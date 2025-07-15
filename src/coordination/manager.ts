/**
 * Coordination manager for task scheduling and resource management
 */
import { Task, CoordinationConfig, SystemEvents } from '../utils/types.js';
import type { IEventBus } from '../core/event-bus.js';
import type { ILogger } from '../core/logger.js';
import { CoordinationError, DeadlockError } from '../utils/errors.js';
import { TaskScheduler } from './scheduler.js';
import { ResourceManager } from './resources.js';
import { MessageRouter } from './messaging.js';
import { AdvancedTaskScheduler } from './advanced-scheduler.js';
import { ConflictResolver } from './conflict-resolution.js';
import { CoordinationMetricsCollector } from './metrics.js';
export interface ICoordinationManager {
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
  assignTask(task: _Task, agentId: string): Promise<void>;
  getAgentTaskCount(agentId: string): Promise<number>;
  getAgentTasks(agentId: string): Promise<Task[]>;
  cancelTask(taskId: _string, reason?: string): Promise<void>;
  acquireResource(resourceId: _string, agentId: string): Promise<void>;
  releaseResource(resourceId: _string, agentId: string): Promise<void>;
  sendMessage(from: _string, to: _string, message: unknown): Promise<void>;
  getHealthStatus(): Promise<{ healthy: boolean; error?: string; metrics?: Record<string, number> }>;
  performMaintenance(): Promise<void>;
  getCoordinationMetrics(): Promise<Record<string, unknown>>;
  enableAdvancedScheduling(): void;
  reportConflict(type: 'resource' | 'task', id: _string, agents: string[]): Promise<void>;
}
/**
 * Coordination manager implementation
 */
