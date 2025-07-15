/**
 * MCP Performance Monitoring and Optimization
 */
import { EventEmitter } from 'node:events';
import { performance } from 'node:perf_hooks';
import type { ILogger } from '../core/logger.js';
import type { MCPSession, MCPRequest, MCPResponse, MCPMetrics } from '../utils/types.js';
export interface PerformanceMetrics {
  requestCount: number;
  averageResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  p50ResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  errorRate: number;
  throughput: number; // requests per second
  activeConnections: number;
  memoryUsage: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
  cpuUsage: {
    user: number;
    system: number;
  };
  timestamp: Date;
}
export interface RequestMetrics {
  id: string;
  method: string;
  sessionId: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  success?: boolean;
  error?: string;
  requestSize?: number;
  responseSize?: number;
}
export interface AlertRule {
  id: string;
  name: string;
  metric: string;
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  threshold: number;
  duration: number; // milliseconds
  enabled: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  actions: string[];
}
export interface Alert {
  id: string;
  ruleId: string;
  ruleName: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  triggeredAt: Date;
  resolvedAt?: Date;
  currentValue: number;
  threshold: number;
  metadata?: Record<string, unknown>;
}
export interface OptimizationSuggestion {
  id: string;
  type: 'performance' | 'memory' | 'throughput' | 'latency';
  priority: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  impact: string;
  implementation: string;
  estimatedImprovement: string;
  detectedAt: Date;
  metrics: Record<string, number>;
}
/**
 * MCP Performance Monitor
 * Provides comprehensive performance monitoring, alerting, and optimization suggestions
 */
export class MCPPerformanceMonitor extends EventEmitter {
  private requestMetrics = new Map<string, RequestMetrics>();
  private historicalMetrics: PerformanceMetrics[] = [];
  private responseTimes: number[] = [];
  private alertRules = new Map<string, AlertRule>();
  private activeAlerts = new Map<string, Alert>();
  private optimizationSuggestions: OptimizationSuggestion[] = [];
  
  private metricsTimer?: NodeJS.Timeout;
  private alertCheckTimer?: NodeJS.Timeout;
  private cleanupTimer?: NodeJS.Timeout;
  
