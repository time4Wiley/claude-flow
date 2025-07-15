/* global Deno */
// performance-monitor.js - Performance monitoring for batch operations
import { printInfo } from '../../utils.js';
export class PerformanceMonitor {
  constructor(options = { /* empty */ }) {
    this.enabled = options.enabled !== false;
    this.logLevel = options.logLevel || 'info';
    this.memoryCheckInterval = options.memoryCheckInterval || 5000; // 5 seconds
    this.maxMemoryMB = options.maxMemoryMB || 1024; // 1GB default limit
    
    this.metrics = {
      startTime: null,
      endTime: null,
      peakMemoryMB: 0,
      averageMemoryMB: 0,
      operationCount: 0,
      memoryReadings: [],
      errors: [],
      warnings: []
    };
    
    this.memoryMonitor = null;
  }
  start() {
    if (!this.enabled) return;
    
    this.metrics.startTime = Date.now();
    this.startMemoryMonitoring();
    
    if (this.logLevel === 'debug') {
      console.log('🔍 Performance monitoring started');
    }
  }
  stop() {
    if (!this.enabled) return;
    
    this.metrics.endTime = Date.now();
    this.stopMemoryMonitoring();
    this.calculateAverages();
    
    if (this.logLevel === 'debug') {
      console.log('🔍 Performance monitoring stopped');
    }
  }
  startMemoryMonitoring() {
    if (typeof Deno !== 'undefined' && Deno.memoryUsage) {
      this.memoryMonitor = setInterval(() => {
        const _memUsage = Deno.memoryUsage();
        const _memoryMB = memUsage.rss / 1024 / 1024;
        
        this.metrics.memoryReadings.push({
          timestamp: Date.now(),
          memoryMB: memoryMB
        });
        
        if (memoryMB > this.metrics.peakMemoryMB) {
          this.metrics.peakMemoryMB = memoryMB;
        }
        
        // Check memory limit
        if (memoryMB > this.maxMemoryMB) {
          this.metrics.warnings.push({
            timestamp: Date.now(),
            type: 'memory',
            message: `Memory usage ${memoryMB.toFixed(1)}MB exceeds limit ${this.maxMemoryMB}MB`
          });
        }
      }, this.memoryCheckInterval);
    }
  }
  stopMemoryMonitoring() {
    if (this.memoryMonitor) {
      clearInterval(this.memoryMonitor);
      this.memoryMonitor = null;
    }
  }
  calculateAverages() {
    if (this.metrics.memoryReadings.length > 0) {
      const _totalMemory = this.metrics.memoryReadings.reduce((_sum, reading) => sum + reading.memoryMB, 0);
      this.metrics.averageMemoryMB = totalMemory / this.metrics.memoryReadings.length;
    }
  }
  recordOperation(_operationType, details = { /* empty */ }) {
    if (!this.enabled) return;
    
    this.metrics.operationCount++;
    
    if (this.logLevel === 'debug') {
      console.log(`📊 Operation: ${operationType}`, details);
    }
  }
  recordError(_error, context = { /* empty */ }) {
    if (!this.enabled) return;
    
    this.metrics.errors.push({
      timestamp: Date.now(),
      error: error.message || error,
      context
    });
    
    if (this.logLevel === 'debug') {
      console.log('❌ Error recorded:', error.message || error);
    }
  }
  recordWarning(_message, context = { /* empty */ }) {
    if (!this.enabled) return;
    
    this.metrics.warnings.push({
      timestamp: Date.now(),
      type: 'warning',
      message,
      context
    });
    
    if (this.logLevel === 'debug') {
      console.log('⚠️ Warning recorded:', message);
    }
  }
  getMetrics() {
    const _duration = this.metrics.endTime - this.metrics.startTime;
    
    return {
      ...this.metrics,
      duration,
      operationsPerSecond: this.metrics.operationCount / (duration / 1000),
      memoryEfficiency: this.metrics.peakMemoryMB < (this.maxMemoryMB * 0.8) ? 'good' : 'warning'
    };
  }
  generateReport() {
    if (!this.enabled) return 'Performance monitoring disabled';
    
    const _metrics = this.getMetrics();
    
    let _report = '\n📊 Performance Report\n';
    report += '====================\n';
    report += `Duration: ${(metrics.duration / 1000).toFixed(2)}s\n`;
    report += `Operations: ${metrics.operationCount}\n`;
    report += `Operations/sec: ${metrics.operationsPerSecond.toFixed(2)}\n`;
    report += `Peak Memory: ${metrics.peakMemoryMB.toFixed(1)}MB\n`;
    report += `Average Memory: ${metrics.averageMemoryMB.toFixed(1)}MB\n`;
    report += `Memory Efficiency: ${metrics.memoryEfficiency}\n`;
    
    if (metrics.errors.length > 0) {
      report += `\n❌ Errors: ${metrics.errors.length}\n`;
      metrics.errors.slice(-3).forEach(error => {
        report += `  - ${error.error}\n`;
      });
    }
    
    if (metrics.warnings.length > 0) {
      report += `\n⚠️  Warnings: ${metrics.warnings.length}\n`;
      metrics.warnings.slice(-3).forEach(warning => {
        report += `  - ${warning.message}\n`;
      });
    }
    
    return report;
  }
  // Real-time monitoring display
  displayRealTimeStats() {
    if (!this.enabled) return;
    
    const _currentTime = Date.now();
    const _elapsed = this.metrics.startTime ? (currentTime - this.metrics.startTime) / 1000 : 0;
    
    let _currentMemory = '—';
    if (typeof Deno !== 'undefined' && Deno.memoryUsage) {
      const _memUsage = Deno.memoryUsage();
      currentMemory = `${(memUsage.rss / 1024 / 1024).toFixed(1)}MB`;
    }
    
    console.log(`⏱️  ${elapsed.toFixed(1)}s | 💾 ${currentMemory} | 🔄 ${this.metrics.operationCount} ops`);
  }
}
// Resource threshold monitor
export class ResourceThresholdMonitor {
  constructor(options = { /* empty */ }) {
    this.maxMemoryMB = options.maxMemoryMB || 1024;
    this.maxCPUPercent = options.maxCPUPercent || 80;
    this.checkInterval = options.checkInterval || 2000;
    
    this.isMonitoring = false;
    this.monitorInterval = null;
    this.callbacks = {
      memoryWarning: options.onMemoryWarning || (() => { /* empty */ }),
      memoryError: options.onMemoryError || (() => { /* empty */ }),
      cpuWarning: options.onCPUWarning || (() => { /* empty */ })
    };
  }
  start() {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    this.monitorInterval = setInterval(() => {
      this.checkResources();
    }, this.checkInterval);
  }
  stop() {
    if (!this.isMonitoring) return;
    
    this.isMonitoring = false;
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
  }
  checkResources() {
    if (typeof Deno !== 'undefined' && Deno.memoryUsage) {
      const _memUsage = Deno.memoryUsage();
      const _memoryMB = memUsage.rss / 1024 / 1024;
      
      const _warningThreshold = this.maxMemoryMB * 0.8;
      const _errorThreshold = this.maxMemoryMB * 0.95;
      
      if (memoryMB > errorThreshold) {
        this.callbacks.memoryError(_memoryMB, this.maxMemoryMB);
      } else if (memoryMB > warningThreshold) {
        this.callbacks.memoryWarning(_memoryMB, this.maxMemoryMB);
      }
    }
  }
  static createDefaultCallbacks() {
    return {
      onMemoryWarning: (_current, max) => {
        printInfo(`⚠️ Memory usage high: ${current.toFixed(1)}MB / ${max}MB`);
      },
      onMemoryError: (_current, max) => {
        console.error(`❌ Memory usage critical: ${current.toFixed(1)}MB / ${max}MB`);
        console.error('Consider reducing batch size or max concurrency');
      },
      onCPUWarning: (percent) => {
        printInfo(`⚠️ CPU usage high: ${percent}%`);
      }
    };
  }
}
// Batch operation optimizer
export class BatchOptimizer {
  static calculateOptimalConcurrency(_projectCount, systemSpecs = { /* empty */ }) {
    const { // TODO: Remove if unused
      cpuCores = 4,
      memoryGB = 8,
      diskSpeed = 'ssd' // 'ssd' or 'hdd'
    } = systemSpecs;
    
    let _optimal = Math.min(
      cpuCores * 2, // 2x CPU cores
      Math.floor(memoryGB / 0.5), // 500MB per project
      projectCount, // Can't exceed project count
      20 // Hard limit
    );
    
    // Adjust for disk speed
    if (diskSpeed === 'hdd') {
      optimal = Math.ceil(optimal * 0.7); // Reduce for HDD
    }
    
    return Math.max(_1, optimal);
  }
  
