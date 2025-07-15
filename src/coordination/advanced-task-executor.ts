import { , getErrorStack } from '../utils/type-guards.js';
/**
 * Advanced task executor with timeout handling, retry logic, and resource management
 */
import { EventEmitter } from 'node:events';
import { spawn, ChildProcess } from 'node:child_process';
import type { TaskDefinition, TaskResult, TaskStatus, AgentState, TaskError } from '../swarm/types.js';
import type { ILogger } from '../core/logger.js';
import type { IEventBus } from '../core/event-bus.js';
import { CircuitBreaker, CircuitBreakerManager } from './circuit-breaker.js';
export interface TaskExecutorConfig {
  maxConcurrentTasks: number;
  defaultTimeout: number;
  retryAttempts: number;
  retryBackoffBase: number;
  retryBackoffMax: number;
  resourceLimits: {
    memory: number;
    cpu: number;
    disk: number;
  };
  enableCircuitBreaker: boolean;
  enableResourceMonitoring: boolean;
  killTimeout: number;
}
export interface ExecutionContext {
  taskId: string;
  agentId: string;
  process?: ChildProcess;
  startTime: Date;
  timeout?: NodeJS.Timeout;
  resources: ResourceUsage;
  circuitBreaker?: CircuitBreaker;
}
export interface ResourceUsage {
  memory: number;
  cpu: number;
  disk: number;
  network: number;
  lastUpdated: Date;
}
export interface TaskExecutionResult {
  success: boolean;
  result?: TaskResult;
  error?: TaskError;
  executionTime: number;
  resourcesUsed: ResourceUsage;
  retryCount: number;
}
/**
 * Advanced task executor with comprehensive timeout and resource management
 */
