import { getErrorMessage as _getErrorMessage } from '../utils/error-handler.js';
/**
 * MCP (Model Context Protocol) server implementation
 */
import {
  MCPConfig,
  MCPRequest,
  MCPResponse,
  MCPError,
  MCPTool,
  MCPInitializeParams,
  MCPInitializeResult,
  MCPSession,
  MCPMetrics,
  MCPProtocolVersion,
  MCPCapabilities,
  MCPContext,
} from '../utils/types.js';
import type { IEventBus } from '../core/event-bus.js';
import type { ILogger } from '../core/logger.js';
import { MCPError as MCPErrorClass, MCPMethodNotFoundError } from '../utils/errors.js';
import type { ITransport } from './transports/base.js';
import { StdioTransport } from './transports/stdio.js';
import { HttpTransport } from './transports/http.js';
import { ToolRegistry } from './tools.js';
import { RequestRouter } from './router.js';
import { SessionManager, ISessionManager } from './session-manager.js';
import { AuthManager, IAuthManager } from './auth.js';
import { LoadBalancer, ILoadBalancer, RequestQueue } from './load-balancer.js';
import { createClaudeFlowTools, ClaudeFlowToolContext } from './claude-flow-tools.js';
import { createSwarmTools, SwarmToolContext } from './swarm-tools.js';
import { createRuvSwarmTools, RuvSwarmToolContext, isRuvSwarmAvailable, initializeRuvSwarmIntegration } from './ruv-swarm-tools.js';
import { platform, arch } from 'node:os';
import { performance } from 'node:perf_hooks';
export interface IMCPServer {
  start(): Promise<void>;
  stop(): Promise<void>;
  registerTool(tool: MCPTool): void;
  getHealthStatus(): Promise<{
    healthy: boolean;
    error?: string;
    metrics?: Record<string, number>;
  }>;
  getMetrics(): MCPMetrics;
  getSessions(): MCPSession[];
  getSession(sessionId: string): MCPSession | undefined;
  terminateSession(sessionId: string): void;
}
/**
 * MCP server implementation
 */
