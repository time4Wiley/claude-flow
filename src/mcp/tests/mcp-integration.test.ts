/**
 * Comprehensive MCP Integration Tests
 */
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
type Mock = jest.MockedFunction<any>;
import { MCPServer } from '../server.js';
import { MCPLifecycleManager, LifecycleState } from '../lifecycle-manager.js';
import { MCPPerformanceMonitor } from '../performance-monitor.js';
import { MCPProtocolManager } from '../protocol-manager.js';
import { MCPOrchestrationIntegration } from '../orchestration-integration.js';
import { ToolRegistry } from '../tools.js';
import type { AuthManager } from '../auth.js';
import type { ILogger } from '../../core/logger.js';
import type { MCPConfig, MCPInitializeParams, MCPRequest, MCPSession } from '../../utils/types.js';
import { EventEmitter } from 'node:events';
// Mock logger
const _mockLogger: ILogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  configure: jest.fn()
};
// Mock event bus
const _mockEventBus = new EventEmitter();
// Mock config
const _mockMCPConfig: MCPConfig = {
  transport: 'stdio',
  enableMetrics: true,
  auth: {
    enabled: false,
    method: 'token',
  },
};
describe('MCP Server', () => {
  let _server: MCPServer; // TODO: Remove if unused
  beforeEach(() => {
    server = new MCPServer(
      _mockMCPConfig,
      _mockEventBus,
      _mockLogger,
    );
  });
  afterEach(async () => {
    if (server) {
      await server.stop();
    }
  });
  describe('Lifecycle Management', () => {
    it('should start and stop server successfully', async () => {
      await server.start();
      expect(mockLogger.info).toHaveBeenCalledWith('MCP server started successfully');
      
      await server.stop();
      expect(mockLogger.info).toHaveBeenCalledWith('MCP server stopped');
    });
    it('should handle initialization request', async () => {
      await server.start();
      
      const _initParams: MCPInitializeParams = {
        protocolVersion: { major: 2024, minor: 11, patch: 5 },
        capabilities: {
          tools: { listChanged: true },
        },
        clientInfo: {
          name: 'test-client',
          version: '1.0.0',
        },
      };
      const _request: MCPRequest = {
        jsonrpc: '2.0',
        id: 'test-init',
        method: 'initialize',
        params: initParams,
      };
      // Mock transport handler
      const _transport = (server as any).transport;
      transport.onRequest = jest.fn();
      
      const _response = await (server as any).handleRequest(request);
      
      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe('test-init');
      expect(response.result).toBeDefined();
      expect(response.result.protocolVersion).toEqual({ major: 2024, minor: 11, patch: 5 });
    });
  });
  describe('Tool Registration', () => {
    beforeEach(async () => {
      await server.start();
    });
    it('should register tools successfully', () => {
      const _tool = {
        name: 'test/tool',
        description: 'Test tool',
        inputSchema: {
          type: 'object',
          properties: {
            input: { type: 'string' },
          },
        },
        handler: jest.fn().mockResolvedValue('test result'),
      };
      server.registerTool(tool);
      expect(mockLogger.info).toHaveBeenCalledWith('Tool registered', { name: 'test/tool' });
    });
    it('should list registered tools', async () => {
      const _tool1 = {
        name: 'test/tool1',
        description: 'Test tool 1',
        inputSchema: { type: 'object', properties: { /* empty */ } },
        handler: jest.fn(),
      };
      const _tool2 = {
        name: 'test/tool2',
        description: 'Test tool 2',
        inputSchema: { type: 'object', properties: { /* empty */ } },
        handler: jest.fn(),
      };
      server.registerTool(tool1);
      server.registerTool(tool2);
      const _tools = (server as any).toolRegistry.listTools();
      expect(tools).toHaveLength(2 + 4); // 2 custom + 4 built-in tools
      expect(tools.some((t: unknown) => t.name === 'test/tool1')).toBe(true);
      expect(tools.some((t: unknown) => t.name === 'test/tool2')).toBe(true);
    });
  });
  describe('Health Checks', () => {
    beforeEach(async () => {
      await server.start();
    });
    it('should report healthy status when running', async () => {
      const _health = await server.getHealthStatus();
      
      expect(health.healthy).toBe(true);
      expect(health.metrics).toBeDefined();
      expect(health.metrics?.registeredTools).toBeGreaterThan(0);
    });
    it('should include metrics in health status', async () => {
      const _health = await server.getHealthStatus();
      
      expect(health.metrics).toBeDefined();
      expect(typeof health.metrics?.registeredTools).toBe('number');
      expect(typeof health.metrics?.totalRequests).toBe('number');
      expect(typeof health.metrics?.successfulRequests).toBe('number');
      expect(typeof health.metrics?.failedRequests).toBe('number');
    });
  });
});
describe('MCP Lifecycle Manager', () => {
  let _lifecycleManager: MCPLifecycleManager; // TODO: Remove if unused
  let _mockServerFactory: Mock; // TODO: Remove if unused
  beforeEach(() => {
    mockServerFactory = jest.fn(() => new MCPServer(
      _mockMCPConfig,
      _mockEventBus,
      _mockLogger,
    ));
    
    lifecycleManager = new MCPLifecycleManager(
      _mockMCPConfig,
      _mockLogger,
      _mockServerFactory,
    );
  });
  afterEach(async () => {
    if (lifecycleManager) {
      await lifecycleManager.stop();
    }
  });
  describe('State Management', () => {
    it('should start in stopped state', () => {
      expect(lifecycleManager.getState()).toBe(LifecycleState.STOPPED);
    });
    it('should transition to running state when started', async () => {
      await lifecycleManager.start();
      expect(lifecycleManager.getState()).toBe(LifecycleState.RUNNING);
    });
    it('should transition back to stopped when stopped', async () => {
      await lifecycleManager.start();
      await lifecycleManager.stop();
      expect(lifecycleManager.getState()).toBe(LifecycleState.STOPPED);
    });
    it('should emit state change events', async () => {
      const _stateChanges: unknown[] = [];
      lifecycleManager.on('stateChange', (event) => {
        stateChanges.push(event);
      });
      await lifecycleManager.start();
      await lifecycleManager.stop();
      expect(stateChanges).toHaveLength(4); // starting -> running -> stopping -> stopped
      expect(stateChanges[0].state).toBe(LifecycleState.STARTING);
      expect(stateChanges[1].state).toBe(LifecycleState.RUNNING);
      expect(stateChanges[2].state).toBe(LifecycleState.STOPPING);
      expect(stateChanges[3].state).toBe(LifecycleState.STOPPED);
    });
  });
  describe('Health Monitoring', () => {
    it('should perform health checks when enabled', async () => {
      const _config = {
        healthCheckInterval: 100,
        enableHealthChecks: true,
      };
      
      lifecycleManager = new MCPLifecycleManager(
        _mockMCPConfig,
        _mockLogger,
        _mockServerFactory,
        _config,
      );
      await lifecycleManager.start();
      
      // Wait for health check
      await new Promise(resolve => setTimeout(_resolve, 150));
      
      const _health = await lifecycleManager.healthCheck();
      expect(health.healthy).toBe(true);
      expect(health.state).toBe(LifecycleState.RUNNING);
    });
    it('should track uptime', async () => {
      await lifecycleManager.start();
      
      // Wait a bit
      await new Promise(resolve => setTimeout(_resolve, 50));
      
      const _uptime = lifecycleManager.getUptime();
      expect(uptime).toBeGreaterThan(0);
    });
  });
});
describe('MCP Performance Monitor', () => {
  let _performanceMonitor: MCPPerformanceMonitor; // TODO: Remove if unused
  beforeEach(() => {
    performanceMonitor = new MCPPerformanceMonitor(mockLogger);
  });
  afterEach(() => {
    if (performanceMonitor) {
      performanceMonitor.stop();
    }
  });
  describe('Request Tracking', () => {
    it('should track request metrics', async () => {
      const _mockSession: MCPSession = {
        id: 'test-session',
        clientInfo: { name: 'test', version: '1.0' },
        protocolVersion: { major: 2024, minor: 11, patch: 5 },
        capabilities: { /* empty */ },
        isInitialized: true,
        createdAt: new Date(),
        lastActivity: new Date(),
        transport: 'stdio',
        authenticated: false,
      };
      const _mockRequest: MCPRequest = {
        jsonrpc: '2.0',
        id: 'test-request',
        method: 'test/method',
      };
      const _requestId = performanceMonitor.recordRequestStart(_mockRequest, mockSession);
      expect(requestId).toBeDefined();
      
      // Simulate request completion
      await new Promise(resolve => setTimeout(_resolve, 10));
      
      performanceMonitor.recordRequestEnd(_requestId, {
        jsonrpc: '2.0',
        id: 'test-request',
        result: 'success',
      });
      const _metrics = performanceMonitor.getCurrentMetrics();
      expect(metrics.requestCount).toBe(1);
      expect(metrics.averageResponseTime).toBeGreaterThan(0);
    });
  });
});
describe('MCP Protocol Manager', () => {
  let _protocolManager: MCPProtocolManager; // TODO: Remove if unused
  beforeEach(() => {
    protocolManager = new MCPProtocolManager(mockLogger);
  });
  describe('Version Compatibility', () => {
    it('should check version compatibility correctly', () => {
      const _clientVersion = { major: 2024, minor: 11, patch: 5 };
      const _compatibility = protocolManager.checkCompatibility(clientVersion);
      
      expect(compatibility.compatible).toBe(true);
      expect(compatibility.errors).toHaveLength(0);
    });
    it('should reject incompatible major versions', () => {
      const _clientVersion = { major: 2023, minor: 11, patch: 5 };
      const _compatibility = protocolManager.checkCompatibility(clientVersion);
      
      expect(compatibility.compatible).toBe(false);
      expect(compatibility.errors.length).toBeGreaterThan(0);
    });
  });
  describe('Protocol Negotiation', () => {
    it('should negotiate protocol successfully', async () => {
      const _clientParams: MCPInitializeParams = {
        protocolVersion: { major: 2024, minor: 11, patch: 5 },
        capabilities: {
          tools: { listChanged: true },
          logging: { level: 'info' },
        },
        clientInfo: {
          name: 'test-client',
          version: '1.0.0',
        },
      };
      const _result = await protocolManager.negotiateProtocol(clientParams);
      
      expect(result.agreedVersion).toEqual(clientParams.protocolVersion);
      expect(result.agreedCapabilities).toBeDefined();
      expect(result.agreedCapabilities.tools?.listChanged).toBe(true);
    });
  });
});
describe('Tool Registry', () => {
  let _toolRegistry: ToolRegistry; // TODO: Remove if unused
  beforeEach(() => {
    toolRegistry = new ToolRegistry(mockLogger);
  });
  describe('Tool Management', () => {
    it('should register tools with capabilities', () => {
      const _tool = {
        name: 'test/tool',
        description: 'Test tool for registry',
        inputSchema: {
          type: 'object',
          properties: {
            input: { type: 'string' },
          },
        },
        handler: jest.fn().mockResolvedValue('test result'),
      };
      const _capability = {
        name: 'test/tool',
        version: '1.0.0',
        description: 'Test capability',
        category: 'test',
        tags: ['testing', 'demo'],
        supportedProtocolVersions: [{ major: 2024, minor: 11, patch: 5 }],
      };
      toolRegistry.register(_tool, capability);
      
      const _registeredCapability = toolRegistry.getToolCapability('test/tool');
      expect(registeredCapability).toEqual(capability);
    });
    it('should discover tools by criteria', () => {
      const _tool1 = {
        name: 'file/read',
        description: 'Read files',
        inputSchema: { type: 'object', properties: { /* empty */ } },
        handler: jest.fn(),
      };
      const _tool2 = {
        name: 'memory/query',
        description: 'Query memory',
        inputSchema: { type: 'object', properties: { /* empty */ } },
        handler: jest.fn(),
      };
      toolRegistry.register(tool1);
      toolRegistry.register(tool2);
      const _fileTools = toolRegistry.discoverTools({ category: 'file' });
      expect(fileTools).toHaveLength(1);
      expect(fileTools[0].tool.name).toBe('file/read');
      const _memoryTools = toolRegistry.discoverTools({ tags: ['memory'] });
      expect(memoryTools).toHaveLength(1);
      expect(memoryTools[0].tool.name).toBe('memory/query');
    });
    it('should track tool metrics', async () => {
      const _tool = {
        name: 'test/metric-tool',
        description: 'Tool for metrics testing',
        inputSchema: { type: 'object', properties: { /* empty */ } },
        handler: jest.fn().mockResolvedValue('success'),
      };
      toolRegistry.register(tool);
      
      // Execute tool multiple times
      await toolRegistry.executeTool('test/metric-tool', { /* empty */ });
      await toolRegistry.executeTool('test/metric-tool', { /* empty */ });
      
      const _metrics = toolRegistry.getToolMetrics('test/metric-tool');
      expect(Array.isArray(metrics) ? metrics[0].totalInvocations : metrics.totalInvocations).toBe(2);
      expect(Array.isArray(metrics) ? metrics[0].successfulInvocations : metrics.successfulInvocations).toBe(2);
    });
  });
});
describe('MCP Orchestration Integration', () => {
  let _integration: MCPOrchestrationIntegration; // TODO: Remove if unused
  let _mockComponents: unknown; // TODO: Remove if unused
  beforeEach(() => {
    mockComponents = {
      orchestrator: {
        getStatus: jest.fn().mockResolvedValue({ status: 'running' }),
        listTasks: jest.fn().mockResolvedValue([]),
      },
      eventBus: new EventEmitter(),
    };
    integration = new MCPOrchestrationIntegration(
      _mockMCPConfig,
      {
        enabledIntegrations: {
          orchestrator: true,
          swarm: false,
          agents: false,
          resources: false,
          memory: false,
          monitoring: false,
          terminals: false,
        },
        autoStart: false,
        healthCheckInterval: 30000,
        reconnectAttempts: 3,
        reconnectDelay: 5000,
        enableMetrics: true,
        enableAlerts: true,
      },
      _mockComponents,
      _mockLogger,
    );
  });
  afterEach(async () => {
    if (integration) {
      await integration.stop();
    }
  });
  describe('Integration Management', () => {
    it('should start integration successfully', async () => {
      await integration.start();
      
      const _status = integration.getIntegrationStatus();
      expect(status).toHaveLength(7); // All component types
      
      const _orchestratorStatus = status.find(s => s.component === 'orchestrator');
      expect(orchestratorStatus?.enabled).toBe(true);
    });
    it('should register orchestrator tools when enabled', async () => {
      await integration.start();
      
      const _server = integration.getServer();
      expect(server).toBeDefined();
      
      // Check that orchestrator tools are registered
      const _tools = (server as any).toolRegistry.listTools();
      const _orchestratorTools = tools.filter((t: unknown) => t.name.startsWith('orchestrator/'));
      expect(orchestratorTools.length).toBeGreaterThan(0);
    });
    it('should handle component connection failures gracefully', async () => {
      // Mock a failing component
      mockComponents.orchestrator.getStatus = jest.fn().mockRejectedValue(new Error('Connection failed'));
      
      await integration.start();
      
      const _status = integration.getComponentStatus('orchestrator');
      expect(status?.connected).toBe(false);
      expect(status?.error).toBeDefined();
    });
  });
  describe('Health Monitoring', () => {
    it('should monitor component health', async () => {
      await integration.start();
      
      // Wait for health check
      await new Promise(resolve => setTimeout(_resolve, 100));
      
      const _status = integration.getIntegrationStatus();
      const _enabledComponents = status.filter(s => s.enabled);
      
      for (const component of enabledComponents) {
        expect(component.lastCheck).toBeInstanceOf(Date);
      }
    });
  });
});