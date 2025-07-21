import * as tf from '@tensorflow/tfjs-node';
import { EventEmitter } from 'events';
import { logger } from '../../utils/logger';
import { NeuralPerformanceBenchmark } from './NeuralPerformanceBenchmark';

/**
 * Comprehensive Benchmark Suite for Neural Networks
 * Provides systematic performance evaluation across multiple dimensions
 */
export class ComprehensiveBenchmarkSuite extends EventEmitter {
  private readonly config: BenchmarkSuiteConfig;
  private benchmarks: Map<string, BenchmarkRunner> = new Map();
  private results: Map<string, BenchmarkSuiteResult> = new Map();
  private currentRun: BenchmarkRun | null = null;

  constructor(config?: Partial<BenchmarkSuiteConfig>) {
    super();
    
    this.config = {
      enabledBenchmarks: [
        'model_accuracy',
        'training_efficiency',
        'inference_speed',
        'memory_usage',
        'scalability',
        'robustness',
        'fairness',
        'interpretability'
      ],
      parallelExecution: true,
      maxConcurrentBenchmarks: 4,
      timeout: 1800000, // 30 minutes
      reportFormat: 'comprehensive',
      saveResults: true,
      resultsPath: './benchmark_results',
      compareBaselines: true,
      generateRecommendations: true,
      ...config
    };

    this.initializeBenchmarks();
  }

  /**
   * Run comprehensive benchmark suite
   */
  public async runBenchmarks(
    models: { [name: string]: tf.LayersModel },
    datasets: BenchmarkDatasets,
    options?: BenchmarkOptions
  ): Promise<ComprehensiveBenchmarkReport> {
    try {
      const runId = this.generateRunId();
      logger.info(`Starting comprehensive benchmark run: ${runId}`);
      
      this.currentRun = {
        id: runId,
        startTime: Date.now(),
        models: Object.keys(models),
        status: 'running',
        progress: 0,
        completedBenchmarks: [],
        results: {}
      };

      this.emit('benchmarkStart', { runId, models: Object.keys(models) });

      // Run benchmarks based on configuration
      const benchmarkResults = await this.executeBenchmarks(models, datasets, options);

      // Analyze and compare results
      const analysis = await this.analyzeResults(benchmarkResults);

      // Generate recommendations
      const recommendations = this.generateRecommendations(analysis);

      // Create comprehensive report
      const report: ComprehensiveBenchmarkReport = {
        runId,
        timestamp: Date.now(),
        duration: Date.now() - this.currentRun.startTime,
        models: Object.keys(models),
        benchmarks: this.config.enabledBenchmarks,
        results: benchmarkResults,
        analysis,
        recommendations,
        metadata: {
          config: this.config,
          environment: await this.getEnvironmentInfo(),
          datasets: this.getDatasetInfo(datasets)
        }
      };

      // Save results if enabled
      if (this.config.saveResults) {
        await this.saveResults(report);
      }

      this.currentRun.status = 'completed';
      this.emit('benchmarkComplete', { runId, report });
      
      logger.info(`Benchmark run ${runId} completed successfully`);
      return report;

    } catch (error) {
      if (this.currentRun) {
        this.currentRun.status = 'failed';
      }
      
      this.emit('benchmarkError', { error: error.message });
      logger.error('Benchmark suite failed:', error);
      throw error;
    }
  }