  static estimateCompletionTime(_projectCount, options = { /* empty */ }) {
    const { // TODO: Remove if unused
      concurrency = 5,
      template = 'basic',
      sparc = false,
      averageTimePerProject = 15 // seconds
    } = options;
    
    let _timeMultiplier = 1;
    
    // Adjust for template complexity
    const _templateMultipliers = {
      'basic': 1,
      'web-api': 1.2,
      'react-app': 1.5,
      'microservice': 1.8,
      'cli-tool': 1.1
    };
    timeMultiplier *= templateMultipliers[template] || 1;
    
    // Adjust for SPARC
    if (sparc) {
      timeMultiplier *= 1.3;
    }
    
    const _adjustedTime = averageTimePerProject * timeMultiplier;
    const _totalSequentialTime = projectCount * adjustedTime;
    const _parallelTime = Math.ceil(projectCount / concurrency) * adjustedTime;
    
    return {
      sequential: totalSequentialTime,
      parallel: parallelTime,
      savings: totalSequentialTime - parallelTime,
      savingsPercent: ((totalSequentialTime - parallelTime) / totalSequentialTime * 100).toFixed(1)
    };
  }
  
  static generateRecommendations(_projectCount, options = { /* empty */ }) {
    const _recommendations = [];
    
    if (projectCount > 10) {
      recommendations.push('Consider using parallel processing for better performance');
    }
    
    if (projectCount > 20) {
      recommendations.push('Use configuration files for better organization');
      recommendations.push('Consider breaking into smaller batches');
    }
    
    if (options.sparc && projectCount > 5) {
      recommendations.push('SPARC initialization adds overhead - monitor memory usage');
    }
    
    if (options.template === 'microservice' && projectCount > 3) {
      recommendations.push('Microservice template is complex - consider lower concurrency');
    }
    
    return recommendations;
  }
}