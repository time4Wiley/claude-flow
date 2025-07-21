/**
 * Cost Optimization Framework Export
 * Central module for all cost optimization features
 */

export * from './cost-optimizer';
export * from './batch-processor';
export * from './cache-manager';
export * from './cost-report-generator';

import { CostOptimizer, createCostOptimizer } from './cost-optimizer';
import { BatchProcessor } from './batch-processor';
import { CacheManager, createCacheManager } from './cache-manager';
import { CostReportGenerator, createCostReportGenerator } from './cost-report-generator';
import { ProviderManager } from '../providers/manager';
import { logger } from '../utils/logger';

/**
 * Integrated cost optimization system
 */
export class IntegratedCostOptimizationSystem {
  private costOptimizer: CostOptimizer;
  private batchProcessor: BatchProcessor;
  private cacheManager: CacheManager;
  private reportGenerator: CostReportGenerator;
  private providerManager?: ProviderManager;

  constructor() {
    this.costOptimizer = new CostOptimizer({
      targetCostReduction: 0.6,
      batchingEnabled: true,
      cachingEnabled: true,
      intelligentRoutingEnabled: true
    });

    this.batchProcessor = new BatchProcessor({
      maxBatchSize: 10,
      batchWindowMs: 50,
      enableDynamicBatching: true,
      enablePriorityQueuing: true,
      enableSmartGrouping: true
    });

    this.cacheManager = createCacheManager({
      l1Size: 1000,
      l2Size: 5000,
      l3Size: 20000,
      enablePredictiveWarming: true
    });

    this.reportGenerator = createCostReportGenerator();
  }

  /**
   * Initialize the system
   */
  async initialize(providerManager?: ProviderManager): Promise<void> {
    logger.info('Initializing Integrated Cost Optimization System...');
    
    this.providerManager = providerManager;
    await this.costOptimizer.initialize();
    
    // Wire up components
    this.setupEventHandlers();
    
    logger.info('Cost Optimization System initialized successfully');
  }

  /**
   * Process an optimized request
   */
  async processRequest(options: any): Promise<any> {
    if (!this.providerManager) {
      throw new Error('Provider manager not initialized');
    }

    // Check cache first
    const cacheKey = this.generateCacheKey(options);
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Process through cost optimizer
    const response = await this.costOptimizer.optimizeRequest(
      options,
      this.providerManager
    );

    // Cache successful response
    await this.cacheManager.set(cacheKey, response, {
      cost: response.usage?.estimatedCost || 0
    });

    return response;
  }

  /**
   * Get optimization metrics
   */
  getMetrics() {
    const costMetrics = this.costOptimizer.getMetrics();
    const batchMetrics = this.batchProcessor.getMetrics();
    const cacheStats = this.cacheManager.getStats();

    return {
      cost: costMetrics,
      batching: batchMetrics,
      cache: cacheStats,
      overall: {
        totalRequests: costMetrics.totalRequests,
        totalCost: costMetrics.totalCost,
        totalSaved: costMetrics.totalSaved + cacheStats.totalCostSaved,
        effectiveReduction: (costMetrics.totalSaved + cacheStats.totalCostSaved) / 
          (costMetrics.totalCost + costMetrics.totalSaved + cacheStats.totalCostSaved),
        cacheHitRate: cacheStats.hitRate,
        batchingEfficiency: batchMetrics.efficiencyGain
      }
    };
  }

  /**
   * Generate cost optimization report
   */
  generateReport(): any {
    const metrics = this.getMetrics();
    const report = this.reportGenerator.generateReport(
      metrics.cost,
      metrics.batching,
      metrics.cache,
      0.6 // 60% target reduction
    );

    return {
      report,
      markdown: this.reportGenerator.formatAsMarkdown(report),
      html: this.reportGenerator.formatAsHTML(report)
    };
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    // Cache events
    this.cacheManager.on('cache:hit', (data) => {
      logger.debug(`Cache hit: ${data.key} from ${data.tier}`);
    });

    // Batch events
    this.batchProcessor.on('batch:completed', (data) => {
      logger.info(`Batch completed: ${data.requestCount} requests in ${data.duration}ms`);
    });

    // Cost optimizer events
    this.costOptimizer.on('cost:saved', (data) => {
      logger.info(`Cost saved: $${data.amount}`);
    });
  }

  /**
   * Generate cache key
   */
  private generateCacheKey(options: any): string {
    return `${options.model}_${JSON.stringify(options.messages)}_${options.temperature}`;
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    await this.costOptimizer.cleanup();
    this.batchProcessor.cleanup();
    await this.cacheManager.clear();
  }
}

/**
 * Factory function to create integrated system
 */
export async function createIntegratedCostOptimizationSystem(
  providerManager?: ProviderManager
): Promise<IntegratedCostOptimizationSystem> {
  const system = new IntegratedCostOptimizationSystem();
  await system.initialize(providerManager);
  return system;
}