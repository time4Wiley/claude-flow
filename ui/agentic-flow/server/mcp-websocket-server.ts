/**
 * MCP WebSocket Server
 * Real implementation following the Model Context Protocol specification
 * Integrates with claude-flow CLI to execute actual tools
 */

import { WebSocketServer, WebSocket } from 'ws';
import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

// JSON-RPC 2.0 Types
interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: any;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: any;
  error?: JsonRpcError;
}

interface JsonRpcError {
  code: number;
  message: string;
  data?: any;
}

interface JsonRpcNotification {
  jsonrpc: '2.0';
  method: string;
  params?: any;
}

// MCP Types
interface MCPToolSchema {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

interface MCPInitializeParams {
  protocolVersion: string;
  capabilities: {
    tools?: Record<string, any>;
    resources?: Record<string, any>;
    prompts?: Record<string, any>;
  };
  clientInfo: {
    name: string;
    version: string;
  };
}

interface MCPConnection {
  id: string;
  ws: WebSocket;
  initialized: boolean;
  capabilities: {
    tools?: Record<string, any>;
    resources?: Record<string, any>;
    prompts?: Record<string, any>;
  };
  activeProcesses: Map<string, ChildProcess>;
}

// Error codes following JSON-RPC 2.0 spec
const ERROR_CODES = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  SERVER_ERROR: -32000,
};

export class MCPWebSocketServer extends EventEmitter {
  private wss: WebSocketServer;
  private connections: Map<string, MCPConnection> = new Map();
  private port: number;
  private toolSchemas: MCPToolSchema[] = [];

  constructor(port: number = 3008) {
    super();
    this.port = port;
    this.wss = new WebSocketServer({ port });
    this.initializeToolSchemas();
    this.setupServer();
  }

  private setupServer(): void {
    console.log(`🚀 MCP WebSocket Server starting on port ${this.port}...`);

    this.wss.on('connection', (ws: WebSocket) => {
      const connectionId = uuidv4();
      console.log(`📱 New MCP connection: ${connectionId}`);

      const connection: MCPConnection = {
        id: connectionId,
        ws,
        initialized: false,
        capabilities: {},
        activeProcesses: new Map(),
      };

      this.connections.set(connectionId, connection);

      ws.on('message', async (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          await this.handleMessage(connection, message);
        } catch (error) {
          console.error('Failed to parse message:', error);
          this.sendError(ws, null, ERROR_CODES.PARSE_ERROR, 'Parse error');
        }
      });

      ws.on('close', () => {
        console.log(`📴 MCP connection closed: ${connectionId}`);
        this.cleanupConnection(connectionId);
      });

      ws.on('error', (error) => {
        console.error(`❌ MCP connection error ${connectionId}:`, error);
      });

      // Send connection notification
      this.sendNotification(ws, 'connection/established', {
        connectionId,
        timestamp: new Date().toISOString(),
      });
    });

    this.wss.on('error', (error) => {
      console.error('❌ WebSocket server error:', error);
    });

