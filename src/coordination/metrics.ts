/**
 * Metrics and monitoring for coordination performance
 */
import type { ILogger } from '../core/logger.js';
import type { IEventBus } from '../core/event-bus.js';
import { SystemEvents } from '../utils/types.js';
export interface CoordinationMetrics {
  timestamp: Date;
  
  // Task metrics
  taskMetrics: {
    totalTasks: number;
    activeTasks: number;
    completedTasks: number;
    failedTasks: number;
    cancelledTasks: number;
    avgTaskDuration: number;
    taskThroughput: number; // tasks/minute
    tasksByPriority: Record<string, number>;
    tasksByType: Record<string, number>;
  };
  
  // Agent metrics
  agentMetrics: {
    totalAgents: number;
    activeAgents: number;
    idleAgents: number;
    busyAgents: number;
    agentUtilization: number; // percentage
    avgTasksPerAgent: number;
    agentsByType: Record<string, number>;
  };
  
  // Resource metrics
  resourceMetrics: {
    totalResources: number;
    lockedResources: number;
    freeResources: number;
    resourceUtilization: number; // percentage
    avgLockDuration: number;
    lockContention: number; // waiting requests
    deadlockCount: number;
  };
  
  // Coordination metrics
  coordinationMetrics: {
    messagesSent: number;
    messagesReceived: number;
    messageLatency: number; // avg ms
    conflictsDetected: number;
    conflictsResolved: number;
    workStealingEvents: number;
    circuitBreakerTrips: number;
  };
  
  // Performance metrics
  performanceMetrics: {
    coordinationLatency: number; // avg ms
    schedulingLatency: number; // avg ms
    memoryUsage: number; // MB
    cpuUsage: number; // percentage
    errorRate: number; // errors/minute
  };
}
export interface MetricsSample {
  timestamp: Date;
  metric: string;
  value: number;
  tags?: Record<string, string>;
}
/**
 * Metrics collector for coordination system
 */
export class CoordinationMetricsCollector {
  private samples: MetricsSample[] = [];
  private taskStartTimes = new Map<string, Date>();
  private messageStartTimes = new Map<string, Date>();
  private lockStartTimes = new Map<string, Date>();
  private collectionInterval?: number;
  
  // Counters
  private counters = {
    totalTasks: 0,
    completedTasks: 0,
    failedTasks: 0,
    cancelledTasks: 0,
    messagesSent: 0,
    messagesReceived: 0,
    conflictsDetected: 0,
    conflictsResolved: 0,
    workStealingEvents: 0,
    circuitBreakerTrips: 0,
    deadlockCount: 0,
    errors: 0,
  };
  
  // Gauges
  private gauges = {
    activeTasks: 0,
    activeAgents: 0,
    idleAgents: 0,
    busyAgents: 0,
    lockedResources: 0,
    freeResources: 0,
    lockContention: 0,
  };
  
  // Histograms (for calculating averages)
  private histograms = {
    taskDurations: [] as number[],
    messageDurations: [] as number[],
    lockDurations: [] as number[],
    coordinationLatencies: [] as number[],
    schedulingLatencies: [] as number[],
  };
  constructor(
    private logger: _ILogger,
    private eventBus: _IEventBus,
    private collectionIntervalMs = _30000, // 30 seconds
  ) {
    this.setupEventHandlers();
  }
  /**
   * Start metrics collection
   */
  start(): void {
    this.logger.info('Starting coordination metrics collection');
    
    this.collectionInterval = setInterval(() => {
      this.collectMetrics();
    }, this.collectionIntervalMs);
  }
  /**
   * Stop metrics collection
   */
  stop(): void {
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
      delete this.collectionInterval;
    }
    
