/**
 * Early Stopping Optimizer for Neural Network Training
 * 
 * Advanced early stopping implementation with:
 * - Multi-metric monitoring
 * - Convergence detection algorithms
 * - Model checkpoint management
 * - Training continuation strategies
 * - Performance analytics and benchmarking
 */

import * as tf from '@tensorflow/tfjs';
import { EventEmitter } from 'events';

export interface EarlyStoppingConfig {
  monitor: string; // 'loss', 'val_loss', 'accuracy', 'val_accuracy'
  minDelta: number; // Minimum change to qualify as improvement
  patience: number; // Number of epochs with no improvement to wait
  verbose: boolean;
  mode: 'min' | 'max'; // 'min' for loss, 'max' for accuracy
  restoreBestWeights: boolean;
  baselineValue?: number; // Stop if metric reaches this value
  startFromEpoch?: number; // Start monitoring after this epoch
  adaptivePatience?: boolean; // Dynamically adjust patience
  convergenceThreshold?: number; // Threshold for convergence detection
}

export interface TrainingMetrics {
  epoch: number;
  loss: number;
  accuracy?: number;
  valLoss?: number;
  valAccuracy?: number;
  learningRate?: number;
  batchTime?: number;
  [key: string]: any;
}

export interface EarlyStoppingState {
  bestMetric: number;
  bestEpoch: number;
  waitCount: number;
  stopped: boolean;
  restoredWeights: boolean;
  convergenceDetected: boolean;
  totalEpochs: number;
  improvements: number;
  stagnationPeriods: number;
}

export interface ConvergenceAnalysis {
  trend: 'improving' | 'stagnating' | 'degrading';
  volatility: number;
  convergenceScore: number;
  stabilityIndex: number;
  predictedConvergence: number;
}

export class EarlyStoppingOptimizer extends EventEmitter {
  private config: EarlyStoppingConfig;
  private state: EarlyStoppingState;
  private metricHistory: TrainingMetrics[] = [];
  private bestWeights: tf.NamedTensorMap | null = null;
  private model: tf.LayersModel | null = null;
  private performanceMetrics: Map<string, number[]> = new Map();
  private convergenceAnalyzer: ConvergenceAnalyzer;

  constructor(config: Partial<EarlyStoppingConfig> = {}) {
    super();
    
    this.config = {
      monitor: 'val_loss',
      minDelta: 0.0001,
      patience: 10,
      verbose: false,
      mode: 'min',
      restoreBestWeights: true,
      startFromEpoch: 0,
      adaptivePatience: false,
      convergenceThreshold: 1e-6,
      ...config
    };

    this.state = {
      bestMetric: this.config.mode === 'min' ? Infinity : -Infinity,
      bestEpoch: 0,
      waitCount: 0,
      stopped: false,
      restoredWeights: false,
      convergenceDetected: false,
      totalEpochs: 0,
      improvements: 0,
      stagnationPeriods: 0
    };

    this.convergenceAnalyzer = new ConvergenceAnalyzer(this.config.convergenceThreshold!);
    this.initializePerformanceTracking();
  }

  private initializePerformanceTracking(): void {
    this.performanceMetrics.set('metric_values', []);
    this.performanceMetrics.set('improvement_rates', []);
    this.performanceMetrics.set('volatility_scores', []);
    this.performanceMetrics.set('convergence_scores', []);
  }

  /**
   * Set the model for weight restoration
   */
  public setModel(model: tf.LayersModel): void {
    this.model = model;
  }

  /**
   * Update early stopping based on current training metrics
   */
  public updateMetrics(metrics: TrainingMetrics): boolean {
    this.metricHistory.push(metrics);
    this.state.totalEpochs = metrics.epoch;

    // Skip monitoring if before start epoch
    if (metrics.epoch < this.config.startFromEpoch!) {
      return false;
    }

    const currentMetric = this.extractMonitoredMetric(metrics);
    if (currentMetric === null) {
      if (this.config.verbose) {
        console.warn(`Early stopping metric '${this.config.monitor}' not found in metrics`);
      }
      return false;
    }

    // Update performance tracking
    this.trackPerformanceMetrics(currentMetric, metrics);

    // Check for improvement
    const hasImproved = this.checkImprovement(currentMetric);
    
    if (hasImproved) {
      this.handleImprovement(currentMetric, metrics.epoch);
    } else {
      this.handleNoImprovement();
    }

    // Check convergence
    this.checkConvergence();

    // Check baseline stopping condition
    if (this.config.baselineValue !== undefined) {
      if (this.checkBaselineReached(currentMetric)) {
        this.stopTraining('baseline_reached');
        return true;
      }
    }

    // Adaptive patience adjustment
    if (this.config.adaptivePatience) {
      this.adjustPatience();
    }

    // Emit monitoring event
    this.emit('metricsUpdated', {
      currentMetric,
      bestMetric: this.state.bestMetric,
      waitCount: this.state.waitCount,
      patience: this.config.patience,
      convergenceAnalysis: this.convergenceAnalyzer.analyze(this.metricHistory)
    });

    return this.state.stopped;
  }

