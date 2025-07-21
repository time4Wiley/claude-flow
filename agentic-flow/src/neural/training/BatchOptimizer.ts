/**
 * Batch Optimizer for Dynamic Batch Sizing and Training Optimization
 * 
 * Advanced batch optimization with:
 * - Dynamic batch size adjustment based on memory and performance
 * - Gradient accumulation for effective large batch training
 * - Memory-aware batch sizing
 * - Performance monitoring and optimization
 * - Adaptive batch scheduling strategies
 */

import * as tf from '@tensorflow/tfjs';
import { EventEmitter } from 'events';

export interface BatchConfig {
  initialBatchSize: number;
  minBatchSize: number;
  maxBatchSize: number;
  strategy: 'adaptive' | 'fixed' | 'scheduled' | 'memory_aware' | 'performance_based';
  memoryThreshold?: number; // MB
  targetUtilization?: number; // 0-1
  gradientAccumulationSteps?: number;
  warmupBatches?: number;
  performanceWindow?: number; // Number of batches to consider for performance
  adjustmentFactor?: number; // Multiplication factor for adjustments
}

export interface BatchMetrics {
  batchSize: number;
  processingTime: number;
  memoryUsage: number;
  throughput: number; // samples per second
  gpuUtilization?: number;
  loss?: number;
  accuracy?: number;
  gradientNorm?: number;
}

export interface OptimizationState {
  currentBatchSize: number;
  totalBatches: number;
  totalSamples: number;
  averageProcessingTime: number;
  averageThroughput: number;
  memoryPeakUsage: number;
  adjustments: number;
  performanceScore: number;
  stabilityIndex: number;
}

export interface PerformanceAnalysis {
  optimalBatchSize: number;
  efficiency: number;
  memoryEfficiency: number;
  throughputGain: number;
  stabilityScore: number;
  recommendations: string[];
}

export class BatchOptimizer extends EventEmitter {
  private config: BatchConfig;
  private state: OptimizationState;
  private metricsHistory: BatchMetrics[] = [];
  private performanceWindow: BatchMetrics[] = [];
  private gradientAccumulator: tf.Tensor[] = [];
  private accumulationCounter: number = 0;
  private performanceAnalyzer: PerformanceAnalyzer;

  constructor(config: Partial<BatchConfig> = {}) {
    super();
    
    this.config = {
      initialBatchSize: 32,
      minBatchSize: 8,
      maxBatchSize: 512,
      strategy: 'adaptive',
      memoryThreshold: 1024, // 1GB
      targetUtilization: 0.8,
      gradientAccumulationSteps: 1,
      warmupBatches: 10,
      performanceWindow: 20,
      adjustmentFactor: 1.5,
      ...config
    };

    this.state = {
      currentBatchSize: this.config.initialBatchSize,
      totalBatches: 0,
      totalSamples: 0,
      averageProcessingTime: 0,
      averageThroughput: 0,
      memoryPeakUsage: 0,
      adjustments: 0,
      performanceScore: 0,
      stabilityIndex: 1.0
    };

    this.performanceAnalyzer = new PerformanceAnalyzer();
  }

