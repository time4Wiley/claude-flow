import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../utils/logger';

/**
 * Real-time Performance Monitoring Engine for Neural Workflows
 * Provides comprehensive monitoring, alerting, and dashboard capabilities
 */
export class PerformanceMonitoringEngine extends EventEmitter {
  private monitors: Map<string, MonitorInstance> = new Map();
  private metrics: Map<string, MetricStore> = new Map();
  private alertRules: Map<string, AlertRule> = new Map();
  private dashboards: Map<string, Dashboard> = new Map();
  private readonly config: MonitoringConfig;
  private isRunning: boolean = false;

  constructor(config?: Partial<MonitoringConfig>) {
    super();
    this.config = {
      metricsRetentionDays: 30,
      alertingEnabled: true,
      realTimeUpdates: true,
      updateInterval: 5000,
      maxMetricsPerStore: 10000,
      enableAggregation: true,
      aggregationInterval: 60000,
      enablePersistence: true,
      persistenceInterval: 300000,
      enableDashboards: true,
      maxAlertHistory: 1000,
      notificationChannels: ['console', 'webhook'],
      thresholdDefaults: {
        latency: { warning: 1000, critical: 5000 },
        throughput: { warning: 10, critical: 5 },
        errorRate: { warning: 0.05, critical: 0.1 },
        resourceUsage: { warning: 0.8, critical: 0.95 }
      },
      ...config
    };

    this.setupDefaultMetrics();
    this.setupDefaultAlerts();
  }

  /**
   * Initialize the monitoring engine
   */
  public async initialize(): Promise<void> {
    try {
      logger.info('Initializing Performance Monitoring Engine...');
      
      // Setup monitoring intervals
      if (this.config.realTimeUpdates) {
        this.startRealTimeMonitoring();
      }

      if (this.config.enableAggregation) {
        this.startMetricAggregation();
      }

      if (this.config.enablePersistence) {
        this.startMetricPersistence();
      }

      this.isRunning = true;
      
      logger.info('Performance Monitoring Engine initialized successfully');
      this.emit('monitoring:initialized');

    } catch (error) {
      logger.error('Error initializing monitoring engine:', error);
      throw error;
    }
  }

  /**
   * Start monitoring a workflow or component
   */
  public startMonitoring(
    targetId: string,
    type: MonitoringTarget,
    config?: MonitoringInstanceConfig
  ): string {
    const monitorId = uuidv4();
    
    try {
      logger.info(`Starting monitoring for ${type}: ${targetId}`);

      const monitor: MonitorInstance = {
        id: monitorId,
        targetId,
        type,
        config: {
          interval: config?.interval || this.config.updateInterval,
          metrics: config?.metrics || this.getDefaultMetricsForType(type),
          thresholds: config?.thresholds || this.config.thresholdDefaults,
          enableAlerting: config?.enableAlerting !== false,
          ...config
        },
        status: 'active',
        startedAt: Date.now(),
        lastUpdate: Date.now(),
        collectedMetrics: 0
      };

      this.monitors.set(monitorId, monitor);
      
      // Initialize metric stores for this monitor
      this.initializeMetricStores(monitorId, monitor.config.metrics);
      
      // Start data collection
      this.startDataCollection(monitor);

      this.emit('monitoring:started', { monitorId, targetId, type });
      
      return monitorId;

    } catch (error) {
      logger.error(`Error starting monitoring for ${targetId}:`, error);
      throw error;
    }
  }

  /**
   * Stop monitoring a target
   */
  public stopMonitoring(monitorId: string): void {
    const monitor = this.monitors.get(monitorId);
    if (!monitor) {
      throw new Error(`Monitor not found: ${monitorId}`);
    }

    monitor.status = 'stopped';
    monitor.stoppedAt = Date.now();

    logger.info(`Stopped monitoring: ${monitor.targetId}`);
    this.emit('monitoring:stopped', { monitorId, targetId: monitor.targetId });
  }