  private extractMonitoredMetric(metrics: TrainingMetrics): number | null {
    const metricMap: { [key: string]: string } = {
      'loss': 'loss',
      'val_loss': 'valLoss',
      'accuracy': 'accuracy',
      'val_accuracy': 'valAccuracy'
    };

    const metricKey = metricMap[this.config.monitor];
    return metricKey && metricKey in metrics ? metrics[metricKey as keyof TrainingMetrics] as number : null;
  }

  private checkImprovement(currentMetric: number): boolean {
    if (this.config.mode === 'min') {
      return currentMetric < (this.state.bestMetric - this.config.minDelta);
    } else {
      return currentMetric > (this.state.bestMetric + this.config.minDelta);
    }
  }

  private handleImprovement(currentMetric: number, epoch: number): void {
    this.state.bestMetric = currentMetric;
    this.state.bestEpoch = epoch;
    this.state.waitCount = 0;
    this.state.improvements++;

    // Save best weights if model is available
    if (this.model && this.config.restoreBestWeights) {
      this.saveCurrentWeights();
    }

    if (this.config.verbose) {
      console.log(`Early stopping: improvement detected at epoch ${epoch}, metric: ${currentMetric}`);
    }

    this.emit('improvement', {
      epoch,
      metric: currentMetric,
      improvement: Math.abs(currentMetric - this.state.bestMetric)
    });
  }

  private handleNoImprovement(): void {
    this.state.waitCount++;

    if (this.state.waitCount >= this.config.patience) {
      this.stopTraining('patience_exceeded');
    } else if (this.state.waitCount % 5 === 0) {
      this.state.stagnationPeriods++;
    }
  }

  private checkConvergence(): void {
    const analysis = this.convergenceAnalyzer.analyze(this.metricHistory);
    
    if (analysis.convergenceScore > 0.9 && analysis.volatility < 0.01) {
      this.state.convergenceDetected = true;
      this.stopTraining('convergence_detected');
    }
  }

  private checkBaselineReached(currentMetric: number): boolean {
    if (this.config.mode === 'min') {
      return currentMetric <= this.config.baselineValue!;
    } else {
      return currentMetric >= this.config.baselineValue!;
    }
  }

  private adjustPatience(): void {
    const analysis = this.convergenceAnalyzer.analyze(this.metricHistory);
    
    // Increase patience if learning is still progressing
    if (analysis.trend === 'improving' && analysis.volatility > 0.05) {
      this.config.patience = Math.min(this.config.patience + 2, 50);
    }
    // Decrease patience if stagnating
    else if (analysis.trend === 'stagnating' && analysis.volatility < 0.01) {
      this.config.patience = Math.max(this.config.patience - 1, 5);
    }
  }

  private stopTraining(reason: string): void {
    this.state.stopped = true;

    if (this.config.restoreBestWeights && this.bestWeights && this.model) {
      this.restoreBestWeights();
    }

    if (this.config.verbose) {
      console.log(`Early stopping triggered: ${reason} at epoch ${this.state.totalEpochs}`);
      console.log(`Best metric: ${this.state.bestMetric} at epoch ${this.state.bestEpoch}`);
    }

    this.emit('earlyStopping', {
      reason,
      epoch: this.state.totalEpochs,
      bestMetric: this.state.bestMetric,
      bestEpoch: this.state.bestEpoch,
      state: { ...this.state }
    });
  }

  private saveCurrentWeights(): void {
    if (this.model) {
      // Dispose previous weights to prevent memory leak
      if (this.bestWeights) {
        Object.values(this.bestWeights).forEach(tensor => tensor.dispose());
      }
      
      this.bestWeights = {};
      this.model.getWeights().forEach((weight, index) => {
        this.bestWeights![`weight_${index}`] = weight.clone();
      });
    }
  }