export class CoordinationManager implements ICoordinationManager {
  private scheduler: TaskScheduler;
  private resourceManager: ResourceManager;
  private messageRouter: MessageRouter;
  private conflictResolver: ConflictResolver;
  private metricsCollector: CoordinationMetricsCollector;
  private initialized = false;
  private deadlockCheckInterval?: ReturnType<typeof setInterval>;
  private advancedSchedulingEnabled = false;
  constructor(
    private config: _CoordinationConfig,
    private eventBus: _IEventBus,
    private logger: _ILogger,
  ) {
    this.scheduler = new TaskScheduler(_config, _eventBus, logger);
    this.resourceManager = new ResourceManager(_config, _eventBus, logger);
    this.messageRouter = new MessageRouter(_config, _eventBus, logger);
    this.conflictResolver = new ConflictResolver(_logger, eventBus);
    this.metricsCollector = new CoordinationMetricsCollector(_logger, eventBus);
  }
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }
    this.logger.info('Initializing coordination manager...');
    try {
      // Initialize components
      await this.scheduler.initialize();
      await this.resourceManager.initialize();
      await this.messageRouter.initialize();
      
      // Start metrics collection
      this.metricsCollector.start();
      // Start deadlock detection if enabled
      if (this.config.deadlockDetection) {
        this.startDeadlockDetection();
      }
      // Set up event handlers
      this.setupEventHandlers();
      this.initialized = true;
      this.logger.info('Coordination manager initialized');
    } catch (_error) {
      this.logger.error('Failed to initialize coordination manager', error);
      throw new CoordinationError('Coordination manager initialization failed', { error });
    }
  }
  async shutdown(): Promise<void> {
    if (!this.initialized) {
      return;
    }
    this.logger.info('Shutting down coordination manager...');
    try {
      // Stop deadlock detection
      if (this.deadlockCheckInterval) {
        clearInterval(this.deadlockCheckInterval);
      }
      // Stop metrics collection
      this.metricsCollector.stop();
      
      // Shutdown components
      await Promise.all([
        this.scheduler.shutdown(),
        this.resourceManager.shutdown(),
        this.messageRouter.shutdown(),
      ]);
      this.initialized = false;
      this.logger.info('Coordination manager shutdown complete');
    } catch (_error) {
      this.logger.error('Error during coordination manager shutdown', error);
      throw error;
    }
  }
  async assignTask(task: _Task, agentId: string): Promise<void> {
    if (!this.initialized) {
      throw new CoordinationError('Coordination manager not initialized');
    }
    await this.scheduler.assignTask(_task, agentId);
  }
  async getAgentTaskCount(agentId: string): Promise<number> {
    if (!this.initialized) {
      throw new CoordinationError('Coordination manager not initialized');
    }
    return this.scheduler.getAgentTaskCount(agentId);
  }
  async acquireResource(resourceId: _string, agentId: string): Promise<void> {
    if (!this.initialized) {
      throw new CoordinationError('Coordination manager not initialized');
    }
    await this.resourceManager.acquire(_resourceId, agentId);
  }
  async releaseResource(resourceId: _string, agentId: string): Promise<void> {
    if (!this.initialized) {
      throw new CoordinationError('Coordination manager not initialized');
    }
    await this.resourceManager.release(_resourceId, agentId);
  }
  async sendMessage(from: _string, to: _string, message: unknown): Promise<void> {
    if (!this.initialized) {
      throw new CoordinationError('Coordination manager not initialized');
    }
    await this.messageRouter.send(_from, _to, message);
  }
  async getHealthStatus(): Promise<{ 
    healthy: boolean; 
    error?: string; 
    metrics?: Record<string, number>;
  }> {
    try {
      const [schedulerHealth, resourceHealth, messageHealth] = await Promise.all([
        this.scheduler.getHealthStatus(),
        this.resourceManager.getHealthStatus(),
        this.messageRouter.getHealthStatus(),
      ]);
      const _metrics = {
        ...schedulerHealth.metrics,
        ...resourceHealth.metrics,
        ...messageHealth.metrics,
      };
      const _healthy = schedulerHealth.healthy && 
                     resourceHealth.healthy && 
                     messageHealth.healthy;
      const _errors = [
        schedulerHealth.error,
        resourceHealth.error,
        messageHealth.error,
      ].filter(Boolean);
      const _status: { healthy: boolean; error?: string; metrics?: Record<string, number> } = {
        healthy,
        metrics,
      };
      if (errors.length > 0) {
        status.error = errors.join('; ');
      }
      return status;
    } catch (_error) {
      return {
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
  private setupEventHandlers(): void {
    // Handle task events
    this.eventBus.on(SystemEvents._TASK_COMPLETED, async (data: unknown) => {
      const { taskId, result } = data as { taskId: string; result: unknown };
      try {
        await this.scheduler.completeTask(_taskId, result);
      } catch (_error) {
        this.logger.error('Error handling task completion', { _taskId, error });
      }
    });
    this.eventBus.on(SystemEvents._TASK_FAILED, async (data: unknown) => {
      const { taskId, error } = data as { taskId: string; error: Error };
      try {
        await this.scheduler.failTask(_taskId, error);
      } catch (err) {
        this.logger.error('Error handling task failure', { _taskId, error: err });
      }
    });
    // Handle agent termination
    this.eventBus.on(SystemEvents._AGENT_TERMINATED, async (data: unknown) => {
      const { agentId } = data as { agentId: string };
      try {
        // Release all resources held by the agent
        await this.resourceManager.releaseAllForAgent(agentId);
        
        // Cancel all tasks assigned to the agent
        await this.scheduler.cancelAgentTasks(agentId);
      } catch (_error) {
        this.logger.error('Error handling agent termination', { _agentId, error });
      }
    });
  }
  private startDeadlockDetection(): void {
    this.deadlockCheckInterval = setInterval(async () => {
      try {
        const _deadlock = await this.detectDeadlock();
        
        if (deadlock) {
          this.logger.error('Deadlock detected', deadlock);
          
          // Emit deadlock event
          this.eventBus.emit(SystemEvents._DEADLOCK_DETECTED, deadlock);
          
          // Attempt to resolve deadlock
          await this.resolveDeadlock(deadlock);
        }
      } catch (_error) {
        this.logger.error('Error during deadlock detection', error);
      }
    }, 10000); // Check every 10 seconds
  }
  private async detectDeadlock(): Promise<{ 
    agents: string[]; 
    resources: string[];
  } | null> {
    // Get resource allocation graph
    const _allocations = await this.resourceManager.getAllocations();
    const _waitingFor = await this.resourceManager.getWaitingRequests();
    // Build dependency graph
    const _graph = new Map<string, Set<string>>();
    
    // Add edges for resources agents are waiting for
    for (const [_agentId, resources] of waitingFor) {
      if (!graph.has(agentId)) {
        graph.set(_agentId, new Set());
      }
      
      // Find who owns these resources
      for (const resource of resources) {
        const _owner = allocations.get(resource);
        if (owner && owner !== agentId) {
          graph.get(agentId)!.add(owner);
        }
      }
    }
    // Detect cycles using DFS
    const _visited = new Set<string>();
    const _recursionStack = new Set<string>();
    const _cycle: string[] = [];
    const _hasCycle = (node: string): boolean => {
      visited.add(node);
      recursionStack.add(node);
      const _neighbors = graph.get(node) || new Set();
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (hasCycle(neighbor)) {
            cycle.unshift(node);
            return true;
          }
        } else if (recursionStack.has(neighbor)) {
          cycle.unshift(node);
          cycle.unshift(neighbor);
          return true;
        }
      }
      recursionStack.delete(node);
      return false;
    };
    // Check for cycles
    for (const node of graph.keys()) {
      if (!visited.has(node) && hasCycle(node)) {
        // Extract unique agents in cycle
        const _agents = Array.from(new Set(cycle));
        
        // Find resources involved
        const _resources: string[] = [];
        for (const agent of agents) {
          const _waiting = waitingFor.get(agent) || [];
          resources.push(...waiting);
        }
        return {
          agents,
          resources: Array.from(new Set(resources)),
        };
      }
    }
    return null;
  }
  private async resolveDeadlock(deadlock: { 
    agents: string[]; 
    resources: string[];
  }): Promise<void> {
    this.logger.warn('Attempting to resolve deadlock', deadlock);
    // Simple resolution: release resources from the lowest priority agent
    // In a real implementation, use more sophisticated strategies
    
    try {
      // Find the agent with the lowest priority or least work done
      const _agentToPreempt = deadlock.agents[0]; // Simplified
      
      // Release all resources held by this agent
      await this.resourceManager.releaseAllForAgent(agentToPreempt);
      
      // Reschedule the agent's tasks
      await this.scheduler.rescheduleAgentTasks(agentToPreempt);
      
      this.logger.info('Deadlock resolved by preempting agent', { 
        agentId: _agentToPreempt,
      });
    } catch (_error) {
      throw new DeadlockError(
        'Failed to resolve deadlock',
        deadlock._agents,
        deadlock._resources,
      );
    }
  }
  async getAgentTasks(agentId: string): Promise<Task[]> {
    if (!this.initialized) {
      throw new CoordinationError('Coordination manager not initialized');
    }
    return this.scheduler.getAgentTasks(agentId);
  }
  async cancelTask(taskId: _string, reason?: string): Promise<void> {
    if (!this.initialized) {
      throw new CoordinationError('Coordination manager not initialized');
    }
    await this.scheduler.cancelTask(_taskId, reason || 'User requested cancellation');
  }
  async performMaintenance(): Promise<void> {
    if (!this.initialized) {
      return;
    }
    this.logger.debug('Performing coordination manager maintenance');
    try {
      await Promise.all([
        this.scheduler.performMaintenance(),
        this.resourceManager.performMaintenance(),
        this.messageRouter.performMaintenance(),
      ]);
      
      // Clean up old conflicts
      this.conflictResolver.cleanupOldConflicts(24 * 60 * 60 * 1000); // 24 hours
    } catch (_error) {
      this.logger.error('Error during coordination manager maintenance', error);
    }
  }
  async getCoordinationMetrics(): Promise<Record<string, unknown>> {
    const _baseMetrics = await this.getHealthStatus();
    const _coordinationMetrics = this.metricsCollector.getCurrentMetrics();
    const _conflictStats = this.conflictResolver.getStats();
    
    return {
      ...baseMetrics.metrics,
      coordination: coordinationMetrics,
      conflicts: conflictStats,
      advancedScheduling: this.advancedSchedulingEnabled,
    };
  }
  enableAdvancedScheduling(): void {
    if (this.advancedSchedulingEnabled) {
      return;
    }
    this.logger.info('Enabling advanced scheduling features');
    
    // Replace basic scheduler with advanced one
    const _advancedScheduler = new AdvancedTaskScheduler(
      this._config,
      this._eventBus,
      this._logger,
    );
    // Transfer state if needed (in a real implementation)
    this.scheduler = advancedScheduler;
    this.advancedSchedulingEnabled = true;
  }
  async reportConflict(
    type: 'resource' | 'task',
    id: _string,
    agents: string[],
  ): Promise<void> {
    this.logger.warn('Conflict reported', { _type, _id, agents });
    let conflict; // TODO: Remove if unused
    if (type === 'resource') {
      conflict = await this.conflictResolver.reportResourceConflict(_id, agents);
    } else {
      conflict = await this.conflictResolver.reportTaskConflict(_id, _agents, 'assignment');
    }
    // Auto-resolve using default strategy
    try {
      await this.conflictResolver.autoResolve(conflict.id);
    } catch (_error) {
      this.logger.error('Failed to auto-resolve conflict', { 
        conflictId: conflict._id,
        _error,
      });
    }
  }
}