  /**
   * Initialize benchmark runners
   */
  private initializeBenchmarks(): void {
    // Model Accuracy Benchmark
    this.benchmarks.set('model_accuracy', new ModelAccuracyBenchmark({
      metrics: ['accuracy', 'precision', 'recall', 'f1', 'auc'],
      crossValidationFolds: 5,
      testSplit: 0.2
    }));

    // Training Efficiency Benchmark
    this.benchmarks.set('training_efficiency', new TrainingEfficiencyBenchmark({
      maxEpochs: 100,
      earlyStopping: true,
      measureConvergence: true,
      profileMemory: true
    }));

    // Inference Speed Benchmark
    this.benchmarks.set('inference_speed', new InferenceSpeedBenchmark({
      batchSizes: [1, 8, 16, 32, 64],
      warmupIterations: 10,
      measurementIterations: 100,
      includeLatency: true,
      includeThroughput: true
    }));

    // Memory Usage Benchmark
    this.benchmarks.set('memory_usage', new MemoryUsageBenchmark({
      measureTraining: true,
      measureInference: true,
      trackPeakUsage: true,
      profileGC: true
    }));

    // Scalability Benchmark
    this.benchmarks.set('scalability', new ScalabilityBenchmark({
      inputSizes: [100, 1000, 10000, 100000],
      batchSizes: [1, 8, 32, 128],
      measureParallelization: true
    }));

    // Robustness Benchmark
    this.benchmarks.set('robustness', new RobustnessBenchmark({
      noiseTypes: ['gaussian', 'uniform', 'adversarial'],
      noiselevels: [0.01, 0.05, 0.1, 0.2],
      measureStability: true
    }));

    // Fairness Benchmark
    this.benchmarks.set('fairness', new FairnessBenchmark({
      sensitiveAttributes: ['age', 'gender', 'race'],
      fairnessMetrics: ['demographic_parity', 'equalized_odds', 'statistical_parity'],
      thresholds: [0.8, 0.9, 0.95]
    }));

    // Interpretability Benchmark
    this.benchmarks.set('interpretability', new InterpretabilityBenchmark({
      methods: ['gradients', 'integrated_gradients', 'lime', 'shap'],
      featureImportance: true,
      visualizations: true
    }));
  }

  /**
   * Execute all enabled benchmarks
   */
  private async executeBenchmarks(
    models: { [name: string]: tf.LayersModel },
    datasets: BenchmarkDatasets,
    options?: BenchmarkOptions
  ): Promise<{ [benchmark: string]: BenchmarkResult }> {
    const results: { [benchmark: string]: BenchmarkResult } = {};
    const benchmarkTasks: Array<() => Promise<void>> = [];

    // Create benchmark tasks
    for (const benchmarkName of this.config.enabledBenchmarks) {
      const benchmark = this.benchmarks.get(benchmarkName);
      if (!benchmark) {
        logger.warn(`Benchmark ${benchmarkName} not found, skipping`);
        continue;
      }

      benchmarkTasks.push(async () => {
        try {
          logger.info(`Running ${benchmarkName} benchmark`);
          const result = await benchmark.run(models, datasets, options);
          results[benchmarkName] = result;
          
          this.currentRun!.completedBenchmarks.push(benchmarkName);
          this.currentRun!.progress = this.currentRun!.completedBenchmarks.length / this.config.enabledBenchmarks.length;
          
          this.emit('benchmarkProgress', {
            benchmark: benchmarkName,
            progress: this.currentRun!.progress,
            result
          });
          
        } catch (error) {
          logger.error(`Benchmark ${benchmarkName} failed:`, error);
          results[benchmarkName] = {
            benchmark: benchmarkName,
            models: Object.keys(models),
            status: 'failed',
            error: error.message,
            timestamp: Date.now()
          };
        }
      });
    }

    // Execute benchmarks
    if (this.config.parallelExecution) {
      // Execute in parallel batches
      const chunks = this.chunkArray(benchmarkTasks, this.config.maxConcurrentBenchmarks);
      for (const chunk of chunks) {
        await Promise.all(chunk.map(task => task()));
      }
    } else {
      // Execute sequentially
      for (const task of benchmarkTasks) {
        await task();
      }
    }

    return results;
  }

  /**
   * Analyze benchmark results
   */
  private async analyzeResults(
    results: { [benchmark: string]: BenchmarkResult }
  ): Promise<BenchmarkAnalysis> {
    logger.info('Analyzing benchmark results...');

    const analysis: BenchmarkAnalysis = {
      summary: this.generateSummary(results),
      comparisons: this.generateComparisons(results),
      rankings: this.generateRankings(results),
      correlations: this.calculateCorrelations(results),
      anomalies: this.detectAnomalies(results),
      trends: this.analyzeTrends(results),
      statisticalSignificance: this.calculateStatisticalSignificance(results)
    };

    return analysis;
  }

  /**
   * Generate summary statistics
   */
  private generateSummary(results: { [benchmark: string]: BenchmarkResult }): BenchmarkSummary {
    const completedBenchmarks = Object.values(results).filter(r => r.status === 'completed').length;
    const failedBenchmarks = Object.values(results).filter(r => r.status === 'failed').length;
    
    // Extract model performance across benchmarks
    const modelPerformance: { [model: string]: any } = {};
    
    for (const [benchmarkName, result] of Object.entries(results)) {
      if (result.status === 'completed' && result.modelResults) {
        for (const [modelName, modelResult] of Object.entries(result.modelResults)) {
          if (!modelPerformance[modelName]) {
            modelPerformance[modelName] = {};
          }
          modelPerformance[modelName][benchmarkName] = modelResult.metrics;
        }
      }
    }

    return {
      totalBenchmarks: Object.keys(results).length,
      completedBenchmarks,
      failedBenchmarks,
      successRate: completedBenchmarks / Object.keys(results).length,
      modelPerformance,
      overallWinner: this.determineOverallWinner(modelPerformance),
      keyFindings: this.extractKeyFindings(results)
    };
  }