  /**
   * Record a metric value
   */
  public recordMetric(
    targetId: string,
    metricName: string,
    value: number,
    timestamp?: number,
    tags?: Record<string, string>
  ): void {
    const metricKey = `${targetId}:${metricName}`;
    let metricStore = this.metrics.get(metricKey);
    
    if (!metricStore) {
      metricStore = this.createMetricStore(metricKey, metricName);
      this.metrics.set(metricKey, metricStore);
    }

    const dataPoint: MetricDataPoint = {
      timestamp: timestamp || Date.now(),
      value,
      tags: tags || {}
    };

    metricStore.dataPoints.push(dataPoint);
    metricStore.lastValue = value;
    metricStore.lastUpdate = dataPoint.timestamp;

    // Maintain size limit
    if (metricStore.dataPoints.length > this.config.maxMetricsPerStore) {
      metricStore.dataPoints.shift();
    }

    // Update statistics
    this.updateMetricStatistics(metricStore);

    // Check alert thresholds
    if (this.config.alertingEnabled) {
      this.checkAlertThresholds(targetId, metricName, value);
    }

    this.emit('metric:recorded', { targetId, metricName, value, timestamp: dataPoint.timestamp });
  }

  /**
   * Get current metrics for a target
   */
  public getMetrics(targetId: string, metricNames?: string[]): TargetMetrics {
    const metrics: Record<string, MetricData> = {};
    
    for (const [key, store] of this.metrics) {
      const [storeTargetId, metricName] = key.split(':');
      
      if (storeTargetId === targetId) {
        if (!metricNames || metricNames.includes(metricName)) {
          metrics[metricName] = {
            current: store.lastValue,
            average: store.statistics.average,
            min: store.statistics.min,
            max: store.statistics.max,
            count: store.dataPoints.length,
            trend: this.calculateTrend(store),
            history: store.dataPoints.slice(-100) // Last 100 points
          };
        }
      }
    }

    return {
      targetId,
      timestamp: Date.now(),
      metrics
    };
  }

  /**
   * Get aggregated metrics over time period
   */
  public getAggregatedMetrics(
    targetId: string,
    metricName: string,
    aggregation: AggregationType,
    timeRange: TimeRange
  ): AggregatedMetricData {
    const metricKey = `${targetId}:${metricName}`;
    const metricStore = this.metrics.get(metricKey);
    
    if (!metricStore) {
      throw new Error(`Metric not found: ${metricKey}`);
    }

    const endTime = timeRange.end || Date.now();
    const startTime = timeRange.start || (endTime - 3600000); // Default 1 hour

    const filteredPoints = metricStore.dataPoints.filter(
      point => point.timestamp >= startTime && point.timestamp <= endTime
    );

    if (filteredPoints.length === 0) {
      return {
        aggregation,
        timeRange: { start: startTime, end: endTime },
        value: 0,
        count: 0,
        points: []
      };
    }

    const aggregatedValue = this.calculateAggregation(filteredPoints, aggregation);
    
    return {
      aggregation,
      timeRange: { start: startTime, end: endTime },
      value: aggregatedValue,
      count: filteredPoints.length,
      points: filteredPoints
    };
  }

  /**
   * Create an alert rule
   */
  public createAlertRule(rule: AlertRuleDefinition): string {
    const ruleId = uuidv4();
    
    const alertRule: AlertRule = {
      id: ruleId,
      ...rule,
      status: 'active',
      createdAt: Date.now(),
      triggeredCount: 0,
      lastTriggered: null
    };

    this.alertRules.set(ruleId, alertRule);
    
    logger.info(`Alert rule created: ${rule.name}`);
    this.emit('alert:rule-created', { ruleId, rule });
    
    return ruleId;
  }

  /**
   * Create a monitoring dashboard
   */
  public createDashboard(definition: DashboardDefinition): string {
    const dashboardId = uuidv4();
    
    const dashboard: Dashboard = {
      id: dashboardId,
      ...definition,
      createdAt: Date.now(),
      lastUpdated: Date.now()
    };

    this.dashboards.set(dashboardId, dashboard);
    
    logger.info(`Dashboard created: ${definition.name}`);
    this.emit('dashboard:created', { dashboardId, definition });
    
    return dashboardId;
  }

