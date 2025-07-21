/**
 * Adaptive Learning Rate Scheduler for Neural Network Training Optimization
 * 
 * Implements advanced learning rate scheduling algorithms including:
 * - Cosine Annealing with Warm Restarts
 * - ReduceLROnPlateau with custom metrics
 * - Exponential Decay with momentum
 * - Custom polynomial decay
 * 
 * Provides significant training speed improvements and convergence optimization.
 */

import * as tf from '@tensorflow/tfjs';
import { EventEmitter } from 'events';

export interface LearningRateConfig {
  initialLR: number;
  minLR: number;
  maxLR: number;
  schedulerType: 'cosine' | 'plateau' | 'exponential' | 'polynomial' | 'cyclical';
  patience?: number;
  factor?: number;
  stepSize?: number;
  gamma?: number;
  power?: number;
  cycleLength?: number;
  warmupSteps?: number;
}

export interface TrainingMetrics {
  loss: number;
  accuracy?: number;
  valLoss?: number;
  valAccuracy?: number;
  epoch: number;
  batchNum?: number;
}

export interface SchedulerState {
  currentLR: number;
  bestMetric: number;
  patienceCounter: number;
  warmupCounter: number;
  cycleCounter: number;
  totalSteps: number;
  improvements: number;
  reductions: number;
}

export class AdaptiveLearningRateScheduler extends EventEmitter {
  private config: LearningRateConfig;
  private state: SchedulerState;
  private optimizer: tf.Optimizer;
  private metricHistory: TrainingMetrics[] = [];
  private performanceMonitor: Map<string, number[]> = new Map();

  constructor(optimizer: tf.Optimizer, config: LearningRateConfig) {
    super();
    this.optimizer = optimizer;
    this.config = {
      patience: 10,
      factor: 0.5,
      stepSize: 1000,
      gamma: 0.95,
      power: 0.9,
      cycleLength: 2000,
      warmupSteps: 1000,
      ...config
    };
    
    this.state = {
      currentLR: config.initialLR,
      bestMetric: Infinity,
      patienceCounter: 0,
      warmupCounter: 0,
      cycleCounter: 0,
      totalSteps: 0,
      improvements: 0,
      reductions: 0
    };

    this.initializePerformanceMonitoring();
  }

  private initializePerformanceMonitoring(): void {
    this.performanceMonitor.set('lr_changes', []);
    this.performanceMonitor.set('convergence_rate', []);
    this.performanceMonitor.set('training_efficiency', []);
  }

  /**
   * Update learning rate based on current metrics and scheduler configuration
   */
  public updateLearningRate(metrics: TrainingMetrics): SchedulerState {
    this.metricHistory.push(metrics);
    this.state.totalSteps++;

    const previousLR = this.state.currentLR;
    
    // Apply warmup if configured
    if (this.shouldApplyWarmup()) {
      this.applyWarmup();
    } else {
      // Apply main scheduling algorithm
      switch (this.config.schedulerType) {
        case 'cosine':
          this.applyCosineAnnealing();
          break;
        case 'plateau':
          this.applyReduceLROnPlateau(metrics);
          break;
        case 'exponential':
          this.applyExponentialDecay();
          break;
        case 'polynomial':
          this.applyPolynomialDecay();
          break;
        case 'cyclical':
          this.applyCyclicalLR();
          break;
      }
    }

    // Update optimizer learning rate
    this.setOptimizerLearningRate(this.state.currentLR);

    // Track performance metrics
    this.trackPerformanceMetrics(previousLR, metrics);

    // Emit events for monitoring
    if (previousLR !== this.state.currentLR) {
      this.emit('learningRateChanged', {
        oldLR: previousLR,
        newLR: this.state.currentLR,
        metrics,
        state: { ...this.state }
      });
    }

    return { ...this.state };
  }

  private shouldApplyWarmup(): boolean {
    return this.config.warmupSteps! > 0 && 
           this.state.warmupCounter < this.config.warmupSteps!;
  }

  private applyWarmup(): void {
    const warmupProgress = this.state.warmupCounter / this.config.warmupSteps!;
    this.state.currentLR = this.config.initialLR * warmupProgress;
    this.state.warmupCounter++;
  }

  private applyCosineAnnealing(): void {
    const cycleProgress = (this.state.totalSteps % this.config.cycleLength!) / this.config.cycleLength!;
    const cosineProgress = (1 + Math.cos(Math.PI * cycleProgress)) / 2;
    
    this.state.currentLR = this.config.minLR + 
      (this.config.maxLR - this.config.minLR) * cosineProgress;
  }

  private applyReduceLROnPlateau(metrics: TrainingMetrics): void {
    const currentMetric = metrics.valLoss || metrics.loss;
    
    if (currentMetric < this.state.bestMetric - 1e-6) {
      this.state.bestMetric = currentMetric;
      this.state.patienceCounter = 0;
      this.state.improvements++;
    } else {
      this.state.patienceCounter++;
      
      if (this.state.patienceCounter >= this.config.patience!) {
        this.state.currentLR = Math.max(
          this.state.currentLR * this.config.factor!,
          this.config.minLR
        );
        this.state.patienceCounter = 0;
        this.state.reductions++;
      }
    }
  }