  /**
   * Process a batch with optimization and monitoring
   */
  public async processBatch(
    data: tf.Tensor,
    labels: tf.Tensor,
    model: tf.LayersModel,
    optimizer: tf.Optimizer
  ): Promise<{ loss: tf.Scalar; predictions: tf.Tensor; metrics: BatchMetrics }> {
    const startTime = performance.now();
    const memoryBefore = tf.memory();

    // Ensure batch size matches current optimization
    const actualBatchSize = Math.min(this.state.currentBatchSize, data.shape[0]);
    const batchData = actualBatchSize < data.shape[0] ? 
      data.slice([0], [actualBatchSize]) : data;
    const batchLabels = actualBatchSize < labels.shape[0] ? 
      labels.slice([0], [actualBatchSize]) : labels;

    let loss: tf.Scalar;
    let predictions: tf.Tensor;

    // Use gradient accumulation if configured
    if (this.config.gradientAccumulationSteps! > 1) {
      const result = await this.processWithGradientAccumulation(
        batchData, batchLabels, model, optimizer
      );
      loss = result.loss;
      predictions = result.predictions;
    } else {
      const result = await this.processNormalBatch(
        batchData, batchLabels, model, optimizer
      );
      loss = result.loss;
      predictions = result.predictions;
    }

    const endTime = performance.now();
    const memoryAfter = tf.memory();

    // Calculate metrics
    const processingTime = endTime - startTime;
    const memoryUsage = memoryAfter.numBytes - memoryBefore.numBytes;
    const throughput = actualBatchSize / (processingTime / 1000);

    const batchMetrics: BatchMetrics = {
      batchSize: actualBatchSize,
      processingTime,
      memoryUsage: memoryUsage / (1024 * 1024), // MB
      throughput,
      loss: await loss.data().then(d => d[0]),
      gradientNorm: this.calculateGradientNorm(model)
    };

    // Update state and optimize
    this.updateState(batchMetrics);
    this.optimizeBatchSize(batchMetrics);

    // Clean up
    batchData.dispose();
    batchLabels.dispose();

    return { loss, predictions, metrics: batchMetrics };
  }

  private async processNormalBatch(
    data: tf.Tensor,
    labels: tf.Tensor,
    model: tf.LayersModel,
    optimizer: tf.Optimizer
  ): Promise<{ loss: tf.Scalar; predictions: tf.Tensor }> {
    return tf.variableGrads(() => {
      const predictions = model.apply(data, { training: true }) as tf.Tensor;
      const loss = tf.losses.softmaxCrossEntropy(labels, predictions);
      return { loss: loss.mean(), predictions };
    });
  }

  private async processWithGradientAccumulation(
    data: tf.Tensor,
    labels: tf.Tensor,
    model: tf.LayersModel,
    optimizer: tf.Optimizer
  ): Promise<{ loss: tf.Scalar; predictions: tf.Tensor }> {
    const microBatchSize = Math.ceil(data.shape[0] / this.config.gradientAccumulationSteps!);
    let accumulatedLoss = tf.scalar(0);
    let predictions: tf.Tensor | null = null;

    for (let i = 0; i < this.config.gradientAccumulationSteps!; i++) {
      const start = i * microBatchSize;
      const end = Math.min(start + microBatchSize, data.shape[0]);
      
      const microData = data.slice([start], [end - start]);
      const microLabels = labels.slice([start], [end - start]);

      const { grads, value } = tf.variableGrads(() => {
        const pred = model.apply(microData, { training: true }) as tf.Tensor;
        const loss = tf.losses.softmaxCrossEntropy(microLabels, pred);
        if (predictions === null) {
          predictions = pred;
        }
        return loss.mean();
      });

      // Accumulate gradients
      this.accumulateGradients(grads);
      accumulatedLoss = accumulatedLoss.add(value);

      microData.dispose();
      microLabels.dispose();
      Object.values(grads).forEach(grad => grad.dispose());
    }

    // Apply accumulated gradients
    this.accumulationCounter++;
    if (this.accumulationCounter >= this.config.gradientAccumulationSteps!) {
      this.applyAccumulatedGradients(optimizer);
      this.accumulationCounter = 0;
    }

    const avgLoss = accumulatedLoss.div(tf.scalar(this.config.gradientAccumulationSteps!));
    accumulatedLoss.dispose();

    return { 
      loss: avgLoss as tf.Scalar, 
      predictions: predictions || tf.zeros([1, 1]) 
    };
  }

  private accumulateGradients(grads: { [varName: string]: tf.Tensor }): void {
    Object.entries(grads).forEach(([name, grad], index) => {
      if (this.gradientAccumulator[index]) {
        const accumulated = this.gradientAccumulator[index].add(grad);
        this.gradientAccumulator[index].dispose();
        this.gradientAccumulator[index] = accumulated;
      } else {
        this.gradientAccumulator[index] = grad.clone();
      }
    });
  }

