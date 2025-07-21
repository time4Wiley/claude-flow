import * as tf from '@tensorflow/tfjs-node';
import { logger } from '../../utils/logger';
import { ModelEnsemble } from '../optimization/ModelEnsemble';

/**
 * Production model serving infrastructure with A/B testing and monitoring
 * Supports multiple models, load balancing, and performance tracking
 */
export class ModelServer {
  private deployedModels: Map<string, DeployedModel> = new Map();
  private ensembles: Map<string, ModelEnsemble> = new Map();
  private readonly config: ModelServerConfig;
  private performanceMetrics: Map<string, ModelMetrics> = new Map();
  private abTests: Map<string, ABTest> = new Map();
  private requestCount: number = 0;

  constructor(config?: Partial<ModelServerConfig>) {
    this.config = {
      maxConcurrentRequests: 100,
      requestTimeout: 30000,
      enableMetrics: true,
      enableABTesting: true,
      metricsRetentionDays: 30,
      warmupRequests: 5,
      autoScaling: true,
      healthCheckInterval: 60000,
      ...config
    };

    if (this.config.enableMetrics) {
      this.startMetricsCollection();
    }

    if (this.config.healthCheckInterval > 0) {
      this.startHealthChecks();
    }
  }

  /**
   * Deploy a model for serving
   */
  public async deployModel(
    modelId: string,
    model: tf.LayersModel,
    config: DeploymentConfig
  ): Promise<void> {
    try {
      logger.info(`Deploying model: ${modelId}`);

      // Validate model
      await this.validateModel(model);

      // Create deployment
      const deployedModel: DeployedModel = {
        id: modelId,
        model,
        config,
        status: 'warming_up',
        deployedAt: Date.now(),
        version: config.version || '1.0.0',
        requestCount: 0,
        errorCount: 0,
        lastRequestTime: 0,
        averageLatency: 0,
        metadata: config.metadata || {}
      };

      // Warm up model
      await this.warmupModel(deployedModel);

      // Register model
      this.deployedModels.set(modelId, deployedModel);
      
      // Initialize metrics
      if (this.config.enableMetrics) {
        this.initializeMetrics(modelId);
      }

      logger.info(`Model ${modelId} deployed successfully`);

    } catch (error) {
      logger.error(`Error deploying model ${modelId}:`, error);
      throw error;
    }
  }

  /**
   * Deploy an ensemble for serving
   */
  public async deployEnsemble(
    ensembleId: string,
    ensemble: ModelEnsemble,
    config: DeploymentConfig
  ): Promise<void> {
    try {
      logger.info(`Deploying ensemble: ${ensembleId}`);

      this.ensembles.set(ensembleId, ensemble);

      // Create virtual deployment entry for the ensemble
      const ensembleDeployment: DeployedModel = {
        id: ensembleId,
        model: null as any, // Ensemble doesn't have single model
        config,
        status: 'active',
        deployedAt: Date.now(),
        version: config.version || '1.0.0',
        requestCount: 0,
        errorCount: 0,
        lastRequestTime: 0,
        averageLatency: 0,
        metadata: { ...config.metadata, type: 'ensemble' }
      };

      this.deployedModels.set(ensembleId, ensembleDeployment);

      if (this.config.enableMetrics) {
        this.initializeMetrics(ensembleId);
      }

      logger.info(`Ensemble ${ensembleId} deployed successfully`);

    } catch (error) {
      logger.error(`Error deploying ensemble ${ensembleId}:`, error);
      throw error;
    }
  }