  private restoreBestWeights(): void {
    if (this.model && this.bestWeights) {
      const weights = Object.values(this.bestWeights);
      this.model.setWeights(weights);
      this.state.restoredWeights = true;
      
      if (this.config.verbose) {
        console.log(`Restored weights from epoch ${this.state.bestEpoch}`);
      }
    }
  }

  private trackPerformanceMetrics(currentMetric: number, metrics: TrainingMetrics): void {
    this.performanceMetrics.get('metric_values')!.push(currentMetric);
    
    // Calculate improvement rate
    if (this.metricHistory.length > 1) {
      const previousMetric = this.extractMonitoredMetric(this.metricHistory[this.metricHistory.length - 2]);
      if (previousMetric !== null) {
        const improvementRate = Math.abs(currentMetric - previousMetric) / Math.abs(previousMetric);
        this.performanceMetrics.get('improvement_rates')!.push(improvementRate);
      }
    }

    // Calculate volatility
    const recentMetrics = this.metricHistory.slice(-10).map(m => this.extractMonitoredMetric(m)).filter(m => m !== null) as number[];
    if (recentMetrics.length >= 3) {
      const volatility = this.calculateVolatility(recentMetrics);
      this.performanceMetrics.get('volatility_scores')!.push(volatility);
    }

    // Calculate convergence score
    const convergenceScore = this.convergenceAnalyzer.calculateConvergenceScore(this.metricHistory);
    this.performanceMetrics.get('convergence_scores')!.push(convergenceScore);
  }