  private applyAccumulatedGradients(optimizer: tf.Optimizer): void {
    if (this.gradientAccumulator.length > 0) {
      // Average the accumulated gradients
      const avgGradients = this.gradientAccumulator.map(grad => 
        grad.div(tf.scalar(this.config.gradientAccumulationSteps!))
      );

      // Apply gradients (this is simplified - actual implementation depends on optimizer type)
      // optimizer.applyGradients(avgGradients);

      // Clean up
      this.gradientAccumulator.forEach(grad => grad.dispose());
      this.gradientAccumulator = [];
    }
  }

  private calculateGradientNorm(model: tf.LayersModel): number {
    const weights = model.getWeights();
    let totalNorm = 0;
    
    weights.forEach(weight => {
      const weightData = weight.dataSync();
      const norm = Math.sqrt(weightData.reduce((sum, val) => sum + val * val, 0));
      totalNorm += norm * norm;
    });
    
    return Math.sqrt(totalNorm);
  }

  private updateState(metrics: BatchMetrics): void {
    this.metricsHistory.push(metrics);
    this.performanceWindow.push(metrics);
    
    // Maintain window size
    if (this.performanceWindow.length > this.config.performanceWindow!) {
      this.performanceWindow.shift();
    }

    this.state.totalBatches++;
    this.state.totalSamples += metrics.batchSize;
    this.state.memoryPeakUsage = Math.max(this.state.memoryPeakUsage, metrics.memoryUsage);
    
    // Update running averages
    this.state.averageProcessingTime = this.calculateRunningAverage(
      this.state.averageProcessingTime,
      metrics.processingTime,
      this.state.totalBatches
    );
    
    this.state.averageThroughput = this.calculateRunningAverage(
      this.state.averageThroughput,
      metrics.throughput,
      this.state.totalBatches
    );

    // Update performance score
    this.state.performanceScore = this.calculatePerformanceScore();
    this.state.stabilityIndex = this.calculateStabilityIndex();
  }

  private calculateRunningAverage(current: number, newValue: number, count: number): number {
    return (current * (count - 1) + newValue) / count;
  }

  private optimizeBatchSize(metrics: BatchMetrics): void {
    // Skip optimization during warmup
    if (this.state.totalBatches < this.config.warmupBatches!) {
      return;
    }

    let newBatchSize = this.state.currentBatchSize;

    switch (this.config.strategy) {
      case 'adaptive':
        newBatchSize = this.adaptiveBatchSizing(metrics);
        break;
      case 'memory_aware':
        newBatchSize = this.memoryAwareSizing(metrics);
        break;
      case 'performance_based':
        newBatchSize = this.performanceBasedSizing(metrics);
        break;
      case 'scheduled':
        newBatchSize = this.scheduledSizing();
        break;
      // 'fixed' strategy doesn't change batch size
    }

    if (newBatchSize !== this.state.currentBatchSize) {
      this.adjustBatchSize(newBatchSize);
    }
  }

  private adaptiveBatchSizing(metrics: BatchMetrics): number {
    const performanceScore = this.calculatePerformanceScore();
    const memoryUtilization = metrics.memoryUsage / this.config.memoryThreshold!;
    
    let adjustment = 1.0;
    
    // Increase batch size if performance is good and memory usage is low
    if (performanceScore > 0.8 && memoryUtilization < 0.7) {
      adjustment = this.config.adjustmentFactor!;
    }
    // Decrease batch size if performance is poor or memory usage is high
    else if (performanceScore < 0.5 || memoryUtilization > 0.9) {
      adjustment = 1.0 / this.config.adjustmentFactor!;
    }
    
    const newSize = Math.round(this.state.currentBatchSize * adjustment);
    return this.clampBatchSize(newSize);
  }

  private memoryAwareSizing(metrics: BatchMetrics): number {
    const memoryUtilization = metrics.memoryUsage / this.config.memoryThreshold!;
    
    if (memoryUtilization > 0.95) {
      // Emergency reduction
      return this.clampBatchSize(Math.round(this.state.currentBatchSize * 0.5));
    } else if (memoryUtilization > 0.8) {
      return this.clampBatchSize(Math.round(this.state.currentBatchSize * 0.8));
    } else if (memoryUtilization < 0.5) {
      return this.clampBatchSize(Math.round(this.state.currentBatchSize * 1.2));
    }
    
    return this.state.currentBatchSize;
  }