  /**
   * Make prediction with deployed model/ensemble
   */
  public async predict(
    modelId: string,
    input: tf.Tensor | tf.Tensor[],
    options?: PredictionOptions
  ): Promise<PredictionResponse> {
    const startTime = Date.now();
    this.requestCount++;

    try {
      // Check if model exists
      const deployedModel = this.deployedModels.get(modelId);
      if (!deployedModel) {
        throw new Error(`Model ${modelId} not found`);
      }

      // Check model status
      if (deployedModel.status !== 'active' && deployedModel.status !== 'warming_up') {
        throw new Error(`Model ${modelId} is not available (status: ${deployedModel.status})`);
      }

      // Check concurrent request limit
      if (this.requestCount > this.config.maxConcurrentRequests) {
        throw new Error('Server overloaded, too many concurrent requests');
      }

      let prediction: tf.Tensor;
      let metadata: any = {};

      // Route to appropriate handler
      if (this.ensembles.has(modelId)) {
        // Handle ensemble prediction
        const ensemble = this.ensembles.get(modelId)!;
        const ensembleResult = await ensemble.predict(input);
        prediction = ensembleResult.prediction;
        metadata = {
          type: 'ensemble',
          confidence: ensembleResult.confidence,
          uncertainty: ensembleResult.uncertainty,
          agreement: ensembleResult.agreement,
          modelContributions: ensembleResult.modelContributions,
          strategy: ensembleResult.strategy
        };
      } else {
        // Handle single model prediction
        const model = deployedModel.model;
        prediction = model.predict(input) as tf.Tensor;
        metadata = {
          type: 'single_model',
          version: deployedModel.version
        };
      }

      const latency = Date.now() - startTime;

      // Update metrics
      this.updateModelMetrics(modelId, latency, true);

      // Handle A/B testing
      if (this.config.enableABTesting && options?.abTestId) {
        this.recordABTestResult(options.abTestId, modelId, prediction, latency);
      }

      const response: PredictionResponse = {
        modelId,
        prediction,
        latency,
        timestamp: Date.now(),
        requestId: this.generateRequestId(),
        metadata
      };

      return response;

    } catch (error) {
      const latency = Date.now() - startTime;
      this.updateModelMetrics(modelId, latency, false);
      
      logger.error(`Prediction error for model ${modelId}:`, error);
      throw error;

    } finally {
      this.requestCount--;
    }
  }

  /**
   * Batch prediction for multiple inputs
   */
  public async batchPredict(
    modelId: string,
    inputs: (tf.Tensor | tf.Tensor[])[],
    options?: PredictionOptions
  ): Promise<BatchPredictionResponse> {
    const startTime = Date.now();

    try {
      const predictions = await Promise.all(
        inputs.map(async (input, index) => {
          try {
            const result = await this.predict(modelId, input, {
              ...options,
              requestId: `${options?.requestId || 'batch'}_${index}`
            });
            return { success: true, result, index };
          } catch (error) {
            return { success: false, error: error.message, index };
          }
        })
      );

      const successful = predictions.filter(p => p.success);
      const failed = predictions.filter(p => !p.success);

      return {
        modelId,
        totalRequests: inputs.length,
        successfulPredictions: successful.length,
        failedPredictions: failed.length,
        predictions: successful.map(p => p.result!),
        errors: failed.map(p => ({ index: p.index, error: p.error! })),
        totalLatency: Date.now() - startTime,
        timestamp: Date.now()
      };

    } catch (error) {
      logger.error(`Batch prediction error for model ${modelId}:`, error);
      throw error;
    }
  }

  /**
   * Start A/B test between models
   */
  public startABTest(
    testId: string,
    modelA: string,
    modelB: string,
    trafficSplit: number = 0.5,
    config?: ABTestConfig
  ): void {
    if (!this.deployedModels.has(modelA) || !this.deployedModels.has(modelB)) {
      throw new Error('Both models must be deployed for A/B testing');
    }

    const abTest: ABTest = {
      id: testId,
      modelA,
      modelB,
      trafficSplit,
      startTime: Date.now(),
      endTime: config?.duration ? Date.now() + config.duration : undefined,
      results: {
        modelA: { requests: 0, successes: 0, totalLatency: 0, errors: 0 },
        modelB: { requests: 0, successes: 0, totalLatency: 0, errors: 0 }
      },
      config: config || {},
      status: 'active'
    };

    this.abTests.set(testId, abTest);
    logger.info(`Started A/B test ${testId}: ${modelA} vs ${modelB}`);
  }