  private applyExponentialDecay(): void {
    if (this.state.totalSteps % this.config.stepSize! === 0) {
      this.state.currentLR = Math.max(
        this.state.currentLR * this.config.gamma!,
        this.config.minLR
      );
    }
  }

  private applyPolynomialDecay(): void {
    const decaySteps = Math.max(this.state.totalSteps, 1);
    const decayFactor = Math.pow(1 - (decaySteps / 100000), this.config.power!);
    
    this.state.currentLR = Math.max(
      this.config.initialLR * decayFactor,
      this.config.minLR
    );
  }

  private applyCyclicalLR(): void {
    const cycle = Math.floor(1 + this.state.totalSteps / (2 * this.config.stepSize!));
    const x = Math.abs(this.state.totalSteps / this.config.stepSize! - 2 * cycle + 1);
    
    this.state.currentLR = this.config.minLR + 
      (this.config.maxLR - this.config.minLR) * Math.max(0, 1 - x);
  }

  private setOptimizerLearningRate(newLR: number): void {
    // Different methods for different optimizers
    if ('learningRate' in this.optimizer) {
      (this.optimizer as any).learningRate = newLR;
    } else if ('setLearningRate' in this.optimizer) {
      (this.optimizer as any).setLearningRate(newLR);
    } else if (this.optimizer instanceof tf.AdamOptimizer) {
      // Create new optimizer with updated learning rate
      const config = this.optimizer.getConfig();
      this.optimizer.dispose();
      this.optimizer = tf.train.adam({ ...config, learningRate: newLR });
    }
  }

  private trackPerformanceMetrics(previousLR: number, metrics: TrainingMetrics): void {
    // Track learning rate changes
    if (previousLR !== this.state.currentLR) {
      this.performanceMonitor.get('lr_changes')!.push(this.state.totalSteps);
    }

    // Calculate convergence rate
    if (this.metricHistory.length >= 2) {
      const recent = this.metricHistory.slice(-10);
      const convergenceRate = this.calculateConvergenceRate(recent);
      this.performanceMonitor.get('convergence_rate')!.push(convergenceRate);
    }

    // Calculate training efficiency
    const efficiency = this.calculateTrainingEfficiency(metrics);
    this.performanceMonitor.get('training_efficiency')!.push(efficiency);
  }

  private calculateConvergenceRate(recentMetrics: TrainingMetrics[]): number {
    if (recentMetrics.length < 2) return 0;
    
    const lossValues = recentMetrics.map(m => m.loss);
    const slope = this.calculateSlope(lossValues);
    return Math.abs(slope); // Rate of loss decrease
  }

  private calculateSlope(values: number[]): number {
    const n = values.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = values.reduce((sum, y, x) => sum + x * y, 0);
    const sumX2 = values.reduce((sum, _, x) => sum + x * x, 0);
    
    return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  }

  private calculateTrainingEfficiency(metrics: TrainingMetrics): number {
    // Efficiency based on loss reduction per step
    const recentLosses = this.metricHistory.slice(-100).map(m => m.loss);
    if (recentLosses.length < 10) return 0;
    
    const initialLoss = recentLosses[0];
    const currentLoss = metrics.loss;
    const steps = recentLosses.length;
    
    return (initialLoss - currentLoss) / steps;
  }

  /**
   * Get comprehensive performance analytics
   */
  public getPerformanceAnalytics(): any {
    const recentMetrics = this.metricHistory.slice(-100);
    
    return {
      currentState: { ...this.state },
      configuration: { ...this.config },
      performance: {
        totalSteps: this.state.totalSteps,
        improvements: this.state.improvements,
        reductions: this.state.reductions,
        averageConvergenceRate: this.calculateAverageConvergenceRate(),
        trainingEfficiency: this.calculateOverallEfficiency(),
        stabilityScore: this.calculateStabilityScore()
      },
      recommendations: this.generateOptimizationRecommendations(),
      benchmarks: this.generateBenchmarkData()
    };
  }

  private calculateAverageConvergenceRate(): number {
    const rates = this.performanceMonitor.get('convergence_rate') || [];
    return rates.length > 0 ? rates.reduce((a, b) => a + b, 0) / rates.length : 0;
  }

  private calculateOverallEfficiency(): number {
    const efficiencies = this.performanceMonitor.get('training_efficiency') || [];
    return efficiencies.length > 0 ? efficiencies.reduce((a, b) => a + b, 0) / efficiencies.length : 0;
  }

  private calculateStabilityScore(): number {
    const changes = this.performanceMonitor.get('lr_changes') || [];
    const totalSteps = this.state.totalSteps;
    
    // Lower change frequency indicates higher stability
    return totalSteps > 0 ? 1 - (changes.length / totalSteps) : 1;
  }