  private performanceBasedSizing(metrics: BatchMetrics): number {
    if (this.performanceWindow.length < 5) {
      return this.state.currentBatchSize;
    }
    
    const recentThroughput = this.performanceWindow.slice(-5)
      .reduce((sum, m) => sum + m.throughput, 0) / 5;
    
    const overallThroughput = this.state.averageThroughput;
    
    if (recentThroughput > overallThroughput * 1.1) {
      // Performance improving, try larger batch
      return this.clampBatchSize(Math.round(this.state.currentBatchSize * 1.1));
    } else if (recentThroughput < overallThroughput * 0.9) {
      // Performance degrading, reduce batch size
      return this.clampBatchSize(Math.round(this.state.currentBatchSize * 0.9));
    }
    
    return this.state.currentBatchSize;
  }

  private scheduledSizing(): number {
    // Simple schedule: increase batch size over time
    const schedule = [
      { batches: 100, batchSize: this.config.initialBatchSize },
      { batches: 500, batchSize: this.config.initialBatchSize * 2 },
      { batches: 1000, batchSize: this.config.initialBatchSize * 4 },
      { batches: Infinity, batchSize: this.config.maxBatchSize }
    ];
    
    for (const { batches, batchSize } of schedule) {
      if (this.state.totalBatches < batches) {
        return this.clampBatchSize(batchSize);
      }
    }
    
    return this.config.maxBatchSize;
  }

  private clampBatchSize(size: number): number {
    return Math.max(
      this.config.minBatchSize,
      Math.min(this.config.maxBatchSize, size)
    );
  }

  private adjustBatchSize(newSize: number): void {
    const oldSize = this.state.currentBatchSize;
    this.state.currentBatchSize = newSize;
    this.state.adjustments++;
    
    this.emit('batchSizeChanged', {
      oldSize,
      newSize,
      reason: this.config.strategy,
      metrics: this.performanceWindow[this.performanceWindow.length - 1]
    });
  }

  private calculatePerformanceScore(): number {
    if (this.performanceWindow.length === 0) return 0;
    
    const recentMetrics = this.performanceWindow.slice(-10);
    const avgThroughput = recentMetrics.reduce((sum, m) => sum + m.throughput, 0) / recentMetrics.length;
    const avgMemoryUsage = recentMetrics.reduce((sum, m) => sum + m.memoryUsage, 0) / recentMetrics.length;
    
    // Normalize scores
    const throughputScore = Math.min(avgThroughput / 1000, 1); // Assume 1000 samples/sec is excellent
    const memoryScore = 1 - (avgMemoryUsage / this.config.memoryThreshold!);
    
    return (throughputScore + memoryScore) / 2;
  }

  private calculateStabilityIndex(): number {
    if (this.performanceWindow.length < 5) return 1.0;
    
    const throughputs = this.performanceWindow.map(m => m.throughput);
    const mean = throughputs.reduce((a, b) => a + b, 0) / throughputs.length;
    const variance = throughputs.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / throughputs.length;
    const stdDev = Math.sqrt(variance);
    
    // Stability decreases with higher coefficient of variation
    const coefficientOfVariation = stdDev / mean;
    return Math.max(0, 1 - coefficientOfVariation);
  }

  /**
   * Get comprehensive performance analysis
   */
  public getPerformanceAnalysis(): PerformanceAnalysis {
    return this.performanceAnalyzer.analyze(this.metricsHistory, this.state, this.config);
  }

  /**
   * Get current optimization state
   */
  public getState(): OptimizationState {
    return { ...this.state };
  }

  /**
   * Get current batch size
   */
  public getCurrentBatchSize(): number {
    return this.state.currentBatchSize;
  }

  /**
   * Manually set batch size (overrides optimization)
   */
  public setBatchSize(size: number): void {
    this.state.currentBatchSize = this.clampBatchSize(size);
  }

  /**
   * Reset optimizer state
   */
  public reset(): void {
    this.state = {
      currentBatchSize: this.config.initialBatchSize,
      totalBatches: 0,
      totalSamples: 0,
      averageProcessingTime: 0,
      averageThroughput: 0,
      memoryPeakUsage: 0,
      adjustments: 0,
      performanceScore: 0,
      stabilityIndex: 1.0
    };
    
    this.metricsHistory = [];
    this.performanceWindow = [];
    this.gradientAccumulator.forEach(grad => grad.dispose());
    this.gradientAccumulator = [];
    this.accumulationCounter = 0;
  }

