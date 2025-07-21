/**
 * Gradient Optimizer for Advanced Gradient Processing
 * 
 * Comprehensive gradient optimization with:
 * - Gradient clipping (norm and value clipping)
 * - Gradient normalization and scaling
 * - Gradient accumulation with memory efficiency
 * - Noise injection for regularization
 * - Gradient flow analysis and monitoring
 * - Adaptive gradient modifications
 */

import * as tf from '@tensorflow/tfjs';
import { EventEmitter } from 'events';

export interface GradientConfig {
  clippingMethod: 'norm' | 'value' | 'adaptive' | 'none';
  clipNorm?: number;
  clipValue?: number;
  normalizeGradients?: boolean;
  noiseInjection?: {
    enabled: boolean;
    variance: number;
    schedule: 'constant' | 'decay' | 'adaptive';
  };
  accumulationSteps?: number;
  gradientCentralization?: boolean;
  momentumDecay?: number;
  adaptiveClipping?: {
    enabled: boolean;
    percentile: number;
    windowSize: number;
  };
}

export interface GradientMetrics {
  globalNorm: number;
  averageNorm: number;
  maxGradient: number;
  minGradient: number;
  sparsity: number;
  vanishingGradientScore: number;
  explodingGradientScore: number;
  flowEfficiency: number;
  step: number;
}

export interface GradientAnalysis {
  healthScore: number;
  flowPattern: 'healthy' | 'vanishing' | 'exploding' | 'oscillating';
  recommendations: string[];
  stability: number;
  convergenceIndicator: number;
}

export class GradientOptimizer extends EventEmitter {
  private config: GradientConfig;
  private metricsHistory: GradientMetrics[] = [];
  private accumulatedGradients: Map<string, tf.Tensor> = new Map();
  private accumulationCounter: number = 0;
  private gradientMomentum: Map<string, tf.Tensor> = new Map();
  private adaptiveClippingHistory: number[] = [];
  private stepCounter: number = 0;

  constructor(config: Partial<GradientConfig> = {}) {
    super();
    
    this.config = {
      clippingMethod: 'norm',
      clipNorm: 1.0,
      clipValue: 0.5,
      normalizeGradients: false,
      noiseInjection: {
        enabled: false,
        variance: 0.01,
        schedule: 'decay'
      },
      accumulationSteps: 1,
      gradientCentralization: false,
      momentumDecay: 0.9,
      adaptiveClipping: {
        enabled: false,
        percentile: 95,
        windowSize: 100
      },
      ...config
    };
  }

  /**
   * Process gradients with all optimizations applied
   */
  public processGradients(
    gradients: { [varName: string]: tf.Tensor },
    variableNames?: string[]
  ): { [varName: string]: tf.Tensor } {
    this.stepCounter++;
    
    // Calculate metrics before processing
    const preMetrics = this.calculateGradientMetrics(gradients);
    
    // Apply gradient centralization if enabled
    let processedGradients = this.config.gradientCentralization 
      ? this.applyGradientCentralization(gradients)
      : { ...gradients };
    
    // Apply noise injection if enabled
    if (this.config.noiseInjection?.enabled) {
      processedGradients = this.applyNoiseInjection(processedGradients);
    }
    
    // Apply gradient accumulation if configured
    if (this.config.accumulationSteps! > 1) {
      processedGradients = this.accumulateGradients(processedGradients);
      
      // Return empty gradients if not ready to apply
      if (this.accumulationCounter < this.config.accumulationSteps!) {
        return {};
      }
    }
    
    // Apply gradient clipping
    processedGradients = this.applyGradientClipping(processedGradients);
    
    // Apply gradient normalization if enabled
    if (this.config.normalizeGradients) {
      processedGradients = this.normalizeGradients(processedGradients);
    }
    
    // Calculate post-processing metrics
    const postMetrics = this.calculateGradientMetrics(processedGradients);
    this.metricsHistory.push(postMetrics);
    
    // Maintain metrics history size
    if (this.metricsHistory.length > 1000) {
      this.metricsHistory.shift();
    }
    
    // Update adaptive clipping if enabled
    if (this.config.adaptiveClipping?.enabled) {
      this.updateAdaptiveClipping(postMetrics.globalNorm);
    }
    
    // Emit gradient analysis event
    this.emit('gradientProcessed', {
      preMetrics,
      postMetrics,
      analysis: this.analyzeGradientHealth(),
      step: this.stepCounter
    });
    
    return processedGradients;
  }

