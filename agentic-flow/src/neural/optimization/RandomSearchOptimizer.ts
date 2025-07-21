import { EventEmitter } from 'events';
import { logger } from '../../utils/logger';

/**
 * Random Search Hyperparameter Optimizer with Early Stopping
 * More efficient than grid search for high-dimensional spaces
 */
export class RandomSearchOptimizer extends EventEmitter {
  private readonly config: RandomSearchConfig;
  private searchSpace: RandomSearchSpace;
  private results: RandomSearchResult[] = [];
  private bestResult: RandomSearchResult | null = null;
  private currentIteration: number = 0;
  private patienceCounter: number = 0;
  private lastBestScore: number = -Infinity;

  constructor(
    searchSpace: RandomSearchSpace,
    config: Partial<RandomSearchConfig> = {}
  ) {
    super();
    
    this.searchSpace = searchSpace;
    this.config = {
      maxIterations: 100,
      maxParallelJobs: 4,
      timeout: 300000,
      verbose: true,
      earlyStoppingPatience: 15,
      minImprovementThreshold: 0.001,
      crossValidationFolds: 3,
      randomSeed: Date.now(),
      scoringMetric: 'accuracy',
      adaptiveSearch: true,
      explorationDecay: 0.95,
      initialExplorationRatio: 0.3,
      ...config
    };

    // Set random seed for reproducibility
    this.setSeed(this.config.randomSeed);
  }

  /**
   * Execute random search optimization
   */
  public async optimize(
    objectiveFunction: (params: any) => Promise<number | EvaluationResult>
  ): Promise<RandomSearchResult> {
    try {
      logger.info(`Starting random search with max ${this.config.maxIterations} iterations`);
      this.emit('searchStart', { maxIterations: this.config.maxIterations });

      this.currentIteration = 0;
      this.patienceCounter = 0;
      this.lastBestScore = -Infinity;

      // Execute search
      await this.executeRandomSearch(objectiveFunction);

      // Ensure we have a best result
      if (!this.bestResult) {
        this.findBestResult();
      }

      this.emit('searchComplete', {
        bestResult: this.bestResult,
        totalEvaluations: this.results.length,
        searchTime: this.calculateSearchTime(),
        converged: this.patienceCounter >= this.config.earlyStoppingPatience
      });

      return this.bestResult!;

    } catch (error) {
      logger.error('Random search optimization failed:', error);
      this.emit('searchError', error);
      throw error;
    }
  }

  /**
   * Execute random search with adaptive sampling
   */
  private async executeRandomSearch(
    objectiveFunction: (params: any) => Promise<number | EvaluationResult>
  ): Promise<void> {
    const batchSize = this.config.maxParallelJobs;
    let explorationRatio = this.config.initialExplorationRatio;

    while (this.currentIteration < this.config.maxIterations) {
      // Check early stopping
      if (this.patienceCounter >= this.config.earlyStoppingPatience) {
        logger.info(`Early stopping triggered at iteration ${this.currentIteration}`);
        break;
      }

      // Generate batch of parameters
      const parameterBatch = this.generateParameterBatch(batchSize, explorationRatio);

      // Evaluate batch in parallel
      const batchPromises = parameterBatch.map(async (params, index) => {
        try {
          return await this.evaluateParameters(params, objectiveFunction, this.currentIteration + index);
        } catch (error) {
          logger.warn(`Failed to evaluate parameters at iteration ${this.currentIteration + index}:`, error);
          return null;
        }
      });

      const batchResults = await Promise.allSettled(batchPromises);

      // Process results
      let improvementFound = false;
      for (const promiseResult of batchResults) {
        if (promiseResult.status === 'fulfilled' && promiseResult.value) {
          this.results.push(promiseResult.value);
          const wasImprovement = this.updateBestResult(promiseResult.value);
          if (wasImprovement) {
            improvementFound = true;
          }
        }
      }

      // Update exploration ratio (decay over time)
      if (this.config.adaptiveSearch) {
        explorationRatio *= this.config.explorationDecay;
      }

      // Update patience counter
      if (!improvementFound) {
        this.patienceCounter++;
      } else {
        this.patienceCounter = 0;
      }

      this.currentIteration += batchSize;

      // Progress reporting
      this.emit('progress', {
        iteration: this.currentIteration,
        maxIterations: this.config.maxIterations,
        bestScore: this.bestResult?.score || 0,
        patienceCounter: this.patienceCounter,
        explorationRatio: explorationRatio
      });

      // Adaptive batch size based on improvement rate
      if (this.config.adaptiveSearch && this.currentIteration > 50) {
        // Increase batch size if not improving
        if (this.patienceCounter > 5) {
          // Keep current batch size or could implement adaptive logic
        }
      }
    }
  }