    console.log(`✅ MCP WebSocket Server listening on port ${this.port}`);
  }

  private async handleMessage(connection: MCPConnection, message: any): Promise<void> {
    // Validate JSON-RPC format
    if (!this.isValidJsonRpc(message)) {
      this.sendError(connection.ws, message.id || null, ERROR_CODES.INVALID_REQUEST, 'Invalid request');
      return;
    }

    const request = message as JsonRpcRequest;
    console.log(`📨 MCP Request: ${request.method} (id: ${request.id})`);

    try {
      switch (request.method) {
        case 'initialize':
          await this.handleInitialize(connection, request);
          break;

        case 'tools/list':
          await this.handleToolsList(connection, request);
          break;

        case 'tools/call':
          await this.handleToolCall(connection, request);
          break;

        case 'notifications/progress':
        case 'notifications/message':
        case 'notifications/log':
          await this.handleNotification(connection, request);
          break;

        case 'ping':
          this.sendResponse(connection.ws, request.id, { pong: true });
          break;

        default:
          this.sendError(connection.ws, request.id, ERROR_CODES.METHOD_NOT_FOUND, `Method not found: ${request.method}`);
      }
    } catch (error: any) {
      console.error(`Error handling ${request.method}:`, error);
      this.sendError(connection.ws, request.id, ERROR_CODES.INTERNAL_ERROR, error.message || 'Internal error');
    }
  }

  private async handleInitialize(connection: MCPConnection, request: JsonRpcRequest): Promise<void> {
    const params = request.params as MCPInitializeParams;

    // Validate protocol version
    if (!params.protocolVersion || !params.protocolVersion.startsWith('2024')) {
      this.sendError(connection.ws, request.id, ERROR_CODES.INVALID_PARAMS, 'Unsupported protocol version');
      return;
    }

    // Update connection state
    connection.initialized = true;
    connection.capabilities = params.capabilities || {};

    // Send initialization response
    this.sendResponse(connection.ws, request.id, {
      protocolVersion: '2024-11-05',
      capabilities: {
        tools: {},
        resources: {},
        prompts: {},
      },
      serverInfo: {
        name: 'claude-flow-mcp-server',
        version: '2.0.0',
      },
    });

    // Send initialized notification
    this.sendNotification(connection.ws, 'initialized', {
      timestamp: new Date().toISOString(),
    });

    console.log(`✅ MCP connection initialized: ${connection.id}`);
  }

  private async handleToolsList(connection: MCPConnection, request: JsonRpcRequest): Promise<void> {
    if (!connection.initialized) {
      this.sendError(connection.ws, request.id, ERROR_CODES.INVALID_REQUEST, 'Not initialized');
      return;
    }

    // Get fresh tool list
    await this.refreshToolSchemas();

    this.sendResponse(connection.ws, request.id, {
      tools: this.toolSchemas,
    });
  }

  private async handleToolCall(connection: MCPConnection, request: JsonRpcRequest): Promise<void> {
    if (!connection.initialized) {
      this.sendError(connection.ws, request.id, ERROR_CODES.INVALID_REQUEST, 'Not initialized');
      return;
    }

    const { name, arguments: args } = request.params || {};

    if (!name) {
      this.sendError(connection.ws, request.id, ERROR_CODES.INVALID_PARAMS, 'Tool name required');
      return;
    }

    // Find tool schema
    const tool = this.toolSchemas.find(t => t.name === name);
    if (!tool) {
      this.sendError(connection.ws, request.id, ERROR_CODES.INVALID_PARAMS, `Unknown tool: ${name}`);
      return;
    }

    // Execute tool
    try {
      const result = await this.executeClaudeFlowTool(connection, name, args || {}, request.id);
      
      this.sendResponse(connection.ws, request.id, {
        content: [
          {
            type: 'text',
            text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
          },
        ],
      });
    } catch (error: any) {
      this.sendError(connection.ws, request.id, ERROR_CODES.SERVER_ERROR, `Tool execution failed: ${error.message}`);
    }
  }

  private async handleNotification(connection: MCPConnection, request: JsonRpcRequest): Promise<void> {
    // Notifications don't require responses
    console.log(`📢 Notification: ${request.method}`, request.params);
    
    // Emit for logging/monitoring
    this.emit('notification', {
      connectionId: connection.id,
      method: request.method,
      params: request.params,
      timestamp: new Date().toISOString(),
    });
  }

  private async executeClaudeFlowTool(
    connection: MCPConnection,
    toolName: string,
    args: any,
    requestId: string | number
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const processId = uuidv4();
      const startTime = Date.now();

      // Send progress notification
      this.sendNotification(connection.ws, 'tools/call/progress', {
        id: requestId,
        progress: 0,
        message: `Starting ${toolName}...`,
      });

      // Build command
      const { command, commandArgs } = this.buildClaudeFlowCommand(toolName, args);
      console.log(`🔧 Executing: ${command} ${commandArgs.join(' ')}`);

      // Spawn process
      const childProcess = spawn(command, commandArgs, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, NODE_ENV: 'production' },
      });

      connection.activeProcesses.set(processId, childProcess);

      let stdout = '';
      let stderr = '';
      let progressInterval: NodeJS.Timeout;

      // Stream output
      childProcess.stdout?.on('data', (data) => {
        const chunk = data.toString();
        stdout += chunk;

        // Send streaming progress
        this.sendNotification(connection.ws, 'tools/call/output', {
          id: requestId,
          type: 'stdout',
          data: chunk,
        });
      });

      childProcess.stderr?.on('data', (data) => {
        const chunk = data.toString();
        stderr += chunk;

        // Send streaming error
        this.sendNotification(connection.ws, 'tools/call/output', {
          id: requestId,
          type: 'stderr',
          data: chunk,
        });
      });

      // Progress updates
      let progress = 0;
      progressInterval = setInterval(() => {
        progress = Math.min(progress + 10, 90);
        this.sendNotification(connection.ws, 'tools/call/progress', {
          id: requestId,
          progress,
          message: `Executing ${toolName}...`,
        });
      }, 1000);

      childProcess.on('close', (code) => {
        clearInterval(progressInterval);
        connection.activeProcesses.delete(processId);
        const executionTime = Date.now() - startTime;

        // Send completion notification
        this.sendNotification(connection.ws, 'tools/call/progress', {
          id: requestId,
          progress: 100,
          message: `Completed ${toolName}`,
        });

        if (code === 0) {
          // Try to parse JSON output
          let result = stdout.trim();
          try {
            result = JSON.parse(result);
          } catch {
            // Keep as string if not JSON
          }

          resolve(result);
        } else {
          reject(new Error(stderr || `Tool execution failed with code ${code}`));
        }

        // Log execution
        console.log(`✅ Tool ${toolName} completed in ${executionTime}ms`);
      });

      childProcess.on('error', (error) => {
        clearInterval(progressInterval);
        connection.activeProcesses.delete(processId);
        reject(error);
      });

      // Timeout after 5 minutes
      setTimeout(() => {
        if (connection.activeProcesses.has(processId)) {
          childProcess.kill('SIGTERM');
          reject(new Error('Tool execution timeout'));
        }
      }, 300000);
    });
  }

  private buildClaudeFlowCommand(toolName: string, args: any): { command: string; commandArgs: string[] } {
    const command = 'npx';
    const commandArgs = ['claude-flow@alpha'];

    // Remove mcp__claude-flow__ prefix if present
    const cleanToolName = toolName.replace(/^mcp__claude-flow__/, '');

    // Map tool names to claude-flow commands
    switch (cleanToolName) {
      case 'swarm_init':
        // Use 'swarm init' command with proper objective
        commandArgs.push('swarm', args.name || 'Initialize swarm system');
        if (args.topology) commandArgs.push('--mode', args.topology);
        if (args.maxAgents) commandArgs.push('--max-agents', args.maxAgents.toString());
        if (args.strategy) commandArgs.push('--strategy', args.strategy);
        // Add dry-run flag to avoid interactive mode
        commandArgs.push('--dry-run');
        break;

      case 'agent_spawn':
        commandArgs.push('agent', 'spawn');
        if (args.type) commandArgs.push('--type', args.type);
        if (args.name) commandArgs.push('--name', args.name);
        if (args.capabilities) commandArgs.push('--capabilities', args.capabilities.join(','));
        break;

      case 'task_orchestrate':
        commandArgs.push('swarm', args.task || 'default task');
        if (args.strategy) commandArgs.push('--strategy', args.strategy);
        if (args.priority) commandArgs.push('--priority', args.priority);
        break;

      case 'memory_usage':
        commandArgs.push('memory', args.action || 'list');
        if (args.key) commandArgs.push('--key', args.key);
        if (args.value) commandArgs.push('--value', JSON.stringify(args.value));
        if (args.namespace) commandArgs.push('--namespace', args.namespace);
        if (args.ttl) commandArgs.push('--ttl', args.ttl.toString());
        break;

      case 'neural_train':
        commandArgs.push('training', 'neural', 'train');
        if (args.pattern_type) commandArgs.push('--pattern', args.pattern_type);
        if (args.epochs) commandArgs.push('--epochs', args.epochs.toString());
        break;

      case 'performance_report':
        commandArgs.push('analysis', 'performance');
        if (args.format) commandArgs.push('--format', args.format);
        if (args.timeframe) commandArgs.push('--timeframe', args.timeframe);
        break;

      case 'swarm_status':
        commandArgs.push('status');
        if (args.swarmId) commandArgs.push('--swarm', args.swarmId);
        break;

      case 'agent_list':
        commandArgs.push('agent', 'list');
        if (args.swarmId) commandArgs.push('--swarm', args.swarmId);
        break;

      case 'task_status':
        commandArgs.push('task', 'status');
        if (args.taskId) commandArgs.push('--task', args.taskId);
        break;

      case 'github_repo_analyze':
        commandArgs.push('github', 'analyze');
        if (args.repo) commandArgs.push('--repo', args.repo);
        if (args.analysis_type) commandArgs.push('--type', args.analysis_type);
        break;

      case 'workflow_execute':
        commandArgs.push('workflow', 'run');
        if (args.workflowId) commandArgs.push('--workflow', args.workflowId);
        if (args.params) commandArgs.push('--params', JSON.stringify(args.params));
        break;

      case 'sparc_mode':
        commandArgs.push('sparc', args.mode || 'dev');
        if (args.task_description) commandArgs.push(args.task_description);
        if (args.options) {
          Object.entries(args.options).forEach(([key, value]) => {
            commandArgs.push(`--${key}`, String(value));
          });
        }
        break;

      case 'terminal_execute':
        // Special case: direct command execution
        commandArgs.push('exec');
        if (args.command) commandArgs.push(args.command);
        if (args.args && Array.isArray(args.args)) {
          commandArgs.push(...args.args);
        }
        break;

      default:
        // Generic tool execution
        commandArgs.push('mcp', 'execute', cleanToolName);
        if (Object.keys(args).length > 0) {
          commandArgs.push('--params', JSON.stringify(args));
        }
        break;
    }

    return { command, commandArgs };
  }

  private async refreshToolSchemas(): Promise<void> {
    // Initialize with all 87 tools
    this.toolSchemas = this.getAllToolSchemas();
  }

  private initializeToolSchemas(): void {
    this.toolSchemas = this.getAllToolSchemas();
  }

  private getAllToolSchemas(): MCPToolSchema[] {
    return [
      // Coordination Tools
      {
        name: 'mcp__claude-flow__swarm_init',
        description: 'Initialize swarm with topology and configuration',
        inputSchema: {
          type: 'object',
          properties: {
            topology: { type: 'string', enum: ['hierarchical', 'mesh', 'ring', 'star'], description: 'Swarm topology' },
            maxAgents: { type: 'number', description: 'Maximum number of agents', default: 8 },
            strategy: { type: 'string', description: 'Coordination strategy', default: 'auto' },
          },
        },
      },
      {
        name: 'mcp__claude-flow__agent_spawn',
        description: 'Create specialized AI agents',
        inputSchema: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['coordinator', 'researcher', 'coder', 'analyst', 'architect', 'tester', 'reviewer', 'optimizer', 'documenter', 'monitor', 'specialist'], description: 'Agent type' },
            name: { type: 'string', description: 'Agent name' },
            capabilities: { type: 'array', items: { type: 'string' }, description: 'Agent capabilities' },
            swarmId: { type: 'string', description: 'Swarm ID to join' },
          },
        },
      },
      {
        name: 'mcp__claude-flow__task_orchestrate',
        description: 'Orchestrate complex task workflows',
        inputSchema: {
          type: 'object',
          properties: {
            task: { type: 'string', description: 'Task description' },
            priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'], description: 'Task priority' },
            strategy: { type: 'string', enum: ['parallel', 'sequential', 'adaptive', 'balanced'], description: 'Execution strategy' },
            dependencies: { type: 'array', items: { type: 'string' }, description: 'Task dependencies' },
          },
        },
      },

      // Monitoring Tools
      {
        name: 'mcp__claude-flow__swarm_status',
        description: 'Monitor swarm health and performance',
        inputSchema: {
          type: 'object',
          properties: {
            swarmId: { type: 'string', description: 'Swarm ID to monitor' },
          },
        },
      },
      {
        name: 'mcp__claude-flow__agent_list',
        description: 'List active agents & capabilities',
        inputSchema: {
          type: 'object',
          properties: {
            swarmId: { type: 'string', description: 'Filter by swarm ID' },
          },
        },
      },
      {
        name: 'mcp__claude-flow__agent_metrics',
        description: 'Agent performance metrics',
        inputSchema: {
          type: 'object',
          properties: {
            agentId: { type: 'string', description: 'Agent ID to analyze' },
          },
        },
      },
      {
        name: 'mcp__claude-flow__swarm_monitor',
        description: 'Real-time swarm monitoring',
        inputSchema: {
          type: 'object',
          properties: {
            swarmId: { type: 'string', description: 'Swarm ID to monitor' },
            interval: { type: 'number', description: 'Update interval in seconds' },
          },
        },
      },
      {
        name: 'mcp__claude-flow__task_status',
        description: 'Check task execution status',
        inputSchema: {
          type: 'object',
          properties: {
            taskId: { type: 'string', description: 'Task ID to check' },
          },
        },
      },
      {
        name: 'mcp__claude-flow__task_results',
        description: 'Get task completion results',
        inputSchema: {
          type: 'object',
          properties: {
            taskId: { type: 'string', description: 'Task ID to retrieve results' },
          },
        },
      },

      // Memory & Neural Tools
      {
        name: 'mcp__claude-flow__memory_usage',
        description: 'Store/retrieve persistent memory with TTL and namespacing',
        inputSchema: {
          type: 'object',
          properties: {
            action: { type: 'string', enum: ['store', 'retrieve', 'list', 'delete', 'search'], description: 'Memory action' },
            key: { type: 'string', description: 'Memory key' },
            value: { type: 'string', description: 'Value to store' },
            namespace: { type: 'string', description: 'Memory namespace', default: 'default' },
            ttl: { type: 'number', description: 'Time to live in seconds' },
          },
          required: ['action'],
        },
      },
      {
        name: 'mcp__claude-flow__memory_search',
        description: 'Search memory with patterns',
        inputSchema: {
          type: 'object',
          properties: {
            pattern: { type: 'string', description: 'Search pattern' },
            namespace: { type: 'string', description: 'Memory namespace' },
            limit: { type: 'number', description: 'Result limit', default: 10 },
          },
          required: ['pattern'],
        },
      },
      {
        name: 'mcp__claude-flow__neural_train',
        description: 'Train neural patterns with WASM SIMD acceleration',
        inputSchema: {
          type: 'object',
          properties: {
            pattern_type: { type: 'string', enum: ['coordination', 'optimization', 'prediction'], description: 'Pattern type' },
            training_data: { type: 'string', description: 'Training data source', default: 'recent' },
            epochs: { type: 'number', description: 'Training epochs', default: 50 },
          },
        },
      },
      {
        name: 'mcp__claude-flow__neural_status',
        description: 'Check neural network status',
        inputSchema: {
          type: 'object',
          properties: {
            modelId: { type: 'string', description: 'Model ID to check' },
          },
        },
      },
      {
        name: 'mcp__claude-flow__neural_patterns',
        description: 'Analyze cognitive patterns',
        inputSchema: {
          type: 'object',
          properties: {
            action: { type: 'string', enum: ['analyze', 'learn', 'predict'], description: 'Pattern action' },
            operation: { type: 'string', description: 'Operation to analyze' },
            outcome: { type: 'string', description: 'Operation outcome' },
            metadata: { type: 'object', description: 'Additional metadata' },
          },
          required: ['action'],
        },
      },

      // GitHub Integration Tools
      {
        name: 'mcp__claude-flow__github_repo_analyze',
        description: 'Repository analysis',
        inputSchema: {
          type: 'object',
          properties: {
            repo: { type: 'string', description: 'Repository name (owner/repo)' },
            analysis_type: { type: 'string', enum: ['code_quality', 'performance', 'security'], description: 'Analysis type' },
          },
        },
      },
      {
        name: 'mcp__claude-flow__github_pr_manage',
        description: 'Pull request management',
        inputSchema: {
          type: 'object',
          properties: {
            repo: { type: 'string', description: 'Repository name' },
            action: { type: 'string', enum: ['review', 'merge', 'close'], description: 'PR action' },
            pr_number: { type: 'number', description: 'Pull request number' },
          },
        },
      },
      {
        name: 'mcp__claude-flow__github_issue_track',
        description: 'Issue tracking & triage',
        inputSchema: {
          type: 'object',
          properties: {
            repo: { type: 'string', description: 'Repository name' },
            action: { type: 'string', description: 'Issue action' },
          },
        },
      },
      {
        name: 'mcp__claude-flow__github_code_review',
        description: 'Automated code review',
        inputSchema: {
          type: 'object',
          properties: {
            repo: { type: 'string', description: 'Repository name' },
            pr: { type: 'number', description: 'Pull request number' },
          },
        },
      },

      // System Tools
      {
        name: 'mcp__claude-flow__performance_report',
        description: 'Generate performance reports with real-time metrics',
        inputSchema: {
          type: 'object',
          properties: {
            format: { type: 'string', enum: ['summary', 'detailed', 'json'], description: 'Report format' },
            timeframe: { type: 'string', enum: ['24h', '7d', '30d'], description: 'Time frame' },
          },
        },
      },
      {
        name: 'mcp__claude-flow__bottleneck_analyze',
        description: 'Identify performance bottlenecks',
        inputSchema: {
          type: 'object',
          properties: {
            component: { type: 'string', description: 'Component to analyze' },
            metrics: { type: 'array', items: { type: 'string' }, description: 'Metrics to check' },
          },
        },
      },
      {
        name: 'mcp__claude-flow__terminal_execute',
        description: 'Execute terminal commands',
        inputSchema: {
          type: 'object',
          properties: {
            command: { type: 'string', description: 'Command to execute' },
            args: { type: 'array', items: { type: 'string' }, description: 'Command arguments' },
          },
        },
      },
      {
        name: 'mcp__claude-flow__benchmark_run',
        description: 'Performance benchmarks',
        inputSchema: {
          type: 'object',
          properties: {
            suite: { type: 'string', description: 'Benchmark suite to run' },
          },
        },
      },

      // Workflow Tools
      {
        name: 'mcp__claude-flow__workflow_create',
        description: 'Create custom workflows',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Workflow name' },
            steps: { type: 'array', description: 'Workflow steps' },
            triggers: { type: 'array', description: 'Workflow triggers' },
          },
          required: ['name', 'steps'],
        },
      },
      {
        name: 'mcp__claude-flow__workflow_execute',
        description: 'Execute predefined workflows',
        inputSchema: {
          type: 'object',
          properties: {
            workflowId: { type: 'string', description: 'Workflow ID' },
            params: { type: 'object', description: 'Workflow parameters' },
          },
        },
      },

      // DAA Tools
      {
        name: 'mcp__claude-flow__daa_agent_create',
        description: 'Create dynamic agents',
        inputSchema: {
          type: 'object',
          properties: {
            agent_type: { type: 'string', description: 'Agent type' },
            capabilities: { type: 'array', items: { type: 'string' }, description: 'Agent capabilities' },
            resources: { type: 'object', description: 'Resource allocation' },
          },
          required: ['agent_type'],
        },
      },
      {
        name: 'mcp__claude-flow__daa_capability_match',
        description: 'Match capabilities to tasks',
        inputSchema: {
          type: 'object',
          properties: {
            task_requirements: { type: 'array', description: 'Required capabilities' },
            available_agents: { type: 'array', description: 'Available agents' },
          },
          required: ['task_requirements'],
        },
      },

      // SPARC Development Modes
      {
        name: 'mcp__claude-flow__sparc_mode',
        description: 'Run SPARC development modes',
        inputSchema: {
          type: 'object',
          properties: {
            mode: { type: 'string', enum: ['dev', 'api', 'ui', 'test', 'refactor'], description: 'SPARC mode' },
            task_description: { type: 'string', description: 'Task description' },
            options: { type: 'object', description: 'Mode options' },
          },
        },
      },

      // Additional coordination tools
      {
        name: 'mcp__claude-flow__topology_optimize',
        description: 'Auto-optimize swarm topology',
        inputSchema: {
          type: 'object',
          properties: {
            swarmId: { type: 'string', description: 'Swarm ID to optimize' },
          },
        },
      },
      {
        name: 'mcp__claude-flow__load_balance',
        description: 'Distribute tasks efficiently',
        inputSchema: {
          type: 'object',
          properties: {
            swarmId: { type: 'string', description: 'Swarm ID' },
            tasks: { type: 'array', description: 'Tasks to distribute' },
          },
        },
      },
      {
        name: 'mcp__claude-flow__coordination_sync',
        description: 'Sync agent coordination',
        inputSchema: {
          type: 'object',
          properties: {
            swarmId: { type: 'string', description: 'Swarm ID to sync' },
          },
        },
      },
      {
        name: 'mcp__claude-flow__swarm_scale',
        description: 'Auto-scale agent count',
        inputSchema: {
          type: 'object',
          properties: {
            swarmId: { type: 'string', description: 'Swarm ID' },
            targetSize: { type: 'number', description: 'Target agent count' },
          },
        },
      },
      {
        name: 'mcp__claude-flow__swarm_destroy',
        description: 'Gracefully shutdown swarm',
        inputSchema: {
          type: 'object',
          properties: {
            swarmId: { type: 'string', description: 'Swarm ID to destroy' },
          },
        },
      },

      // Memory management tools
      {
        name: 'mcp__claude-flow__memory_persist',
        description: 'Cross-session persistence',
        inputSchema: {
          type: 'object',
          properties: {
            sessionId: { type: 'string', description: 'Session ID' },
          },
        },
      },
      {
        name: 'mcp__claude-flow__memory_namespace',
        description: 'Namespace management',
        inputSchema: {
          type: 'object',
          properties: {
            namespace: { type: 'string', description: 'Namespace name' },
            action: { type: 'string', description: 'Namespace action' },
          },
        },
      },
      {
        name: 'mcp__claude-flow__memory_backup',
        description: 'Backup memory stores',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Backup path' },
          },
        },
      },
      {
        name: 'mcp__claude-flow__memory_restore',
        description: 'Restore from backups',
        inputSchema: {
          type: 'object',
          properties: {
            backupPath: { type: 'string', description: 'Backup path to restore' },
          },
        },
      },
      {
        name: 'mcp__claude-flow__memory_compress',
        description: 'Compress memory data',
        inputSchema: {
          type: 'object',
          properties: {
            namespace: { type: 'string', description: 'Namespace to compress' },
          },
        },
      },
      {
        name: 'mcp__claude-flow__memory_sync',
        description: 'Sync across instances',
        inputSchema: {
          type: 'object',
          properties: {
            target: { type: 'string', description: 'Sync target' },
          },
        },
      },
      {
        name: 'mcp__claude-flow__cache_manage',
        description: 'Manage coordination cache',
        inputSchema: {
          type: 'object',
          properties: {
            action: { type: 'string', description: 'Cache action' },
            key: { type: 'string', description: 'Cache key' },
          },
        },
      },
      {
        name: 'mcp__claude-flow__state_snapshot',
        description: 'Create state snapshots',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Snapshot name' },
          },
        },
      },
      {
        name: 'mcp__claude-flow__context_restore',
        description: 'Restore execution context',
        inputSchema: {
          type: 'object',
          properties: {
            snapshotId: { type: 'string', description: 'Snapshot ID to restore' },
          },
        },
      },
      {
        name: 'mcp__claude-flow__memory_analytics',
        description: 'Analyze memory usage',
        inputSchema: {
          type: 'object',
          properties: {
            timeframe: { type: 'string', description: 'Analysis timeframe' },
          },
        },
      },

      // Neural network tools
      {
        name: 'mcp__claude-flow__neural_predict',
        description: 'Make AI predictions',
        inputSchema: {
          type: 'object',
          properties: {
            modelId: { type: 'string', description: 'Model ID' },
            input: { type: 'string', description: 'Input data' },
          },
        },
      },
      {
        name: 'mcp__claude-flow__model_load',
        description: 'Load pre-trained models',
        inputSchema: {
          type: 'object',
          properties: {
            modelPath: { type: 'string', description: 'Model file path' },
          },
        },
      },
      {
        name: 'mcp__claude-flow__model_save',
        description: 'Save trained models',
        inputSchema: {
          type: 'object',
          properties: {
            modelId: { type: 'string', description: 'Model ID' },
            path: { type: 'string', description: 'Save path' },
          },
        },
      },
      {
        name: 'mcp__claude-flow__wasm_optimize',
        description: 'WASM SIMD optimization',
        inputSchema: {
          type: 'object',
          properties: {
            operation: { type: 'string', description: 'Operation to optimize' },
          },
        },
      },
      {
        name: 'mcp__claude-flow__inference_run',
        description: 'Run neural inference',
        inputSchema: {
          type: 'object',
          properties: {
            modelId: { type: 'string', description: 'Model ID' },
            data: { type: 'array', description: 'Input data' },
          },
        },
      },
      {
        name: 'mcp__claude-flow__pattern_recognize',
        description: 'Pattern recognition',
        inputSchema: {
          type: 'object',
          properties: {
            data: { type: 'array', description: 'Data to analyze' },
            patterns: { type: 'array', description: 'Patterns to recognize' },
          },
        },
      },
      {
        name: 'mcp__claude-flow__cognitive_analyze',
        description: 'Cognitive behavior analysis',
        inputSchema: {
          type: 'object',
          properties: {
            behavior: { type: 'string', description: 'Behavior to analyze' },
          },
        },
      },
      {
        name: 'mcp__claude-flow__learning_adapt',
        description: 'Adaptive learning',
        inputSchema: {
          type: 'object',
          properties: {
            experience: { type: 'object', description: 'Learning experience' },
          },
        },
      },
      {
        name: 'mcp__claude-flow__neural_compress',
        description: 'Compress neural models',
        inputSchema: {
          type: 'object',
          properties: {
            modelId: { type: 'string', description: 'Model ID' },
            ratio: { type: 'number', description: 'Compression ratio' },
          },
        },
      },
      {
        name: 'mcp__claude-flow__ensemble_create',
        description: 'Create model ensembles',
        inputSchema: {
          type: 'object',
          properties: {
            models: { type: 'array', description: 'Models to ensemble' },
            strategy: { type: 'string', description: 'Ensemble strategy' },
          },
        },
      },
      {
        name: 'mcp__claude-flow__transfer_learn',
        description: 'Transfer learning',
        inputSchema: {
          type: 'object',
          properties: {
            sourceModel: { type: 'string', description: 'Source model' },
            targetDomain: { type: 'string', description: 'Target domain' },
          },
        },
      },
      {
        name: 'mcp__claude-flow__neural_explain',
        description: 'AI explainability',
        inputSchema: {
          type: 'object',
          properties: {
            modelId: { type: 'string', description: 'Model ID' },
            prediction: { type: 'object', description: 'Prediction to explain' },
          },
        },
      },
      {
        name: 'mcp__claude-flow__neural_sync',
        description: 'Synchronize neural networks',
        inputSchema: {
          type: 'object',
          properties: {
            sourceModel: { type: 'string', description: 'Source model' },
            targetModel: { type: 'string', description: 'Target model' },
          },
        },
      },

      // GitHub additional tools
      {
        name: 'mcp__claude-flow__github_release_coord',
        description: 'Release coordination',
        inputSchema: {
          type: 'object',
          properties: {
            repo: { type: 'string', description: 'Repository name' },
            version: { type: 'string', description: 'Release version' },
          },
        },
      },
      {
        name: 'mcp__claude-flow__github_workflow_auto',
        description: 'Workflow automation',
        inputSchema: {
          type: 'object',
          properties: {
            repo: { type: 'string', description: 'Repository name' },
            workflow: { type: 'object', description: 'Workflow configuration' },
          },
        },
      },
      {
        name: 'mcp__claude-flow__github_sync_coord',
        description: 'Multi-repo sync coordination',
        inputSchema: {
          type: 'object',
          properties: {
            repos: { type: 'array', description: 'Repositories to sync' },
          },
        },
      },
      {
        name: 'mcp__claude-flow__github_metrics',
        description: 'Repository metrics',
        inputSchema: {
          type: 'object',
          properties: {
            repo: { type: 'string', description: 'Repository name' },
          },
        },
      },

      // System monitoring tools
      {
        name: 'mcp__claude-flow__token_usage',
        description: 'Analyze token consumption',
        inputSchema: {
          type: 'object',
          properties: {
            operation: { type: 'string', description: 'Operation to analyze' },
            timeframe: { type: 'string', description: 'Timeframe', default: '24h' },
          },
        },
      },
      {
        name: 'mcp__claude-flow__metrics_collect',
        description: 'Collect system metrics',
        inputSchema: {
          type: 'object',
          properties: {
            components: { type: 'array', description: 'Components to monitor' },
          },
        },
      },
      {
        name: 'mcp__claude-flow__trend_analysis',
        description: 'Analyze performance trends',
        inputSchema: {
          type: 'object',
          properties: {
            metric: { type: 'string', description: 'Metric to analyze' },
            period: { type: 'string', description: 'Analysis period' },
          },
          required: ['metric'],
        },
      },
      {
        name: 'mcp__claude-flow__cost_analysis',
        description: 'Cost and resource analysis',
        inputSchema: {
          type: 'object',
          properties: {
            timeframe: { type: 'string', description: 'Analysis timeframe' },
          },
        },
      },
      {
        name: 'mcp__claude-flow__quality_assess',
        description: 'Quality assessment',
        inputSchema: {
          type: 'object',
          properties: {
            target: { type: 'string', description: 'Target to assess' },
            criteria: { type: 'array', description: 'Assessment criteria' },
          },
          required: ['target', 'criteria'],
        },
      },
      {
        name: 'mcp__claude-flow__error_analysis',
        description: 'Error pattern analysis',
        inputSchema: {
          type: 'object',
          properties: {
            logs: { type: 'array', description: 'Log entries to analyze' },
          },
        },
      },
      {
        name: 'mcp__claude-flow__usage_stats',
        description: 'Usage statistics',
        inputSchema: {
          type: 'object',
          properties: {
            component: { type: 'string', description: 'Component to analyze' },
          },
        },
      },
      {
        name: 'mcp__claude-flow__health_check',
        description: 'System health monitoring',
        inputSchema: {
          type: 'object',
          properties: {
            components: { type: 'array', description: 'Components to check' },
          },
        },
      },
      {
        name: 'mcp__claude-flow__config_manage',
        description: 'Configuration management',
        inputSchema: {
          type: 'object',
          properties: {
            action: { type: 'string', description: 'Config action' },
            config: { type: 'object', description: 'Configuration data' },
          },
        },
      },
      {
        name: 'mcp__claude-flow__security_scan',
        description: 'Security scanning',
        inputSchema: {
          type: 'object',
          properties: {
            target: { type: 'string', description: 'Scan target' },
            depth: { type: 'string', description: 'Scan depth' },
          },
        },
      },
      {
        name: 'mcp__claude-flow__backup_create',
        description: 'Create system backups',
        inputSchema: {
          type: 'object',
          properties: {
            components: { type: 'array', description: 'Components to backup' },
            destination: { type: 'string', description: 'Backup destination' },
          },
        },
      },
      {
        name: 'mcp__claude-flow__restore_system',
        description: 'System restoration',
        inputSchema: {
          type: 'object',
          properties: {
            backupId: { type: 'string', description: 'Backup ID to restore' },
          },
        },
      },
      {
        name: 'mcp__claude-flow__log_analysis',
        description: 'Log analysis & insights',
        inputSchema: {
          type: 'object',
          properties: {
            logFile: { type: 'string', description: 'Log file path' },
            patterns: { type: 'array', description: 'Patterns to search' },
          },
        },
      },
      {
        name: 'mcp__claude-flow__diagnostic_run',
        description: 'System diagnostics',
        inputSchema: {
          type: 'object',
          properties: {
            components: { type: 'array', description: 'Components to diagnose' },
          },
        },
      },
      {
        name: 'mcp__claude-flow__features_detect',
        description: 'Feature detection',
        inputSchema: {
          type: 'object',
          properties: {
            component: { type: 'string', description: 'Component to check' },
          },
        },
      },

      // DAA additional tools
      {
        name: 'mcp__claude-flow__daa_resource_alloc',
        description: 'Resource allocation',
        inputSchema: {
          type: 'object',
          properties: {
            resources: { type: 'object', description: 'Resources to allocate' },
            agents: { type: 'array', description: 'Target agents' },
          },
          required: ['resources'],
        },
      },
      {
        name: 'mcp__claude-flow__daa_lifecycle_manage',
        description: 'Agent lifecycle management',
        inputSchema: {
          type: 'object',
          properties: {
            agentId: { type: 'string', description: 'Agent ID' },
            action: { type: 'string', description: 'Lifecycle action' },
          },
          required: ['agentId', 'action'],
        },
      },
      {
        name: 'mcp__claude-flow__daa_communication',
        description: 'Inter-agent communication',
        inputSchema: {
          type: 'object',
          properties: {
            from: { type: 'string', description: 'Source agent' },
            to: { type: 'string', description: 'Target agent' },
            message: { type: 'object', description: 'Message content' },
          },
          required: ['from', 'to', 'message'],
        },
      },
      {
        name: 'mcp__claude-flow__daa_consensus',
        description: 'Consensus mechanisms',
        inputSchema: {
          type: 'object',
          properties: {
            agents: { type: 'array', description: 'Participating agents' },
            proposal: { type: 'object', description: 'Proposal for consensus' },
          },
          required: ['agents', 'proposal'],
        },
      },
      {
        name: 'mcp__claude-flow__daa_fault_tolerance',
        description: 'Fault tolerance & recovery',
        inputSchema: {
          type: 'object',
          properties: {
            agentId: { type: 'string', description: 'Agent ID' },
            strategy: { type: 'string', description: 'Recovery strategy' },
          },
          required: ['agentId'],
        },
      },
      {
        name: 'mcp__claude-flow__daa_optimization',
        description: 'Performance optimization',
        inputSchema: {
          type: 'object',
          properties: {
            target: { type: 'string', description: 'Optimization target' },
            metrics: { type: 'array', description: 'Metrics to optimize' },
          },
        },
      },

      // Agent management tools
      {
        name: 'mcp__claude-flow__remove_agent',
        description: 'Remove agent from swarm',
        inputSchema: {
          type: 'object',
          properties: {
            agentId: { type: 'string', description: 'Agent ID to remove' },
          },
        },
      },
      {
        name: 'mcp__claude-flow__cancel_task',
        description: 'Cancel running task',
        inputSchema: {
          type: 'object',
          properties: {
            taskId: { type: 'string', description: 'Task ID to cancel' },
          },
        },
      },
    ];
  }

  private isValidJsonRpc(message: any): boolean {
    return (
      message &&
      typeof message === 'object' &&
      message.jsonrpc === '2.0' &&
      (message.id !== undefined || message.method !== undefined)
    );
  }

  private sendResponse(ws: WebSocket, id: string | number, result: any): void {
    const response: JsonRpcResponse = {
      jsonrpc: '2.0',
      id,
      result,
    };
    ws.send(JSON.stringify(response));
  }

  private sendError(ws: WebSocket, id: string | number | null, code: number, message: string, data?: any): void {
    const response: JsonRpcResponse = {
      jsonrpc: '2.0',
      id: id || 0,
      error: { code, message, data },
    };
    ws.send(JSON.stringify(response));
  }

  private sendNotification(ws: WebSocket, method: string, params?: any): void {
    const notification: JsonRpcNotification = {
      jsonrpc: '2.0',
      method,
      params,
    };
    ws.send(JSON.stringify(notification));
  }

  private cleanupConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    // Kill all active processes
    const activeProcesses = Array.from(connection.activeProcesses.entries());
    for (const [processId, childProcess] of activeProcesses) {
      console.log(`🔪 Killing process ${processId}`);
      childProcess.kill('SIGTERM');
    }

    this.connections.delete(connectionId);
  }

  public stop(): void {
    console.log('🛑 Stopping MCP WebSocket Server...');

    // Close all connections
    const connections = Array.from(this.connections.entries());
    for (const [id, connection] of connections) {
      connection.ws.close();
      this.cleanupConnection(id);
    }

    // Close server
    this.wss.close(() => {
      console.log('✅ MCP WebSocket Server stopped');
    });
  }

  public getStats(): {
    connections: number;
    activeProcesses: number;
    port: number;
  } {
    let totalProcesses = 0;
    const connections = Array.from(this.connections.values());
    for (const connection of connections) {
      totalProcesses += connection.activeProcesses.size;
    }

    return {
      connections: this.connections.size,
      activeProcesses: totalProcesses,
      port: this.port,
    };
  }
}

// Export for use as module
export default MCPWebSocketServer;