  private calculateVolatility(values: number[]): number {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance) / Math.abs(mean);
  }

  /**
   * Get comprehensive performance analytics
   */
  public getPerformanceAnalytics(): any {
    const convergenceAnalysis = this.convergenceAnalyzer.analyze(this.metricHistory);
    
    return {
      state: { ...this.state },
      configuration: { ...this.config },
      performance: {
        totalEpochs: this.state.totalEpochs,
        improvements: this.state.improvements,
        stagnationPeriods: this.state.stagnationPeriods,
        improvementRate: this.calculateAverageImprovementRate(),
        trainingEfficiency: this.calculateTrainingEfficiency(),
        convergenceAnalysis
      },
      benchmarks: this.generateBenchmarkData(),
      recommendations: this.generateRecommendations(convergenceAnalysis)
    };
  }

  private calculateAverageImprovementRate(): number {
    const rates = this.performanceMetrics.get('improvement_rates') || [];
    return rates.length > 0 ? rates.reduce((a, b) => a + b, 0) / rates.length : 0;
  }

  private calculateTrainingEfficiency(): number {
    if (this.state.totalEpochs === 0) return 0;
    
    // Efficiency = improvements per epoch
    return this.state.improvements / this.state.totalEpochs;
  }

  private generateBenchmarkData(): any {
    const metricValues = this.performanceMetrics.get('metric_values') || [];
    const convergenceScores = this.performanceMetrics.get('convergence_scores') || [];
    
    return {
      memoryUsage: tf.memory(),
      performanceMetrics: {
        epochsToConvergence: this.estimateEpochsToConvergence(),
        trainingTimeOptimization: this.calculateTimeOptimization(),
        resourceEfficiency: this.calculateResourceEfficiency()
      },
      comparison: {
        baselineImprovement: this.calculateBaselineImprovement(),
        optimalStoppingPoint: this.findOptimalStoppingPoint(),
        efficiencyGain: this.calculateEfficiencyGain()
      }
    };
  }

  private estimateEpochsToConvergence(): number {
    const convergenceScores = this.performanceMetrics.get('convergence_scores') || [];
    const convergenceThreshold = 0.95;
    
    for (let i = 0; i < convergenceScores.length; i++) {
      if (convergenceScores[i] >= convergenceThreshold) {
        return i + 1;
      }
    }
    
    return this.state.totalEpochs;
  }

  private calculateTimeOptimization(): number {
    // Estimated time saved by early stopping
    const maxEpochs = 1000; // Assumed maximum without early stopping
    const actualEpochs = this.state.totalEpochs;
    return ((maxEpochs - actualEpochs) / maxEpochs) * 100;
  }

  private calculateResourceEfficiency(): number {
    // Based on improvements per epoch
    const efficiency = this.calculateTrainingEfficiency();
    return Math.min(efficiency * 100, 100);
  }

  private calculateBaselineImprovement(): number {
    const metricValues = this.performanceMetrics.get('metric_values') || [];
    if (metricValues.length < 2) return 0;
    
    const initial = metricValues[0];
    const final = this.state.bestMetric;
    return ((Math.abs(initial - final)) / Math.abs(initial)) * 100;
  }

  private findOptimalStoppingPoint(): number {
    // Find epoch with best efficiency/improvement ratio
    let bestRatio = 0;
    let optimalEpoch = this.state.bestEpoch;
    
    for (let i = 0; i < this.metricHistory.length; i++) {
      const improvements = this.metricHistory.slice(0, i + 1)
        .filter((_, idx) => idx === 0 || this.checkImprovement(this.extractMonitoredMetric(this.metricHistory[idx])!))
        .length;
      
      const ratio = improvements / (i + 1);
      if (ratio > bestRatio) {
        bestRatio = ratio;
        optimalEpoch = i + 1;
      }
    }
    
    return optimalEpoch;
  }

  private calculateEfficiencyGain(): number {
    // Compare efficiency with vs without early stopping
    const withEarlyStopping = this.calculateTrainingEfficiency();
    const withoutEarlyStopping = 0.1; // Assumed baseline efficiency
    return ((withEarlyStopping - withoutEarlyStopping) / withoutEarlyStopping) * 100;
  }

  private generateRecommendations(analysis: ConvergenceAnalysis): string[] {
    const recommendations: string[] = [];
    
    if (analysis.volatility > 0.1) {
      recommendations.push('High volatility detected - consider reducing learning rate');
    }
    
    if (this.state.improvements < 3 && this.state.totalEpochs > 20) {
      recommendations.push('Few improvements detected - check model architecture or data quality');
    }
    
    if (analysis.trend === 'stagnating' && this.state.waitCount > this.config.patience / 2) {
      recommendations.push('Consider adjusting hyperparameters or using learning rate scheduling');
    }
    
    if (this.state.stagnationPeriods > 3) {
      recommendations.push('Multiple stagnation periods - model may need regularization');
    }
    
    return recommendations;
  }

  /**
   * Reset early stopping state for new training session
   */
  public reset(): void {
    this.state = {
      bestMetric: this.config.mode === 'min' ? Infinity : -Infinity,
      bestEpoch: 0,
      waitCount: 0,
      stopped: false,
      restoredWeights: false,
      convergenceDetected: false,
      totalEpochs: 0,
      improvements: 0,
      stagnationPeriods: 0
    };
    
    this.metricHistory = [];
    this.performanceMetrics.clear();
    this.initializePerformanceTracking();
    
    if (this.bestWeights) {
      Object.values(this.bestWeights).forEach(tensor => tensor.dispose());
      this.bestWeights = null;
    }
  }

  /**
   * Dispose of resources
   */
  public dispose(): void {
    if (this.bestWeights) {
      Object.values(this.bestWeights).forEach(tensor => tensor.dispose());
    }
    
    this.removeAllListeners();
    this.metricHistory = [];
    this.performanceMetrics.clear();
  }

  // Getters
  public get currentState(): EarlyStoppingState {
    return { ...this.state };
  }

  public get shouldStop(): boolean {
    return this.state.stopped;
  }

  public get bestScore(): number {
    return this.state.bestMetric;
  }
}

/**
 * Convergence Analysis Helper Class
 */
class ConvergenceAnalyzer {
  private threshold: number;

  constructor(threshold: number = 1e-6) {
    this.threshold = threshold;
  }

  public analyze(metricHistory: TrainingMetrics[]): ConvergenceAnalysis {
    if (metricHistory.length < 5) {
      return {
        trend: 'improving',
        volatility: 1.0,
        convergenceScore: 0.0,
        stabilityIndex: 0.0,
        predictedConvergence: Infinity
      };
    }

    const recentMetrics = metricHistory.slice(-20);
    const trend = this.calculateTrend(recentMetrics);
    const volatility = this.calculateVolatility(recentMetrics);
    const convergenceScore = this.calculateConvergenceScore(metricHistory);
    const stabilityIndex = this.calculateStabilityIndex(recentMetrics);
    const predictedConvergence = this.predictConvergenceEpoch(metricHistory);

    return {
      trend,
      volatility,
      convergenceScore,
      stabilityIndex,
      predictedConvergence
    };
  }