  /**
   * Generate model comparisons
   */
  private generateComparisons(results: { [benchmark: string]: BenchmarkResult }): ModelComparison[] {
    const comparisons: ModelComparison[] = [];
    const models = this.extractModelNames(results);

    // Pairwise comparisons
    for (let i = 0; i < models.length; i++) {
      for (let j = i + 1; j < models.length; j++) {
        const modelA = models[i];
        const modelB = models[j];
        
        const comparison = this.compareModels(modelA, modelB, results);
        comparisons.push(comparison);
      }
    }

    return comparisons;
  }

  /**
   * Generate model rankings
   */
  private generateRankings(results: { [benchmark: string]: BenchmarkResult }): ModelRanking[] {
    const rankings: ModelRanking[] = [];
    
    for (const [benchmarkName, result] of Object.entries(results)) {
      if (result.status === 'completed' && result.modelResults) {
        const benchmarkRanking = this.rankModelsForBenchmark(benchmarkName, result);
        rankings.push(benchmarkRanking);
      }
    }

    // Overall ranking
    const overallRanking = this.calculateOverallRanking(rankings);
    rankings.push(overallRanking);

    return rankings;
  }

  /**
   * Calculate correlations between metrics
   */
  private calculateCorrelations(results: { [benchmark: string]: BenchmarkResult }): CorrelationMatrix {
    const metrics = this.extractAllMetrics(results);
    const correlations: { [key: string]: { [key: string]: number } } = {};

    for (const metric1 of metrics) {
      correlations[metric1] = {};
      for (const metric2 of metrics) {
        if (metric1 === metric2) {
          correlations[metric1][metric2] = 1.0;
        } else {
          correlations[metric1][metric2] = this.calculateCorrelation(metric1, metric2, results);
        }
      }
    }

    return {
      metrics,
      correlations,
      strongCorrelations: this.findStrongCorrelations(correlations),
      insights: this.generateCorrelationInsights(correlations)
    };
  }

  /**
   * Detect anomalies in results
   */
  private detectAnomalies(results: { [benchmark: string]: BenchmarkResult }): Anomaly[] {
    const anomalies: Anomaly[] = [];

    for (const [benchmarkName, result] of Object.entries(results)) {
      if (result.status === 'completed' && result.modelResults) {
        for (const [modelName, modelResult] of Object.entries(result.modelResults)) {
          const modelAnomalies = this.detectModelAnomalies(benchmarkName, modelName, modelResult);
          anomalies.push(...modelAnomalies);
        }
      }
    }

    return anomalies;
  }

  /**
   * Analyze performance trends
   */
  private analyzeTrends(results: { [benchmark: string]: BenchmarkResult }): TrendAnalysis {
    return {
      performanceTrends: this.calculatePerformanceTrends(results),
      efficiencyTrends: this.calculateEfficiencyTrends(results),
      scalabilityTrends: this.calculateScalabilityTrends(results),
      recommendations: this.generateTrendRecommendations(results)
    };
  }

  /**
   * Calculate statistical significance
   */
  private calculateStatisticalSignificance(
    results: { [benchmark: string]: BenchmarkResult }
  ): StatisticalSignificance {
    return {
      pValues: this.calculatePValues(results),
      confidenceIntervals: this.calculateConfidenceIntervals(results),
      effectSizes: this.calculateEffectSizes(results),
      significantDifferences: this.identifySignificantDifferences(results)
    };
  }