  private applyGradientCentralization(
    gradients: { [varName: string]: tf.Tensor }
  ): { [varName: string]: tf.Tensor } {
    const centralizedGradients: { [varName: string]: tf.Tensor } = {};
    
    Object.entries(gradients).forEach(([name, gradient]) => {
      if (gradient.rank >= 2) {
        // Apply centralization for weights (not biases)
        const mean = gradient.mean();
        centralizedGradients[name] = gradient.sub(mean);
        mean.dispose();
      } else {
        centralizedGradients[name] = gradient.clone();
      }
    });
    
    return centralizedGradients;
  }

  private applyNoiseInjection(
    gradients: { [varName: string]: tf.Tensor }
  ): { [varName: string]: tf.Tensor } {
    const noisyGradients: { [varName: string]: tf.Tensor } = {};
    const variance = this.calculateNoiseVariance();
    
    Object.entries(gradients).forEach(([name, gradient]) => {
      const noise = tf.randomNormal(gradient.shape, 0, Math.sqrt(variance));
      noisyGradients[name] = gradient.add(noise);
      noise.dispose();
    });
    
    return noisyGradients;
  }

  private calculateNoiseVariance(): number {
    const baseVariance = this.config.noiseInjection!.variance;
    
    switch (this.config.noiseInjection!.schedule) {
      case 'constant':
        return baseVariance;
      case 'decay':
        return baseVariance * Math.pow(0.99, this.stepCounter);
      case 'adaptive':
        // Increase noise when gradients are small (vanishing), decrease when large
        const recentMetrics = this.metricsHistory.slice(-10);
        if (recentMetrics.length > 0) {
          const avgNorm = recentMetrics.reduce((sum, m) => sum + m.globalNorm, 0) / recentMetrics.length;
          return baseVariance * (1.0 / Math.max(avgNorm, 0.01));
        }
        return baseVariance;
      default:
        return baseVariance;
    }
  }

  private accumulateGradients(
    gradients: { [varName: string]: tf.Tensor }
  ): { [varName: string]: tf.Tensor } {
    Object.entries(gradients).forEach(([name, gradient]) => {
      if (this.accumulatedGradients.has(name)) {
        const accumulated = this.accumulatedGradients.get(name)!;
        const newAccumulated = accumulated.add(gradient);
        accumulated.dispose();
        this.accumulatedGradients.set(name, newAccumulated);
      } else {
        this.accumulatedGradients.set(name, gradient.clone());
      }
    });
    
    this.accumulationCounter++;
    
    if (this.accumulationCounter >= this.config.accumulationSteps!) {
      // Average accumulated gradients
      const averagedGradients: { [varName: string]: tf.Tensor } = {};
      
      this.accumulatedGradients.forEach((accumulated, name) => {
        averagedGradients[name] = accumulated.div(tf.scalar(this.config.accumulationSteps!));
        accumulated.dispose();
      });
      
      this.accumulatedGradients.clear();
      this.accumulationCounter = 0;
      
      return averagedGradients;
    }
    
    return {};
  }

  private applyGradientClipping(
    gradients: { [varName: string]: tf.Tensor }
  ): { [varName: string]: tf.Tensor } {
    switch (this.config.clippingMethod) {
      case 'norm':
        return this.clipByGlobalNorm(gradients);
      case 'value':
        return this.clipByValue(gradients);
      case 'adaptive':
        return this.clipAdaptively(gradients);
      case 'none':
      default:
        return gradients;
    }
  }

  private clipByGlobalNorm(
    gradients: { [varName: string]: tf.Tensor }
  ): { [varName: string]: tf.Tensor } {
    const globalNorm = this.calculateGlobalNorm(gradients);
    const clipNorm = this.getEffectiveClipNorm();
    
    if (globalNorm <= clipNorm) {
      return gradients;
    }
    
    const clippedGradients: { [varName: string]: tf.Tensor } = {};
    const scaleFactor = clipNorm / globalNorm;
    
    Object.entries(gradients).forEach(([name, gradient]) => {
      clippedGradients[name] = gradient.mul(tf.scalar(scaleFactor));
    });
    
    return clippedGradients;
  }