  /**
   * Get dashboard data
   */
  public getDashboardData(dashboardId: string): DashboardData {
    const dashboard = this.dashboards.get(dashboardId);
    if (!dashboard) {
      throw new Error(`Dashboard not found: ${dashboardId}`);
    }

    const widgets: WidgetData[] = [];

    for (const widget of dashboard.widgets) {
      const widgetData = this.generateWidgetData(widget);
      widgets.push(widgetData);
    }

    return {
      id: dashboardId,
      name: dashboard.name,
      timestamp: Date.now(),
      widgets
    };
  }

  /**
   * Get performance summary
   */
  public getPerformanceSummary(targetId?: string): PerformanceSummary {
    const summary: PerformanceSummary = {
      timestamp: Date.now(),
      totalMonitors: this.monitors.size,
      activeMonitors: Array.from(this.monitors.values()).filter(m => m.status === 'active').length,
      totalMetrics: this.metrics.size,
      totalAlerts: this.alertRules.size,
      recentAlerts: [],
      systemHealth: 'healthy',
      performance: {
        averageLatency: 0,
        throughput: 0,
        errorRate: 0,
        resourceUsage: 0
      }
    };

    // Calculate performance metrics
    if (targetId) {
      const targetMetrics = this.getMetrics(targetId);
      summary.performance = this.calculatePerformanceMetrics(targetMetrics);
    } else {
      summary.performance = this.calculateOverallPerformance();
    }

    // Get recent alerts
    summary.recentAlerts = this.getRecentAlerts(10);

    // Determine system health
    summary.systemHealth = this.calculateSystemHealth(summary.performance);

    return summary;
  }

  /**
   * Private helper methods
   */
  private setupDefaultMetrics(): void {
    // Setup default metric definitions
    const defaultMetrics = [
      'latency', 'throughput', 'error_rate', 'cpu_usage', 
      'memory_usage', 'network_io', 'disk_io', 'queue_size',
      'active_connections', 'response_time'
    ];

    for (const metricName of defaultMetrics) {
      // Metric definitions would be stored here
    }
  }

  private setupDefaultAlerts(): void {
    // Setup default alert rules
    const defaultRules: AlertRuleDefinition[] = [
      {
        name: 'High Latency Alert',
        condition: {
          metric: 'latency',
          operator: 'greater_than',
          threshold: this.config.thresholdDefaults.latency.critical
        },
        severity: 'critical',
        description: 'Latency exceeds critical threshold'
      },
      {
        name: 'High Error Rate Alert',
        condition: {
          metric: 'error_rate',
          operator: 'greater_than',
          threshold: this.config.thresholdDefaults.errorRate.warning
        },
        severity: 'warning',
        description: 'Error rate exceeds warning threshold'
      }
    ];

    for (const rule of defaultRules) {
      this.createAlertRule(rule);
    }
  }

  private getDefaultMetricsForType(type: MonitoringTarget): string[] {
    switch (type) {
      case 'workflow':
        return ['latency', 'throughput', 'error_rate', 'step_duration'];
      case 'model':
        return ['inference_time', 'accuracy', 'memory_usage', 'cpu_usage'];
      case 'training':
        return ['epoch_time', 'loss', 'accuracy', 'gradient_norm'];
      case 'deployment':
        return ['request_rate', 'response_time', 'error_rate', 'resource_usage'];
      case 'agent':
        return ['task_completion_time', 'success_rate', 'load', 'response_time'];
      default:
        return ['latency', 'throughput', 'error_rate'];
    }
  }

  private initializeMetricStores(monitorId: string, metrics: string[]): void {
    for (const metricName of metrics) {
      const metricKey = `${monitorId}:${metricName}`;
      const store = this.createMetricStore(metricKey, metricName);
      this.metrics.set(metricKey, store);
    }
  }

  private createMetricStore(key: string, name: string): MetricStore {
    return {
      key,
      name,
      dataPoints: [],
      lastValue: 0,
      lastUpdate: Date.now(),
      statistics: {
        count: 0,
        sum: 0,
        average: 0,
        min: Infinity,
        max: -Infinity,
        standardDeviation: 0
      }
    };
  }

