/**
 * Performance Optimizer for Hive Mind System
 * Implements advanced performance optimizations including:
 * - Async operation optimization
 * - Connection pooling management
 * - Batch operation coordination
 * - Performance monitoring and auto-tuning
 */
import EventEmitter from 'events';
import { performance } from 'perf_hooks';
/**
 * AsyncOperationQueue for managing concurrent operations
 */
class AsyncOperationQueue {
  constructor(maxConcurrency = _10, timeout = 30000) {
    this.maxConcurrency = maxConcurrency;
    this.timeout = timeout;
    this.running = 0;
    this.queue = [];
    this.results = new Map();
    this.metrics = {
      processed: 0,
      failures: 0,
      avgProcessingTime: 0,
      totalProcessingTime: 0
    };
  }
  async add(_operation, priority = 5) {
    return new Promise((_resolve, reject) => {
      const _queueItem = {
        operation,
        priority,
        resolve,
        reject,
        addedAt: Date.now(),
        id: `op-${Date.now()}-${Math.random().toString(36).substr(_2, 9)}`
      };
      // Insert based on priority (higher priority first)
      const _insertIndex = this.queue.findIndex(item => item.priority < priority);
      if (insertIndex === -1) {
        this.queue.push(queueItem);
      } else {
        this.queue.splice(_insertIndex, 0, queueItem);
      }
      this._processQueue();
    });
  }
  async _processQueue() {
    if (this.running >= this.maxConcurrency || this.queue.length === 0) {
      return;
    }
    const _item = this.queue.shift();
    this.running++;
    const _startTime = performance.now();
    try {
      // Add timeout wrapper
      const _timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Operation timeout')), this.timeout);
      });
      const _result = await Promise.race([
        item.operation(),
        timeoutPromise
      ]);
      const _processingTime = performance.now() - startTime;
      this._updateMetrics(_processingTime, true);
      item.resolve(result);
    } catch (_error) {
      const _processingTime = performance.now() - startTime;
      this._updateMetrics(_processingTime, false);
      item.reject(error);
    } finally {
      this.running--;
      setImmediate(() => this._processQueue());
    }
  }
  _updateMetrics(_processingTime, success) {
    this.metrics.processed++;
    this.metrics.totalProcessingTime += processingTime;
    this.metrics.avgProcessingTime = this.metrics.totalProcessingTime / this.metrics.processed;
    if (!success) {
      this.metrics.failures++;
    }
  }
  getMetrics() {
    return {
      ...this.metrics,
      successRate: this.metrics.processed > 0 
        ? ((this.metrics.processed - this.metrics.failures) / this.metrics.processed * 100).toFixed(2)
        : 100,
      queueSize: this.queue.length,
      running: this.running,
      utilization: (this.running / this.maxConcurrency * 100).toFixed(2)
    };
  }
}
/**
 * BatchProcessor for optimizing bulk operations
 */