  private clipByValue(
    gradients: { [varName: string]: tf.Tensor }
  ): { [varName: string]: tf.Tensor } {
    const clippedGradients: { [varName: string]: tf.Tensor } = {};
    const clipValue = this.config.clipValue!;
    
    Object.entries(gradients).forEach(([name, gradient]) => {
      clippedGradients[name] = gradient.clipByValue(-clipValue, clipValue);
    });
    
    return clippedGradients;
  }

  private clipAdaptively(
    gradients: { [varName: string]: tf.Tensor }
  ): { [varName: string]: tf.Tensor } {
    // Adaptive clipping based on recent gradient norms
    if (this.adaptiveClippingHistory.length < 10) {
      return this.clipByGlobalNorm(gradients);
    }
    
    const sortedNorms = [...this.adaptiveClippingHistory].sort((a, b) => a - b);
    const percentileIndex = Math.floor(
      (this.config.adaptiveClipping!.percentile / 100) * sortedNorms.length
    );
    const adaptiveClipNorm = sortedNorms[percentileIndex];
    
    const globalNorm = this.calculateGlobalNorm(gradients);
    
    if (globalNorm <= adaptiveClipNorm) {
      return gradients;
    }
    
    const clippedGradients: { [varName: string]: tf.Tensor } = {};
    const scaleFactor = adaptiveClipNorm / globalNorm;
    
    Object.entries(gradients).forEach(([name, gradient]) => {
      clippedGradients[name] = gradient.mul(tf.scalar(scaleFactor));
    });
    
    return clippedGradients;
  }

  private getEffectiveClipNorm(): number {
    if (this.config.adaptiveClipping?.enabled && this.adaptiveClippingHistory.length >= 10) {
      const recentNorms = this.adaptiveClippingHistory.slice(-50);
      const meanNorm = recentNorms.reduce((a, b) => a + b, 0) / recentNorms.length;
      return Math.max(this.config.clipNorm!, meanNorm * 0.5);
    }
    return this.config.clipNorm!;
  }

  private normalizeGradients(
    gradients: { [varName: string]: tf.Tensor }
  ): { [varName: string]: tf.Tensor } {
    const globalNorm = this.calculateGlobalNorm(gradients);
    
    if (globalNorm === 0) {
      return gradients;
    }
    
    const normalizedGradients: { [varName: string]: tf.Tensor } = {};
    
    Object.entries(gradients).forEach(([name, gradient]) => {
      normalizedGradients[name] = gradient.div(tf.scalar(globalNorm));
    });
    
    return normalizedGradients;
  }

  private calculateGlobalNorm(gradients: { [varName: string]: tf.Tensor }): number {
    let totalNormSquared = 0;
    
    Object.values(gradients).forEach(gradient => {
      const gradientData = gradient.dataSync();
      for (let i = 0; i < gradientData.length; i++) {
        totalNormSquared += gradientData[i] * gradientData[i];
      }
    });
    
    return Math.sqrt(totalNormSquared);
  }

  private calculateGradientMetrics(gradients: { [varName: string]: tf.Tensor }): GradientMetrics {
    if (Object.keys(gradients).length === 0) {
      return {
        globalNorm: 0,
        averageNorm: 0,
        maxGradient: 0,
        minGradient: 0,
        sparsity: 1,
        vanishingGradientScore: 1,
        explodingGradientScore: 0,
        flowEfficiency: 0,
        step: this.stepCounter
      };
    }
    
    const globalNorm = this.calculateGlobalNorm(gradients);
    const gradientValues: number[] = [];
    let totalElements = 0;
    let zeroElements = 0;
    
    Object.values(gradients).forEach(gradient => {
      const data = gradient.dataSync();
      gradientValues.push(...Array.from(data));
      totalElements += data.length;
      zeroElements += Array.from(data).filter(v => Math.abs(v) < 1e-8).length;
    });
    
    const maxGradient = Math.max(...gradientValues.map(Math.abs));
    const minGradient = Math.min(...gradientValues.map(Math.abs));
    const averageNorm = globalNorm / Math.sqrt(totalElements);
    const sparsity = zeroElements / totalElements;
    
    // Calculate vanishing gradient score (higher = more vanishing)
    const vanishingThreshold = 1e-6;
    const vanishingGradientScore = gradientValues.filter(v => Math.abs(v) < vanishingThreshold).length / gradientValues.length;
    
    // Calculate exploding gradient score (higher = more exploding)
    const explodingThreshold = 100;
    const explodingGradientScore = gradientValues.filter(v => Math.abs(v) > explodingThreshold).length / gradientValues.length;
    
    // Calculate flow efficiency (based on gradient distribution)
    const flowEfficiency = this.calculateFlowEfficiency(gradientValues);
    
    return {
      globalNorm,
      averageNorm,
      maxGradient,
      minGradient,
      sparsity,
      vanishingGradientScore,
      explodingGradientScore,
      flowEfficiency,
      step: this.stepCounter
    };
  }

