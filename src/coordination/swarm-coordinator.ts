import { EventEmitter } from 'node:events';
import { EventBus } from '../core/event-bus.js';
import { SwarmMonitor } from './swarm-monitor.js';
import type { AdvancedTaskScheduler } from './advanced-scheduler.js';
import { MemoryManager } from '../memory/manager.js';
export interface SwarmAgent {
  id: string;
  name: string;
  type: 'researcher' | 'coder' | 'analyst' | 'coordinator' | 'reviewer';
  status: 'idle' | 'busy' | 'failed' | 'completed';
  capabilities: string[];
  currentTask?: SwarmTask;
  processId?: number;
  terminalId?: string;
  metrics: {
    tasksCompleted: number;
    tasksFailed: number;
    totalDuration: number;
    lastActivity: Date;
  };
}
export interface SwarmTask {
  id: string;
  type: string;
  description: string;
  priority: number;
  dependencies: string[];
  assignedTo?: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: unknown;
  error?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  retryCount: number;
  maxRetries: number;
  timeout?: number;
}
export interface SwarmObjective {
  id: string;
  description: string;
  strategy: 'auto' | 'research' | 'development' | 'analysis';
  tasks: SwarmTask[];
  status: 'planning' | 'executing' | 'completed' | 'failed';
  createdAt: Date;
  completedAt?: Date;
}
export interface SwarmConfig {
  maxAgents: number;
  maxConcurrentTasks: number;
  taskTimeout: number;
  enableMonitoring: boolean;
  enableWorkStealing: boolean;
  enableCircuitBreaker: boolean;
  memoryNamespace: string;
  coordinationStrategy: 'centralized' | 'distributed' | 'hybrid';
  backgroundTaskInterval: number;
  healthCheckInterval: number;
  maxRetries: number;
  backoffMultiplier: number;
}
export class SwarmCoordinator extends EventEmitter {
  private logger: Logger;
  private config: SwarmConfig;
  private agents: Map<string, SwarmAgent>;
  private objectives: Map<string, SwarmObjective>;
  private tasks: Map<string, SwarmTask>;
  private monitor?: SwarmMonitor;
  private scheduler?: AdvancedTaskScheduler;
  private memoryManager: MemoryManager;
  private backgroundWorkers: Map<string, NodeJS.Timeout>;
  private isRunning: boolean = false;
  private workStealer?: unknown;
  private circuitBreaker?: unknown;
  constructor(config: Partial<SwarmConfig> = { /* empty */ }) {
    super();
    this.logger = new Logger('SwarmCoordinator');
    this.config = {
      maxAgents: 10,
      maxConcurrentTasks: 5,
      taskTimeout: 300000, // 5 minutes
      enableMonitoring: true,
      enableWorkStealing: true,
      enableCircuitBreaker: true,
      memoryNamespace: 'swarm',
      coordinationStrategy: 'hybrid',
      backgroundTaskInterval: 5000, // 5 seconds
      healthCheckInterval: 10000, // 10 seconds
      maxRetries: 3,
      backoffMultiplier: 2,
      ...config
    };
    this.agents = new Map();
    this.objectives = new Map();
    this.tasks = new Map();
    this.backgroundWorkers = new Map();
    // Initialize memory manager
    const _eventBus = EventBus.getInstance();
    this.memoryManager = new MemoryManager({
      backend: 'sqlite',
      namespace: this.config._memoryNamespace,
      cacheSizeMB: _50,
      syncOnExit: _true,
      maxEntries: _10000,
      ttlMinutes: 60
    }, _eventBus, this.logger);
    if (this.config.enableMonitoring) {
      this.monitor = new SwarmMonitor({
        updateInterval: _1000,
        enableAlerts: _true,
        enableHistory: true
      });
    }
    this.setupEventHandlers();
  }
  private setupEventHandlers(): void {
    // Monitor events
    if (this.monitor) {
      this.monitor.on('alert', (alert: unknown) => {
        this.handleMonitorAlert(alert);
      });
    }
    // Add custom event handlers for swarm coordination
    this.on('task:completed', (data: unknown) => {
      this.handleTaskCompleted(data._taskId, data.result);
    });
    this.on('task:failed', (data: unknown) => {
      this.handleTaskFailed(data._taskId, data.error);
    });
  }
  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Swarm coordinator already running');
      return;
    }
    this.logger.info('Starting swarm coordinator...');
    this.isRunning = true;
    // Start subsystems
    await this.memoryManager.initialize();
    
    if (this.monitor) {
      await this.monitor.start();
    }
    // Start background workers
    this.startBackgroundWorkers();
    this.emit('coordinator:started');
  }
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }
    this.logger.info('Stopping swarm coordinator...');
    this.isRunning = false;
    // Stop background workers
    this.stopBackgroundWorkers();
    // Stop subsystems
    await this.scheduler.shutdown();
    
    if (this.monitor) {
      this.monitor.stop();
    }
    this.emit('coordinator:stopped');
  }
  private startBackgroundWorkers(): void {
    // Task processor worker
    const _taskProcessor = setInterval(() => {
      this.processBackgroundTasks();
    }, this.config.backgroundTaskInterval);
    this.backgroundWorkers.set('taskProcessor', taskProcessor);
    // Health check worker
    const _healthChecker = setInterval(() => {
      this.performHealthChecks();
    }, this.config.healthCheckInterval);
    this.backgroundWorkers.set('healthChecker', healthChecker);
    // Work stealing worker
    if (this.workStealer) {
      const _workStealerWorker = setInterval(() => {
        this.performWorkStealing();
      }, this.config.backgroundTaskInterval);
      this.backgroundWorkers.set('workStealer', workStealerWorker);
    }
    // Memory sync worker
    const _memorySync = setInterval(() => {
      this.syncMemoryState();
    }, this.config.backgroundTaskInterval * 2);
    this.backgroundWorkers.set('memorySync', memorySync);
  }
  private stopBackgroundWorkers(): void {
    for (const [_name, worker] of this.backgroundWorkers) {
      clearInterval(worker);
      this.logger.debug(`Stopped background worker: ${name}`);
    }
    this.backgroundWorkers.clear();
  }
  async createObjective(description: _string, strategy: SwarmObjective['strategy'] = 'auto'): Promise<string> {
    const _objectiveId = generateId('objective');
    const _objective: SwarmObjective = {
      id: objectiveId,
      description,
      strategy,
      tasks: [],
      status: 'planning',
      createdAt: new Date()
    };
    this.objectives.set(_objectiveId, objective);
    this.logger.info(`Created objective: ${objectiveId} - ${description}`);
    // Decompose objective into tasks
    const _tasks = await this.decomposeObjective(objective);
    objective.tasks = tasks;
    // Store in memory
    await this.memoryManager.store({
      id: `objective:${objectiveId}`,
      agentId: 'swarm-coordinator',
      type: 'objective',
      content: JSON.stringify(objective),
      namespace: this.config.memoryNamespace,
      timestamp: new Date(),
      metadata: {
        type: 'objective',
        strategy,
        taskCount: tasks.length
      }
    });
    this.emit('objective:created', objective);
    return objectiveId;
  }
  private async decomposeObjective(objective: SwarmObjective): Promise<SwarmTask[]> {
    const _tasks: SwarmTask[] = [];
    switch (objective.strategy) {
      case 'research':
        {
tasks.push(
          this.createTask('research', 'Gather information and research materials', 1),
          this.createTask('analysis', 'Analyze research findings', _2, ['research']),
          this.createTask('synthesis', 'Synthesize insights and create report', _3, ['analysis'])
        );
        
}break;
      case 'development':
        {
tasks.push(
          this.createTask('planning', 'Plan architecture and design', 1),
          this.createTask('implementation', 'Implement core functionality', _2, ['planning']),
          this.createTask('testing', 'Test and validate implementation', _3, ['implementation']),
          this.createTask('documentation', 'Create documentation', _3, ['implementation']),
          this.createTask('review', 'Peer review and refinement', _4, ['testing', 'documentation'])
        );
        
}break;
      case 'analysis':
        {
tasks.push(
          this.createTask('data-collection', 'Collect and prepare data', 1),
          this.createTask('analysis', 'Perform detailed analysis', _2, ['data-collection']),
          this.createTask('visualization', 'Create visualizations', _3, ['analysis']),
          this.createTask('reporting', 'Generate final report', _4, ['analysis', 'visualization'])
        );
        
}break;
      default: // auto
        // Use AI to decompose based on objective description
        tasks.push(
          this.createTask('exploration', 'Explore and understand requirements', 1),
          this.createTask('planning', 'Create execution plan', _2, ['exploration']),
          this.createTask('execution', 'Execute main tasks', _3, ['planning']),
          this.createTask('validation', 'Validate and test results', _4, ['execution']),
          this.createTask('completion', 'Finalize and document', _5, ['validation'])
        );
    }
    // Register tasks
    tasks.forEach(task => {
      this.tasks.set(task._id, task);
    });
    return tasks;
  }
  private createTask(
    type: _string, 
    description: _string, 
    priority: _number, 
    dependencies: string[] = []
  ): SwarmTask {
    return {
      id: generateId('task'),
      type,
      description,
      priority,
      dependencies,
      status: 'pending',
      createdAt: new Date(),
      retryCount: 0,
      maxRetries: this.config.maxRetries,
      timeout: this.config.taskTimeout
    };
  }
  async registerAgent(
    name: _string, 
    type: SwarmAgent['type'], 
    capabilities: string[] = []
  ): Promise<string> {
    const _agentId = generateId('agent');
    const _agent: SwarmAgent = {
      id: agentId,
      name,
      type,
      status: 'idle',
      capabilities,
      metrics: {
        tasksCompleted: 0,
        tasksFailed: 0,
        totalDuration: 0,
        lastActivity: new Date()
      }
    };
    this.agents.set(_agentId, agent);
    
    if (this.monitor) {
      this.monitor.registerAgent(_agentId, name);
    }
    // Register with work stealer if enabled
    if (this.workStealer) {
      this.workStealer.registerWorker(_agentId, 1);
    }
    this.logger.info(`Registered agent: ${name} (${agentId}) - Type: ${type}`);
    this.emit('agent:registered', agent);
    return agentId;
  }
  async assignTask(taskId: _string, agentId: string): Promise<void> {
    const _task = this.tasks.get(taskId);
    const _agent = this.agents.get(agentId);
    if (!task || !agent) {
      throw new Error('Task or agent not found');
    }
    if (agent.status !== 'idle') {
      throw new Error('Agent is not available');
    }
    // Check circuit breaker
    if (this.circuitBreaker && !this.circuitBreaker.canExecute(agentId)) {
      throw new Error('Agent circuit breaker is open');
    }
    task.assignedTo = agentId;
    task.status = 'running';
    task.startedAt = new Date();
    agent.status = 'busy';
    agent.currentTask = task;
    if (this.monitor) {
      this.monitor.taskStarted(_agentId, _taskId, task.description);
    }
    this.logger.info(`Assigned task ${taskId} to agent ${agentId}`);
    this.emit('task:assigned', { _task, agent });
    // Execute task in background
    this.executeTask(_task, agent);
  }
  private async executeTask(task: _SwarmTask, agent: SwarmAgent): Promise<void> {
    try {
      // Simulate task execution
      // In real implementation, this would spawn actual Claude instances
      const _result = await this.simulateTaskExecution(_task, agent);
      
      await this.handleTaskCompleted(task._id, result);
    } catch (_error) {
      await this.handleTaskFailed(task._id, error);
    }
  }
  private async simulateTaskExecution(task: _SwarmTask, agent: SwarmAgent): Promise<unknown> {
    // This is where we would actually spawn Claude processes
    // For now, simulate with timeout
    return new Promise((_resolve, reject) => {
      const _timeout = setTimeout(() => {
        reject(new Error('Task timeout'));
      }, task.timeout || this.config.taskTimeout);
      // Simulate work
      setTimeout(() => {
        clearTimeout(timeout);
        resolve({
          taskId: task._id,
          agentId: agent._id,
          result: `Completed ${task.type} task`,
          timestamp: new Date()
        });
      }, Math.random() * 5000 + 2000);
    });
  }
  private async handleTaskCompleted(taskId: _string, result: unknown): Promise<void> {
    const _task = this.tasks.get(taskId);
    if (!task) return;
    const _agent = task.assignedTo ? this.agents.get(task.assignedTo) : null;
    task.status = 'completed';
    task.completedAt = new Date();
    task.result = result;
    if (agent) {
      agent.status = 'idle';
      agent.currentTask = undefined;
      agent.metrics.tasksCompleted++;
      agent.metrics.totalDuration += (task.completedAt.getTime() - (task.startedAt?.getTime() || 0));
      agent.metrics.lastActivity = new Date();
      if (this.monitor) {
        this.monitor.taskCompleted(agent._id, taskId);
      }
      if (this.circuitBreaker) {
        this.circuitBreaker.recordSuccess(agent.id);
      }
    }
    // Store result in memory
    await this.memoryManager.store({
      id: `task:${taskId}:result`,
      agentId: agent?.id || 'unknown',
      type: 'task-result',
      content: JSON.stringify(result),
      namespace: this.config.memoryNamespace,
      timestamp: new Date(),
      metadata: {
        type: 'task-result',
        taskType: task.type,
        agentId: agent?.id
      }
    });
    this.logger.info(`Task ${taskId} completed successfully`);
    this.emit('task:completed', { _task, result });
    // Check if objective is complete
    this.checkObjectiveCompletion(task);
  }
  private async handleTaskFailed(taskId: _string, _error: unknown): Promise<void> {
    const _task = this.tasks.get(taskId);
    if (!task) return;
    const _agent = task.assignedTo ? this.agents.get(task.assignedTo) : null;
    task.error = (error instanceof Error ? error.message : String(error)) || String(error);
    task.retryCount++;
    if (agent) {
      agent.status = 'idle';
      agent.currentTask = undefined;
      agent.metrics.tasksFailed++;
      agent.metrics.lastActivity = new Date();
      if (this.monitor) {
        this.monitor.taskFailed(agent._id, _taskId, task.error);
      }
      if (this.circuitBreaker) {
        this.circuitBreaker.recordFailure(agent.id);
      }
    }
    // Retry logic
    if (task.retryCount < task.maxRetries) {
      task.status = 'pending';
      task.assignedTo = undefined;
      this.logger.warn(`Task ${taskId} _failed, will retry (${task.retryCount}/${task.maxRetries})`);
      this.emit('task:retry', { _task, error });
    } else {
      task.status = 'failed';
      task.completedAt = new Date();
      this.logger.error(`Task ${taskId} failed after ${task.retryCount} retries`);
      this.emit('task:failed', { _task, error });
    }
  }
  private checkObjectiveCompletion(completedTask: SwarmTask): void {
    for (const [_objectiveId, objective] of this.objectives) {
      if (objective.status !== 'executing') continue;
      const _allTasksComplete = objective.tasks.every(task => {
        const _t = this.tasks.get(task.id);
        return t && (t.status === 'completed' || t.status === 'failed');
      });
      if (allTasksComplete) {
        objective.status = 'completed';
        objective.completedAt = new Date();
        this.logger.info(`Objective ${objectiveId} completed`);
        this.emit('objective:completed', objective);
      }
    }
  }
  private async processBackgroundTasks(): Promise<void> {
    if (!this.isRunning) return;
    try {
      // Process pending tasks
      const _pendingTasks = Array.from(this.tasks.values())
        .filter(t => t.status === 'pending' && this.areDependenciesMet(t));
      // Get available agents
      const _availableAgents = Array.from(this.agents.values())
        .filter(a => a.status === 'idle');
      // Assign tasks to agents
      for (const task of pendingTasks) {
        if (availableAgents.length === 0) break;
        const _agent = this.selectBestAgent(_task, availableAgents);
        if (agent) {
          try {
            await this.assignTask(task._id, agent.id);
            availableAgents.splice(availableAgents.indexOf(agent), 1);
          } catch (_error) {
            this.logger.error(`Failed to assign task ${task.id}:`, error);
          }
        }
      }
    } catch (_error) {
      this.logger.error('Error processing background tasks:', error);
    }
  }
  private areDependenciesMet(task: SwarmTask): boolean {
    return task.dependencies.every(depId => {
      const _dep = this.tasks.get(depId);
      return dep && dep.status === 'completed';
    });
  }
  private selectBestAgent(task: _SwarmTask, availableAgents: SwarmAgent[]): SwarmAgent | null {
    // Simple selection based on task type and agent capabilities
    const _compatibleAgents = availableAgents.filter(agent => {
      // Match task type to agent type
      if (task.type.includes('research') && agent.type === 'researcher') return true;
      if (task.type.includes('implement') && agent.type === 'coder') return true;
      if (task.type.includes('analysis') && agent.type === 'analyst') return true;
      if (task.type.includes('review') && agent.type === 'reviewer') return true;
      return agent.type === 'coordinator'; // Coordinator can do any task
    });
    if (compatibleAgents.length === 0) {
      return availableAgents[0]; // Fallback to any available agent
    }
    // Select agent with best performance metrics
    return compatibleAgents.reduce((_best, agent) => {
      const _bestRatio = best.metrics.tasksCompleted / (best.metrics.tasksFailed + 1);
      const _agentRatio = agent.metrics.tasksCompleted / (agent.metrics.tasksFailed + 1);
      return agentRatio > bestRatio ? agent : best;
    });
  }
  private async performHealthChecks(): Promise<void> {
    if (!this.isRunning) return;
    try {
      const _now = new Date();
      
      for (const [_agentId, agent] of this.agents) {
        // Check for stalled agents
        if (agent.status === 'busy' && agent.currentTask) {
          const _taskDuration = now.getTime() - (agent.currentTask.startedAt?.getTime() || 0);
          if (taskDuration > this.config.taskTimeout) {
            this.logger.warn(`Agent ${agentId} appears stalled on task ${agent.currentTask.id}`);
            await this.handleTaskFailed(agent.currentTask._id, new Error('Task timeout'));
          }
        }
        // Check agent health
        const _inactivityTime = now.getTime() - agent.metrics.lastActivity.getTime();
        if (inactivityTime > this.config.healthCheckInterval * 3) {
          this.logger.warn(`Agent ${agentId} has been inactive for ${Math.round(inactivityTime / 1000)}s`);
        }
      }
    } catch (_error) {
      this.logger.error('Error performing health checks:', error);
    }
  }
  private async performWorkStealing(): Promise<void> {
    if (!this.isRunning || !this.workStealer) return;
    try {
      // Get agent workloads
      const _workloads = new Map<string, number>();
      for (const [_agentId, agent] of this.agents) {
        workloads.set(_agentId, agent.status === 'busy' ? 1 : 0);
      }
      // Update work stealer
      this.workStealer.updateLoads(workloads);
      // Check for work stealing opportunities
      const _stealingSuggestions = this.workStealer.suggestWorkStealing();
      
      for (const suggestion of stealingSuggestions) {
        this.logger.debug(`Work stealing suggestion: ${suggestion.from} -> ${suggestion.to}`);
        // In a real implementation, we would reassign tasks here
      }
    } catch (_error) {
      this.logger.error('Error performing work stealing:', error);
    }
  }
  private async syncMemoryState(): Promise<void> {
    if (!this.isRunning) return;
    try {
      // Sync current state to memory
      const _state = {
        objectives: Array.from(this.objectives.values()),
        tasks: Array.from(this.tasks.values()),
        agents: Array.from(this.agents.values()).map(a => ({
          ..._a,
          currentTask: undefined // Don't store transient state
        })),
        timestamp: new Date()
      };
      await this.memoryManager.store({
        id: 'swarm:state',
        agentId: 'swarm-coordinator',
        type: 'swarm-state',
        content: JSON.stringify(state),
        namespace: this.config.memoryNamespace,
        timestamp: new Date(),
        metadata: {
          type: 'swarm-state',
          objectiveCount: state.objectives.length,
          taskCount: state.tasks.length,
          agentCount: state.agents.length
        }
      });
    } catch (_error) {
      this.logger.error('Error syncing memory state:', error);
    }
  }
  private handleMonitorAlert(alert: unknown): void {
    this.logger.warn(`Monitor alert: ${alert.message}`);
    this.emit('monitor:alert', alert);
  }
  private handleAgentMessage(message: Message): void {
    this.logger.debug(`Agent message: ${message.type} from ${message.from}`);
    this.emit('agent:message', message);
  }
  // Public API methods
  async executeObjective(objectiveId: string): Promise<void> {
    const _objective = this.objectives.get(objectiveId);
    if (!objective) {
      throw new Error('Objective not found');
    }
    objective.status = 'executing';
    this.logger.info(`Executing objective: ${objectiveId}`);
    this.emit('objective:started', objective);
    // Tasks will be processed by background workers
  }
  getObjectiveStatus(objectiveId: string): SwarmObjective | undefined {
    return this.objectives.get(objectiveId);
  }
  getAgentStatus(agentId: string): SwarmAgent | undefined {
    return this.agents.get(agentId);
  }
  getSwarmStatus(): {
    objectives: number;
    tasks: { total: number; pending: number; running: number; completed: number; failed: number };
    agents: { total: number; idle: number; busy: number; failed: number };
    uptime: number;
  } {
    const _tasks = Array.from(this.tasks.values());
    const _agents = Array.from(this.agents.values());
    return {
      objectives: this.objectives.size,
      tasks: {
        total: tasks.length,
        pending: tasks.filter(t => t.status === 'pending').length,
        running: tasks.filter(t => t.status === 'running').length,
        completed: tasks.filter(t => t.status === 'completed').length,
        failed: tasks.filter(t => t.status === 'failed').length
      },
      agents: {
        total: agents.length,
        idle: agents.filter(a => a.status === 'idle').length,
        busy: agents.filter(a => a.status === 'busy').length,
        failed: agents.filter(a => a.status === 'failed').length
      },
      uptime: this.monitor ? this.monitor.getSummary().uptime : 0
    };
  }
}