  /**
   * Stop A/B test and get results
   */
  public stopABTest(testId: string): ABTestResults {
    const test = this.abTests.get(testId);
    if (!test) {
      throw new Error(`A/B test ${testId} not found`);
    }

    test.status = 'completed';
    test.endTime = Date.now();

    const results = this.calculateABTestResults(test);
    logger.info(`Stopped A/B test ${testId}`, results);

    return results;
  }

  /**
   * Get model performance metrics
   */
  public getModelMetrics(modelId: string): ModelMetrics | undefined {
    return this.performanceMetrics.get(modelId);
  }

  /**
   * Get all deployed models status
   */
  public getDeployedModels(): DeployedModelInfo[] {
    return Array.from(this.deployedModels.values()).map(model => ({
      id: model.id,
      status: model.status,
      version: model.version,
      deployedAt: model.deployedAt,
      requestCount: model.requestCount,
      errorCount: model.errorCount,
      averageLatency: model.averageLatency,
      lastRequestTime: model.lastRequestTime,
      metadata: model.metadata
    }));
  }

  /**
   * Update model (blue-green deployment)
   */
  public async updateModel(
    modelId: string,
    newModel: tf.LayersModel,
    config: DeploymentConfig
  ): Promise<void> {
    try {
      logger.info(`Updating model: ${modelId}`);

      // Create new deployment with temporary ID
      const tempId = `${modelId}_new`;
      await this.deployModel(tempId, newModel, config);

      // Warm up new model
      const newDeployment = this.deployedModels.get(tempId)!;
      await this.warmupModel(newDeployment);

      // Switch traffic to new model
      const oldDeployment = this.deployedModels.get(modelId);
      if (oldDeployment) {
        // Dispose old model
        if (oldDeployment.model) {
          oldDeployment.model.dispose();
        }
        this.deployedModels.delete(modelId);
      }

      // Rename new deployment
      newDeployment.id = modelId;
      this.deployedModels.delete(tempId);
      this.deployedModels.set(modelId, newDeployment);

      logger.info(`Model ${modelId} updated successfully`);

    } catch (error) {
      logger.error(`Error updating model ${modelId}:`, error);
      throw error;
    }
  }

  /**
   * Undeploy model
   */
  public async undeployModel(modelId: string): Promise<void> {
    try {
      const deployment = this.deployedModels.get(modelId);
      if (!deployment) {
        throw new Error(`Model ${modelId} not found`);
      }

      // Mark as inactive
      deployment.status = 'inactive';

      // Dispose model
      if (deployment.model) {
        deployment.model.dispose();
      }

      // Remove from maps
      this.deployedModels.delete(modelId);
      this.performanceMetrics.delete(modelId);

      // Remove ensemble if exists
      if (this.ensembles.has(modelId)) {
        const ensemble = this.ensembles.get(modelId)!;
        ensemble.dispose();
        this.ensembles.delete(modelId);
      }

      logger.info(`Model ${modelId} undeployed successfully`);

    } catch (error) {
      logger.error(`Error undeploying model ${modelId}:`, error);
      throw error;
    }
  }

  /**
   * Get server health status
   */
  public getHealth(): ServerHealth {
    const totalModels = this.deployedModels.size;
    const activeModels = Array.from(this.deployedModels.values())
      .filter(m => m.status === 'active').length;

    const totalRequests = Array.from(this.deployedModels.values())
      .reduce((sum, m) => sum + m.requestCount, 0);

    const totalErrors = Array.from(this.deployedModels.values())
      .reduce((sum, m) => sum + m.errorCount, 0);

    const averageLatency = Array.from(this.deployedModels.values())
      .reduce((sum, m) => sum + m.averageLatency, 0) / totalModels || 0;

    return {
      status: activeModels > 0 ? 'healthy' : 'unhealthy',
      timestamp: Date.now(),
      models: {
        total: totalModels,
        active: activeModels,
        inactive: totalModels - activeModels
      },
      requests: {
        total: totalRequests,
        current: this.requestCount,
        errors: totalErrors,
        errorRate: totalRequests > 0 ? totalErrors / totalRequests : 0
      },
      performance: {
        averageLatency,
        memoryUsage: process.memoryUsage().heapUsed
      }
    };
  }