  private calculateFlowEfficiency(gradientValues: number[]): number {
    // Efficiency based on how well gradients are distributed
    const mean = gradientValues.reduce((a, b) => a + b, 0) / gradientValues.length;
    const variance = gradientValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / gradientValues.length;
    const stdDev = Math.sqrt(variance);
    
    // Good flow has low mean (centered around 0) and moderate variance
    const centeringScore = Math.exp(-Math.abs(mean) * 100); // Penalty for non-zero mean
    const varianceScore = Math.exp(-Math.abs(stdDev - 0.1) * 10); // Optimal std around 0.1
    
    return (centeringScore + varianceScore) / 2;
  }

  private updateAdaptiveClipping(globalNorm: number): void {
    this.adaptiveClippingHistory.push(globalNorm);
    
    // Maintain window size
    const windowSize = this.config.adaptiveClipping!.windowSize;
    if (this.adaptiveClippingHistory.length > windowSize) {
      this.adaptiveClippingHistory.shift();
    }
  }

  /**
   * Analyze gradient health and provide insights
   */
  public analyzeGradientHealth(): GradientAnalysis {
    if (this.metricsHistory.length < 5) {
      return {
        healthScore: 0.5,
        flowPattern: 'healthy',
        recommendations: ['Insufficient data for analysis'],
        stability: 0.5,
        convergenceIndicator: 0.5
      };
    }
    
    const recentMetrics = this.metricsHistory.slice(-20);
    const healthScore = this.calculateHealthScore(recentMetrics);
    const flowPattern = this.determineFlowPattern(recentMetrics);
    const stability = this.calculateStability(recentMetrics);
    const convergenceIndicator = this.calculateConvergenceIndicator(recentMetrics);
    const recommendations = this.generateRecommendations(recentMetrics, flowPattern);
    
    return {
      healthScore,
      flowPattern,
      recommendations,
      stability,
      convergenceIndicator
    };
  }

  private calculateHealthScore(metrics: GradientMetrics[]): number {
    let score = 0;
    const weights = {
      vanishing: 0.3,
      exploding: 0.3,
      flow: 0.2,
      stability: 0.2
    };
    
    // Vanishing gradient penalty
    const avgVanishing = metrics.reduce((sum, m) => sum + m.vanishingGradientScore, 0) / metrics.length;
    score += weights.vanishing * (1 - avgVanishing);
    
    // Exploding gradient penalty
    const avgExploding = metrics.reduce((sum, m) => sum + m.explodingGradientScore, 0) / metrics.length;
    score += weights.exploding * (1 - avgExploding);
    
    // Flow efficiency
    const avgFlow = metrics.reduce((sum, m) => sum + m.flowEfficiency, 0) / metrics.length;
    score += weights.flow * avgFlow;
    
    // Stability (low variance in norms)
    const norms = metrics.map(m => m.globalNorm);
    const normMean = norms.reduce((a, b) => a + b, 0) / norms.length;
    const normVariance = norms.reduce((sum, norm) => sum + Math.pow(norm - normMean, 2), 0) / norms.length;
    const stabilityScore = Math.exp(-normVariance);
    score += weights.stability * stabilityScore;
    
    return Math.max(0, Math.min(1, score));
  }