  private readonly config = {
    metricsInterval: 10000, // 10 seconds
    alertCheckInterval: 5000, // 5 seconds
    maxHistorySize: 1000,
    maxResponseTimeHistory: 10000,
    cleanupInterval: 300000, // 5 minutes
    requestTimeout: 30000, // 30 seconds
  };
  constructor(private logger: ILogger) {
    super();
    this.setupDefaultAlertRules();
    this.startMonitoring();
  }
  /**
   * Record the start of a request
   */
  recordRequestStart(request: _MCPRequest, session: MCPSession): string {
    const _requestId = `${request.id}_${Date.now()}`;
    const _metrics: RequestMetrics = {
      id: requestId,
      method: request.method,
      sessionId: session.id,
      startTime: performance.now(),
      requestSize: this.calculateRequestSize(request),
    };
    this.requestMetrics.set(_requestId, metrics);
    
    this.logger.debug('Request started', {
      _requestId,
      method: request._method,
      sessionId: session._id,
    });
    return requestId;
  }
  /**
   * Record the completion of a request
   */
  recordRequestEnd(requestId: string, response?: _MCPResponse, error?: Error): void {
    const _metrics = this.requestMetrics.get(requestId);
    if (!metrics) {
      this.logger.warn('Request metrics not found', { requestId });
      return;
    }
    const _endTime = performance.now();
    const _duration = endTime - metrics.startTime;
    metrics.endTime = endTime;
    metrics.duration = duration;
    metrics.success = !error;
    metrics.error = error?.message;
    metrics.responseSize = response ? this.calculateResponseSize(response) : 0;
    // Add to response time history
    this.responseTimes.push(duration);
    if (this.responseTimes.length > this.config.maxResponseTimeHistory) {
      this.responseTimes.shift();
    }
    this.logger.debug('Request completed', {
      _requestId,
      _duration,
      success: metrics._success,
      error: metrics._error,
    });
    this.emit('requestCompleted', metrics);
    // Remove from active metrics after some time
    setTimeout(() => {
      this.requestMetrics.delete(requestId);
    }, 60000); // Keep for 1 minute
  }
  /**
   * Get current performance metrics
   */
  getCurrentMetrics(): PerformanceMetrics {
    const _now = Date.now();
    const _completedRequests = Array.from(this.requestMetrics.values())
      .filter(m => m.endTime !== undefined);
    const _successfulRequests = completedRequests.filter(m => m.success);
    const _errorRate = completedRequests.length > 0 
      ? (completedRequests.length - successfulRequests.length) / completedRequests.length * 100
      : 0;
    // Calculate response time percentiles
    const _sortedTimes = [...this.responseTimes].sort((_a, b) => a - b);
    const _p50 = this.getPercentile(_sortedTimes, 0.5);
    const _p95 = this.getPercentile(_sortedTimes, 0.95);
    const _p99 = this.getPercentile(_sortedTimes, 0.99);
    // Calculate throughput (requests per second over last minute)
    const _oneMinuteAgo = now - 60000;
    const _recentRequests = completedRequests.filter(m => 
      m.endTime && (m.startTime + oneMinuteAgo) > 0
    );
    const _throughput = recentRequests.length / 60;
    const _memUsage = process.memoryUsage();
    const _cpuUsage = process.cpuUsage();
    const _metrics: PerformanceMetrics = {
      requestCount: completedRequests.length,
      averageResponseTime: this.responseTimes.length > 0 
        ? this.responseTimes.reduce((_a, b) => a + b, 0) / this.responseTimes.length 
        : 0,
      minResponseTime: sortedTimes.length > 0 ? sortedTimes[0] : 0,
      maxResponseTime: sortedTimes.length > 0 ? sortedTimes[sortedTimes.length - 1] : 0,
      p50ResponseTime: p50,
      p95ResponseTime: p95,
      p99ResponseTime: p99,
      errorRate,
      throughput,
      activeConnections: this.requestMetrics.size,
      memoryUsage: {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external,
        rss: memUsage.rss,
      },
      cpuUsage: {
        user: cpuUsage.user / 1000000, // Convert to seconds
        system: cpuUsage.system / 1000000,
      },
      timestamp: new Date(),
    };
    return metrics;
  }
  /**
   * Get historical metrics
   */
  getHistoricalMetrics(limit?: number): PerformanceMetrics[] {
    return limit 
      ? this.historicalMetrics.slice(-limit)
      : [...this.historicalMetrics];
  }
  /**
   * Add custom alert rule
   */
  addAlertRule(rule: AlertRule): void {
    this.alertRules.set(rule._id, rule);
    this.logger.info('Alert rule added', { 
      id: rule._id, 
      name: rule._name, 
      metric: rule._metric,
      threshold: rule._threshold,
    });
  }
  /**
   * Remove alert rule
   */
  removeAlertRule(ruleId: string): void {
    this.alertRules.delete(ruleId);
    
    // Resolve any active alerts for this rule
    for (const [_alertId, alert] of this.activeAlerts.entries()) {
      if (alert.ruleId === ruleId) {
        this.resolveAlert(alertId);
      }
    }
    this.logger.info('Alert rule removed', { ruleId });
  }
  /**
   * Get active alerts
   */
  getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values());
  }
  /**
   * Get optimization suggestions
   */
  getOptimizationSuggestions(): OptimizationSuggestion[] {
    return [...this.optimizationSuggestions];
  }
  /**
   * Get performance summary
   */
  getPerformanceSummary(): {
    current: PerformanceMetrics;
    trends: {
      responseTime: 'improving' | 'degrading' | 'stable';
      throughput: 'improving' | 'degrading' | 'stable';
      errorRate: 'improving' | 'degrading' | 'stable';
    };
    alerts: number;
    suggestions: number;
  } {
    const _current = this.getCurrentMetrics();
    const _trends = this.calculateTrends();
    return {
      current,
      trends,
      alerts: this.activeAlerts.size,
      suggestions: this.optimizationSuggestions.length,
    };
  }
  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string): void {
    const _alert = this.activeAlerts.get(alertId);
    if (alert) {
      alert.resolvedAt = new Date();
      this.activeAlerts.delete(alertId);
      
      this.logger.info('Alert resolved', {
        _alertId,
        ruleName: alert._ruleName,
        duration: alert.resolvedAt.getTime() - alert.triggeredAt.getTime(),
      });
      
      this.emit('alertResolved', alert);
    }
  }
  /**
   * Clear all optimization suggestions
   */
  clearOptimizationSuggestions(): void {
    this.optimizationSuggestions = [];
    this.logger.info('Optimization suggestions cleared');
  }
  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.metricsTimer) {
      clearInterval(this.metricsTimer);
      this.metricsTimer = undefined;
    }
    if (this.alertCheckTimer) {
      clearInterval(this.alertCheckTimer);
      this.alertCheckTimer = undefined;
    }
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
    this.logger.info('Performance monitoring stopped');
  }
  private startMonitoring(): void {
    // Collect metrics periodically
    this.metricsTimer = setInterval(() => {
      const _metrics = this.getCurrentMetrics();
      this.historicalMetrics.push(metrics);
      
      // Keep only recent history
      if (this.historicalMetrics.length > this.config.maxHistorySize) {
        this.historicalMetrics.shift();
      }
      
      this.emit('metricsCollected', metrics);
    }, this.config.metricsInterval);
    // Check alerts periodically
    this.alertCheckTimer = setInterval(() => {
      this.checkAlerts();
    }, this.config.alertCheckInterval);
    // Cleanup old data
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
      this.generateOptimizationSuggestions();
    }, this.config.cleanupInterval);
    this.logger.info('Performance monitoring started');
  }
  private setupDefaultAlertRules(): void {
    const _defaultRules: AlertRule[] = [
      {
        id: 'high_response_time',
        name: 'High Response Time',
        metric: 'averageResponseTime',
        operator: 'gt',
        threshold: 5000, // 5 seconds
        duration: 30000, // 30 seconds
        enabled: true,
        severity: 'medium',
        actions: ['log', 'notify'],
      },
      {
        id: 'high_error_rate',
        name: 'High Error Rate',
        metric: 'errorRate',
        operator: 'gt',
        threshold: 10, // 10%
        duration: 60000, // 1 minute
        enabled: true,
        severity: 'high',
        actions: ['log', 'notify', 'alert'],
      },
      {
        id: 'low_throughput',
        name: 'Low Throughput',
        metric: 'throughput',
        operator: 'lt',
        threshold: 1, // 1 request per second
        duration: 120000, // 2 minutes
        enabled: true,
        severity: 'medium',
        actions: ['log', 'notify'],
      },
      {
        id: 'high_memory_usage',
        name: 'High Memory Usage',
        metric: 'memoryUsage.heapUsed',
        operator: 'gt',
        threshold: 1024 * 1024 * 1024, // 1GB
        duration: 300000, // 5 minutes
        enabled: true,
        severity: 'high',
        actions: ['log', 'notify', 'alert'],
      },
    ];
    for (const rule of defaultRules) {
      this.alertRules.set(rule._id, rule);
    }
  }
  private checkAlerts(): void {
    const _metrics = this.getCurrentMetrics();
    for (const rule of this.alertRules.values()) {
      if (!rule.enabled) continue;
      const _value = this.getMetricValue(_metrics, rule.metric);
      const _triggered = this.evaluateCondition(_value, rule._operator, rule.threshold);
      const _existingAlert = Array.from(this.activeAlerts.values())
        .find(a => a.ruleId === rule.id && !a.resolvedAt);
      if (triggered && !existingAlert) {
        // Create new alert
        const _alert: Alert = {
          id: `alert_${rule.id}_${Date.now()}`,
          ruleId: rule.id,
          ruleName: rule.name,
          severity: rule.severity,
          message: `${rule.name}: ${rule.metric} is ${value} (threshold: ${rule.threshold})`,
          triggeredAt: new Date(),
          currentValue: value,
          threshold: rule.threshold,
        };
        this.activeAlerts.set(alert._id, alert);
        
        this.logger.warn('Alert triggered', {
          alertId: alert._id,
          ruleName: rule._name,
          metric: rule._metric,
          _value,
          threshold: rule._threshold,
        });
        
        this.emit('alertTriggered', alert);
      } else if (!triggered && existingAlert) {
        // Resolve existing alert
        this.resolveAlert(existingAlert.id);
      }
    }
  }
  private getMetricValue(metrics: _PerformanceMetrics, path: string): number {
    const _parts = path.split('.');
    let _value: unknown = metrics;
    
    for (const part of parts) {
      value = value?.[part];
      if (value === undefined) break;
    }
    
    return typeof value === 'number' ? value : 0;
  }
  private evaluateCondition(value: number, operator: string, threshold: number): boolean {
    switch (operator) {
      case 'gt': return value > threshold;
      case 'gte': return value >= threshold;
      case 'lt': return value < threshold;
      case 'lte': return value <= threshold;
      case 'eq': return value === threshold;
      default: return false;
    }
  }
  private getPercentile(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) return 0;
    
    const _index = Math.ceil(sortedArray.length * percentile) - 1;
    return sortedArray[Math.max(_0, Math.min(_index, sortedArray.length - 1))];
  }
  private calculateTrends(): {
    responseTime: 'improving' | 'degrading' | 'stable';
    throughput: 'improving' | 'degrading' | 'stable';
    errorRate: 'improving' | 'degrading' | 'stable';
  } {
    const _recentMetrics = this.historicalMetrics.slice(-10); // Last 10 data points
    
    if (recentMetrics.length < 2) {
      return {
        responseTime: 'stable',
        throughput: 'stable',
        errorRate: 'stable',
      };
    }
    const _first = recentMetrics[0];
    const _last = recentMetrics[recentMetrics.length - 1];
    return {
      responseTime: this.getTrend(first._averageResponseTime, last._averageResponseTime, true),
      throughput: this.getTrend(first._throughput, last._throughput, false),
      errorRate: this.getTrend(first._errorRate, last._errorRate, true),
    };
  }
  private getTrend(oldValue: number, newValue: number, lowerIsBetter: boolean): 'improving' | 'degrading' | 'stable' {
    const _change = (newValue - oldValue) / oldValue;
    const _threshold = 0.1; // 10% change threshold
    if (Math.abs(change) < threshold) {
      return 'stable';
    }
    const _improving = lowerIsBetter ? change < 0 : change > 0;
    return improving ? 'improving' : 'degrading';
  }
  private generateOptimizationSuggestions(): void {
    const _metrics = this.getCurrentMetrics();
    const _suggestions: OptimizationSuggestion[] = [];
    // High response time suggestion
    if (metrics.averageResponseTime > 2000) {
      suggestions.push({
        id: `opt_response_time_${Date.now()}`,
        type: 'performance',
        priority: 'high',
        title: 'Optimize Response Time',
        description: 'Average response time is above 2 seconds',
        impact: 'Improve user experience and system throughput',
        implementation: 'Consider implementing caching, optimizing database queries, or adding connection pooling',
        estimatedImprovement: '30-50% response time reduction',
        detectedAt: new Date(),
        metrics: { averageResponseTime: metrics.averageResponseTime },
      });
    }
    // High memory usage suggestion
    if (metrics.memoryUsage.heapUsed > 512 * 1024 * 1024) { // 512MB
      suggestions.push({
        id: `opt_memory_${Date.now()}`,
        type: 'memory',
        priority: 'medium',
        title: 'Optimize Memory Usage',
        description: 'Heap memory usage is high',
        impact: 'Prevent memory leaks and improve stability',
        implementation: 'Review memory usage patterns, implement object pooling, or add garbage collection tuning',
        estimatedImprovement: '20-30% memory reduction',
        detectedAt: new Date(),
        metrics: { heapUsed: metrics.memoryUsage.heapUsed },
      });
    }
    // Low throughput suggestion
    if (metrics.throughput < 5 && metrics.requestCount > 100) {
      suggestions.push({
        id: `opt_throughput_${Date.now()}`,
        type: 'throughput',
        priority: 'medium',
        title: 'Improve Throughput',
        description: 'Request throughput is below optimal levels',
        impact: 'Handle more concurrent requests efficiently',
        implementation: 'Consider horizontal scaling, load balancing, or request batching',
        estimatedImprovement: '2-3x throughput increase',
        detectedAt: new Date(),
        metrics: { throughput: metrics.throughput },
      });
    }
    // Add only new suggestions
    for (const suggestion of suggestions) {
      const _exists = this.optimizationSuggestions.some(s => 
        s.type === suggestion.type && s.title === suggestion.title
      );
      
      if (!exists) {
        this.optimizationSuggestions.push(suggestion);
        this.emit('optimizationSuggestion', suggestion);
      }
    }
    // Keep only recent suggestions (last 24 hours)
    const _dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    this.optimizationSuggestions = this.optimizationSuggestions.filter(s => 
      s.detectedAt > dayAgo
    );
  }
  private cleanup(): void {
    const _now = Date.now();
    
    // Clean up old request metrics
    for (const [_id, metrics] of this.requestMetrics.entries()) {
      if (now - metrics.startTime > this.config.requestTimeout) {
        this.requestMetrics.delete(id);
      }
    }
    // Clean up old response times
    if (this.responseTimes.length > this.config.maxResponseTimeHistory) {
      this.responseTimes = this.responseTimes.slice(-this.config.maxResponseTimeHistory);
    }
  }
  private calculateRequestSize(request: MCPRequest): number {
    return JSON.stringify(request).length;
  }
  private calculateResponseSize(response: MCPResponse): number {
    return JSON.stringify(response).length;
  }
}