  /**
   * Generate batch of parameters with adaptive sampling
   */
  private generateParameterBatch(batchSize: number, explorationRatio: number): any[] {
    const batch: any[] = [];

    for (let i = 0; i < batchSize; i++) {
      let params: any;

      if (this.config.adaptiveSearch && this.bestResult && Math.random() > explorationRatio) {
        // Exploitation: sample around best known parameters
        params = this.generateParamsAroundBest();
      } else {
        // Exploration: pure random sampling
        params = this.generateRandomParams();
      }

      batch.push(params);
    }

    return batch;
  }

  /**
   * Generate random parameters from search space
   */
  private generateRandomParams(): any {
    const params: any = {};

    for (const [paramName, space] of Object.entries(this.searchSpace)) {
      params[paramName] = this.sampleFromSpace(space);
    }

    return params;
  }

  /**
   * Generate parameters around best known solution
   */
  private generateParamsAroundBest(): any {
    if (!this.bestResult) {
      return this.generateRandomParams();
    }

    const params: any = {};
    const bestParams = this.bestResult.parameters;

    for (const [paramName, space] of Object.entries(this.searchSpace)) {
      const bestValue = bestParams[paramName];
      
      if (space.type === 'continuous') {
        // Add noise around best value
        const noiseScale = (space.bounds[1] - space.bounds[0]) * 0.1; // 10% of range
        const noise = (Math.random() - 0.5) * 2 * noiseScale;
        let newValue = bestValue + noise;
        
        // Ensure bounds
        newValue = Math.max(space.bounds[0], Math.min(space.bounds[1], newValue));
        
        if (space.scale === 'log') {
          newValue = Math.exp(newValue);
        }
        
        params[paramName] = space.transform ? space.transform(newValue) : newValue;
      } else {
        // For discrete/categorical, occasionally use random, otherwise keep best
        if (Math.random() < 0.3) {
          params[paramName] = this.sampleFromSpace(space);
        } else {
          params[paramName] = bestValue;
        }
      }
    }

    return params;
  }

  /**
   * Sample value from parameter space
   */
  private sampleFromSpace(space: ParameterSpace): any {
    switch (space.type) {
      case 'continuous':
        let value = Math.random() * (space.bounds[1] - space.bounds[0]) + space.bounds[0];
        if (space.scale === 'log') {
          value = Math.exp(value);
        }
        return space.transform ? space.transform(value) : value;

      case 'discrete':
        const index = Math.floor(Math.random() * space.values.length);
        return space.values[index];

      case 'categorical':
        const catIndex = Math.floor(Math.random() * space.values.length);
        return space.values[catIndex];

      case 'integer':
        return Math.floor(Math.random() * (space.bounds[1] - space.bounds[0] + 1)) + space.bounds[0];

      default:
        throw new Error(`Unknown parameter type: ${space.type}`);
    }
  }