  private determineFlowPattern(metrics: GradientMetrics[]): 'healthy' | 'vanishing' | 'exploding' | 'oscillating' {
    const avgVanishing = metrics.reduce((sum, m) => sum + m.vanishingGradientScore, 0) / metrics.length;
    const avgExploding = metrics.reduce((sum, m) => sum + m.explodingGradientScore, 0) / metrics.length;
    
    // Check for oscillation
    const norms = metrics.map(m => m.globalNorm);
    const oscillationScore = this.calculateOscillationScore(norms);
    
    if (oscillationScore > 0.7) {
      return 'oscillating';
    } else if (avgVanishing > 0.5) {
      return 'vanishing';
    } else if (avgExploding > 0.1) {
      return 'exploding';
    } else {
      return 'healthy';
    }
  }

  private calculateOscillationScore(values: number[]): number {
    if (values.length < 5) return 0;
    
    let directionChanges = 0;
    for (let i = 2; i < values.length; i++) {
      const prev = values[i - 1] - values[i - 2];
      const curr = values[i] - values[i - 1];
      if (prev * curr < 0) { // Sign change
        directionChanges++;
      }
    }
    
    return directionChanges / (values.length - 2);
  }

  private calculateStability(metrics: GradientMetrics[]): number {
    const norms = metrics.map(m => m.globalNorm);
    const mean = norms.reduce((a, b) => a + b, 0) / norms.length;
    const variance = norms.reduce((sum, norm) => sum + Math.pow(norm - mean, 2), 0) / norms.length;
    const coefficientOfVariation = Math.sqrt(variance) / Math.abs(mean);
    
    return Math.max(0, 1 - coefficientOfVariation);
  }

  private calculateConvergenceIndicator(metrics: GradientMetrics[]): number {
    // Convergence indicated by decreasing gradient norms over time
    const norms = metrics.map(m => m.globalNorm);
    if (norms.length < 5) return 0.5;
    
    const early = norms.slice(0, Math.floor(norms.length / 2));
    const late = norms.slice(Math.floor(norms.length / 2));
    
    const earlyMean = early.reduce((a, b) => a + b, 0) / early.length;
    const lateMean = late.reduce((a, b) => a + b, 0) / late.length;
    
    // Positive score if norms are decreasing
    const improvement = (earlyMean - lateMean) / earlyMean;
    return Math.max(0, Math.min(1, improvement + 0.5));
  }

  private generateRecommendations(
    metrics: GradientMetrics[],
    flowPattern: string
  ): string[] {
    const recommendations: string[] = [];
    
    const avgVanishing = metrics.reduce((sum, m) => sum + m.vanishingGradientScore, 0) / metrics.length;
    const avgExploding = metrics.reduce((sum, m) => sum + m.explodingGradientScore, 0) / metrics.length;
    const avgFlow = metrics.reduce((sum, m) => sum + m.flowEfficiency, 0) / metrics.length;
    
    if (flowPattern === 'vanishing') {
      recommendations.push('Vanishing gradients detected - consider using residual connections or batch normalization');
      recommendations.push('Try reducing the learning rate or using gradient clipping');
    }
    
    if (flowPattern === 'exploding') {
      recommendations.push('Exploding gradients detected - enable gradient clipping');
      recommendations.push('Consider reducing the learning rate significantly');
    }
    
    if (flowPattern === 'oscillating') {
      recommendations.push('Gradient oscillation detected - try reducing learning rate');
      recommendations.push('Consider using momentum or adaptive learning rate scheduling');
    }
    
    if (avgFlow < 0.3) {
      recommendations.push('Poor gradient flow - check model architecture for bottlenecks');
      recommendations.push('Consider using gradient centralization or normalization');
    }
    
    if (this.config.clippingMethod === 'none' && avgExploding > 0.05) {
      recommendations.push('Enable gradient clipping to prevent exploding gradients');
    }
    
    if (!this.config.noiseInjection?.enabled && avgVanishing > 0.3) {
      recommendations.push('Consider enabling gradient noise injection to combat vanishing gradients');
    }
    
    return recommendations;
  }