  /**
   * Generate actionable recommendations
   */
  private generateRecommendations(analysis: BenchmarkAnalysis): Recommendation[] {
    const recommendations: Recommendation[] = [];

    // Performance recommendations
    if (analysis.summary.successRate < 0.8) {
      recommendations.push({
        type: 'performance',
        priority: 'high',
        title: 'Improve Model Reliability',
        description: 'Several benchmarks failed. Review model implementations and training procedures.',
        actions: [
          'Check model architecture compatibility',
          'Validate input data preprocessing',
          'Review training hyperparameters',
          'Implement better error handling'
        ]
      });
    }

    // Efficiency recommendations
    const efficiencyIssues = this.identifyEfficiencyIssues(analysis);
    if (efficiencyIssues.length > 0) {
      recommendations.push({
        type: 'efficiency',
        priority: 'medium',
        title: 'Optimize Training Efficiency',
        description: 'Models show inefficient training patterns.',
        actions: efficiencyIssues
      });
    }

    // Scalability recommendations
    const scalabilityIssues = this.identifyScalabilityIssues(analysis);
    if (scalabilityIssues.length > 0) {
      recommendations.push({
        type: 'scalability',
        priority: 'medium',
        title: 'Improve Model Scalability',
        description: 'Models may not scale well with larger inputs.',
        actions: scalabilityIssues
      });
    }

    // Fairness recommendations
    const fairnessIssues = this.identifyFairnessIssues(analysis);
    if (fairnessIssues.length > 0) {
      recommendations.push({
        type: 'fairness',
        priority: 'high',
        title: 'Address Fairness Concerns',
        description: 'Models show potential bias issues.',
        actions: fairnessIssues
      });
    }

    return recommendations;
  }