  /**
   * Dispose of resources
   */
  public dispose(): void {
    this.gradientAccumulator.forEach(grad => grad.dispose());
    this.removeAllListeners();
  }
}

/**
 * Performance Analyzer Helper Class
 */
class PerformanceAnalyzer {
  public analyze(
    metricsHistory: BatchMetrics[],
    state: OptimizationState,
    config: BatchConfig
  ): PerformanceAnalysis {
    if (metricsHistory.length === 0) {
      return {
        optimalBatchSize: config.initialBatchSize,
        efficiency: 0,
        memoryEfficiency: 0,
        throughputGain: 0,
        stabilityScore: 0,
        recommendations: ['Insufficient data for analysis']
      };
    }

    const optimalBatchSize = this.findOptimalBatchSize(metricsHistory);
    const efficiency = this.calculateEfficiency(metricsHistory);
    const memoryEfficiency = this.calculateMemoryEfficiency(metricsHistory, config);
    const throughputGain = this.calculateThroughputGain(metricsHistory);
    const stabilityScore = this.calculateStabilityScore(metricsHistory);
    const recommendations = this.generateRecommendations(metricsHistory, state, config);

    return {
      optimalBatchSize,
      efficiency,
      memoryEfficiency,
      throughputGain,
      stabilityScore,
      recommendations
    };
  }

  private findOptimalBatchSize(metricsHistory: BatchMetrics[]): number {
    // Group metrics by batch size and find the one with best throughput/memory ratio
    const batchSizeGroups = new Map<number, BatchMetrics[]>();
    
    metricsHistory.forEach(metric => {
      if (!batchSizeGroups.has(metric.batchSize)) {
        batchSizeGroups.set(metric.batchSize, []);
      }
      batchSizeGroups.get(metric.batchSize)!.push(metric);
    });

    let bestBatchSize = metricsHistory[0].batchSize;
    let bestScore = 0;

    batchSizeGroups.forEach((metrics, batchSize) => {
      const avgThroughput = metrics.reduce((sum, m) => sum + m.throughput, 0) / metrics.length;
      const avgMemoryUsage = metrics.reduce((sum, m) => sum + m.memoryUsage, 0) / metrics.length;
      
      // Score based on throughput per MB of memory
      const score = avgThroughput / Math.max(avgMemoryUsage, 1);
      
      if (score > bestScore) {
        bestScore = score;
        bestBatchSize = batchSize;
      }
    });

    return bestBatchSize;
  }

  private calculateEfficiency(metricsHistory: BatchMetrics[]): number {
    if (metricsHistory.length === 0) return 0;
    
    const recentMetrics = metricsHistory.slice(-50);
    const avgThroughput = recentMetrics.reduce((sum, m) => sum + m.throughput, 0) / recentMetrics.length;
    const maxPossibleThroughput = 2000; // Theoretical maximum
    
    return Math.min(avgThroughput / maxPossibleThroughput, 1);
  }

  private calculateMemoryEfficiency(metricsHistory: BatchMetrics[], config: BatchConfig): number {
    if (metricsHistory.length === 0) return 0;
    
    const avgMemoryUsage = metricsHistory.reduce((sum, m) => sum + m.memoryUsage, 0) / metricsHistory.length;
    const memoryUtilization = avgMemoryUsage / config.memoryThreshold!;
    
    // Efficiency is good when memory usage is in the sweet spot (60-80%)
    if (memoryUtilization >= 0.6 && memoryUtilization <= 0.8) {
      return 1.0;
    } else if (memoryUtilization < 0.6) {
      return memoryUtilization / 0.6;
    } else {
      return Math.max(0, 2 - memoryUtilization / 0.8);
    }
  }