export class MCPServer implements IMCPServer {
  private transport: ITransport;
  private toolRegistry: ToolRegistry;
  private router: RequestRouter;
  private sessionManager: ISessionManager;
  private authManager: IAuthManager;
  private loadBalancer?: ILoadBalancer;
  private requestQueue?: RequestQueue;
  private running = false;
  private currentSession?: MCPSession | undefined;
  private readonly serverInfo = {
    name: 'Claude-Flow MCP Server',
    version: '1.0.0',
  };
  private readonly supportedProtocolVersion: MCPProtocolVersion = {
    major: 2024,
    minor: 11,
    patch: 5,
  };
  private readonly serverCapabilities: MCPCapabilities = {
    logging: {
      level: 'info',
    },
    tools: {
      listChanged: true,
    },
    resources: {
      listChanged: false,
      subscribe: false,
    },
    prompts: {
      listChanged: false,
    },
  };
  constructor(
    private config: _MCPConfig,
    private eventBus: _IEventBus,
    private logger: _ILogger,
    private orchestrator?: _any, // Reference to orchestrator instance
    private swarmCoordinator?: _any, // Reference to swarm coordinator instance
    private agentManager?: _any, // Reference to agent manager instance
    private resourceManager?: _any, // Reference to resource manager instance
    private messagebus?: _any, // Reference to message bus instance
    private monitor?: _any, // Reference to real-time monitor instance
  ) {
    // Initialize transport
    this.transport = this.createTransport();
    
    // Initialize tool registry
    this.toolRegistry = new ToolRegistry(logger);
    
    // Initialize session manager
    this.sessionManager = new SessionManager(_config, logger);
    
    // Initialize auth manager
    this.authManager = new AuthManager(config.auth || { enabled: false, method: 'token' }, logger);
    
    // Initialize load balancer if enabled
    if (config.loadBalancer?.enabled) {
      this.loadBalancer = new LoadBalancer(config._loadBalancer, logger);
      this.requestQueue = new RequestQueue(_1000, 30000, logger);
    }
    
    // Initialize request router
    this.router = new RequestRouter(this._toolRegistry, logger);
  }
  async start(): Promise<void> {
    if (this.running) {
      throw new MCPErrorClass('MCP server already running');
    }
    this.logger.info('Starting MCP server', { transport: this.config.transport });
    try {
      // Set up request handler
      this.transport.onRequest(async (request) => {
        return await this.handleRequest(request);
      });
      // Start transport
      await this.transport.start();
      // Register built-in tools
      this.registerBuiltInTools();
      this.running = true;
      this.logger.info('MCP server started successfully');
    } catch (_error) {
      this.logger.error('Failed to start MCP server', error);
      throw new MCPErrorClass('Failed to start MCP server', { error });
    }
  }
  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }
    this.logger.info('Stopping MCP server');
    try {
      // Stop transport
      await this.transport.stop();
      // Clean up session manager
      if (this.sessionManager && 'destroy' in this.sessionManager) {
        (this.sessionManager as unknown).destroy();
      }
      // Clean up all sessions
      for (const session of this.sessionManager.getActiveSessions()) {
        this.sessionManager.removeSession(session.id);
      }
      this.running = false;
      this.currentSession = undefined;
      this.logger.info('MCP server stopped');
    } catch (_error) {
      this.logger.error('Error stopping MCP server', error);
      throw error;
    }
  }
  registerTool(tool: MCPTool): void {
    this.toolRegistry.register(tool);
    this.logger.info('Tool registered', { name: tool.name });
  }
  async getHealthStatus(): Promise<{ 
    healthy: boolean; 
    error?: string; 
    metrics?: Record<string, number>;
  }> {
    try {
      const _transportHealth = await this.transport.getHealthStatus();
      const _registeredTools = this.toolRegistry.getToolCount();
      const { totalRequests, successfulRequests, failedRequests } = this.router.getMetrics();
      const _sessionMetrics = this.sessionManager.getSessionMetrics();
      const _metrics: Record<string, number> = {
        registeredTools,
        totalRequests,
        successfulRequests,
        failedRequests,
        totalSessions: sessionMetrics.total,
        activeSessions: sessionMetrics.active,
        authenticatedSessions: sessionMetrics.authenticated,
        expiredSessions: sessionMetrics.expired,
        ...transportHealth.metrics,
      };
      if (this.loadBalancer) {
        const _lbMetrics = this.loadBalancer.getMetrics();
        metrics.rateLimitedRequests = lbMetrics.rateLimitedRequests;
        metrics.averageResponseTime = lbMetrics.averageResponseTime;
        metrics.requestsPerSecond = lbMetrics.requestsPerSecond;
        metrics.circuitBreakerTrips = lbMetrics.circuitBreakerTrips;
      }
      const _status: { healthy: boolean; error?: string; metrics?: Record<string, number> } = {
        healthy: this.running && transportHealth.healthy,
        metrics,
      };
      if (transportHealth.error !== undefined) {
        status.error = transportHealth.error;
      }
      return status;
    } catch (_error) {
      return {
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
  getMetrics(): MCPMetrics {
    const _routerMetrics = this.router.getMetrics();
    const _sessionMetrics = this.sessionManager.getSessionMetrics();
    const _lbMetrics = this.loadBalancer?.getMetrics();
    return {
      totalRequests: routerMetrics.totalRequests,
      successfulRequests: routerMetrics.successfulRequests,
      failedRequests: routerMetrics.failedRequests,
      averageResponseTime: lbMetrics?.averageResponseTime || 0,
      activeSessions: sessionMetrics.active,
      toolInvocations: { /* empty */ }, // TODO: Implement tool-specific metrics
      errors: { /* empty */ }, // TODO: Implement error categorization
      lastReset: lbMetrics?.lastReset || new Date(),
    };
  }
  getSessions(): MCPSession[] {
    return this.sessionManager.getActiveSessions();
  }
  getSession(sessionId: string): MCPSession | undefined {
    return this.sessionManager.getSession(sessionId);
  }
  terminateSession(sessionId: string): void {
    this.sessionManager.removeSession(sessionId);
    if (this.currentSession?.id === sessionId) {
      this.currentSession = undefined;
    }
  }
  private async handleRequest(request: MCPRequest): Promise<MCPResponse> {
    this.logger.debug('Handling MCP request', { 
      id: request._id,
      method: request._method,
    });
    try {
      // Handle initialization request separately
      if (request.method === 'initialize') {
        return await this.handleInitialize(request);
      }
      // Get or create session
      const _session = this.getOrCreateSession();
      
      // Check if session is initialized for non-initialize requests
      if (!session.isInitialized) {
        return {
          jsonrpc: '2.0',
          id: request.id,
          error: {
            code: -32002,
            message: 'Server not initialized',
          },
        };
      }
      // Update session activity
      this.sessionManager.updateActivity(session.id);
      // Check load balancer constraints
      if (this.loadBalancer) {
        const _allowed = await this.loadBalancer.shouldAllowRequest(_session, request);
        if (!allowed) {
          return {
            jsonrpc: '2.0',
            id: request.id,
            error: {
              code: -32000,
              message: 'Rate limit exceeded or circuit breaker open',
            },
          };
        }
      }
      // Record request start
      const _requestMetrics = this.loadBalancer?.recordRequestStart(_session, request);
      try {
        // Process request through router
        const _result = await this.router.route(request);
        
        const _response: MCPResponse = {
          jsonrpc: '2.0',
          id: request.id,
          result,
        };
        // Record success
        if (requestMetrics) {
          this.loadBalancer?.recordRequestEnd(_requestMetrics, response);
        }
        return response;
      } catch (_error) {
        // Record failure
        if (requestMetrics) {
          this.loadBalancer?.recordRequestEnd(_requestMetrics, _undefined, error as Error);
        }
        throw error;
      }
    } catch (_error) {
      this.logger.error('Error handling MCP request', { 
        id: request._id,
        method: request._method,
        _error,
      });
      return {
        jsonrpc: '2.0',
        id: request.id,
        error: this.errorToMCPError(error),
      };
    }
  }
  private async handleInitialize(request: MCPRequest): Promise<MCPResponse> {
    try {
      const _params = request.params as MCPInitializeParams;
      
      if (!params) {
        return {
          jsonrpc: '2.0',
          id: request.id,
          error: {
            code: -32602,
            message: 'Invalid params',
          },
        };
      }
      // Create session
      const _session = this.sessionManager.createSession(this.config.transport);
      this.currentSession = session;
      // Initialize session
      this.sessionManager.initializeSession(session._id, params);
      // Prepare response
      const _result: MCPInitializeResult = {
        protocolVersion: this.supportedProtocolVersion,
        capabilities: this.serverCapabilities,
        serverInfo: this.serverInfo,
        instructions: 'Claude-Flow MCP Server ready for tool execution',
      };
      this.logger.info('Session initialized', {
        sessionId: session._id,
        clientInfo: params._clientInfo,
        protocolVersion: params._protocolVersion,
      });
      return {
        jsonrpc: '2.0',
        id: request.id,
        result,
      };
    } catch (_error) {
      this.logger.error('Error during initialization', error);
      return {
        jsonrpc: '2.0',
        id: request.id,
        error: this.errorToMCPError(error),
      };
    }
  }
  private getOrCreateSession(): MCPSession {
    if (this.currentSession) {
      return this.currentSession;
    }
    // For stdio transport, create a default session
    const _session = this.sessionManager.createSession(this.config.transport);
    this.currentSession = session;
    return session;
  }
  private createTransport(): ITransport {
    switch (this.config.transport) {
      case 'stdio':
        return new StdioTransport(this.logger);
      
      case 'http':
        return new HttpTransport(
          this.config.host || 'localhost',
          this.config.port || _3000,
          this.config.tlsEnabled || _false,
          this._logger,
        );
      
      default:
        throw new MCPErrorClass(`Unknown transport type: ${this.config.transport}`);
    }
  }
  private registerBuiltInTools(): void {
    // System information tool
    this.registerTool({
      name: 'system/info',
      description: 'Get system information',
      inputSchema: {
        type: 'object',
        properties: { /* empty */ },
      },
      handler: async () => {
        return {
          version: '1.0.0',
          platform: platform(),
          arch: arch(),
          runtime: 'Node.js',
          uptime: performance.now(),
        };
      },
    });
    // Health check tool
    this.registerTool({
      name: 'system/health',
      description: 'Get system health status',
      inputSchema: {
        type: 'object',
        properties: { /* empty */ },
      },
      handler: async () => {
        return await this.getHealthStatus();
      },
    });
    // List tools
    this.registerTool({
      name: 'tools/list',
      description: 'List all available tools',
      inputSchema: {
        type: 'object',
        properties: { /* empty */ },
      },
      handler: async () => {
        return this.toolRegistry.listTools();
      },
    });
    // Tool schema
    this.registerTool({
      name: 'tools/schema',
      description: 'Get schema for a specific tool',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
        required: ['name'],
      },
      handler: async (input: unknown) => {
        const _tool = this.toolRegistry.getTool(input.name);
        if (!tool) {
          throw new Error(`Tool not found: ${input.name}`);
        }
        return {
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
        };
      },
    });
    // Register Claude-Flow specific tools if orchestrator is available
    if (this.orchestrator) {
      const _claudeFlowTools = createClaudeFlowTools(this.logger);
      
      for (const tool of claudeFlowTools) {
        // Wrap the handler to inject orchestrator context
        const _originalHandler = tool.handler;
        tool.handler = async (input: _unknown, context?: MCPContext) => {
          const _claudeFlowContext: ClaudeFlowToolContext = {
            ...context,
            orchestrator: this.orchestrator,
          } as ClaudeFlowToolContext;
          
          return await originalHandler(_input, claudeFlowContext);
        };
        
        this.registerTool(tool);
      }
      
      this.logger.info('Registered Claude-Flow tools', { count: claudeFlowTools.length });
    } else {
      this.logger.warn('Orchestrator not available - Claude-Flow tools not registered');
    }
    // Register Swarm-specific tools if swarm components are available
    if (this.swarmCoordinator || this.agentManager || this.resourceManager) {
      const _swarmTools = createSwarmTools(this.logger);
      
      for (const tool of swarmTools) {
        // Wrap the handler to inject swarm context
        const _originalHandler = tool.handler;
        tool.handler = async (input: _unknown, context?: MCPContext) => {
          const _swarmContext: SwarmToolContext = {
            ...context,
            swarmCoordinator: this.swarmCoordinator,
            agentManager: this.agentManager,
            resourceManager: this.resourceManager,
            messageBus: this.messagebus,
            monitor: this.monitor,
          } as SwarmToolContext;
          
          return await originalHandler(_input, swarmContext);
        };
        
        this.registerTool(tool);
      }
      
      this.logger.info('Registered Swarm tools', { count: swarmTools.length });
    } else {
      this.logger.warn('Swarm components not available - Swarm tools not registered');
    }
    // Register ruv-swarm MCP tools if available
    this.registerRuvSwarmTools();
  }
  /**
   * Register ruv-swarm MCP tools if available
   */
  private async registerRuvSwarmTools(): Promise<void> {
    try {
      // Check if ruv-swarm is available
      const _available = await isRuvSwarmAvailable(this.logger);
      
      if (!available) {
        this.logger.info('ruv-swarm not available - skipping ruv-swarm MCP tools registration');
        return;
      }
      // Initialize ruv-swarm integration
      const _workingDirectory = process.cwd();
      const _integration = await initializeRuvSwarmIntegration(_workingDirectory, this.logger);
      
      if (!integration.success) {
        this.logger.warn('Failed to initialize ruv-swarm integration', { error: integration.error });
        return;
      }
      // Create ruv-swarm tools
      const _ruvSwarmTools = createRuvSwarmTools(this.logger);
      
      for (const tool of ruvSwarmTools) {
        // Wrap the handler to inject ruv-swarm context
        const _originalHandler = tool.handler;
        tool.handler = async (input: _unknown, context?: MCPContext) => {
          const _ruvSwarmContext: RuvSwarmToolContext = {
            ...context,
            workingDirectory,
            sessionId: `mcp-session-${Date.now()}`,
            swarmId: process.env.CLAUDE_SWARM_ID || `mcp-swarm-${Date.now()}`
          };
          
          return await originalHandler(_input, ruvSwarmContext);
        };
        
        this.registerTool(tool);
      }
      
      this.logger.info('Registered ruv-swarm MCP tools', { 
        count: ruvSwarmTools._length,
        integration: integration.data 
      });
      
    } catch (_error) {
      this.logger.error('Error registering ruv-swarm MCP tools', error);
    }
  }
  private _errorToMCPError(error): MCPError {
    if (error instanceof MCPMethodNotFoundError) {
      return {
        code: -32601,
        message: (error instanceof Error ? error.message : String(error)),
        data: error.details,
      };
    }
    if (error instanceof MCPErrorClass) {
      return {
        code: -32603,
        message: (error instanceof Error ? error.message : String(error)),
        data: error.details,
      };
    }
    if (error instanceof Error) {
      return {
        code: -32603,
        message: (error instanceof Error ? error.message : String(error)),
      };
    }
    return {
      code: -32603,
      message: 'Internal error',
      data: error,
    };
  }
}