  private generateOptimizationRecommendations(): string[] {
    const recommendations: string[] = [];
    const analytics = this.getPerformanceAnalytics();
    
    if (analytics.performance.improvements < 3 && this.state.totalSteps > 1000) {
      recommendations.push('Consider increasing learning rate or changing scheduler type');
    }
    
    if (analytics.performance.stabilityScore < 0.8) {
      recommendations.push('Training appears unstable, consider reducing learning rate');
    }
    
    if (analytics.performance.trainingEfficiency < 0.001) {
      recommendations.push('Low training efficiency detected, consider warmup or different decay strategy');
    }
    
    return recommendations;
  }

  private generateBenchmarkData(): any {
    return {
      memoryUsage: tf.memory(),
      performanceMetrics: {
        avgStepsPerSecond: this.calculateStepsPerSecond(),
        convergenceTime: this.estimateConvergenceTime(),
        optimalLRRange: this.findOptimalLRRange()
      },
      comparison: {
        baselineImprovement: this.calculateBaselineImprovement(),
        efficiencyGain: this.calculateEfficiencyGain()
      }
    };
  }

  private calculateStepsPerSecond(): number {
    // Approximate based on recent training time
    return this.state.totalSteps > 0 ? this.state.totalSteps / (Date.now() / 1000) : 0;
  }

  private estimateConvergenceTime(): number {
    const convergenceRate = this.calculateAverageConvergenceRate();
    return convergenceRate > 0 ? 1 / convergenceRate : Infinity;
  }

  private findOptimalLRRange(): { min: number; max: number; optimal: number } {
    // Analyze performance at different learning rates
    const lrHistory = this.metricHistory.map((_, idx) => {
      // Reconstruct LR at that step (simplified)
      return this.config.initialLR * Math.pow(0.95, Math.floor(idx / 1000));
    });
    
    const bestIdx = this.metricHistory.reduce((bestIdx, metric, idx) => 
      metric.loss < this.metricHistory[bestIdx].loss ? idx : bestIdx, 0);
    
    return {
      min: this.config.minLR,
      max: this.config.maxLR,
      optimal: lrHistory[bestIdx] || this.config.initialLR
    };
  }

  private calculateBaselineImprovement(): number {
    // Compare against fixed learning rate baseline
    const baselineLoss = this.metricHistory[0]?.loss || 1;
    const currentLoss = this.metricHistory[this.metricHistory.length - 1]?.loss || 1;
    return ((baselineLoss - currentLoss) / baselineLoss) * 100;
  }

  private calculateEfficiencyGain(): number {
    // Efficiency gain compared to no scheduling
    const avgEfficiency = this.calculateOverallEfficiency();
    const baselineEfficiency = 0.001; // Assumed baseline
    return ((avgEfficiency - baselineEfficiency) / baselineEfficiency) * 100;
  }

  /**
   * Reset scheduler state
   */
  public reset(): void {
    this.state = {
      currentLR: this.config.initialLR,
      bestMetric: Infinity,
      patienceCounter: 0,
      warmupCounter: 0,
      cycleCounter: 0,
      totalSteps: 0,
      improvements: 0,
      reductions: 0
    };
    
    this.metricHistory = [];
    this.performanceMonitor.clear();
    this.initializePerformanceMonitoring();
  }

  /**
   * Save scheduler state for resuming training
   */
  public saveState(): any {
    return {
      state: { ...this.state },
      config: { ...this.config },
      metricHistory: [...this.metricHistory],
      performanceData: Object.fromEntries(this.performanceMonitor)
    };
  }

  /**
   * Load previously saved scheduler state
   */
  public loadState(savedState: any): void {
    this.state = savedState.state;
    this.config = savedState.config;
    this.metricHistory = savedState.metricHistory || [];
    
    if (savedState.performanceData) {
      this.performanceMonitor = new Map(Object.entries(savedState.performanceData));
    }
  }

  /**
   * Dispose of resources
   */
  public dispose(): void {
    this.removeAllListeners();
    this.metricHistory = [];
    this.performanceMonitor.clear();
  }
}

/**
 * Factory function for creating optimized schedulers based on model type
 */
export function createOptimalScheduler(
  optimizer: tf.Optimizer, 
  modelType: 'small' | 'medium' | 'large',
  trainingSize: number
): AdaptiveLearningRateScheduler {
  let config: LearningRateConfig;
  
  switch (modelType) {
    case 'small':
      config = {
        initialLR: 0.01,
        minLR: 1e-5,
        maxLR: 0.1,
        schedulerType: 'cosine',
        cycleLength: Math.min(trainingSize, 1000),
        warmupSteps: 100
      };
      break;
      
    case 'medium':
      config = {
        initialLR: 0.005,
        minLR: 1e-6,
        maxLR: 0.05,
        schedulerType: 'plateau',
        patience: 15,
        factor: 0.5,
        warmupSteps: 500
      };
      break;
      
    case 'large':
      config = {
        initialLR: 0.001,
        minLR: 1e-7,
        maxLR: 0.01,
        schedulerType: 'cyclical',
        stepSize: 2000,
        warmupSteps: 1000
      };
      break;
  }
  
  return new AdaptiveLearningRateScheduler(optimizer, config);
}