  private updateMetricStatistics(store: MetricStore): void {
    const values = store.dataPoints.map(p => p.value);
    
    store.statistics.count = values.length;
    store.statistics.sum = values.reduce((sum, val) => sum + val, 0);
    store.statistics.average = store.statistics.sum / store.statistics.count;
    store.statistics.min = Math.min(...values);
    store.statistics.max = Math.max(...values);
    
    // Calculate standard deviation
    const variance = values.reduce((sum, val) => {
      return sum + Math.pow(val - store.statistics.average, 2);
    }, 0) / store.statistics.count;
    
    store.statistics.standardDeviation = Math.sqrt(variance);
  }

  private calculateTrend(store: MetricStore): 'up' | 'down' | 'stable' {
    if (store.dataPoints.length < 2) return 'stable';
    
    const recent = store.dataPoints.slice(-10);
    const first = recent[0].value;
    const last = recent[recent.length - 1].value;
    
    const change = (last - first) / first;
    
    if (change > 0.05) return 'up';
    if (change < -0.05) return 'down';
    return 'stable';
  }

  private calculateAggregation(points: MetricDataPoint[], type: AggregationType): number {
    const values = points.map(p => p.value);
    
    switch (type) {
      case 'average':
        return values.reduce((sum, val) => sum + val, 0) / values.length;
      case 'sum':
        return values.reduce((sum, val) => sum + val, 0);
      case 'min':
        return Math.min(...values);
      case 'max':
        return Math.max(...values);
      case 'count':
        return values.length;
      case 'median':
        const sorted = values.sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
      case 'percentile_95':
        const sorted95 = values.sort((a, b) => a - b);
        const index95 = Math.floor(sorted95.length * 0.95);
        return sorted95[index95];
      default:
        return 0;
    }
  }

  private checkAlertThresholds(targetId: string, metricName: string, value: number): void {
    for (const rule of this.alertRules.values()) {
      if (rule.status !== 'active') continue;
      
      if (this.evaluateAlertCondition(rule, targetId, metricName, value)) {
        this.triggerAlert(rule, targetId, metricName, value);
      }
    }
  }

  private evaluateAlertCondition(
    rule: AlertRule,
    targetId: string,
    metricName: string,
    value: number
  ): boolean {
    const condition = rule.condition;
    
    if (condition.metric !== metricName) return false;
    if (rule.targetFilter && !rule.targetFilter.includes(targetId)) return false;
    
    switch (condition.operator) {
      case 'greater_than':
        return value > condition.threshold;
      case 'less_than':
        return value < condition.threshold;
      case 'equal_to':
        return value === condition.threshold;
      case 'not_equal_to':
        return value !== condition.threshold;
      default:
        return false;
    }
  }

  private triggerAlert(rule: AlertRule, targetId: string, metricName: string, value: number): void {
    const alert: TriggeredAlert = {
      id: uuidv4(),
      ruleId: rule.id,
      ruleName: rule.name,
      targetId,
      metricName,
      value,
      threshold: rule.condition.threshold,
      severity: rule.severity,
      message: rule.description || `${metricName} threshold exceeded`,
      timestamp: Date.now(),
      acknowledged: false
    };

    rule.triggeredCount++;
    rule.lastTriggered = Date.now();

    // Send notifications
    this.sendAlertNotifications(alert);

    logger.warn(`Alert triggered: ${rule.name}`, alert);
    this.emit('alert:triggered', alert);
  }

  private sendAlertNotifications(alert: TriggeredAlert): void {
    for (const channel of this.config.notificationChannels) {
      try {
        switch (channel) {
          case 'console':
            this.sendConsoleNotification(alert);
            break;
          case 'webhook':
            this.sendWebhookNotification(alert);
            break;
          case 'email':
            this.sendEmailNotification(alert);
            break;
        }
      } catch (error) {
        logger.error(`Failed to send alert notification via ${channel}:`, error);
      }
    }
  }

  private sendConsoleNotification(alert: TriggeredAlert): void {
    const severity = alert.severity.toUpperCase();
    logger.warn(`[${severity} ALERT] ${alert.message}`, {
      target: alert.targetId,
      metric: alert.metricName,
      value: alert.value,
      threshold: alert.threshold
    });
  }