  /**
   * Evaluate parameters with cross-validation
   */
  private async evaluateParameters(
    params: any,
    objectiveFunction: (params: any) => Promise<number | EvaluationResult>,
    iteration: number
  ): Promise<RandomSearchResult> {
    const startTime = Date.now();

    try {
      if (this.config.verbose && iteration % 10 === 0) {
        logger.info(`Evaluating parameters at iteration ${iteration}`);
      }

      let evaluationResult: EvaluationResult;

      // Perform cross-validation if enabled
      if (this.config.crossValidationFolds > 1) {
        evaluationResult = await this.performCrossValidation(params, objectiveFunction);
      } else {
        const result = await objectiveFunction(params);
        evaluationResult = typeof result === 'number'
          ? { score: result, metrics: {}, foldScores: [result] }
          : result;
      }

      const evaluationTime = Date.now() - startTime;

      const searchResult: RandomSearchResult = {
        parameters: { ...params },
        score: evaluationResult.score,
        metrics: evaluationResult.metrics || {},
        evaluationTime,
        iteration,
        crossValidationScores: evaluationResult.foldScores || [evaluationResult.score],
        standardDeviation: this.calculateStandardDeviation(
          evaluationResult.foldScores || [evaluationResult.score]
        ),
        timestamp: new Date().toISOString(),
        samplingMethod: this.determineSamplingMethod(params)
      };

      this.emit('evaluation', searchResult);
      return searchResult;

    } catch (error) {
      logger.error(`Error evaluating parameters:`, error);
      throw error;
    }
  }

  /**
   * Perform cross-validation
   */
  private async performCrossValidation(
    params: any,
    objectiveFunction: (params: any) => Promise<number | EvaluationResult>
  ): Promise<EvaluationResult> {
    const foldScores: number[] = [];
    const foldMetrics: any[] = [];

    for (let fold = 0; fold < this.config.crossValidationFolds; fold++) {
      const foldParams = { ...params, _fold: fold, _totalFolds: this.config.crossValidationFolds };
      const result = await objectiveFunction(foldParams);

      if (typeof result === 'number') {
        foldScores.push(result);
        foldMetrics.push({});
      } else {
        foldScores.push(result.score);
        foldMetrics.push(result.metrics || {});
      }
    }

    const meanScore = foldScores.reduce((sum, score) => sum + score, 0) / foldScores.length;
    const combinedMetrics = this.combineMetrics(foldMetrics);

    return {
      score: meanScore,
      metrics: combinedMetrics,
      foldScores
    };
  }

  /**
   * Combine metrics from multiple folds
   */
  private combineMetrics(foldMetrics: any[]): any {
    if (foldMetrics.length === 0) return {};

    const combined: any = {};
    const allKeys = new Set(foldMetrics.flatMap(metrics => Object.keys(metrics)));

    for (const key of allKeys) {
      const values = foldMetrics
        .map(metrics => metrics[key])
        .filter(value => value !== undefined && typeof value === 'number');

      if (values.length > 0) {
        combined[key] = values.reduce((sum, value) => sum + value, 0) / values.length;
        combined[`${key}_std`] = this.calculateStandardDeviation(values);
      }
    }

    return combined;
  }

  /**
   * Calculate standard deviation
   */
  private calculateStandardDeviation(values: number[]): number {
    if (values.length < 2) return 0;

    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const squaredDiffs = values.map(value => Math.pow(value - mean, 2));
    const variance = squaredDiffs.reduce((sum, diff) => sum + diff, 0) / (values.length - 1);

    return Math.sqrt(variance);
  }

  /**
   * Update best result
   */
  private updateBestResult(result: RandomSearchResult): boolean {
    const isImprovement = !this.bestResult || 
      result.score > this.bestResult.score + this.config.minImprovementThreshold;

    if (isImprovement) {
      this.bestResult = result;
      this.lastBestScore = result.score;

      if (this.config.verbose) {
        logger.info(`New best score: ${result.score.toFixed(6)} at iteration ${result.iteration}`);
      }

      this.emit('newBest', result);
      return true;
    }

    return false;
  }

  /**
   * Find best result from all evaluations
   */
  private findBestResult(): void {
    if (this.results.length === 0) {
      throw new Error('No valid results found during random search');
    }

    this.bestResult = this.results.reduce((best, current) =>
      current.score > best.score ? current : best
    );
  }

  /**
   * Determine sampling method used
   */
  private determineSamplingMethod(params: any): 'exploration' | 'exploitation' {
    // This is a simplified heuristic
    return this.bestResult && this.currentIteration > 20 ? 'exploitation' : 'exploration';
  }