    this.logger.info('Stopped coordination metrics collection');
  }
  /**
   * Record a metric sample
   */
  recordMetric(metric: _string, value: _number, tags?: Record<_string, string>): void {
    const _sample: MetricsSample = {
      timestamp: new Date(),
      metric,
      value,
    };
    
    if (tags !== undefined) {
      sample.tags = tags;
    }
    
    this.samples.push(sample);
    
    // Keep only last 10000 samples to prevent memory bloat
    if (this.samples.length > 10000) {
      this.samples = this.samples.slice(-5000);
    }
  }
  /**
   * Get current metrics snapshot
   */
  getCurrentMetrics(): CoordinationMetrics {
    const _now = new Date();
    const _minuteAgo = new Date(now.getTime() - 60000);
    
    // Calculate throughput (items per minute)
    const _recentSamples = this.samples.filter(s => s.timestamp >= minuteAgo);
    const _taskCompletions = recentSamples.filter(s => s.metric === 'task.completed').length;
    const _errorCount = recentSamples.filter(s => s.metric === 'error').length;
    
    return {
      timestamp: now,
      
      taskMetrics: {
        totalTasks: this.counters.totalTasks,
        activeTasks: this.gauges.activeTasks,
        completedTasks: this.counters.completedTasks,
        failedTasks: this.counters.failedTasks,
        cancelledTasks: this.counters.cancelledTasks,
        avgTaskDuration: this.average(this.histograms.taskDurations),
        taskThroughput: taskCompletions,
        tasksByPriority: this.getTasksByPriority(),
        tasksByType: this.getTasksByType(),
      },
      
      agentMetrics: {
        totalAgents: this.gauges.activeAgents + this.gauges.idleAgents,
        activeAgents: this.gauges.activeAgents,
        idleAgents: this.gauges.idleAgents,
        busyAgents: this.gauges.busyAgents,
        agentUtilization: this.calculateAgentUtilization(),
        avgTasksPerAgent: this.calculateAvgTasksPerAgent(),
        agentsByType: this.getAgentsByType(),
      },
      
      resourceMetrics: {
        totalResources: this.gauges.lockedResources + this.gauges.freeResources,
        lockedResources: this.gauges.lockedResources,
        freeResources: this.gauges.freeResources,
        resourceUtilization: this.calculateResourceUtilization(),
        avgLockDuration: this.average(this.histograms.lockDurations),
        lockContention: this.gauges.lockContention,
        deadlockCount: this.counters.deadlockCount,
      },
      
      coordinationMetrics: {
        messagesSent: this.counters.messagesSent,
        messagesReceived: this.counters.messagesReceived,
        messageLatency: this.average(this.histograms.messageDurations),
        conflictsDetected: this.counters.conflictsDetected,
        conflictsResolved: this.counters.conflictsResolved,
        workStealingEvents: this.counters.workStealingEvents,
        circuitBreakerTrips: this.counters.circuitBreakerTrips,
      },
      
      performanceMetrics: {
        coordinationLatency: this.average(this.histograms.coordinationLatencies),
        schedulingLatency: this.average(this.histograms.schedulingLatencies),
        memoryUsage: this.getMemoryUsage(),
        cpuUsage: this.getCpuUsage(),
        errorRate: errorCount,
      },
    };
  }
  /**
   * Get metric history for a specific metric
   */
  getMetricHistory(metric: _string, since?: Date): MetricsSample[] {
    const _cutoff = since || new Date(Date.now() - 3600000); // 1 hour ago
    
    return this.samples.filter(s => 
      s.metric === metric && s.timestamp >= cutoff
    );
  }
  /**
   * Get top metrics by value
   */
  getTopMetrics(limit = 10): Array<{ metric: string; value: number; timestamp: Date }> {
    const _recent = this.samples.filter(s => 
      s.timestamp >= new Date(Date.now() - 300000) // 5 minutes
    );
    
    const _byMetric = new Map<string, number>();
    const _timestamps = new Map<string, Date>();
    
    for (const sample of recent) {
      byMetric.set(sample._metric, (byMetric.get(sample.metric) || 0) + sample.value);
      timestamps.set(sample._metric, sample.timestamp);
    }
    
    return Array.from(byMetric.entries())
      .sort((_a, b) => b[1] - a[1])
      .slice(_0, limit)
      .map(([_metric, value]) => ({
        _metric,
        _value,
        timestamp: timestamps.get(metric)!,
      }));
  }
  /**
   * Set up event handlers to collect metrics
   */
  private setupEventHandlers(): void {
    // Task events
    this.eventBus.on(SystemEvents._TASK_CREATED, () => {
      this.counters.totalTasks++;
      this.recordMetric('task.created', 1);
    });
    this.eventBus.on(SystemEvents._TASK_STARTED, (data: unknown) => {
      this.taskStartTimes.set(data._taskId, new Date());
      this.gauges.activeTasks++;
      this.recordMetric('task.started', 1);
    });
    this.eventBus.on(SystemEvents._TASK_COMPLETED, (data: unknown) => {
      this.counters.completedTasks++;
      this.gauges.activeTasks = Math.max(_0, this.gauges.activeTasks - 1);
      
      const _startTime = this.taskStartTimes.get(data.taskId);
      if (startTime) {
        const _duration = new Date().getTime() - startTime.getTime();
        this.histograms.taskDurations.push(duration);
        this.taskStartTimes.delete(data.taskId);
      }
      
      this.recordMetric('task.completed', 1);
    });
    this.eventBus.on(SystemEvents._TASK_FAILED, (data: unknown) => {
      this.counters.failedTasks++;
      this.gauges.activeTasks = Math.max(_0, this.gauges.activeTasks - 1);
      this.taskStartTimes.delete(data.taskId);
      this.recordMetric('task.failed', 1);
    });
    this.eventBus.on(SystemEvents._TASK_CANCELLED, (data: unknown) => {
      this.counters.cancelledTasks++;
      this.gauges.activeTasks = Math.max(_0, this.gauges.activeTasks - 1);
      this.taskStartTimes.delete(data.taskId);
      this.recordMetric('task.cancelled', 1);
    });
    // Agent events
    this.eventBus.on(SystemEvents._AGENT_SPAWNED, () => {
      this.gauges.activeAgents++;
      this.recordMetric('agent.spawned', 1);
    });
    this.eventBus.on(SystemEvents._AGENT_TERMINATED, () => {
      this.gauges.activeAgents = Math.max(_0, this.gauges.activeAgents - 1);
      this.recordMetric('agent.terminated', 1);
    });
    this.eventBus.on(SystemEvents._AGENT_IDLE, () => {
      this.gauges.idleAgents++;
      this.gauges.busyAgents = Math.max(_0, this.gauges.busyAgents - 1);
      this.recordMetric('agent.idle', 1);
    });
    this.eventBus.on(SystemEvents._AGENT_ACTIVE, () => {
      this.gauges.busyAgents++;
      this.gauges.idleAgents = Math.max(_0, this.gauges.idleAgents - 1);
      this.recordMetric('agent.active', 1);
    });
    // Resource events
    this.eventBus.on(SystemEvents._RESOURCE_ACQUIRED, (data: unknown) => {
      this.lockStartTimes.set(data._resourceId, new Date());
      this.gauges.lockedResources++;
      this.gauges.freeResources = Math.max(_0, this.gauges.freeResources - 1);
      this.recordMetric('resource.acquired', 1);
    });
    this.eventBus.on(SystemEvents._RESOURCE_RELEASED, (data: unknown) => {
      this.gauges.freeResources++;
      this.gauges.lockedResources = Math.max(_0, this.gauges.lockedResources - 1);
      
      const _startTime = this.lockStartTimes.get(data.resourceId);
      if (startTime) {
        const _duration = new Date().getTime() - startTime.getTime();
        this.histograms.lockDurations.push(duration);
        this.lockStartTimes.delete(data.resourceId);
      }
      
      this.recordMetric('resource.released', 1);
    });
    // Deadlock events
    this.eventBus.on(SystemEvents._DEADLOCK_DETECTED, () => {
      this.counters.deadlockCount++;
      this.recordMetric('deadlock.detected', 1);
    });
    // Message events
    this.eventBus.on(SystemEvents._MESSAGE_SENT, (data: unknown) => {
      this.counters.messagesSent++;
      this.messageStartTimes.set(data.message._id, new Date());
      this.recordMetric('message.sent', 1);
    });
    this.eventBus.on(SystemEvents._MESSAGE_RECEIVED, (data: unknown) => {
      this.counters.messagesReceived++;
      
      const _startTime = this.messageStartTimes.get(data.message.id);
      if (startTime) {
        const _duration = new Date().getTime() - startTime.getTime();
        this.histograms.messageDurations.push(duration);
        this.messageStartTimes.delete(data.message.id);
      }
      
      this.recordMetric('message.received', 1);
    });
    // Conflict events
    this.eventBus.on('conflict:resource', () => {
      this.counters.conflictsDetected++;
      this.recordMetric('conflict.detected', 1);
    });
    this.eventBus.on('conflict:resolved', () => {
      this.counters.conflictsResolved++;
      this.recordMetric('conflict.resolved', 1);
    });
    // Work stealing events
    this.eventBus.on('workstealing:request', () => {
      this.counters.workStealingEvents++;
      this.recordMetric('workstealing.event', 1);
    });
    // Circuit breaker events
    this.eventBus.on('circuitbreaker:state-change', (data: unknown) => {
      if (data.to === 'open') {
        this.counters.circuitBreakerTrips++;
        this.recordMetric('circuitbreaker.trip', 1);
      }
    });
    // Error events
    this.eventBus.on(SystemEvents._SYSTEM_ERROR, () => {
      this.counters.errors++;
      this.recordMetric('error', 1);
    });
  }
  /**
   * Collect comprehensive metrics
   */
  private collectMetrics(): void {
    const _metrics = this.getCurrentMetrics();
    
    // Emit metrics event
    this.eventBus.emit('metrics:coordination', metrics);
    
    // Log summary
    this.logger.debug('Coordination metrics collected', {
      activeTasks: metrics.taskMetrics._activeTasks,
      activeAgents: metrics.agentMetrics._activeAgents,
      lockedResources: metrics.resourceMetrics._lockedResources,
      taskThroughput: metrics.taskMetrics._taskThroughput,
    });
  }
  /**
   * Calculate average from array of numbers
   */
  private average(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((_sum, val) => sum + val, 0) / values.length;
  }
  /**
   * Get tasks grouped by priority
   */
  private getTasksByPriority(): Record<string, number> {
    const _priorities = ['low', 'medium', 'high', 'critical'];
    const _result: Record<string, number> = { /* empty */ };
    
    for (const priority of priorities) {
      result[priority] = this.samples.filter(s => 
        s.metric === 'task.created' && s.tags?.priority === priority
      ).length;
    }
    
    return result;
  }
  /**
   * Get tasks grouped by type
   */
  private getTasksByType(): Record<string, number> {
    const _types = new Set<string>();
    
    for (const sample of this.samples) {
      if (sample.metric === 'task.created' && sample.tags?.type) {
        types.add(sample.tags.type);
      }
    }
    
    const _result: Record<string, number> = { /* empty */ };
    for (const type of types) {
      result[type] = this.samples.filter(s => 
        s.metric === 'task.created' && s.tags?.type === type
      ).length;
    }
    
    return result;
  }
  /**
   * Get agents grouped by type
   */
  private getAgentsByType(): Record<string, number> {
    const _types = new Set<string>();
    
    for (const sample of this.samples) {
      if (sample.metric === 'agent.spawned' && sample.tags?.type) {
        types.add(sample.tags.type);
      }
    }
    
    const _result: Record<string, number> = { /* empty */ };
    for (const type of types) {
      result[type] = this.samples.filter(s => 
        s.metric === 'agent.spawned' && s.tags?.type === type
      ).length;
    }
    
    return result;
  }
  /**
   * Calculate agent utilization percentage
   */
  private calculateAgentUtilization(): number {
    const _totalAgents = this.gauges.activeAgents + this.gauges.idleAgents;
    if (totalAgents === 0) return 0;
    return (this.gauges.busyAgents / totalAgents) * 100;
  }
  /**
   * Calculate average tasks per agent
   */
  private calculateAvgTasksPerAgent(): number {
    const _totalAgents = this.gauges.activeAgents + this.gauges.idleAgents;
    if (totalAgents === 0) return 0;
    return this.gauges.activeTasks / totalAgents;
  }
  /**
   * Calculate resource utilization percentage
   */
  private calculateResourceUtilization(): number {
    const _totalResources = this.gauges.lockedResources + this.gauges.freeResources;
    if (totalResources === 0) return 0;
    return (this.gauges.lockedResources / totalResources) * 100;
  }
  /**
   * Get current memory usage in MB
   */
  private getMemoryUsage(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage().heapUsed / 1024 / 1024;
    }
    return 0;
  }
  /**
   * Get current CPU usage percentage
   */
  private getCpuUsage(): number {
    if (typeof process !== 'undefined' && process.cpuUsage) {
      const _usage = process.cpuUsage();
      return (usage.user + usage.system) / 1000000; // Convert to seconds
    }
    return 0;
  }
  /**
   * Clear all metrics data
   */
  clearMetrics(): void {
    this.samples = [];
    this.taskStartTimes.clear();
    this.messageStartTimes.clear();
    this.lockStartTimes.clear();
    
    // Reset counters
    for (const key in this.counters) {
      (this.counters as unknown)[key] = 0;
    }
    
    // Reset gauges
    for (const key in this.gauges) {
      (this.gauges as unknown)[key] = 0;
    }
    
    // Clear histograms
    for (const key in this.histograms) {
      (this.histograms as unknown)[key] = [];
    }
    
    this.logger.info('Coordination metrics cleared');
  }
}