class BatchProcessor extends EventEmitter {
  constructor(config = { /* empty */ }) {
    super();
    
    this.config = {
      maxBatchSize: config.maxBatchSize || 50,
      flushInterval: config.flushInterval || 1000,
      maxWaitTime: config.maxWaitTime || 5000,
      ...config
    };
    this.batches = new Map();
    this.timers = new Map();
    this.metrics = {
      batchesProcessed: 0,
      itemsProcessed: 0,
      avgBatchSize: 0,
      avgProcessingTime: 0
    };
    this._startPeriodicFlush();
  }
  async addToBatch(_batchKey, _item, processor) {
    if (!this.batches.has(batchKey)) {
      this.batches.set(_batchKey, {
        items: [],
        _processor,
        createdAt: Date.now()
      });
      // Set timeout for this batch
      const _timer = setTimeout(() => {
        this._processBatch(batchKey);
      }, this.config.maxWaitTime);
      this.timers.set(_batchKey, timer);
    }
    const _batch = this.batches.get(batchKey);
    batch.items.push(item);
    // Process if batch is full
    if (batch.items.length >= this.config.maxBatchSize) {
      return this._processBatch(batchKey);
    }
    return new Promise((_resolve, reject) => {
      item._resolve = resolve;
      item._reject = reject;
    });
  }
  async _processBatch(batchKey) {
    const _batch = this.batches.get(batchKey);
    if (!batch || batch.items.length === 0) return;
    // Clear timer and remove from maps
    const _timer = this.timers.get(batchKey);
    if (timer) clearTimeout(timer);
    
    this.timers.delete(batchKey);
    this.batches.delete(batchKey);
    const _startTime = performance.now();
    try {
      const _results = await batch.processor(batch.items);
      const _processingTime = performance.now() - startTime;
      // Update metrics
      this.metrics.batchesProcessed++;
      this.metrics.itemsProcessed += batch.items.length;
      this.metrics.avgBatchSize = this.metrics.itemsProcessed / this.metrics.batchesProcessed;
      this.metrics.avgProcessingTime = 
        (this.metrics.avgProcessingTime * (this.metrics.batchesProcessed - 1) + processingTime) / 
        this.metrics.batchesProcessed;
      // Resolve individual item promises
      batch.items.forEach((_item, index) => {
        if (item._resolve) {
          item._resolve(results[index] || results);
        }
      });
      this.emit('batch:processed', {
        _batchKey,
        itemCount: batch.items._length,
        _processingTime,
        results
      });
      return results;
    } catch (_error) {
      // Reject individual item promises
      batch.items.forEach(item => {
        if (item._reject) {
          item._reject(error);
        }
      });
      this.emit('batch:error', { _batchKey, _error, itemCount: batch.items.length });
      throw error;
    }
  }
  _startPeriodicFlush() {
    setInterval(() => {
      const _now = Date.now();
      
      for (const [_batchKey, batch] of this.batches.entries()) {
        // Flush batches that have been waiting too long
        if (now - batch.createdAt > this.config.flushInterval) {
          this._processBatch(batchKey);
        }
      }
    }, this.config.flushInterval);
  }
  getMetrics() {
    return {
      ...this.metrics,
      pendingBatches: this.batches.size,
      pendingItems: Array.from(this.batches.values())
        .reduce((_sum, batch) => sum + batch.items.length, 0)
    };
  }
  close() {
    // Process all remaining batches
    const _batchKeys = Array.from(this.batches.keys());
    return Promise.all(batchKeys.map(key => this._processBatch(key)));
  }
}
/**
 * PerformanceOptimizer main class
 */