  /**
   * Validate model before deployment
   */
  private async validateModel(model: tf.LayersModel): Promise<void> {
    try {
      // Check if model has valid structure
      if (!model || !model.predict) {
        throw new Error('Invalid model: missing predict method');
      }

      // Try a dummy prediction
      const inputShape = model.inputs[0].shape;
      const dummyInput = tf.zeros(inputShape.slice(1) as number[]);
      const prediction = model.predict(dummyInput) as tf.Tensor;
      
      // Verify prediction shape
      if (!prediction || prediction.shape.length === 0) {
        throw new Error('Model produces invalid output');
      }

      // Cleanup
      dummyInput.dispose();
      prediction.dispose();

    } catch (error) {
      throw new Error(`Model validation failed: ${error.message}`);
    }
  }

  /**
   * Warm up model with test requests
   */
  private async warmupModel(deployment: DeployedModel): Promise<void> {
    if (!deployment.model) return; // Skip for ensembles

    try {
      logger.info(`Warming up model: ${deployment.id}`);

      const inputShape = deployment.model.inputs[0].shape;
      
      for (let i = 0; i < this.config.warmupRequests; i++) {
        const dummyInput = tf.randomNormal(inputShape.slice(1) as number[]);
        const prediction = deployment.model.predict(dummyInput) as tf.Tensor;
        
        dummyInput.dispose();
        prediction.dispose();
      }

      deployment.status = 'active';
      logger.info(`Model ${deployment.id} warmed up successfully`);

    } catch (error) {
      deployment.status = 'error';
      throw new Error(`Model warmup failed: ${error.message}`);
    }
  }

  /**
   * Initialize metrics collection for a model
   */
  private initializeMetrics(modelId: string): void {
    this.performanceMetrics.set(modelId, {
      modelId,
      requestCount: 0,
      errorCount: 0,
      totalLatency: 0,
      averageLatency: 0,
      requestsPerMinute: 0,
      errorsPerMinute: 0,
      lastUpdated: Date.now(),
      latencyHistory: [],
      errorHistory: []
    });
  }

  /**
   * Update model performance metrics
   */
  private updateModelMetrics(modelId: string, latency: number, success: boolean): void {
    const deployment = this.deployedModels.get(modelId);
    const metrics = this.performanceMetrics.get(modelId);

    if (deployment) {
      deployment.requestCount++;
      deployment.lastRequestTime = Date.now();
      
      if (!success) {
        deployment.errorCount++;
      }

      // Update average latency
      deployment.averageLatency = 
        (deployment.averageLatency * (deployment.requestCount - 1) + latency) / deployment.requestCount;
    }

    if (metrics) {
      metrics.requestCount++;
      metrics.totalLatency += latency;
      metrics.averageLatency = metrics.totalLatency / metrics.requestCount;
      
      if (!success) {
        metrics.errorCount++;
      }

      // Keep latency history (last 100 requests)
      metrics.latencyHistory.push({ timestamp: Date.now(), latency });
      if (metrics.latencyHistory.length > 100) {
        metrics.latencyHistory.shift();
      }

      // Update error history
      if (!success) {
        metrics.errorHistory.push({ timestamp: Date.now(), error: 'Prediction failed' });
        if (metrics.errorHistory.length > 50) {
          metrics.errorHistory.shift();
        }
      }

      metrics.lastUpdated = Date.now();
    }
  }

  /**
   * Record A/B test result
   */
  private recordABTestResult(
    testId: string,
    modelId: string,
    prediction: tf.Tensor,
    latency: number
  ): void {
    const test = this.abTests.get(testId);
    if (!test || test.status !== 'active') return;

    const isModelA = modelId === test.modelA;
    const isModelB = modelId === test.modelB;

    if (!isModelA && !isModelB) return;

    const results = isModelA ? test.results.modelA : test.results.modelB;
    results.requests++;
    results.successes++;
    results.totalLatency += latency;
  }