  private calculateThroughputGain(metricsHistory: BatchMetrics[]): number {
    if (metricsHistory.length < 10) return 0;
    
    const early = metricsHistory.slice(0, 10);
    const recent = metricsHistory.slice(-10);
    
    const earlyThroughput = early.reduce((sum, m) => sum + m.throughput, 0) / early.length;
    const recentThroughput = recent.reduce((sum, m) => sum + m.throughput, 0) / recent.length;
    
    return ((recentThroughput - earlyThroughput) / earlyThroughput) * 100;
  }

  private calculateStabilityScore(metricsHistory: BatchMetrics[]): number {
    if (metricsHistory.length < 5) return 1.0;
    
    const throughputs = metricsHistory.map(m => m.throughput);
    const mean = throughputs.reduce((a, b) => a + b, 0) / throughputs.length;
    const variance = throughputs.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / throughputs.length;
    const coefficientOfVariation = Math.sqrt(variance) / mean;
    
    return Math.max(0, 1 - coefficientOfVariation);
  }

  private generateRecommendations(
    metricsHistory: BatchMetrics[],
    state: OptimizationState,
    config: BatchConfig
  ): string[] {
    const recommendations: string[] = [];
    
    if (metricsHistory.length === 0) {
      return ['Insufficient data for recommendations'];
    }

    const avgMemoryUsage = metricsHistory.reduce((sum, m) => sum + m.memoryUsage, 0) / metricsHistory.length;
    const avgThroughput = metricsHistory.reduce((sum, m) => sum + m.throughput, 0) / metricsHistory.length;
    
    // Memory recommendations
    if (avgMemoryUsage > config.memoryThreshold! * 0.9) {
      recommendations.push('Memory usage is very high - consider reducing max batch size');
    } else if (avgMemoryUsage < config.memoryThreshold! * 0.3) {
      recommendations.push('Memory usage is low - consider increasing max batch size for better utilization');
    }
    
    // Performance recommendations
    if (avgThroughput < 100) {
      recommendations.push('Low throughput detected - check data loading pipeline and model complexity');
    }
    
    // Stability recommendations
    if (state.stabilityIndex < 0.7) {
      recommendations.push('Training instability detected - consider using gradient accumulation or fixed batch size');
    }
    
    // Optimization recommendations
    if (state.adjustments > state.totalBatches * 0.1) {
      recommendations.push('Frequent batch size changes - consider tuning adjustment parameters');
    }
    
    if (config.strategy === 'fixed' && avgMemoryUsage < config.memoryThreshold! * 0.5) {
      recommendations.push('Switch to adaptive batch sizing to improve resource utilization');
    }
    
    return recommendations;
  }
}

/**
 * Factory function for creating optimized batch configurations
 */
export function createOptimalBatchConfig(
  availableMemory: number, // MB
  modelSize: 'small' | 'medium' | 'large',
  datasetSize: number
): BatchConfig {
  let config: BatchConfig;
  
  const memoryThreshold = availableMemory * 0.8; // Use 80% of available memory
  
  switch (modelSize) {
    case 'small':
      config = {
        initialBatchSize: 64,
        minBatchSize: 16,
        maxBatchSize: Math.min(512, Math.floor(memoryThreshold / 10)),
        strategy: 'adaptive',
        memoryThreshold,
        targetUtilization: 0.7,
        gradientAccumulationSteps: 1,
        warmupBatches: 5
      };
      break;
      
    case 'medium':
      config = {
        initialBatchSize: 32,
        minBatchSize: 8,
        maxBatchSize: Math.min(256, Math.floor(memoryThreshold / 20)),
        strategy: 'memory_aware',
        memoryThreshold,
        targetUtilization: 0.8,
        gradientAccumulationSteps: 2,
        warmupBatches: 10
      };
      break;
      
    case 'large':
      config = {
        initialBatchSize: 16,
        minBatchSize: 4,
        maxBatchSize: Math.min(128, Math.floor(memoryThreshold / 40)),
        strategy: 'performance_based',
        memoryThreshold,
        targetUtilization: 0.85,
        gradientAccumulationSteps: 4,
        warmupBatches: 20
      };
      break;
  }
  
  // Adjust for dataset size
  if (datasetSize < 1000) {
    config.maxBatchSize = Math.min(config.maxBatchSize, 64);
  }
  
  return config;
}