  private sendWebhookNotification(alert: TriggeredAlert): void {
    // Simplified webhook notification
    logger.info('Webhook notification sent for alert:', alert.id);
  }

  private sendEmailNotification(alert: TriggeredAlert): void {
    // Simplified email notification
    logger.info('Email notification sent for alert:', alert.id);
  }

  private generateWidgetData(widget: WidgetDefinition): WidgetData {
    const data: any = {};
    
    switch (widget.type) {
      case 'metric':
        data.value = this.getWidgetMetricValue(widget);
        break;
      case 'chart':
        data.series = this.getWidgetChartData(widget);
        break;
      case 'table':
        data.rows = this.getWidgetTableData(widget);
        break;
      case 'gauge':
        data.value = this.getWidgetGaugeValue(widget);
        break;
    }
    
    return {
      id: widget.id,
      type: widget.type,
      title: widget.title,
      data,
      timestamp: Date.now()
    };
  }

  private getWidgetMetricValue(widget: WidgetDefinition): number {
    const config = widget.config as MetricWidgetConfig;
    const metricKey = `${config.targetId}:${config.metricName}`;
    const store = this.metrics.get(metricKey);
    
    return store?.lastValue || 0;
  }

  private getWidgetChartData(widget: WidgetDefinition): ChartSeries[] {
    const config = widget.config as ChartWidgetConfig;
    const series: ChartSeries[] = [];
    
    for (const metric of config.metrics) {
      const metricKey = `${metric.targetId}:${metric.metricName}`;
      const store = this.metrics.get(metricKey);
      
      if (store) {
        const points = store.dataPoints.slice(-config.pointLimit || 100);
        series.push({
          name: metric.label || metric.metricName,
          data: points.map(p => ({ x: p.timestamp, y: p.value }))
        });
      }
    }
    
    return series;
  }

  private getWidgetTableData(widget: WidgetDefinition): TableRow[] {
    const config = widget.config as TableWidgetConfig;
    const rows: TableRow[] = [];
    
    for (const target of config.targets) {
      const metrics = this.getMetrics(target);
      const row: TableRow = { targetId: target };
      
      for (const column of config.columns) {
        row[column] = metrics.metrics[column]?.current || 0;
      }
      
      rows.push(row);
    }
    
    return rows;
  }

  private getWidgetGaugeValue(widget: WidgetDefinition): number {
    const config = widget.config as GaugeWidgetConfig;
    const metricKey = `${config.targetId}:${config.metricName}`;
    const store = this.metrics.get(metricKey);
    
    return store?.lastValue || 0;
  }

  private calculatePerformanceMetrics(metrics: TargetMetrics): PerformanceMetrics {
    return {
      averageLatency: metrics.metrics.latency?.average || 0,
      throughput: metrics.metrics.throughput?.current || 0,
      errorRate: metrics.metrics.error_rate?.current || 0,
      resourceUsage: Math.max(
        metrics.metrics.cpu_usage?.current || 0,
        metrics.metrics.memory_usage?.current || 0
      )
    };
  }

  private calculateOverallPerformance(): PerformanceMetrics {
    const allMetrics = Array.from(this.metrics.values());
    
    const latencyMetrics = allMetrics.filter(m => m.name === 'latency');
    const throughputMetrics = allMetrics.filter(m => m.name === 'throughput');
    const errorRateMetrics = allMetrics.filter(m => m.name === 'error_rate');
    const cpuMetrics = allMetrics.filter(m => m.name === 'cpu_usage');
    const memoryMetrics = allMetrics.filter(m => m.name === 'memory_usage');
    
    return {
      averageLatency: this.calculateAverageFromStores(latencyMetrics),
      throughput: this.calculateAverageFromStores(throughputMetrics),
      errorRate: this.calculateAverageFromStores(errorRateMetrics),
      resourceUsage: Math.max(
        this.calculateAverageFromStores(cpuMetrics),
        this.calculateAverageFromStores(memoryMetrics)
      )
    };
  }