  /**
   * Set random seed
   */
  private setSeed(seed: number): void {
    // Simple seeded random number generator
    let s = seed;
    Math.random = () => {
      s = Math.sin(s) * 10000;
      return s - Math.floor(s);
    };
  }

  /**
   * Calculate search time
   */
  private calculateSearchTime(): number {
    if (this.results.length === 0) return 0;
    return this.results.reduce((total, result) => total + result.evaluationTime, 0);
  }

  /**
   * Get optimization analytics
   */
  public getAnalytics(): RandomSearchAnalytics {
    const scores = this.results.map(r => r.score);
    const times = this.results.map(r => r.evaluationTime);

    return {
      totalEvaluations: this.results.length,
      bestScore: this.bestResult?.score || 0,
      averageScore: scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0,
      scoreStandardDeviation: this.calculateStandardDeviation(scores),
      averageEvaluationTime: times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0,
      totalSearchTime: this.calculateSearchTime(),
      convergenceAnalysis: this.analyzeConvergence(),
      parameterImportance: this.analyzeParameterImportance(),
      explorationEfficiency: this.calculateExplorationEfficiency(),
      topResults: this.getTopResults(10)
    };
  }

  /**
   * Analyze convergence
   */
  private analyzeConvergence(): ConvergenceAnalysis {
    const scores = this.results.map(r => r.score);
    const bestScores: number[] = [];
    let currentBest = -Infinity;

    for (const score of scores) {
      if (score > currentBest) {
        currentBest = score;
      }
      bestScores.push(currentBest);
    }

    const improvements = bestScores.slice(1).map((score, i) => score - bestScores[i]);
    const significantImprovements = improvements.filter(imp => imp > this.config.minImprovementThreshold);

    return {
      convergenceRate: significantImprovements.length / bestScores.length,
      finalImprovement: bestScores[bestScores.length - 1] - bestScores[0],
      plateauLength: this.calculatePlateauLength(bestScores),
      hasConverged: this.patienceCounter >= this.config.earlyStoppingPatience
    };
  }

  /**
   * Calculate plateau length
   */
  private calculatePlateauLength(bestScores: number[]): number {
    let plateauLength = 0;
    for (let i = bestScores.length - 1; i > 0; i--) {
      if (Math.abs(bestScores[i] - bestScores[i - 1]) < this.config.minImprovementThreshold) {
        plateauLength++;
      } else {
        break;
      }
    }
    return plateauLength;
  }

  /**
   * Analyze parameter importance
   */
  private analyzeParameterImportance(): { [key: string]: number } {
    const importance: { [key: string]: number } = {};
    const parameterNames = Object.keys(this.searchSpace);

    for (const paramName of parameterNames) {
      const paramValues = this.results.map(r => r.parameters[paramName]);
      const scores = this.results.map(r => r.score);

      importance[paramName] = this.calculateCorrelation(paramValues, scores);
    }

    return importance;
  }

  /**
   * Calculate correlation coefficient
   */
  private calculateCorrelation(x: any[], y: number[]): number {
    const numericX = x.map((val, idx) => {
      if (typeof val === 'number') return val;
      if (typeof val === 'string') return x.indexOf(val);
      return idx;
    });

    const n = numericX.length;
    const meanX = numericX.reduce((a, b) => a + b, 0) / n;
    const meanY = y.reduce((a, b) => a + b, 0) / n;

    let numerator = 0;
    let denomX = 0;
    let denomY = 0;

    for (let i = 0; i < n; i++) {
      const diffX = numericX[i] - meanX;
      const diffY = y[i] - meanY;
      numerator += diffX * diffY;
      denomX += diffX * diffX;
      denomY += diffY * diffY;
    }

    if (denomX === 0 || denomY === 0) return 0;
    return Math.abs(numerator / Math.sqrt(denomX * denomY));
  }