  /**
   * Get comprehensive gradient analytics
   */
  public getAnalytics(): any {
    const analysis = this.analyzeGradientHealth();
    const recentMetrics = this.metricsHistory.slice(-100);
    
    return {
      currentStep: this.stepCounter,
      configuration: { ...this.config },
      health: analysis,
      performance: {
        averageGlobalNorm: recentMetrics.reduce((sum, m) => sum + m.globalNorm, 0) / recentMetrics.length,
        averageFlowEfficiency: recentMetrics.reduce((sum, m) => sum + m.flowEfficiency, 0) / recentMetrics.length,
        sparsityLevel: recentMetrics.reduce((sum, m) => sum + m.sparsity, 0) / recentMetrics.length,
        clippingFrequency: this.calculateClippingFrequency(),
        processingOverhead: this.calculateProcessingOverhead()
      },
      trends: this.calculateTrends(recentMetrics),
      benchmarks: this.generateBenchmarks()
    };
  }

  private calculateClippingFrequency(): number {
    if (this.metricsHistory.length < 10) return 0;
    
    const recentMetrics = this.metricsHistory.slice(-100);
    const clipThreshold = this.getEffectiveClipNorm();
    const clippedSteps = recentMetrics.filter(m => m.globalNorm > clipThreshold).length;
    
    return clippedSteps / recentMetrics.length;
  }

  private calculateProcessingOverhead(): number {
    // Estimate overhead based on enabled features
    let overhead = 0;
    
    if (this.config.gradientCentralization) overhead += 0.1;
    if (this.config.noiseInjection?.enabled) overhead += 0.05;
    if (this.config.accumulationSteps! > 1) overhead += 0.15;
    if (this.config.normalizeGradients) overhead += 0.05;
    if (this.config.clippingMethod !== 'none') overhead += 0.05;
    
    return overhead;
  }

  private calculateTrends(metrics: GradientMetrics[]): any {
    if (metrics.length < 10) return {};
    
    const norms = metrics.map(m => m.globalNorm);
    const flowEfficiencies = metrics.map(m => m.flowEfficiency);
    
    return {
      normTrend: this.calculateTrend(norms),
      flowTrend: this.calculateTrend(flowEfficiencies),
      convergenceTrend: this.calculateConvergenceTrend(metrics)
    };
  }

  private calculateTrend(values: number[]): 'increasing' | 'decreasing' | 'stable' {
    const n = values.length;
    const xMean = (n - 1) / 2;
    const yMean = values.reduce((a, b) => a + b, 0) / n;
    
    let numerator = 0;
    let denominator = 0;
    
    for (let i = 0; i < n; i++) {
      numerator += (i - xMean) * (values[i] - yMean);
      denominator += (i - xMean) * (i - xMean);
    }
    
    const slope = numerator / denominator;
    
    if (slope > 0.01) return 'increasing';
    if (slope < -0.01) return 'decreasing';
    return 'stable';
  }

  private calculateConvergenceTrend(metrics: GradientMetrics[]): number {
    // Higher score indicates better convergence
    const convergenceScores = metrics.map(m => 1 - m.vanishingGradientScore - m.explodingGradientScore);
    const trend = this.calculateTrend(convergenceScores);
    
    switch (trend) {
      case 'increasing': return 1.0;
      case 'stable': return 0.5;
      case 'decreasing': return 0.0;
    }
  }

  private generateBenchmarks(): any {
    return {
      memoryUsage: tf.memory(),
      performanceMetrics: {
        gradientProcessingRate: this.calculateProcessingRate(),
        memoryEfficiency: this.calculateMemoryEfficiency(),
        optimizationEffectiveness: this.calculateOptimizationEffectiveness()
      },
      comparison: {
        baselineImprovement: this.calculateBaselineImprovement(),
        clippingBenefit: this.calculateClippingBenefit()
      }
    };
  }

  private calculateProcessingRate(): number {
    // Estimated gradients processed per second
    return this.stepCounter / (Date.now() / 1000);
  }

  private calculateMemoryEfficiency(): number {
    const memoryInfo = tf.memory();
    return memoryInfo.numBytesInGPU / (memoryInfo.numBytesInGPU + memoryInfo.numBytes);
  }

  private calculateOptimizationEffectiveness(): number {
    if (this.metricsHistory.length < 10) return 0.5;
    
    const recent = this.metricsHistory.slice(-10);
    const healthScore = this.calculateHealthScore(recent);
    return healthScore;
  }