  private calculateAverageFromStores(stores: MetricStore[]): number {
    if (stores.length === 0) return 0;
    
    const sum = stores.reduce((total, store) => total + store.statistics.average, 0);
    return sum / stores.length;
  }

  private getRecentAlerts(limit: number): TriggeredAlert[] {
    // This would typically come from a persistent store
    // For now, return empty array
    return [];
  }

  private calculateSystemHealth(performance: PerformanceMetrics): 'healthy' | 'warning' | 'critical' {
    const thresholds = this.config.thresholdDefaults;
    
    if (
      performance.averageLatency > thresholds.latency.critical ||
      performance.errorRate > thresholds.errorRate.critical ||
      performance.resourceUsage > thresholds.resourceUsage.critical
    ) {
      return 'critical';
    }
    
    if (
      performance.averageLatency > thresholds.latency.warning ||
      performance.errorRate > thresholds.errorRate.warning ||
      performance.resourceUsage > thresholds.resourceUsage.warning
    ) {
      return 'warning';
    }
    
    return 'healthy';
  }

  private startRealTimeMonitoring(): void {
    setInterval(() => {
      this.collectRealTimeMetrics();
    }, this.config.updateInterval);
  }

  private startMetricAggregation(): void {
    setInterval(() => {
      this.performMetricAggregation();
    }, this.config.aggregationInterval);
  }

  private startMetricPersistence(): void {
    setInterval(() => {
      this.persistMetrics();
    }, this.config.persistenceInterval);
  }

  private startDataCollection(monitor: MonitorInstance): void {
    const collectData = () => {
      if (monitor.status !== 'active') return;
      
      try {
        this.collectMonitorMetrics(monitor);
        monitor.lastUpdate = Date.now();
        monitor.collectedMetrics++;
        
        // Schedule next collection
        setTimeout(collectData, monitor.config.interval);
      } catch (error) {
        logger.error(`Error collecting metrics for monitor ${monitor.id}:`, error);
      }
    };
    
    // Start initial collection
    setTimeout(collectData, monitor.config.interval);
  }

  private collectMonitorMetrics(monitor: MonitorInstance): void {
    // Simulate metric collection based on monitor type
    for (const metricName of monitor.config.metrics) {
      const value = this.simulateMetricValue(monitor.type, metricName);
      this.recordMetric(monitor.targetId, metricName, value);
    }
  }

  private simulateMetricValue(type: MonitoringTarget, metricName: string): number {
    // Simplified metric simulation - in practice would collect real metrics
    switch (metricName) {
      case 'latency':
        return 50 + Math.random() * 200;
      case 'throughput':
        return 100 + Math.random() * 50;
      case 'error_rate':
        return Math.random() * 0.05;
      case 'cpu_usage':
        return 0.3 + Math.random() * 0.4;
      case 'memory_usage':
        return 0.4 + Math.random() * 0.3;
      default:
        return Math.random() * 100;
    }
  }

  private collectRealTimeMetrics(): void {
    // Collect system-wide metrics
    const systemMetrics = {
      timestamp: Date.now(),
      activeMonitors: Array.from(this.monitors.values()).filter(m => m.status === 'active').length,
      totalMetricPoints: Array.from(this.metrics.values()).reduce((sum, store) => sum + store.dataPoints.length, 0),
      alertCount: this.alertRules.size
    };

    this.emit('metrics:realtime', systemMetrics);
  }

  private performMetricAggregation(): void {
    // Perform periodic metric aggregation
    for (const store of this.metrics.values()) {
      this.updateMetricStatistics(store);
    }
    
    this.emit('metrics:aggregated', { timestamp: Date.now() });
  }

  private persistMetrics(): void {
    // Persist metrics to storage
    if (this.config.enablePersistence) {
      logger.debug('Persisting metrics to storage');
      this.emit('metrics:persisted', { timestamp: Date.now() });
    }
  }

  /**
   * Public API methods
   */
  public getMonitor(monitorId: string): MonitorInstance | undefined {
    return this.monitors.get(monitorId);
  }

  public getAllMonitors(): MonitorInstance[] {
    return Array.from(this.monitors.values());
  }