  private calculateTrend(metrics: TrainingMetrics[]): 'improving' | 'stagnating' | 'degrading' {
    if (metrics.length < 3) return 'improving';
    
    const values = metrics.map(m => m.loss);
    const recent = values.slice(-5);
    const earlier = values.slice(-10, -5);
    
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const earlierAvg = earlier.reduce((a, b) => a + b, 0) / earlier.length;
    
    const improvement = (earlierAvg - recentAvg) / earlierAvg;
    
    if (improvement > 0.01) return 'improving';
    if (improvement < -0.01) return 'degrading';
    return 'stagnating';
  }

  private calculateVolatility(metrics: TrainingMetrics[]): number {
    const values = metrics.map(m => m.loss);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance) / Math.abs(mean);
  }

  public calculateConvergenceScore(metricHistory: TrainingMetrics[]): number {
    if (metricHistory.length < 10) return 0;
    
    const recent = metricHistory.slice(-10);
    const improvements = recent.filter((metric, idx) => {
      if (idx === 0) return false;
      return metric.loss < recent[idx - 1].loss;
    }).length;
    
    const stabilityScore = 1 - this.calculateVolatility(recent);
    const improvementScore = improvements / (recent.length - 1);
    
    return (stabilityScore + improvementScore) / 2;
  }

  private calculateStabilityIndex(metrics: TrainingMetrics[]): number {
    if (metrics.length < 5) return 0;
    
    const values = metrics.map(m => m.loss);
    const differences = values.slice(1).map((val, idx) => Math.abs(val - values[idx]));
    const avgDifference = differences.reduce((a, b) => a + b, 0) / differences.length;
    
    // Stability increases as differences decrease
    return Math.max(0, 1 - (avgDifference / values[0]));
  }

  private predictConvergenceEpoch(metricHistory: TrainingMetrics[]): number {
    if (metricHistory.length < 10) return Infinity;
    
    const recentTrend = this.calculateTrend(metricHistory.slice(-10));
    const convergenceScore = this.calculateConvergenceScore(metricHistory);
    
    if (recentTrend === 'stagnating' && convergenceScore > 0.8) {
      return metricHistory.length + 5; // Predict convergence soon
    }
    
    if (recentTrend === 'improving') {
      // Estimate based on current improvement rate
      const improvementRate = this.calculateImprovementRate(metricHistory);
      return metricHistory.length + Math.ceil(1 / Math.max(improvementRate, 0.001));
    }
    
    return Infinity;
  }

  private calculateImprovementRate(metricHistory: TrainingMetrics[]): number {
    if (metricHistory.length < 5) return 0;
    
    const recent = metricHistory.slice(-5);
    const losses = recent.map(m => m.loss);
    const improvements = losses.slice(1).map((loss, idx) => 
      Math.max(0, losses[idx] - loss) / losses[idx]
    );
    
    return improvements.reduce((a, b) => a + b, 0) / improvements.length;
  }
}

/**
 * Factory function for creating optimized early stopping configurations
 */
export function createOptimalEarlyStopping(
  modelComplexity: 'simple' | 'moderate' | 'complex',
  datasetSize: number
): EarlyStoppingOptimizer {
  let config: Partial<EarlyStoppingConfig>;
  
  switch (modelComplexity) {
    case 'simple':
      config = {
        patience: 5,
        minDelta: 0.001,
        monitor: 'val_loss',
        adaptivePatience: false
      };
      break;
      
    case 'moderate':
      config = {
        patience: 15,
        minDelta: 0.0001,
        monitor: 'val_loss',
        adaptivePatience: true,
        convergenceThreshold: 1e-5
      };
      break;
      
    case 'complex':
      config = {
        patience: 25,
        minDelta: 0.00001,
        monitor: 'val_loss',
        adaptivePatience: true,
        convergenceThreshold: 1e-6,
        startFromEpoch: 10
      };
      break;
  }
  
  // Adjust patience based on dataset size
  if (datasetSize < 1000) {
    config.patience = Math.max(config.patience! * 0.5, 3);
  } else if (datasetSize > 100000) {
    config.patience = config.patience! * 1.5;
  }
  
  return new EarlyStoppingOptimizer(config);
}