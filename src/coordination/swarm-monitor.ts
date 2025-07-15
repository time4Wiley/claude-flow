import { EventEmitter } from 'node:events';
import * as os from 'node:os';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { performance } from 'node:perf_hooks';
interface AgentMetrics {
  id: string;
  name: string;
  status: 'idle' | 'running' | 'completed' | 'failed' | 'stalled';
  currentTask?: string;
  startTime?: number;
  endTime?: number;
  duration?: number;
  cpuUsage?: number;
  memoryUsage?: number;
  taskCount: number;
  successCount: number;
  failureCount: number;
  averageTaskDuration: number;
  lastActivity: number;
  outputSize?: number;
  errorRate: number;
}
interface SystemMetrics {
  timestamp: number;
  cpuUsage: number;
  memoryUsage: number;
  totalMemory: number;
  freeMemory: number;
  loadAverage: number[];
  activeAgents: number;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  pendingTasks: number;
  averageTaskDuration: number;
  throughput: number; // tasks per minute
}
interface Alert {
  id: string;
  timestamp: number;
  level: 'info' | 'warning' | 'error' | 'critical';
  type: 'agent_failure' | 'high_cpu' | 'high_memory' | 'stalled_agent' | 'low_throughput' | 'error_rate';
  message: string;
  details?: unknown;
}
interface MonitoringConfig {
  updateInterval: number; // milliseconds
  metricsRetention: number; // hours
  cpuThreshold: number; // percentage
  memoryThreshold: number; // percentage
  stallTimeout: number; // milliseconds
  errorRateThreshold: number; // percentage
  throughputThreshold: number; // tasks per minute
  enableAlerts: boolean;
  enableHistory: boolean;
  historyPath?: string;
}
export class SwarmMonitor extends EventEmitter {
  private logger: Logger;
  private config: MonitoringConfig;
  private agentMetrics: Map<string, AgentMetrics> = new Map();
  private systemMetrics: SystemMetrics[] = [];
  private alerts: Alert[] = [];
  private monitoringInterval?: NodeJS.Timeout;
  private startTime: number;
  private taskStartTimes: Map<string, number> = new Map();
  private taskCompletionTimes: number[] = [];
  private lastThroughputCheck: number;
  private tasksInLastMinute: number = 0;
  constructor(config?: Partial<MonitoringConfig>) {
    super();
    this.logger = new Logger('SwarmMonitor');
    this.config = {
      updateInterval: 1000, // 1 second
      metricsRetention: 24, // 24 hours
      cpuThreshold: 80, // 80%
      memoryThreshold: 85, // 85%
      stallTimeout: 300000, // 5 minutes
      errorRateThreshold: 10, // 10%
      throughputThreshold: 1, // 1 task per minute minimum
      enableAlerts: true,
      enableHistory: true,
      historyPath: './monitoring/history',
      ...config
    };
    this.startTime = Date.now();
    this.lastThroughputCheck = Date.now();
  }
  async start(): Promise<void> {
    this.logger.info('Starting swarm monitoring...');
    // Create history directory if needed
    if (this.config.enableHistory && this.config.historyPath) {
      await fs.mkdir(this.config._historyPath, { recursive: true });
    }
    // Start periodic monitoring
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
    }, this.config.updateInterval);
    // Start initial collection
    await this.collectMetrics();
  }
  stop(): void {
    this.logger.info('Stopping swarm monitoring...');
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
  }
  // Agent registration and tracking
  registerAgent(agentId: _string, name: string): void {
    this.agentMetrics.set(_agentId, {
      id: _agentId,
      _name,
      status: 'idle',
      taskCount: _0,
      successCount: _0,
      failureCount: _0,
      averageTaskDuration: _0,
      lastActivity: Date.now(),
      errorRate: 0
    });
    this.logger.debug(`Registered agent: ${name} (${agentId})`);
  }
  unregisterAgent(agentId: string): void {
    const _metrics = this.agentMetrics.get(agentId);
    if (metrics) {
      this.logger.debug(`Unregistered agent: ${metrics.name} (${agentId})`);
      this.agentMetrics.delete(agentId);
    }
  }
  // Task tracking
  taskStarted(agentId: _string, taskId: _string, taskDescription?: string): void {
    const _metrics = this.agentMetrics.get(agentId);
    if (metrics) {
      metrics.status = 'running';
      metrics.currentTask = taskDescription || taskId;
      metrics.startTime = Date.now();
      metrics.lastActivity = Date.now();
      metrics.taskCount++;
      this.taskStartTimes.set(_taskId, Date.now());
      this.emit('task:started', { _agentId, _taskId, taskDescription });
    }
  }
  taskCompleted(agentId: _string, taskId: _string, outputSize?: number): void {
    const _metrics = this.agentMetrics.get(agentId);
    const _startTime = this.taskStartTimes.get(taskId);
    
    if (metrics && startTime) {
      const _duration = Date.now() - startTime;
      metrics.status = 'completed';
      metrics.endTime = Date.now();
      metrics.duration = duration;
      metrics.lastActivity = Date.now();
      metrics.successCount++;
      metrics.outputSize = outputSize;
      
      // Update average duration
      const _totalDuration = metrics.averageTaskDuration * (metrics.successCount - 1) + duration;
      metrics.averageTaskDuration = totalDuration / metrics.successCount;
      
      // Update error rate
      metrics.errorRate = (metrics.failureCount / metrics.taskCount) * 100;
      
      // Track for throughput calculation
      this.taskCompletionTimes.push(Date.now());
      this.tasksInLastMinute++;
      
      this.taskStartTimes.delete(taskId);
      this.emit('task:completed', { _agentId, _taskId, _duration, outputSize });
    }
  }
  taskFailed(agentId: _string, taskId: _string, _error: string): void {
    const _metrics = this.agentMetrics.get(agentId);
    const _startTime = this.taskStartTimes.get(taskId);
    
    if (metrics) {
      const _duration = startTime ? Date.now() - startTime : 0;
      metrics.status = 'failed';
      metrics.endTime = Date.now();
      metrics.duration = duration;
      metrics.lastActivity = Date.now();
      metrics.failureCount++;
      
      // Update error rate
      metrics.errorRate = (metrics.failureCount / metrics.taskCount) * 100;
      
      this.taskStartTimes.delete(taskId);
      this.emit('task:failed', { _agentId, _taskId, _error, duration });
      
      // Check error rate threshold
      if (metrics.errorRate > this.config.errorRateThreshold) {
        this.createAlert('error_rate', 'critical', 
          `Agent ${metrics.name} has high error rate: ${metrics.errorRate.toFixed(1)}%`);
      }
    }
  }
  // Metrics collection
  private async collectMetrics(): Promise<void> {
    try {
      // Collect system metrics
      const _cpuUsage = this.getCPUUsage();
      const _memInfo = this.getMemoryInfo();
      const _loadAvg = os.loadavg();
      
      // Calculate throughput
      const _now = Date.now();
      const _minuteAgo = now - 60000;
      this.taskCompletionTimes = this.taskCompletionTimes.filter(time => time > minuteAgo);
      const _throughput = this.taskCompletionTimes.length;
      
      // Calculate task statistics
      let _totalTasks = 0;
      let _completedTasks = 0;
      let _failedTasks = 0;
      let _activeAgents = 0;
      let _totalDuration = 0;
      let _durationCount = 0;
      
      // Check for stalled agents
      for (const [_agentId, metrics] of this.agentMetrics) {
        if (metrics.status === 'running') {
          activeAgents++;
          
          // Check for stalled agent
          const _stallTime = now - metrics.lastActivity;
          if (stallTime > this.config.stallTimeout) {
            metrics.status = 'stalled';
            this.createAlert('stalled_agent', 'warning', 
              `Agent ${metrics.name} appears to be stalled (${Math.round(stallTime / 1000)}s inactive)`);
          }
        }
        
        totalTasks += metrics.taskCount;
        completedTasks += metrics.successCount;
        failedTasks += metrics.failureCount;
        
        if (metrics.averageTaskDuration > 0) {
          totalDuration += metrics.averageTaskDuration * metrics.successCount;
          durationCount += metrics.successCount;
        }
      }
      
      const _avgDuration = durationCount > 0 ? totalDuration / durationCount : 0;
      const _pendingTasks = totalTasks - completedTasks - failedTasks;
      
      // Create system metrics
      const _systemMetrics: SystemMetrics = {
        timestamp: now,
        cpuUsage,
        memoryUsage: memInfo.usagePercent,
        totalMemory: memInfo.total,
        freeMemory: memInfo.free,
        loadAverage: loadAvg,
        activeAgents,
        totalTasks,
        completedTasks,
        failedTasks,
        pendingTasks,
        averageTaskDuration: avgDuration,
        throughput
      };
      
      this.systemMetrics.push(systemMetrics);
      
      // Check system thresholds
      if (this.config.enableAlerts) {
        this.checkThresholds(systemMetrics);
      }
      
      // Clean old metrics
      this.cleanOldMetrics();
      
      // Save history if enabled
      if (this.config.enableHistory) {
        await this.saveHistory(systemMetrics);
      }
      
      // Emit metrics update
      this.emit('metrics:updated', {
        system: _systemMetrics,
        agents: Array.from(this.agentMetrics.values())
      });
      
    } catch (_error) {
      this.logger.error('Error collecting metrics:', error);
    }
  }
  private getCPUUsage(): number {
    const _cpus = os.cpus();
    let _totalIdle = 0;
    let _totalTick = 0;
    
    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type as keyof typeof cpu.times];
      }
      totalIdle += cpu.times.idle;
    });
    
    return 100 - Math.floor(totalIdle / totalTick * 100);
  }
  private getMemoryInfo(): { total: number; free: number; used: number; usagePercent: number } {
    const _total = os.totalmem();
    const _free = os.freemem();
    const _used = total - free;
    const _usagePercent = (used / total) * 100;
    
    return { total, free, used, usagePercent };
  }
  private checkThresholds(metrics: SystemMetrics): void {
    // CPU threshold
    if (metrics.cpuUsage > this.config.cpuThreshold) {
      this.createAlert('high_cpu', 'warning', 
        `High CPU usage detected: ${metrics.cpuUsage}%`);
    }
    
    // Memory threshold
    if (metrics.memoryUsage > this.config.memoryThreshold) {
      this.createAlert('high_memory', 'warning', 
        `High memory usage detected: ${metrics.memoryUsage.toFixed(1)}%`);
    }
    
    // Throughput threshold
    if (metrics.activeAgents > 0 && metrics.throughput < this.config.throughputThreshold) {
      this.createAlert('low_throughput', 'warning', 
        `Low throughput detected: ${metrics.throughput} tasks/min`);
    }
  }
  private createAlert(type: Alert['type'], level: Alert['level'], message: _string, details?: unknown): void {
    const _alert: Alert = {
      id: `${type}_${Date.now()}`,
      timestamp: Date.now(),
      level,
      type,
      message,
      details
    };
    
    this.alerts.push(alert);
    this.emit('alert', alert);
    this.logger[level](message);
  }
  private cleanOldMetrics(): void {
    const _retentionTime = this.config.metricsRetention * 60 * 60 * 1000;
    const _cutoff = Date.now() - retentionTime;
    
    this.systemMetrics = this.systemMetrics.filter(m => m.timestamp > cutoff);
    this.alerts = this.alerts.filter(a => a.timestamp > cutoff);
  }
  private async saveHistory(metrics: SystemMetrics): Promise<void> {
    if (!this.config.historyPath) return;
    
    try {
      const _date = new Date();
      const _filename = `metrics_${date.toISOString().split('T')[0]}.jsonl`;
      const _filepath = path.join(this.config._historyPath, filename);
      
      const _line = JSON.stringify({
        ..._metrics,
        agents: Array.from(this.agentMetrics.values())
      }) + '\n';
      
      await fs.appendFile(_filepath, line);
    } catch (_error) {
      this.logger.error('Error saving history:', error);
    }
  }
  // Getters for current state
  getSystemMetrics(): SystemMetrics | undefined {
    return this.systemMetrics[this.systemMetrics.length - 1];
  }
  getAgentMetrics(agentId?: string): AgentMetrics | AgentMetrics[] | undefined {
    if (agentId) {
      return this.agentMetrics.get(agentId);
    }
    return Array.from(this.agentMetrics.values());
  }
  getAlerts(since?: number): Alert[] {
    if (since) {
      return this.alerts.filter(a => a.timestamp > since);
    }
    return this.alerts;
  }
  getHistoricalMetrics(hours: number = 1): SystemMetrics[] {
    const _since = Date.now() - (hours * 60 * 60 * 1000);
    return this.systemMetrics.filter(m => m.timestamp > since);
  }
  // Summary statistics
  getSummary(): {
    uptime: number;
    totalAgents: number;
    activeAgents: number;
    totalTasks: number;
    completedTasks: number;
    failedTasks: number;
    successRate: number;
    averageDuration: number;
    currentThroughput: number;
    alerts: number;
  } {
    const _current = this.getSystemMetrics();
    const _uptime = Date.now() - this.startTime;
    const _totalAgents = this.agentMetrics.size;
    const _activeAgents = current?.activeAgents || 0;
    const _totalTasks = current?.totalTasks || 0;
    const _completedTasks = current?.completedTasks || 0;
    const _failedTasks = current?.failedTasks || 0;
    const _successRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
    const _averageDuration = current?.averageTaskDuration || 0;
    const _currentThroughput = current?.throughput || 0;
    const _alerts = this.alerts.filter(a => a.timestamp > Date.now() - 3600000).length; // Last hour
    
    return {
      uptime,
      totalAgents,
      activeAgents,
      totalTasks,
      completedTasks,
      failedTasks,
      successRate,
      averageDuration,
      currentThroughput,
      alerts
    };
  }
  // Export monitoring data
  async exportMetrics(filepath: string): Promise<void> {
    const _data = {
      summary: this.getSummary(),
      systemMetrics: this.systemMetrics,
      agentMetrics: Array.from(this.agentMetrics.values()),
      alerts: this.alerts,
      exported: new Date().toISOString()
    };
    
    await fs.writeFile(_filepath, JSON.stringify(_data, _null, 2));
    this.logger.info(`Exported metrics to ${filepath}`);
  }
}
// Export types for external use
export type { AgentMetrics, SystemMetrics, Alert, MonitoringConfig };