  public getActiveMonitors(): MonitorInstance[] {
    return Array.from(this.monitors.values()).filter(m => m.status === 'active');
  }

  public getAlertRule(ruleId: string): AlertRule | undefined {
    return this.alertRules.get(ruleId);
  }

  public getAllAlertRules(): AlertRule[] {
    return Array.from(this.alertRules.values());
  }

  public updateAlertRule(ruleId: string, updates: Partial<AlertRuleDefinition>): void {
    const rule = this.alertRules.get(ruleId);
    if (!rule) {
      throw new Error(`Alert rule not found: ${ruleId}`);
    }

    Object.assign(rule, updates);
    this.emit('alert:rule-updated', { ruleId, updates });
  }

  public deleteAlertRule(ruleId: string): void {
    const rule = this.alertRules.get(ruleId);
    if (!rule) {
      throw new Error(`Alert rule not found: ${ruleId}`);
    }

    this.alertRules.delete(ruleId);
    this.emit('alert:rule-deleted', { ruleId });
  }

  public getDashboard(dashboardId: string): Dashboard | undefined {
    return this.dashboards.get(dashboardId);
  }

  public getAllDashboards(): Dashboard[] {
    return Array.from(this.dashboards.values());
  }

  public updateDashboard(dashboardId: string, updates: Partial<DashboardDefinition>): void {
    const dashboard = this.dashboards.get(dashboardId);
    if (!dashboard) {
      throw new Error(`Dashboard not found: ${dashboardId}`);
    }

    Object.assign(dashboard, updates);
    dashboard.lastUpdated = Date.now();
    this.emit('dashboard:updated', { dashboardId, updates });
  }

  public deleteDashboard(dashboardId: string): void {
    const dashboard = this.dashboards.get(dashboardId);
    if (!dashboard) {
      throw new Error(`Dashboard not found: ${dashboardId}`);
    }

    this.dashboards.delete(dashboardId);
    this.emit('dashboard:deleted', { dashboardId });
  }

  public getSystemStatus(): SystemStatus {
    return {
      isRunning: this.isRunning,
      totalMonitors: this.monitors.size,
      activeMonitors: this.getActiveMonitors().length,
      totalMetrics: this.metrics.size,
      totalAlertRules: this.alertRules.size,
      totalDashboards: this.dashboards.size,
      uptime: Date.now() - (this.isRunning ? Date.now() : 0), // Simplified
      memoryUsage: process.memoryUsage().heapUsed
    };
  }

  public dispose(): void {
    this.isRunning = false;
    
    // Stop all monitors
    for (const monitor of this.monitors.values()) {
      monitor.status = 'stopped';
    }
    
    // Clear all data
    this.monitors.clear();
    this.metrics.clear();
    this.alertRules.clear();
    this.dashboards.clear();
    
    this.removeAllListeners();
    logger.info('Performance Monitoring Engine disposed');
  }
}

// Type definitions
export interface MonitoringConfig {
  metricsRetentionDays: number;
  alertingEnabled: boolean;
  realTimeUpdates: boolean;
  updateInterval: number;
  maxMetricsPerStore: number;
  enableAggregation: boolean;
  aggregationInterval: number;
  enablePersistence: boolean;
  persistenceInterval: number;
  enableDashboards: boolean;
  maxAlertHistory: number;
  notificationChannels: string[];
  thresholdDefaults: {
    latency: { warning: number; critical: number };
    throughput: { warning: number; critical: number };
    errorRate: { warning: number; critical: number };
    resourceUsage: { warning: number; critical: number };
  };
}

export type MonitoringTarget = 'workflow' | 'model' | 'training' | 'deployment' | 'agent' | 'system';
export type AggregationType = 'average' | 'sum' | 'min' | 'max' | 'count' | 'median' | 'percentile_95';

export interface MonitoringInstanceConfig {
  interval?: number;
  metrics?: string[];
  thresholds?: any;
  enableAlerting?: boolean;
}

export interface MonitorInstance {
  id: string;
  targetId: string;
  type: MonitoringTarget;
  config: MonitoringInstanceConfig;
  status: 'active' | 'stopped' | 'error';
  startedAt: number;
  stoppedAt?: number;
  lastUpdate: number;
  collectedMetrics: number;
}