  /**
   * Calculate A/B test results
   */
  private calculateABTestResults(test: ABTest): ABTestResults {
    const { modelA: resultA, modelB: resultB } = test.results;

    const avgLatencyA = resultA.requests > 0 ? resultA.totalLatency / resultA.requests : 0;
    const avgLatencyB = resultB.requests > 0 ? resultB.totalLatency / resultB.requests : 0;

    const successRateA = resultA.requests > 0 ? resultA.successes / resultA.requests : 0;
    const successRateB = resultB.requests > 0 ? resultB.successes / resultB.requests : 0;

    return {
      testId: test.id,
      duration: (test.endTime || Date.now()) - test.startTime,
      modelA: {
        modelId: test.modelA,
        requests: resultA.requests,
        successRate: successRateA,
        averageLatency: avgLatencyA,
        errors: resultA.errors
      },
      modelB: {
        modelId: test.modelB,
        requests: resultB.requests,
        successRate: successRateB,
        averageLatency: avgLatencyB,
        errors: resultB.errors
      },
      winner: this.determineWinner(resultA, resultB, avgLatencyA, avgLatencyB, successRateA, successRateB),
      significance: this.calculateSignificance(resultA, resultB)
    };
  }

  /**
   * Determine A/B test winner
   */
  private determineWinner(
    resultA: any, resultB: any,
    latencyA: number, latencyB: number,
    successA: number, successB: number
  ): 'modelA' | 'modelB' | 'inconclusive' {
    // Simple heuristic: better success rate wins, tie-break with latency
    if (Math.abs(successA - successB) > 0.01) {
      return successA > successB ? 'modelA' : 'modelB';
    }
    
    if (Math.abs(latencyA - latencyB) > 10) {
      return latencyA < latencyB ? 'modelA' : 'modelB';
    }

    return 'inconclusive';
  }

  /**
   * Calculate statistical significance
   */
  private calculateSignificance(resultA: any, resultB: any): number {
    // Simplified significance calculation
    const totalA = resultA.requests;
    const totalB = resultB.requests;
    
    if (totalA < 30 || totalB < 30) return 0; // Not enough data

    const succA = resultA.successes;
    const succB = resultB.successes;

    const pA = succA / totalA;
    const pB = succB / totalB;

    const pooled = (succA + succB) / (totalA + totalB);
    const se = Math.sqrt(pooled * (1 - pooled) * (1/totalA + 1/totalB));

    if (se === 0) return 0;

    const z = Math.abs(pA - pB) / se;
    
    // Convert z-score to confidence level (simplified)
    return Math.min(0.99, Math.max(0, (z - 1.96) / 2.58));
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    setInterval(() => {
      this.collectMetrics();
    }, 60000); // Collect every minute
  }

  /**
   * Collect performance metrics
   */
  private collectMetrics(): void {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    this.performanceMetrics.forEach((metrics, modelId) => {
      // Calculate requests per minute
      const recentRequests = metrics.latencyHistory.filter(
        h => h.timestamp > oneMinuteAgo
      ).length;
      metrics.requestsPerMinute = recentRequests;

      // Calculate errors per minute
      const recentErrors = metrics.errorHistory.filter(
        h => h.timestamp > oneMinuteAgo
      ).length;
      metrics.errorsPerMinute = recentErrors;
    });
  }

  /**
   * Start health checks
   */
  private startHealthChecks(): void {
    setInterval(() => {
      this.performHealthChecks();
    }, this.config.healthCheckInterval);
  }