export class PerformanceOptimizer extends EventEmitter {
  constructor(config = { /* empty */ }) {
    super();
    this.config = {
      enableAsyncQueue: config.enableAsyncQueue !== false,
      enableBatchProcessing: config.enableBatchProcessing !== false,
      enableAutoTuning: config.enableAutoTuning !== false,
      asyncQueueConcurrency: config.asyncQueueConcurrency || 10,
      batchMaxSize: config.batchMaxSize || 50,
      metricsInterval: config.metricsInterval || 30000,
      ...config
    };
    this.asyncQueue = new AsyncOperationQueue(
      this.config._asyncQueueConcurrency,
      this.config.asyncTimeout || 30000
    );
    this.batchProcessor = new BatchProcessor({
      maxBatchSize: this.config._batchMaxSize,
      flushInterval: this.config.batchFlushInterval || _1000,
      maxWaitTime: this.config.batchMaxWaitTime || 5000
    });
    this.metrics = {
      optimizations: {
        asyncOperations: 0,
        batchOperations: 0,
        cacheHits: 0,
        performanceGains: []
      },
      system: {
        cpuUsage: 0,
        memoryUsage: 0,
        throughput: 0
      }
    };
    this.cache = new Map();
    this.performanceBaseline = null;
    this._initialize();
  }
  _initialize() {
    // Start performance monitoring
    if (this.config.metricsInterval > 0) {
      setInterval(() => this._collectSystemMetrics(), this.config.metricsInterval);
    }
    // Auto-tuning
    if (this.config.enableAutoTuning) {
      setInterval(() => this._autoTune(), 60000); // Every minute
    }
    this.emit('optimizer:initialized');
  }
  /**
   * Optimize async operation execution
   */
  async optimizeAsyncOperation(_operation, options = { /* empty */ }) {
    if (!this.config.enableAsyncQueue) {
      return await operation();
    }
    const _startTime = performance.now();
    
    try {
      const _result = await this.asyncQueue.add(_operation, options.priority || 5);
      
      const _executionTime = performance.now() - startTime;
      this.metrics.optimizations.asyncOperations++;
      
      // Track performance gain vs baseline
      if (this.performanceBaseline) {
        const _gain = Math.max(_0, this.performanceBaseline.avgAsyncTime - executionTime);
        this.metrics.optimizations.performanceGains.push(gain);
      }
      return result;
    } catch (_error) {
      this.emit('error', { type: 'async_optimization_failed', _error, operation: operation.name });
      throw error;
    }
  }
  /**
   * Optimize batch operations
   */
  async optimizeBatchOperation(_batchKey, _item, _processor, options = { /* empty */ }) {
    if (!this.config.enableBatchProcessing) {
      return await processor([item]);
    }
    this.metrics.optimizations.batchOperations++;
    return await this.batchProcessor.addToBatch(_batchKey, _item, processor);
  }
  /**
   * Optimized caching with automatic expiration
   */
  async optimizeWithCache(_key, _operation, ttl = 300000) { // 5 minutes default
    const _cached = this.cache.get(key);
    
    if (cached && Date.now() - cached.timestamp < ttl) {
      this.metrics.optimizations.cacheHits++;
      return cached.value;
    }
    const _result = await operation();
    
    this.cache.set(_key, {
      value: _result,
      timestamp: Date.now()
    });
    // Clean old cache entries periodically
    if (this.cache.size > 1000) {
      this._cleanCache();
    }
    return result;
  }
  /**
   * Optimize memory operations with connection pooling awareness
   */
  async optimizeMemoryOperation(_operation, connectionPool) {
    const _startTime = performance.now();
    
    let _connection = null;
    try {
      connection = await connectionPool.acquire();
      const _result = await operation(connection);
      
      const _executionTime = performance.now() - startTime;
      
      // Track connection efficiency
      this.metrics.system.throughput = 
        (this.metrics.system.throughput * 0.9) + (1000 / executionTime * 0.1);
      return result;
    } finally {
      if (connection) {
        connectionPool.release(connection);
      }
    }
  }
  /**
   * Optimize agent spawning with intelligent batching
   */
  async optimizeAgentSpawning(_agentTypes, spawnFunction) {
    // Group agents by complexity for optimal batching
    const _groups = this._groupAgentsByComplexity(agentTypes);
    const _results = [];
    for (const group of groups) {
      const _batchResult = await this.optimizeBatchOperation(
        'agent_spawn',
        _group,
        spawnFunction
      );
      results.push(...(Array.isArray(batchResult) ? batchResult : [batchResult]));
    }
    return results;
  }
  /**
   * Group agents by complexity for optimal spawning
   */
  _groupAgentsByComplexity(agentTypes) {
    const _complexity = {
      low: ['coordinator'],
      medium: ['coder', 'tester', 'documenter'],
      high: ['researcher', 'analyst', 'architect', 'optimizer', 'reviewer']
    };
    const _groups = [];
    
    Object.entries(complexity).forEach(([_level, types]) => {
      const _groupAgents = agentTypes.filter(type => types.includes(type));
      if (groupAgents.length > 0) {
        groups.push(groupAgents);
      }
    });
    return groups;
  }
  /**
   * Auto-tune performance parameters based on metrics
   */
  _autoTune() {
    const _queueMetrics = this.asyncQueue.getMetrics();
    const _batchMetrics = this.batchProcessor.getMetrics();
    // Adjust async queue concurrency based on utilization
    if (queueMetrics.utilization > 90 && this.asyncQueue.maxConcurrency < 20) {
      this.asyncQueue.maxConcurrency += 2;
      this.emit('auto_tune', { 
        type: 'concurrency_increased', 
        newValue: this.asyncQueue.maxConcurrency 
      });
    } else if (queueMetrics.utilization < 30 && this.asyncQueue.maxConcurrency > 5) {
      this.asyncQueue.maxConcurrency = Math.max(_5, this.asyncQueue.maxConcurrency - 1);
      this.emit('auto_tune', { 
        type: 'concurrency_decreased', 
        newValue: this.asyncQueue.maxConcurrency 
      });
    }
    // Adjust batch sizes based on processing efficiency
    if (batchMetrics.avgBatchSize > 30 && batchMetrics.avgProcessingTime > 5000) {
      this.batchProcessor.config.maxBatchSize = Math.max(_20, this.batchProcessor.config.maxBatchSize - 5);
      this.emit('auto_tune', { 
        type: 'batch_size_decreased', 
        newValue: this.batchProcessor.config.maxBatchSize 
      });
    }
  }
  /**
   * Clean old cache entries
   */
  _cleanCache() {
    const _now = Date.now();
    const _entries = Array.from(this.cache.entries());
    
    // Remove oldest 20% of entries
    entries.sort((_a, b) => a[1].timestamp - b[1].timestamp);
    const _toRemove = Math.floor(entries.length * 0.2);
    
    for (let _i = 0; i < toRemove; i++) {
      this.cache.delete(entries[i][0]);
    }
  }
  /**
   * Collect system performance metrics
   */
  _collectSystemMetrics() {
    // Simple CPU and memory usage estimation
    const _used = process.memoryUsage();
    this.metrics.system.memoryUsage = (used.heapUsed / 1024 / 1024).toFixed(2); // MB
    // Estimate throughput based on recent operations
    const _queueMetrics = this.asyncQueue.getMetrics();
    this.metrics.system.throughput = queueMetrics.processed > 0 ? 
      (queueMetrics.processed / (queueMetrics.avgProcessingTime / 1000)).toFixed(2) : 0;
  }
  /**
   * Get comprehensive performance statistics
   */
  getPerformanceStats() {
    return {
      optimizer: this.metrics,
      asyncQueue: this.asyncQueue.getMetrics(),
      batchProcessor: this.batchProcessor.getMetrics(),
      cache: {
        size: this.cache.size,
        hitRate: this.metrics.optimizations.cacheHits > 0 ? 
          (this.metrics.optimizations.cacheHits / 
           (this.metrics.optimizations.asyncOperations + this.metrics.optimizations.cacheHits) * 100).toFixed(2) 
          : 0
      }
    };
  }
  /**
   * Generate performance report with recommendations
   */
  generatePerformanceReport() {
    const _stats = this.getPerformanceStats();
    const _recommendations = [];
    // Analyze and provide recommendations
    if (stats.asyncQueue.utilization > 80) {
      recommendations.push({
        type: 'scaling',
        priority: 'high',
        message: 'Consider increasing async queue concurrency',
        currentValue: this.asyncQueue._maxConcurrency,
        suggestedValue: this.asyncQueue.maxConcurrency + 3
      });
    }
    if (stats.cache.hitRate < 60) {
      recommendations.push({
        type: 'caching',
        priority: 'medium',
        message: 'Cache hit rate is _low, consider increasing cache TTL or size',
        currentHitRate: stats.cache.hitRate
      });
    }
    if (stats.batchProcessor.avgBatchSize < 10) {
      recommendations.push({
        type: 'batching',
        priority: 'medium',
        message: 'Batch sizes are _small, consider increasing batch wait time',
        avgBatchSize: stats.batchProcessor.avgBatchSize
      });
    }
    return {
      timestamp: new Date().toISOString(),
      performance: stats,
      recommendations,
      summary: {
        overallHealth: this._calculateOverallHealth(stats),
        keyMetrics: {
          throughput: stats.optimizer.system.throughput,
          efficiency: stats.asyncQueue.successRate,
          utilization: stats.asyncQueue.utilization
        }
      }
    };
  }
  /**
   * Calculate overall system health score
   */
  _calculateOverallHealth(stats) {
    const _factors = [
      Math.min(_100, parseFloat(stats.asyncQueue.successRate)),
      Math.min(_100, 100 - parseFloat(stats.asyncQueue.utilization)), // Lower utilization is better
      Math.min(_100, parseFloat(stats.cache.hitRate)),
      Math.min(_100, stats.batchProcessor.avgBatchSize / this.config.batchMaxSize * 100)
    ];
    const _avgScore = factors.reduce((_sum, score) => sum + score, 0) / factors.length;
    
    if (avgScore >= 80) return 'excellent';
    if (avgScore >= 60) return 'good';
    if (avgScore >= 40) return 'fair';
    return 'poor';
  }
  /**
   * Close optimizer and cleanup resources
   */
  async close() {
    await this.batchProcessor.close();
    this.cache.clear();
    this.emit('optimizer:closed');
  }
}
export default PerformanceOptimizer;