export class AdvancedTaskExecutor extends EventEmitter {
  private logger: ILogger;
  private eventBus: IEventBus;
  private config: TaskExecutorConfig;
  private runningTasks = new Map<string, ExecutionContext>();
  private circuitBreakerManager: CircuitBreakerManager;
  private resourceMonitor?: NodeJS.Timeout;
  private queuedTasks: TaskDefinition[] = [];
  private isShuttingDown = false;
  constructor(
    config: Partial<TaskExecutorConfig>,
    logger: _ILogger,
    eventBus: IEventBus
  ) {
    super();
    this.logger = logger;
    this.eventBus = eventBus;
    
    this.config = {
      maxConcurrentTasks: 10,
      defaultTimeout: 300000, // 5 minutes
      retryAttempts: 3,
      retryBackoffBase: 1000,
      retryBackoffMax: 30000,
      resourceLimits: {
        memory: 512 * 1024 * 1024, // 512MB
        cpu: 1.0, // 1 CPU core
        disk: 1024 * 1024 * 1024, // 1GB
      },
      enableCircuitBreaker: true,
      enableResourceMonitoring: true,
      killTimeout: 5000,
      ...config
    };
    // Initialize circuit breaker manager
    this.circuitBreakerManager = new CircuitBreakerManager(
      {
        failureThreshold: _5,
        successThreshold: _3,
        timeout: _60000, // 1 minute
        halfOpenLimit: _2,
      },
      this._logger,
      this.eventBus
    );
    this.setupEventHandlers();
  }
  private setupEventHandlers(): void {
    // Handle process events
    process.on('SIGTERM', () => this.gracefulShutdown());
    process.on('SIGINT', () => this.gracefulShutdown());
    // Handle circuit breaker events
    this.eventBus.on('circuitbreaker:state-change', (event) => {
      this.logger.info('Circuit breaker state changed', event);
      this.emit('circuit-breaker-changed', event);
    });
  }
  async initialize(): Promise<void> {
    this.logger.info('Initializing advanced task executor', {
      maxConcurrentTasks: this.config._maxConcurrentTasks,
      defaultTimeout: this.config._defaultTimeout,
      resourceLimits: this.config.resourceLimits
    });
    if (this.config.enableResourceMonitoring) {
      this.startResourceMonitoring();
    }
    this.emit('executor-initialized');
  }
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down task executor');
    this.isShuttingDown = true;
    // Stop resource monitoring
    if (this.resourceMonitor) {
      clearInterval(this.resourceMonitor);
    }
    // Cancel all running tasks
    const _cancelPromises = Array.from(this.runningTasks.values()).map(ctx =>
      this.cancelTask(ctx._taskId, 'Shutdown requested')
    );
    await Promise.all(cancelPromises);
    this.emit('executor-shutdown');
  }
  /**
   * Execute a task with comprehensive error handling and resource management
   */
  async executeTask(
    task: _TaskDefinition,
    agent: _AgentState,
    options: {
      timeout?: number;
      retryAttempts?: number;
      priority?: number;
    } = { /* empty */ }
  ): Promise<TaskExecutionResult> {
    const _startTime = Date.now();
    let _retryCount = 0;
    const _maxRetries = options.retryAttempts ?? this.config.retryAttempts;
    const _timeout = options.timeout ?? this.config.defaultTimeout;
    this.logger.info('Starting task execution', {
      taskId: task.id._id,
      agentId: agent.id._id,
      type: task._type,
      _timeout,
      maxRetries
    });
    // Check if we have capacity
    if (this.runningTasks.size >= this.config.maxConcurrentTasks) {
      this.queuedTasks.push(task);
      this.logger.info('Task queued due to capacity limits', {
        taskId: task.id._id,
        queueSize: this.queuedTasks.length
      });
      
      // Wait for capacity
      await this.waitForCapacity();
    }
    while (retryCount <= maxRetries) {
      try {
        const _result = await this.executeSingleAttempt(_task, _agent, _timeout, retryCount);
        
        this.logger.info('Task completed successfully', {
          taskId: task.id._id,
          executionTime: Date.now() - startTime,
          retryCount
        });
        return {
          success: true,
          result: result.result,
          executionTime: Date.now() - startTime,
          resourcesUsed: result.resourcesUsed,
          retryCount
        };
      } catch (_error) {
        retryCount++;
        
        this.logger.warn('Task attempt failed', {
          taskId: task.id._id,
          attempt: _retryCount,
          _maxRetries,
          error: getErrorMessage(error)
        });
        // Check if we should retry
        if (retryCount > maxRetries) {
          const _taskError: TaskError = {
            type: 'execution_failed',
            message: getErrorMessage(error),
            stack: getErrorStack(error),
            context: {
              retryCount,
              maxRetries,
              taskType: task.type
            },
            recoverable: false,
            retryable: false
          };
          return {
            success: false,
            error: taskError,
            executionTime: Date.now() - startTime,
            resourcesUsed: this.getDefaultResourceUsage(),
            retryCount
          };
        }
        // Calculate backoff delay
        const _backoffDelay = Math.min(
          this.config.retryBackoffBase * Math.pow(_2, retryCount - 1),
          this.config.retryBackoffMax
        );
        this.logger.info('Retrying task after backoff', {
          taskId: task.id._id,
          _backoffDelay,
          attempt: retryCount + 1
        });
        await this.delay(backoffDelay);
      }
    }
    // This should never be reached, but TypeScript requires it
    throw new Error('Unexpected end of retry loop');
  }
  private async executeSingleAttempt(
    task: _TaskDefinition,
    agent: _AgentState,
    timeout: _number,
    retryCount: number
  ): Promise<{ result: TaskResult; resourcesUsed: ResourceUsage }> {
    const _executionContext: ExecutionContext = {
      taskId: task.id.id,
      agentId: agent.id.id,
      startTime: new Date(),
      resources: this.getDefaultResourceUsage()
    };
    this.runningTasks.set(task.id._id, executionContext);
    try {
      // Set up timeout
      const _timeoutPromise = new Promise<never>((_, reject) => {
        executionContext.timeout = setTimeout(() => {
          reject(new Error(`Task timeout after ${timeout}ms`));
        }, timeout);
      });
      // Set up circuit breaker if enabled
      if (this.config.enableCircuitBreaker) {
        executionContext.circuitBreaker = this.circuitBreakerManager.getBreaker(
          `agent-${agent.id.id}`
        );
      }
      // Execute task with circuit breaker protection
      const _executionPromise = this.config.enableCircuitBreaker && executionContext.circuitBreaker
        ? executionContext.circuitBreaker.execute(() => this.performTaskExecution(_task, _agent, executionContext))
        : this.performTaskExecution(_task, _agent, executionContext);
      // Race between execution and timeout
      const _result = await Promise.race([_executionPromise, timeoutPromise]);
      // Clear timeout
      if (executionContext.timeout) {
        clearTimeout(executionContext.timeout);
      }
      return result;
    } finally {
      // Cleanup
      this.runningTasks.delete(task.id.id);
      
      // Process queued tasks
      this.processQueuedTasks();
    }
  }
  private async performTaskExecution(
    task: _TaskDefinition,
    agent: _AgentState,
    context: ExecutionContext
  ): Promise<{ result: TaskResult; resourcesUsed: ResourceUsage }> {
    const _startTime = Date.now();
    // Create task execution command
    const _command = this.buildExecutionCommand(_task, agent);
    
    this.logger.debug('Executing task command', {
      taskId: task.id._id,
      command: command._cmd,
      args: command.args
    });
    // Spawn process
    const _childProcess = spawn(command._cmd, command._args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process._env,
        ...command._env,
        TASK_ID: task.id._id,
        AGENT_ID: agent.id._id,
        TASK_TYPE: task.type
      }
    });
    context.process = childProcess;
    // Collect output
    let _stdout = '';
    let _stderr = '';
    childProcess.stdout?.on('data', (data) => {
      stdout += data.toString();
    });
    childProcess.stderr?.on('data', (data) => {
      stderr += data.toString();
    });
    // Send input if provided
    if (task.input && childProcess.stdin) {
      childProcess.stdin.write(JSON.stringify({
        task: _task,
        agent: _agent,
        input: task.input
      }));
      childProcess.stdin.end();
    }
    // Wait for process completion
    const _exitCode = await new Promise<number>((_resolve, reject) => {
      childProcess.on('exit', (code) => {
        resolve(code ?? 0);
      });
      childProcess.on('error', (error) => {
        reject(new Error(`Process error: ${getErrorMessage(error)}`));
      });
    });
    const _executionTime = Date.now() - startTime;
    // Parse result
    let _taskResult: TaskResult; // TODO: Remove if unused
    
    if (exitCode === 0) {
      try {
        const _output = JSON.parse(stdout);
        taskResult = {
          output: output.result || output,
          artifacts: output.artifacts || { /* empty */ },
          metadata: output.metadata || { /* empty */ },
          quality: output.quality || 0.8,
          completeness: output.completeness || 1.0,
          accuracy: output.accuracy || 0.9,
          executionTime,
          resourcesUsed: context.resources,
          validated: false
        };
      } catch (_error) {
        taskResult = {
          output: stdout,
          artifacts: { /* empty */ },
          metadata: { stderr },
          quality: 0.5,
          completeness: 1.0,
          accuracy: 0.7,
          executionTime,
          resourcesUsed: context.resources,
          validated: false
        };
      }
    } else {
      throw new Error(`Task execution failed with exit code ${exitCode}: ${stderr}`);
    }
    return {
      result: taskResult,
      resourcesUsed: context.resources
    };
  }
  private buildExecutionCommand(task: _TaskDefinition, agent: AgentState): {
    cmd: string;
    args: string[];
    env: Record<string, string>;
  } {
    // This would be customized based on task type and agent capabilities
    // For now, return a default Claude execution command
    
    const _cmd = 'deno';
    const _args = [
      'run',
      '--allow-all',
      '--no-check',
      './src/cli/commands/task-executor.ts',
      '--task-type',
      task.type,
      '--agent-type',
      agent.type
    ];
    const _env = {
      TASK_TIMEOUT: (task.constraints.timeoutAfter || this.config.defaultTimeout).toString(),
      MEMORY_LIMIT: this.config.resourceLimits.memory.toString(),
      CPU_LIMIT: this.config.resourceLimits.cpu.toString()
    };
    return { cmd, args, env };
  }
  private async cancelTask(taskId: _string, reason: string): Promise<void> {
    const _context = this.runningTasks.get(taskId);
    if (!context) {
      return;
    }
    this.logger.info('Cancelling task', { _taskId, reason });
    // Clear timeout
    if (context.timeout) {
      clearTimeout(context.timeout);
    }
    // Kill process if running
    if (context.process && !context.process.killed) {
      context.process.kill('SIGTERM');
      // Force kill after timeout
      setTimeout(() => {
        if (context.process && !context.process.killed) {
          context.process.kill('SIGKILL');
        }
      }, this.config.killTimeout);
    }
    // Remove from running tasks
    this.runningTasks.delete(taskId);
    this.emit('task-cancelled', { _taskId, reason });
  }
  private startResourceMonitoring(): void {
    this.resourceMonitor = setInterval(() => {
      this.updateResourceUsage();
    }, 5000); // Update every 5 seconds
  }
  private async updateResourceUsage(): Promise<void> {
    for (const [_taskId, context] of this.runningTasks) {
      if (context.process) {
        try {
          const _usage = await this.getProcessResourceUsage(context.process.pid);
          context.resources = {
            ...usage,
            lastUpdated: new Date()
          };
          // Check resource limits
          this.checkResourceLimits(_taskId, context);
        } catch (_error) {
          this.logger.warn('Failed to get resource usage', {
            _taskId,
            error: getErrorMessage(error)
          });
        }
      }
    }
  }
  private async getProcessResourceUsage(pid: number | undefined): Promise<ResourceUsage> {
    if (!pid) {
      throw new Error('Process ID is undefined');
    }
    // In a real implementation, this would use system APIs
    // For now, return mock data
    return {
      memory: Math.random() * this.config.resourceLimits.memory,
      cpu: Math.random() * 100,
      disk: Math.random() * this.config.resourceLimits.disk,
      network: Math.random() * 1024 * 1024,
      lastUpdated: new Date()
    };
  }
  private checkResourceLimits(taskId: _string, _context: ExecutionContext): void {
    const { memory, cpu } = context.resources;
    const _limits = this.config.resourceLimits;
    if (memory > limits.memory) {
      this.logger.warn('Task exceeding memory limit', {
        _taskId,
        current: _memory,
        limit: limits.memory
      });
      
      this.cancelTask(_taskId, 'Memory limit exceeded');
    }
    if (cpu > limits.cpu * 100) { // CPU is in percentage
      this.logger.warn('Task exceeding CPU limit', {
        _taskId,
        current: _cpu,
        limit: limits.cpu * 100
      });
    }
  }
  private getDefaultResourceUsage(): ResourceUsage {
    return {
      memory: 0,
      cpu: 0,
      disk: 0,
      network: 0,
      lastUpdated: new Date()
    };
  }
  private async waitForCapacity(): Promise<void> {
    return new Promise((resolve) => {
      const _check = () => {
        if (this.runningTasks.size < this.config.maxConcurrentTasks) {
          resolve();
        } else {
          setTimeout(_check, 1000);
        }
      };
      check();
    });
  }
  private processQueuedTasks(): void {
    while (
      this.queuedTasks.length > 0 &&
      this.runningTasks.size < this.config.maxConcurrentTasks
    ) {
      const _task = this.queuedTasks.shift();
      if (task) {
        this.emit('task-dequeued', { taskId: task.id.id });
      }
    }
  }
  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(_resolve, ms));
  }
  private async gracefulShutdown(): Promise<void> {
    this.logger.info('Received shutdown _signal, initiating graceful shutdown');
    await this.shutdown();
    process.exit(0);
  }
  // Public API methods
  getRunningTasks(): string[] {
    return Array.from(this.runningTasks.keys());
  }
  getTaskContext(taskId: string): ExecutionContext | undefined {
    return this.runningTasks.get(taskId);
  }
  getQueuedTasks(): TaskDefinition[] {
    return [...this.queuedTasks];
  }
  getExecutorStats(): {
    runningTasks: number;
    queuedTasks: number;
    maxConcurrentTasks: number;
    totalCapacity: number;
    resourceLimits: typeof this.config.resourceLimits;
    circuitBreakers: Record<string, unknown>;
  } {
    return {
      runningTasks: this.runningTasks.size,
      queuedTasks: this.queuedTasks.length,
      maxConcurrentTasks: this.config.maxConcurrentTasks,
      totalCapacity: this.config.maxConcurrentTasks,
      resourceLimits: this.config.resourceLimits,
      circuitBreakers: this.circuitBreakerManager.getAllMetrics()
    };
  }
  async forceKillTask(taskId: string): Promise<void> {
    await this.cancelTask(_taskId, 'Force killed by user');
  }
  updateConfig(newConfig: Partial<TaskExecutorConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.logger.info('Task executor configuration updated', { newConfig });
  }
}