  /**
   * Perform health checks on deployed models
   */
  private async performHealthChecks(): Promise<void> {
    for (const [modelId, deployment] of this.deployedModels) {
      try {
        if (deployment.status === 'active' && deployment.model) {
          // Quick health check with dummy input
          const inputShape = deployment.model.inputs[0].shape;
          const dummyInput = tf.zeros(inputShape.slice(1) as number[]);
          const prediction = deployment.model.predict(dummyInput) as tf.Tensor;
          
          dummyInput.dispose();
          prediction.dispose();
        }
      } catch (error) {
        logger.warn(`Health check failed for model ${modelId}:`, error);
        deployment.status = 'unhealthy';
      }
    }
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Dispose of all models and clean up
   */
  public dispose(): void {
    // Dispose all deployed models
    this.deployedModels.forEach(deployment => {
      if (deployment.model) {
        deployment.model.dispose();
      }
    });

    // Dispose all ensembles
    this.ensembles.forEach(ensemble => {
      ensemble.dispose();
    });

    // Clear all data structures
    this.deployedModels.clear();
    this.ensembles.clear();
    this.performanceMetrics.clear();
    this.abTests.clear();
  }
}

// Type definitions
export interface ModelServerConfig {
  maxConcurrentRequests: number;
  requestTimeout: number;
  enableMetrics: boolean;
  enableABTesting: boolean;
  metricsRetentionDays: number;
  warmupRequests: number;
  autoScaling: boolean;
  healthCheckInterval: number;
}

export interface DeploymentConfig {
  version?: string;
  metadata?: any;
  replicas?: number;
  resourceLimits?: {
    memory?: number;
    cpu?: number;
  };
  scaling?: {
    minReplicas?: number;
    maxReplicas?: number;
    targetCPU?: number;
  };
}

export interface DeployedModel {
  id: string;
  model: tf.LayersModel;
  config: DeploymentConfig;
  status: 'warming_up' | 'active' | 'inactive' | 'error' | 'unhealthy';
  deployedAt: number;
  version: string;
  requestCount: number;
  errorCount: number;
  lastRequestTime: number;
  averageLatency: number;
  metadata: any;
}

export interface PredictionOptions {
  requestId?: string;
  abTestId?: string;
  timeout?: number;
  metadata?: any;
}

export interface PredictionResponse {
  modelId: string;
  prediction: tf.Tensor;
  latency: number;
  timestamp: number;
  requestId: string;
  metadata: any;
}

export interface BatchPredictionResponse {
  modelId: string;
  totalRequests: number;
  successfulPredictions: number;
  failedPredictions: number;
  predictions: PredictionResponse[];
  errors: Array<{ index: number; error: string }>;
  totalLatency: number;
  timestamp: number;
}

export interface ModelMetrics {
  modelId: string;
  requestCount: number;
  errorCount: number;
  totalLatency: number;
  averageLatency: number;
  requestsPerMinute: number;
  errorsPerMinute: number;
  lastUpdated: number;
  latencyHistory: Array<{ timestamp: number; latency: number }>;
  errorHistory: Array<{ timestamp: number; error: string }>;
}

export interface ABTestConfig {
  duration?: number;
  successMetric?: 'accuracy' | 'latency' | 'combined';
  minSampleSize?: number;
}

export interface ABTest {
  id: string;
  modelA: string;
  modelB: string;
  trafficSplit: number;
  startTime: number;
  endTime?: number;
  results: {
    modelA: { requests: number; successes: number; totalLatency: number; errors: number };
    modelB: { requests: number; successes: number; totalLatency: number; errors: number };
  };
  config: ABTestConfig;
  status: 'active' | 'completed' | 'stopped';
}

export interface ABTestResults {
  testId: string;
  duration: number;
  modelA: {
    modelId: string;
    requests: number;
    successRate: number;
    averageLatency: number;
    errors: number;
  };
  modelB: {
    modelId: string;
    requests: number;
    successRate: number;
    averageLatency: number;
    errors: number;
  };
  winner: 'modelA' | 'modelB' | 'inconclusive';
  significance: number;
}

export interface DeployedModelInfo {
  id: string;
  status: string;
  version: string;
  deployedAt: number;
  requestCount: number;
  errorCount: number;
  averageLatency: number;
  lastRequestTime: number;
  metadata: any;
}

export interface ServerHealth {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: number;
  models: {
    total: number;
    active: number;
    inactive: number;
  };
  requests: {
    total: number;
    current: number;
    errors: number;
    errorRate: number;
  };
  performance: {
    averageLatency: number;
    memoryUsage: number;
  };
}

/**
 * Factory function to create model server
 */
export function createModelServer(
  config?: Partial<ModelServerConfig>
): ModelServer {
  return new ModelServer(config);
}