  // Helper methods (simplified implementations)
  private generateRunId(): string {
    return `bench_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  private async getEnvironmentInfo(): Promise<any> {
    return {
      nodeVersion: process.version,
      platform: process.platform,
      memory: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      cpus: require('os').cpus().length,
      tensorflow: tf.version
    };
  }

  private getDatasetInfo(datasets: BenchmarkDatasets): any {
    return {
      training: {
        samples: datasets.training?.features?.shape?.[0] || 0,
        features: datasets.training?.features?.shape?.[1] || 0
      },
      validation: {
        samples: datasets.validation?.features?.shape?.[0] || 0,
        features: datasets.validation?.features?.shape?.[1] || 0
      },
      test: {
        samples: datasets.test?.features?.shape?.[0] || 0,
        features: datasets.test?.features?.shape?.[1] || 0
      }
    };
  }

  private async saveResults(report: ComprehensiveBenchmarkReport): Promise<void> {
    const filename = `benchmark_${report.runId}_${Date.now()}.json`;
    const filepath = `${this.config.resultsPath}/${filename}`;
    
    // In practice, would save to file system
    logger.info(`Saving benchmark results to ${filepath}`);
  }

  private extractModelNames(results: { [benchmark: string]: BenchmarkResult }): string[] {
    const modelNames = new Set<string>();
    
    for (const result of Object.values(results)) {
      if (result.models) {
        result.models.forEach(name => modelNames.add(name));
      }
    }
    
    return Array.from(modelNames);
  }

  private extractAllMetrics(results: { [benchmark: string]: BenchmarkResult }): string[] {
    const metrics = new Set<string>();
    
    for (const result of Object.values(results)) {
      if (result.modelResults) {
        for (const modelResult of Object.values(result.modelResults)) {
          if (modelResult.metrics) {
            Object.keys(modelResult.metrics).forEach(metric => metrics.add(metric));
          }
        }
      }
    }
    
    return Array.from(metrics);
  }

  // Additional helper methods would be implemented here...
  private determineOverallWinner(modelPerformance: any): string {
    return 'model_1'; // Placeholder
  }

  private extractKeyFindings(results: any): string[] {
    return ['Finding 1', 'Finding 2']; // Placeholder
  }

  private compareModels(modelA: string, modelB: string, results: any): ModelComparison {
    return {
      modelA,
      modelB,
      winner: modelA,
      metrics: {},
      significance: 0.95
    }; // Placeholder
  }

  private rankModelsForBenchmark(benchmarkName: string, result: BenchmarkResult): ModelRanking {
    return {
      benchmark: benchmarkName,
      rankings: [],
      metric: 'accuracy'
    }; // Placeholder
  }

  private calculateOverallRanking(rankings: ModelRanking[]): ModelRanking {
    return {
      benchmark: 'overall',
      rankings: [],
      metric: 'weighted_score'
    }; // Placeholder
  }

  private calculateCorrelation(metric1: string, metric2: string, results: any): number {
    return Math.random(); // Placeholder
  }

  private findStrongCorrelations(correlations: any): Array<{ metric1: string; metric2: string; correlation: number }> {
    return []; // Placeholder
  }

  private generateCorrelationInsights(correlations: any): string[] {
    return []; // Placeholder
  }

  private detectModelAnomalies(benchmark: string, model: string, result: any): Anomaly[] {
    return []; // Placeholder
  }

  private calculatePerformanceTrends(results: any): any {
    return {}; // Placeholder
  }

  private calculateEfficiencyTrends(results: any): any {
    return {}; // Placeholder
  }

  private calculateScalabilityTrends(results: any): any {
    return {}; // Placeholder
  }

  private generateTrendRecommendations(results: any): string[] {
    return []; // Placeholder
  }

  private calculatePValues(results: any): any {
    return {}; // Placeholder
  }

  private calculateConfidenceIntervals(results: any): any {
    return {}; // Placeholder
  }

  private calculateEffectSizes(results: any): any {
    return {}; // Placeholder
  }

  private identifySignificantDifferences(results: any): any {
    return {}; // Placeholder
  }

  private identifyEfficiencyIssues(analysis: BenchmarkAnalysis): string[] {
    return []; // Placeholder
  }

  private identifyScalabilityIssues(analysis: BenchmarkAnalysis): string[] {
    return []; // Placeholder
  }

  private identifyFairnessIssues(analysis: BenchmarkAnalysis): string[] {
    return []; // Placeholder
  }

  /**
   * Get current benchmark run status
   */
  public getCurrentRun(): BenchmarkRun | null {
    return this.currentRun;
  }

  /**
   * List available benchmarks
   */
  public getAvailableBenchmarks(): string[] {
    return Array.from(this.benchmarks.keys());
  }

  /**
   * Get benchmark results history
   */
  public getResultsHistory(): BenchmarkSuiteResult[] {
    return Array.from(this.results.values());
  }
}

// Placeholder benchmark implementations
class ModelAccuracyBenchmark implements BenchmarkRunner {
  constructor(private config: any) {}
  
  async run(models: any, datasets: any, options?: any): Promise<BenchmarkResult> {
    return {
      benchmark: 'model_accuracy',
      models: Object.keys(models),
      status: 'completed',
      timestamp: Date.now(),
      modelResults: {}
    };
  }
}

class TrainingEfficiencyBenchmark implements BenchmarkRunner {
  constructor(private config: any) {}
  
  async run(models: any, datasets: any, options?: any): Promise<BenchmarkResult> {
    return {
      benchmark: 'training_efficiency',
      models: Object.keys(models),
      status: 'completed',
      timestamp: Date.now(),
      modelResults: {}
    };
  }
}

class InferenceSpeedBenchmark implements BenchmarkRunner {
  constructor(private config: any) {}
  
  async run(models: any, datasets: any, options?: any): Promise<BenchmarkResult> {
    return {
      benchmark: 'inference_speed',
      models: Object.keys(models),
      status: 'completed',
      timestamp: Date.now(),
      modelResults: {}
    };
  }
}

class MemoryUsageBenchmark implements BenchmarkRunner {
  constructor(private config: any) {}
  
  async run(models: any, datasets: any, options?: any): Promise<BenchmarkResult> {
    return {
      benchmark: 'memory_usage',
      models: Object.keys(models),
      status: 'completed',
      timestamp: Date.now(),
      modelResults: {}
    };
  }
}

class ScalabilityBenchmark implements BenchmarkRunner {
  constructor(private config: any) {}
  
  async run(models: any, datasets: any, options?: any): Promise<BenchmarkResult> {
    return {
      benchmark: 'scalability',
      models: Object.keys(models),
      status: 'completed',
      timestamp: Date.now(),
      modelResults: {}
    };
  }
}

class RobustnessBenchmark implements BenchmarkRunner {
  constructor(private config: any) {}
  
  async run(models: any, datasets: any, options?: any): Promise<BenchmarkResult> {
    return {
      benchmark: 'robustness',
      models: Object.keys(models),
      status: 'completed',
      timestamp: Date.now(),
      modelResults: {}
    };
  }
}

class FairnessBenchmark implements BenchmarkRunner {
  constructor(private config: any) {}
  
  async run(models: any, datasets: any, options?: any): Promise<BenchmarkResult> {
    return {
      benchmark: 'fairness',
      models: Object.keys(models),
      status: 'completed',
      timestamp: Date.now(),
      modelResults: {}
    };
  }
}

class InterpretabilityBenchmark implements BenchmarkRunner {
  constructor(private config: any) {}
  
  async run(models: any, datasets: any, options?: any): Promise<BenchmarkResult> {
    return {
      benchmark: 'interpretability',
      models: Object.keys(models),
      status: 'completed',
      timestamp: Date.now(),
      modelResults: {}
    };
  }
}

// Type definitions
export interface BenchmarkSuiteConfig {
  enabledBenchmarks: string[];
  parallelExecution: boolean;
  maxConcurrentBenchmarks: number;
  timeout: number;
  reportFormat: 'summary' | 'detailed' | 'comprehensive';
  saveResults: boolean;
  resultsPath: string;
  compareBaselines: boolean;
  generateRecommendations: boolean;
}

export interface BenchmarkDatasets {
  training?: { features: tf.Tensor; labels: tf.Tensor };
  validation?: { features: tf.Tensor; labels: tf.Tensor };
  test?: { features: tf.Tensor; labels: tf.Tensor };
}

export interface BenchmarkOptions {
  timeout?: number;
  enableProfiling?: boolean;
  saveIntermediate?: boolean;
  [key: string]: any;
}

export interface BenchmarkRunner {
  run(
    models: { [name: string]: tf.LayersModel },
    datasets: BenchmarkDatasets,
    options?: BenchmarkOptions
  ): Promise<BenchmarkResult>;
}

export interface BenchmarkResult {
  benchmark: string;
  models: string[];
  status: 'completed' | 'failed' | 'timeout';
  timestamp: number;
  duration?: number;
  modelResults?: { [model: string]: any };
  error?: string;
}

export interface BenchmarkRun {
  id: string;
  startTime: number;
  models: string[];
  status: 'running' | 'completed' | 'failed';
  progress: number;
  completedBenchmarks: string[];
  results: { [benchmark: string]: BenchmarkResult };
}

export interface BenchmarkSuiteResult {
  runId: string;
  timestamp: number;
  report: ComprehensiveBenchmarkReport;
}

export interface ComprehensiveBenchmarkReport {
  runId: string;
  timestamp: number;
  duration: number;
  models: string[];
  benchmarks: string[];
  results: { [benchmark: string]: BenchmarkResult };
  analysis: BenchmarkAnalysis;
  recommendations: Recommendation[];
  metadata: {
    config: BenchmarkSuiteConfig;
    environment: any;
    datasets: any;
  };
}

export interface BenchmarkAnalysis {
  summary: BenchmarkSummary;
  comparisons: ModelComparison[];
  rankings: ModelRanking[];
  correlations: CorrelationMatrix;
  anomalies: Anomaly[];
  trends: TrendAnalysis;
  statisticalSignificance: StatisticalSignificance;
}

export interface BenchmarkSummary {
  totalBenchmarks: number;
  completedBenchmarks: number;
  failedBenchmarks: number;
  successRate: number;
  modelPerformance: { [model: string]: any };
  overallWinner: string;
  keyFindings: string[];
}

export interface ModelComparison {
  modelA: string;
  modelB: string;
  winner: string;
  metrics: { [metric: string]: { a: number; b: number; difference: number } };
  significance: number;
}

export interface ModelRanking {
  benchmark: string;
  rankings: Array<{ model: string; score: number; rank: number }>;
  metric: string;
}

export interface CorrelationMatrix {
  metrics: string[];
  correlations: { [metric1: string]: { [metric2: string]: number } };
  strongCorrelations: Array<{ metric1: string; metric2: string; correlation: number }>;
  insights: string[];
}

export interface Anomaly {
  type: 'performance' | 'efficiency' | 'memory' | 'fairness';
  severity: 'low' | 'medium' | 'high';
  model: string;
  benchmark: string;
  description: string;
  value: number;
  expectedRange: [number, number];
}

export interface TrendAnalysis {
  performanceTrends: any;
  efficiencyTrends: any;
  scalabilityTrends: any;
  recommendations: string[];
}

export interface StatisticalSignificance {
  pValues: { [comparison: string]: number };
  confidenceIntervals: { [metric: string]: [number, number] };
  effectSizes: { [comparison: string]: number };
  significantDifferences: { [comparison: string]: boolean };
}

export interface Recommendation {
  type: 'performance' | 'efficiency' | 'scalability' | 'fairness' | 'interpretability';
  priority: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  actions: string[];
}

/**
 * Factory function to create comprehensive benchmark suite
 */
export function createComprehensiveBenchmarkSuite(
  config?: Partial<BenchmarkSuiteConfig>
): ComprehensiveBenchmarkSuite {
  return new ComprehensiveBenchmarkSuite(config);
}