  private calculateBaselineImprovement(): number {
    // Compare current performance to initial performance
    if (this.metricsHistory.length < 20) return 0;
    
    const initial = this.metricsHistory.slice(0, 10);
    const recent = this.metricsHistory.slice(-10);
    
    const initialHealth = this.calculateHealthScore(initial);
    const recentHealth = this.calculateHealthScore(recent);
    
    return ((recentHealth - initialHealth) / initialHealth) * 100;
  }

  private calculateClippingBenefit(): number {
    // Estimate benefit of gradient clipping
    const clippingFreq = this.calculateClippingFrequency();
    const stabilityScore = this.calculateStability(this.metricsHistory.slice(-20));
    
    return clippingFreq * stabilityScore * 100;
  }

  /**
   * Reset optimizer state
   */
  public reset(): void {
    this.metricsHistory = [];
    this.accumulatedGradients.forEach(tensor => tensor.dispose());
    this.accumulatedGradients.clear();
    this.gradientMomentum.forEach(tensor => tensor.dispose());
    this.gradientMomentum.clear();
    this.adaptiveClippingHistory = [];
    this.accumulationCounter = 0;
    this.stepCounter = 0;
  }

  /**
   * Dispose of resources
   */
  public dispose(): void {
    this.accumulatedGradients.forEach(tensor => tensor.dispose());
    this.gradientMomentum.forEach(tensor => tensor.dispose());
    this.removeAllListeners();
  }

  // Getters
  public get currentStep(): number {
    return this.stepCounter;
  }

  public get metricsSize(): number {
    return this.metricsHistory.length;
  }
}

/**
 * Factory function for creating optimized gradient configurations
 */
export function createOptimalGradientConfig(
  modelType: 'rnn' | 'cnn' | 'transformer' | 'dense',
  trainingStage: 'initial' | 'fine_tuning' | 'convergence'
): GradientConfig {
  let config: GradientConfig;
  
  switch (modelType) {
    case 'rnn':
      config = {
        clippingMethod: 'norm',
        clipNorm: 1.0,
        normalizeGradients: false,
        noiseInjection: {
          enabled: true,
          variance: 0.01,
          schedule: 'decay'
        },
        accumulationSteps: 1,
        gradientCentralization: true,
        adaptiveClipping: {
          enabled: true,
          percentile: 95,
          windowSize: 100
        }
      };
      break;
      
    case 'cnn':
      config = {
        clippingMethod: 'value',
        clipValue: 0.5,
        normalizeGradients: true,
        noiseInjection: {
          enabled: false,
          variance: 0.005,
          schedule: 'constant'
        },
        accumulationSteps: 1,
        gradientCentralization: true
      };
      break;
      
    case 'transformer':
      config = {
        clippingMethod: 'norm',
        clipNorm: 1.0,
        normalizeGradients: true,
        noiseInjection: {
          enabled: true,
          variance: 0.001,
          schedule: 'adaptive'
        },
        accumulationSteps: 4,
        gradientCentralization: true,
        adaptiveClipping: {
          enabled: true,
          percentile: 90,
          windowSize: 50
        }
      };
      break;
      
    case 'dense':
    default:
      config = {
        clippingMethod: 'adaptive',
        clipNorm: 5.0,
        normalizeGradients: false,
        noiseInjection: {
          enabled: false,
          variance: 0.01,
          schedule: 'decay'
        },
        accumulationSteps: 1,
        gradientCentralization: false
      };
      break;
  }
  
  // Adjust for training stage
  switch (trainingStage) {
    case 'initial':
      config.clipNorm = (config.clipNorm || 1.0) * 2; // More aggressive clipping
      if (config.noiseInjection) {
        config.noiseInjection.variance *= 2; // More noise for exploration
      }
      break;
      
    case 'fine_tuning':
      config.clipNorm = (config.clipNorm || 1.0) * 0.5; // Gentler clipping
      if (config.noiseInjection) {
        config.noiseInjection.variance *= 0.1; // Less noise
      }
      break;
      
    case 'convergence':
      config.clippingMethod = 'none'; // Minimal intervention
      if (config.noiseInjection) {
        config.noiseInjection.enabled = false; // No noise
      }
      break;
  }
  
  return config;
}