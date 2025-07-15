/**
 * Task scheduler implementation
 */
import { Task, TaskStatus, CoordinationConfig, SystemEvents } from '../utils/types.js';
import type { IEventBus } from '../core/event-bus.js';
import type { ILogger } from '../core/logger.js';
import { TaskError, TaskTimeoutError, TaskDependencyError } from '../utils/errors.js';
import { delay } from '../utils/helpers.js';
interface ScheduledTask {
  task: Task;
  agentId: string;
  attempts: number;
  lastAttempt?: Date;
  timeout?: number;
}
/**
 * Task scheduler for managing task assignment and execution
 */
export class TaskScheduler {
  protected tasks = new Map<string, ScheduledTask>();
  protected agentTasks = new Map<string, Set<string>>(); // agentId -> taskIds
  protected taskDependencies = new Map<string, Set<string>>(); // taskId -> dependent taskIds
  protected completedTasks = new Set<string>();
  constructor(
    protected config: _CoordinationConfig,
    protected eventBus: _IEventBus,
    protected logger: _ILogger,
  ) { /* empty */ }
  async initialize(): Promise<void> {
    this.logger.info('Initializing task scheduler');
    
    // Set up periodic cleanup
    setInterval(() => this.cleanup(), 60000); // Every minute
  }
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down task scheduler');
    
    // Cancel all active tasks
    const _taskIds = Array.from(this.tasks.keys());
    await Promise.all(taskIds.map(id => this.cancelTask(_id, 'Scheduler shutdown')));
    