export interface MetricDataPoint {
  timestamp: number;
  value: number;
  tags: Record<string, string>;
}

export interface MetricStore {
  key: string;
  name: string;
  dataPoints: MetricDataPoint[];
  lastValue: number;
  lastUpdate: number;
  statistics: {
    count: number;
    sum: number;
    average: number;
    min: number;
    max: number;
    standardDeviation: number;
  };
}

export interface MetricData {
  current: number;
  average: number;
  min: number;
  max: number;
  count: number;
  trend: 'up' | 'down' | 'stable';
  history: MetricDataPoint[];
}

export interface TargetMetrics {
  targetId: string;
  timestamp: number;
  metrics: Record<string, MetricData>;
}

export interface TimeRange {
  start: number;
  end?: number;
}

export interface AggregatedMetricData {
  aggregation: AggregationType;
  timeRange: TimeRange;
  value: number;
  count: number;
  points: MetricDataPoint[];
}

export interface AlertCondition {
  metric: string;
  operator: 'greater_than' | 'less_than' | 'equal_to' | 'not_equal_to';
  threshold: number;
}

export interface AlertRuleDefinition {
  name: string;
  condition: AlertCondition;
  severity: 'info' | 'warning' | 'critical';
  description?: string;
  targetFilter?: string[];
  cooldown?: number;
}

export interface AlertRule extends AlertRuleDefinition {
  id: string;
  status: 'active' | 'inactive';
  createdAt: number;
  triggeredCount: number;
  lastTriggered: number | null;
}

export interface TriggeredAlert {
  id: string;
  ruleId: string;
  ruleName: string;
  targetId: string;
  metricName: string;
  value: number;
  threshold: number;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  timestamp: number;
  acknowledged: boolean;
}

export interface WidgetDefinition {
  id: string;
  type: 'metric' | 'chart' | 'table' | 'gauge';
  title: string;
  config: any;
}

export interface MetricWidgetConfig {
  targetId: string;
  metricName: string;
  format?: string;
}

export interface ChartWidgetConfig {
  metrics: Array<{
    targetId: string;
    metricName: string;
    label?: string;
  }>;
  chartType: 'line' | 'bar' | 'area';
  pointLimit?: number;
}

export interface TableWidgetConfig {
  targets: string[];
  columns: string[];
}

export interface GaugeWidgetConfig {
  targetId: string;
  metricName: string;
  min: number;
  max: number;
}

export interface DashboardDefinition {
  name: string;
  description?: string;
  widgets: WidgetDefinition[];
  layout?: any;
}

export interface Dashboard extends DashboardDefinition {
  id: string;
  createdAt: number;
  lastUpdated: number;
}

export interface WidgetData {
  id: string;
  type: string;
  title: string;
  data: any;
  timestamp: number;
}

export interface ChartSeries {
  name: string;
  data: Array<{ x: number; y: number }>;
}

export interface TableRow {
  [key: string]: any;
}

export interface DashboardData {
  id: string;
  name: string;
  timestamp: number;
  widgets: WidgetData[];
}

export interface PerformanceMetrics {
  averageLatency: number;
  throughput: number;
  errorRate: number;
  resourceUsage: number;
}

export interface PerformanceSummary {
  timestamp: number;
  totalMonitors: number;
  activeMonitors: number;
  totalMetrics: number;
  totalAlerts: number;
  recentAlerts: TriggeredAlert[];
  systemHealth: 'healthy' | 'warning' | 'critical';
  performance: PerformanceMetrics;
}

export interface SystemStatus {
  isRunning: boolean;
  totalMonitors: number;
  activeMonitors: number;
  totalMetrics: number;
  totalAlertRules: number;
  totalDashboards: number;
  uptime: number;
  memoryUsage: number;
}

/**
 * Factory function to create performance monitoring engine
 */
export function createPerformanceMonitoringEngine(
  config?: Partial<MonitoringConfig>
): PerformanceMonitoringEngine {
  return new PerformanceMonitoringEngine(config);
}