  /**
   * Calculate exploration efficiency
   */
  private calculateExplorationEfficiency(): number {
    if (this.results.length === 0) return 0;

    // Measure how well we're exploring the parameter space
    const uniqueParams = new Set(this.results.map(r => JSON.stringify(r.parameters)));
    const diversityScore = uniqueParams.size / this.results.length;

    // Measure improvement rate
    const scores = this.results.map(r => r.score);
    const improvementRate = (Math.max(...scores) - Math.min(...scores)) / Math.max(...scores);

    return (diversityScore + improvementRate) / 2;
  }

  /**
   * Get top results
   */
  private getTopResults(count: number): RandomSearchResult[] {
    return this.results
      .sort((a, b) => b.score - a.score)
      .slice(0, count);
  }

  /**
   * Get all results
   */
  public getResults(): RandomSearchResult[] {
    return [...this.results];
  }

  /**
   * Get best result
   */
  public getBestResult(): RandomSearchResult | null {
    return this.bestResult;
  }

  /**
   * Export results
   */
  public exportResults(): RandomSearchExport {
    return {
      config: this.config,
      searchSpace: this.searchSpace,
      results: this.results,
      bestResult: this.bestResult,
      analytics: this.getAnalytics(),
      timestamp: new Date().toISOString()
    };
  }
}

// Type definitions
export interface RandomSearchSpace {
  [parameterName: string]: ParameterSpace;
}

export interface ParameterSpace {
  type: 'continuous' | 'discrete' | 'categorical' | 'integer';
  bounds?: [number, number];
  values?: any[];
  scale?: 'linear' | 'log';
  transform?: (value: any) => any;
}

export interface RandomSearchConfig {
  maxIterations: number;
  maxParallelJobs: number;
  timeout: number;
  verbose: boolean;
  earlyStoppingPatience: number;
  minImprovementThreshold: number;
  crossValidationFolds: number;
  randomSeed: number;
  scoringMetric: string;
  adaptiveSearch: boolean;
  explorationDecay: number;
  initialExplorationRatio: number;
}

export interface RandomSearchResult {
  parameters: any;
  score: number;
  metrics: any;
  evaluationTime: number;
  iteration: number;
  crossValidationScores: number[];
  standardDeviation: number;
  timestamp: string;
  samplingMethod: 'exploration' | 'exploitation';
}

export interface EvaluationResult {
  score: number;
  metrics?: any;
  foldScores?: number[];
}

export interface RandomSearchAnalytics {
  totalEvaluations: number;
  bestScore: number;
  averageScore: number;
  scoreStandardDeviation: number;
  averageEvaluationTime: number;
  totalSearchTime: number;
  convergenceAnalysis: ConvergenceAnalysis;
  parameterImportance: { [key: string]: number };
  explorationEfficiency: number;
  topResults: RandomSearchResult[];
}

export interface ConvergenceAnalysis {
  convergenceRate: number;
  finalImprovement: number;
  plateauLength: number;
  hasConverged: boolean;
}

export interface RandomSearchExport {
  config: RandomSearchConfig;
  searchSpace: RandomSearchSpace;
  results: RandomSearchResult[];
  bestResult: RandomSearchResult | null;
  analytics: RandomSearchAnalytics;
  timestamp: string;
}

/**
 * Factory function to create random search optimizer
 */
export function createRandomSearchOptimizer(
  searchSpace: RandomSearchSpace,
  config?: Partial<RandomSearchConfig>
): RandomSearchOptimizer {
  return new RandomSearchOptimizer(searchSpace, config);
}

/**
 * Utility function to create search space from ranges
 */
export function createRandomSearchSpace(ranges: {
  [key: string]: {
    min: number;
    max: number;
    type?: 'continuous' | 'integer';
    scale?: 'linear' | 'log';
  } | any[];
}): RandomSearchSpace {
  const space: RandomSearchSpace = {};

  for (const [paramName, range] of Object.entries(ranges)) {
    if (Array.isArray(range)) {
      space[paramName] = {
        type: 'categorical',
        values: range
      };
    } else {
      const { min, max, type = 'continuous', scale = 'linear' } = range;
      
      space[paramName] = {
        type,
        bounds: [min, max],
        scale
      };
    }
  }

  return space;
}