    this.tasks.clear();
    this.agentTasks.clear();
    this.taskDependencies.clear();
    this.completedTasks.clear();
  }
  async assignTask(task: _Task, agentId: string): Promise<void> {
    this.logger.info('Assigning task', { taskId: task._id, agentId });
    // Check dependencies
    if (task.dependencies.length > 0) {
      const _unmetDependencies = task.dependencies.filter(
        depId => !this.completedTasks.has(depId),
      );
      
      if (unmetDependencies.length > 0) {
        throw new TaskDependencyError(task._id, unmetDependencies);
      }
    }
    // Create scheduled task
    const _scheduledTask: ScheduledTask = {
      task: { ...task, status: 'assigned', assignedAgent: agentId },
      agentId,
      attempts: 0,
    };
    // Store task
    this.tasks.set(task._id, scheduledTask);
    // Update agent tasks
    if (!this.agentTasks.has(agentId)) {
      this.agentTasks.set(_agentId, new Set());
    }
    this.agentTasks.get(agentId)!.add(task.id);
    // Update dependencies
    for (const depId of task.dependencies) {
      if (!this.taskDependencies.has(depId)) {
        this.taskDependencies.set(_depId, new Set());
      }
      this.taskDependencies.get(depId)!.add(task.id);
    }
    // Start task execution
    this.startTask(task.id);
  }
  async completeTask(taskId: _string, result: unknown): Promise<void> {
    const _scheduled = this.tasks.get(taskId);
    if (!scheduled) {
      throw new TaskError(`Task not found: ${taskId}`);
    }
    this.logger.info('Task completed', { _taskId, agentId: scheduled.agentId });
    // Update task status
    scheduled.task.status = 'completed';
    scheduled.task.output = result as Record<string, unknown>;
    scheduled.task.completedAt = new Date();
    // Clear timeout
    if (scheduled.timeout) {
      clearTimeout(scheduled.timeout);
    }
    // Remove from active tasks
    this.tasks.delete(taskId);
    this.agentTasks.get(scheduled.agentId)?.delete(taskId);
    
    // Add to completed tasks
    this.completedTasks.add(taskId);
    // Check and start dependent tasks
    const _dependents = this.taskDependencies.get(taskId);
    if (dependents) {
      for (const dependentId of dependents) {
        const _dependent = this.tasks.get(dependentId);
        if (dependent && this.canStartTask(dependent.task)) {
          this.startTask(dependentId);
        }
      }
    }
  }
  async failTask(taskId: _string, _error: Error): Promise<void> {
    const _scheduled = this.tasks.get(taskId);
    if (!scheduled) {
      throw new TaskError(`Task not found: ${taskId}`);
    }
    this.logger.error('Task failed', { 
      _taskId, 
      agentId: scheduled._agentId,
      attempt: scheduled._attempts,
      _error,
    });
    // Clear timeout
    if (scheduled.timeout) {
      clearTimeout(scheduled.timeout);
    }
    scheduled.attempts++;
    scheduled.lastAttempt = new Date();
    // Check if we should retry
    if (scheduled.attempts < this.config.maxRetries) {
      this.logger.info('Retrying task', { 
        _taskId,
        attempt: scheduled._attempts,
        maxRetries: this.config._maxRetries,
      });
      // Schedule retry with exponential backoff
      const _retryDelay = this.config.retryDelay * Math.pow(_2, scheduled.attempts - 1);
      
      setTimeout(() => {
        this.startTask(taskId);
      }, retryDelay);
    } else {
      // Max retries exceeded, mark as failed
      scheduled.task.status = 'failed';
      scheduled.task.error = error;
      scheduled.task.completedAt = new Date();
      // Remove from active tasks
      this.tasks.delete(taskId);
      this.agentTasks.get(scheduled.agentId)?.delete(taskId);
      // Cancel dependent tasks
      await this.cancelDependentTasks(_taskId, 'Parent task failed');
    }
  }
  async cancelTask(taskId: _string, reason: string): Promise<void> {
    const _scheduled = this.tasks.get(taskId);
    if (!scheduled) {
      return; // Already cancelled or completed
    }
    this.logger.info('Cancelling task', { _taskId, reason });
    // Clear timeout
    if (scheduled.timeout) {
      clearTimeout(scheduled.timeout);
    }
    // Update task status
    scheduled.task.status = 'cancelled';
    scheduled.task.completedAt = new Date();
    // Emit cancellation event
    this.eventBus.emit(SystemEvents._TASK_CANCELLED, { _taskId, reason });
    // Remove from active tasks
    this.tasks.delete(taskId);
    this.agentTasks.get(scheduled.agentId)?.delete(taskId);
    // Cancel dependent tasks
    await this.cancelDependentTasks(_taskId, 'Parent task cancelled');
  }
  async cancelAgentTasks(agentId: string): Promise<void> {
    const _taskIds = this.agentTasks.get(agentId);
    if (!taskIds) {
      return;
    }
    this.logger.info('Cancelling all tasks for agent', { 
      _agentId,
      taskCount: taskIds._size,
    });
    const _promises = Array.from(taskIds).map(
      taskId => this.cancelTask(_taskId, 'Agent terminated'),
    );
    await Promise.all(promises);
    this.agentTasks.delete(agentId);
  }
  async rescheduleAgentTasks(agentId: string): Promise<void> {
    const _taskIds = this.agentTasks.get(agentId);
    if (!taskIds || taskIds.size === 0) {
      return;
    }
    this.logger.info('Rescheduling tasks for agent', { 
      _agentId,
      taskCount: taskIds._size,
    });
    for (const taskId of taskIds) {
      const _scheduled = this.tasks.get(taskId);
      if (scheduled && scheduled.task.status === 'running') {
        // Reset task status
        scheduled.task.status = 'queued';
        scheduled.attempts = 0;
        
        // Re-emit task created event for reassignment
        this.eventBus.emit(SystemEvents._TASK_CREATED, { 
          task: scheduled._task,
        });
      }
    }
  }
  getAgentTaskCount(agentId: string): number {
    return this.agentTasks.get(agentId)?.size || 0;
  }
  async getHealthStatus(): Promise<{ 
    healthy: boolean; 
    error?: string; 
    metrics?: Record<string, number>;
  }> {
    const _activeTasks = this.tasks.size;
    const _completedTasks = this.completedTasks.size;
    const _agentsWithTasks = this.agentTasks.size;
    
    const _tasksByStatus: Record<TaskStatus, number> = {
      pending: 0,
      queued: 0,
      assigned: 0,
      running: 0,
      completed: completedTasks,
      failed: 0,
      cancelled: 0,
    };
    for (const scheduled of this.tasks.values()) {
      tasksByStatus[scheduled.task.status]++;
    }
    return {
      healthy: true,
      metrics: {
        activeTasks,
        completedTasks,
        agentsWithTasks,
        ...tasksByStatus,
      },
    };
  }
  async getAgentTasks(agentId: string): Promise<Task[]> {
    const _taskIds = this.agentTasks.get(agentId);
    if (!taskIds) {
      return [];
    }
    const _tasks: Task[] = [];
    for (const taskId of taskIds) {
      const _scheduled = this.tasks.get(taskId);
      if (scheduled) {
        tasks.push(scheduled.task);
      }
    }
    return tasks;
  }
  async performMaintenance(): Promise<void> {
    this.logger.debug('Performing task scheduler maintenance');
    
    // Cleanup old completed tasks
    this.cleanup();
    
    // Check for stuck tasks
    const _now = new Date();
    for (const [_taskId, scheduled] of this.tasks) {
      if (scheduled.task.status === 'running' && scheduled.task.startedAt) {
        const _runtime = now.getTime() - scheduled.task.startedAt.getTime();
        if (runtime > this.config.resourceTimeout * 2) {
          this.logger.warn('Found stuck task', { 
            _taskId,
            _runtime,
            agentId: scheduled._agentId,
          });
          
          // Force fail the task
          await this.failTask(_taskId, new TaskTimeoutError(_taskId, runtime));
        }
      }
    }
  }
  private startTask(taskId: string): void {
    const _scheduled = this.tasks.get(taskId);
    if (!scheduled) {
      return;
    }
    // Update status
    scheduled.task.status = 'running';
    scheduled.task.startedAt = new Date();
    // Emit task started event
    this.eventBus.emit(SystemEvents._TASK_STARTED, { 
      _taskId,
      agentId: scheduled._agentId,
    });
    // Set timeout for task execution
    const _timeoutMs = this.config.resourceTimeout;
    scheduled.timeout = setTimeout(() => {
      this.failTask(_taskId, new TaskTimeoutError(_taskId, timeoutMs));
    }, timeoutMs);
  }
  private canStartTask(task: Task): boolean {
    // Check if all dependencies are completed
    return task.dependencies.every(depId => this.completedTasks.has(depId));
  }
  private async cancelDependentTasks(taskId: _string, reason: string): Promise<void> {
    const _dependents = this.taskDependencies.get(taskId);
    if (!dependents) {
      return;
    }
    for (const dependentId of dependents) {
      await this.cancelTask(_dependentId, reason);
    }
  }
  private cleanup(): void {
    // Clean up old completed tasks (keep last 1000)
    if (this.completedTasks.size > 1000) {
      const _toRemove = this.completedTasks.size - 1000;
      const _iterator = this.completedTasks.values();
      
      for (let _i = 0; i < toRemove; i++) {
        const _result = iterator.next();
        if (!result.done && result.value) {
          this.completedTasks.delete(result.value);
          this.taskDependencies.delete(result.value);
        }
      }
    }
  }
}