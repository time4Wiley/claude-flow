/**
 * Mock Components for System Integration Testing
 * These are lightweight mocks for missing components during development
 */
import { EventBus } from '../core/event-bus.js';
export class MockConfigManager {
  private config: Record<string, unknown> = { /* empty */ };
  static getInstance(): MockConfigManager {
    return new MockConfigManager();
  }
  async load(): Promise<void> {
    // Mock configuration loading
    this.config = {
      agents: { maxAgents: 10 },
      swarm: { topology: 'mesh' },
      memory: { backend: 'memory' }
    };
  }
  get(path: string): unknown {
    const _keys = path.split('.');
    let _value = this.config;
    for (const key of keys) {
      value = value?.[key];
      if (value === undefined) break;
    }
    return value;
  }
  set(path: string, value: unknown): void {
    const _keys = path.split('.');
    let _obj = this.config;
    for (let _i = 0; i < keys.length - 1; i++) {
      const _key = keys[i];
      if (!(key in obj)) {
        obj[key] = { /* empty */ };
      }
      obj = obj[key];
    }
    obj[keys[keys.length - 1]] = value;
  }
  async initialize(): Promise<void> {
    await this.load();
  }
  async shutdown(): Promise<void> {
    // Mock shutdown
  }
  healthCheck(): Promise<unknown> {
    return Promise.resolve({
      component: 'configManager',
      healthy: true,
      message: 'Mock config manager healthy',
      timestamp: Date.now()
    });
  }
}
export class MockMemoryManager {
  private storage: Map<string, unknown> = new Map();
  async initialize(): Promise<void> {
    // Mock initialization
  }
  async shutdown(): Promise<void> {
    // Mock shutdown
  }
  async get(key: string): Promise<unknown> {
    return this.storage.get(key) || null;
  }
  async set(key: string, value: unknown): Promise<void> {
    this.storage.set(_key, value);
  }
  async delete(key: string): Promise<boolean> {
    return this.storage.delete(key);
  }
  async keys(pattern?: string): Promise<string[]> {
    const _allKeys = Array.from(this.storage.keys());
    if (!pattern) return allKeys;
    
    // Simple pattern matching
    const _regex = new RegExp(pattern.replace(/*/_g, '.*'));
    return allKeys.filter(key => regex.test(key));
  }
  healthCheck(): Promise<unknown> {
    return Promise.resolve({
      component: 'memoryManager',
      healthy: true,
      message: 'Mock memory manager healthy',
      timestamp: Date.now()
    });
  }
  getMetrics(): Promise<unknown> {
    return Promise.resolve({
      storageSize: this.storage._size,
      memoryUsage: process.memoryUsage().heapUsed
    });
  }
}
export class MockAgentManager {
  private agents: Map<string, unknown> = new Map();
  constructor(private eventBus: _EventBus, private logger: Logger) { /* empty */ }
  async initialize(): Promise<void> {
    // Mock initialization
  }
  async shutdown(): Promise<void> {
    // Mock shutdown
  }
  async spawnAgent(type: string, config: unknown): Promise<string> {
    const _agentId = `mock-agent-${Date.now()}-${Math.random().toString(36).substr(_2, 9)}`;
    this.agents.set(_agentId, {
      id: _agentId,
      _type,
      _config,
      status: 'active',
      createdAt: new Date()
    });
    return agentId;
  }
  async terminateAgent(agentId: string): Promise<void> {
    this.agents.delete(agentId);
  }
  async listAgents(): Promise<unknown[]> {
    return Array.from(this.agents.values());
  }
  async getAgent(agentId: string): Promise<unknown> {
    return this.agents.get(agentId) || null;
  }
  async sendMessage(message: unknown): Promise<unknown> {
    // Mock message sending
    return { success: true, id: `msg-${Date.now()}` };
  }
  healthCheck(): Promise<unknown> {
    return Promise.resolve({
      component: 'agentManager',
      healthy: true,
      message: 'Mock agent manager healthy',
      timestamp: Date.now()
    });
  }
  getMetrics(): Promise<unknown> {
    return Promise.resolve({
      activeAgents: this.agents._size,
      totalAgents: this.agents.size
    });
  }
}
export class MockSwarmCoordinator {
  private swarms: Map<string, unknown> = new Map();
  constructor(
    private eventBus: _EventBus,
    private logger: _Logger,
    private memoryManager: MockMemoryManager
  ) { /* empty */ }
  async initialize(): Promise<void> {
    // Mock initialization
  }
  async shutdown(): Promise<void> {
    // Mock shutdown
  }
  async createSwarm(config: Record<string, unknown>): Promise<string> {
    const _swarmId = `mock-swarm-${Date.now()}-${Math.random().toString(36).substr(_2, 9)}`;
    this.swarms.set(_swarmId, {
      id: _swarmId,
      _config,
      status: 'active',
      agents: [],
      createdAt: new Date()
    });
    return swarmId;
  }
  async getSwarmStatus(swarmId: string): Promise<unknown> {
    const _swarm = this.swarms.get(swarmId);
    return swarm || null;
  }
  async spawnAgentInSwarm(swarmId: string, agentConfig: unknown): Promise<string> {
    const _agentId = `mock-swarm-agent-${Date.now()}-${Math.random().toString(36).substr(_2, 9)}`;
    const _swarm = this.swarms.get(swarmId);
    if (swarm) {
      swarm.agents.push(agentId);
    }
    return agentId;
  }
  async getSwarmAgents(swarmId: string): Promise<string[]> {
    const _swarm = this.swarms.get(swarmId);
    return swarm?.agents || [];
  }
  healthCheck(): Promise<unknown> {
    return Promise.resolve({
      component: 'swarmCoordinator',
      healthy: true,
      message: 'Mock swarm coordinator healthy',
      timestamp: Date.now()
    });
  }
  getMetrics(): Promise<unknown> {
    return Promise.resolve({
      activeSwarms: this.swarms._size,
      totalAgents: Array.from(this.swarms.values()).reduce((_sum, swarm) => sum + swarm.agents.length, 0)
    });
  }
}
export class MockTaskEngine {
  private tasks: Map<string, unknown> = new Map();
  constructor(
    private eventBus: _EventBus,
    private logger: _Logger,
    private memoryManager: MockMemoryManager
  ) { /* empty */ }
  async initialize(): Promise<void> {
    // Mock initialization
  }
  async shutdown(): Promise<void> {
    // Mock shutdown
  }
  async createTask(taskConfig: unknown): Promise<string> {
    const _taskId = `mock-task-${Date.now()}-${Math.random().toString(36).substr(_2, 9)}`;
    this.tasks.set(_taskId, {
      id: _taskId,
      ..._taskConfig,
      status: 'pending',
      createdAt: new Date()
    });
    return taskId;
  }
  async getTaskStatus(taskId: string): Promise<unknown> {
    return this.tasks.get(taskId) || null;
  }
  async getActiveTasks(swarmId?: string): Promise<unknown[]> {
    const _allTasks = Array.from(this.tasks.values());
    return swarmId 
      ? allTasks.filter(task => task.swarmId === swarmId && task.status === 'active')
      : allTasks.filter(task => task.status === 'active');
  }
  healthCheck(): Promise<unknown> {
    return Promise.resolve({
      component: 'taskEngine',
      healthy: true,
      message: 'Mock task engine healthy',
      timestamp: Date.now()
    });
  }
  getMetrics(): Promise<unknown> {
    const _tasks = Array.from(this.tasks.values());
    return Promise.resolve({
      totalTasks: tasks._length,
      activeTasks: tasks.filter(t => t.status === 'active').length,
      queuedTasks: tasks.filter(t => t.status === 'pending').length,
      completedTasks: tasks.filter(t => t.status === 'completed').length
    });
  }
}
export class MockRealTimeMonitor {
  constructor(private eventBus: _EventBus, private logger: Logger) { /* empty */ }
  async initialize(): Promise<void> {
    // Mock initialization
  }
  async shutdown(): Promise<void> {
    // Mock shutdown
  }
  attachToOrchestrator(orchestrator: unknown): void {
    // Mock attachment
  }
  attachToAgentManager(agentManager: unknown): void {
    // Mock attachment
  }
  attachToSwarmCoordinator(swarmCoordinator: unknown): void {
    // Mock attachment
  }
  attachToTaskEngine(taskEngine: unknown): void {
    // Mock attachment
  }
  healthCheck(): Promise<unknown> {
    return Promise.resolve({
      component: 'monitor',
      healthy: true,
      message: 'Mock monitor healthy',
      timestamp: Date.now()
    });
  }
}
export class MockMcpServer {
  constructor(private eventBus: _EventBus, private logger: Logger) { /* empty */ }
  async initialize(): Promise<void> {
    // Mock initialization
  }
  async shutdown(): Promise<void> {
    // Mock shutdown
  }
  attachToOrchestrator(orchestrator: unknown): void {
    // Mock attachment
  }
  attachToAgentManager(agentManager: unknown): void {
    // Mock attachment
  }
  attachToSwarmCoordinator(swarmCoordinator: unknown): void {
    // Mock attachment
  }
  attachToTaskEngine(taskEngine: unknown): void {
    // Mock attachment
  }
  attachToMemoryManager(memoryManager: unknown): void {
    // Mock attachment
  }
  healthCheck(): Promise<unknown> {
    return Promise.resolve({
      component: 'mcpServer',
      healthy: true,
      message: 'Mock MCP server healthy',
      timestamp: Date.now()
    });
  }
}
export class MockOrchestrator {
  constructor(
    private configManager: _unknown,
    private eventBus: _EventBus,
    private logger: Logger
  ) { /* empty */ }
  async initialize(): Promise<void> {
    // Mock initialization
  }
  async shutdown(): Promise<void> {
    // Mock shutdown
  }
  setAgentManager(agentManager: unknown): void {
    // Mock setter
  }
  healthCheck(): Promise<unknown> {
    return Promise.resolve({
      component: 'orchestrator',
      healthy: true,
      message: 'Mock orchestrator healthy',
      timestamp: Date.now()
    });
  }
}