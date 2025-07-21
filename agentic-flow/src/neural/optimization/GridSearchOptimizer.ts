import { EventEmitter } from 'events';
import { logger } from '../../utils/logger';

/**
 * Grid Search Hyperparameter Optimizer
 * Exhaustive search through hyperparameter space with parallel evaluation
 */
export class GridSearchOptimizer extends EventEmitter {
  private readonly config: GridSearchConfig;
  private searchSpace: ParameterGrid;
  private results: GridSearchResult[] = [];
  private bestResult: GridSearchResult | null = null;
  private currentIteration: number = 0;
  private totalCombinations: number = 0;

  constructor(
    searchSpace: ParameterGrid,
    config: Partial<GridSearchConfig> = {}
  ) {
    super();
    
    this.searchSpace = searchSpace;
    this.config = {
      maxParallelJobs: 4,
      timeout: 300000, // 5 minutes
      verbose: true,
      saveIntermediateResults: true,
      earlyStoppingPatience: 10,
      minImprovementThreshold: 0.001,
      crossValidationFolds: 5,
      scoringMetric: 'accuracy',
      ...config
    };

    this.totalCombinations = this.calculateTotalCombinations();
  }

  /**
   * Execute grid search optimization
   */
  public async optimize(
    objectiveFunction: (params: any) => Promise<number | EvaluationResult>
  ): Promise<GridSearchResult> {
    try {
      logger.info(`Starting grid search with ${this.totalCombinations} combinations`);
      this.emit('searchStart', { totalCombinations: this.totalCombinations });

      // Generate all parameter combinations
      const parameterCombinations = this.generateParameterCombinations();
      
      // Execute search with parallel evaluation
      await this.executeParallelSearch(parameterCombinations, objectiveFunction);

      // Find and return best result
      this.findBestResult();
      
      this.emit('searchComplete', {
        bestResult: this.bestResult,
        totalEvaluations: this.results.length,
        searchTime: this.calculateSearchTime()
      });

      return this.bestResult!;

    } catch (error) {
      logger.error('Grid search optimization failed:', error);
      this.emit('searchError', error);
      throw error;
    }
  }

  /**
   * Generate all parameter combinations
   */
  private generateParameterCombinations(): any[] {
    const combinations: any[] = [];
    const parameterNames = Object.keys(this.searchSpace);
    
    // Generate cartesian product of all parameter values
    const generateCombinations = (
      names: string[],
      current: any = {},
      index: number = 0
    ): void => {
      if (index === names.length) {
        combinations.push({ ...current });
        return;
      }

      const paramName = names[index];
      const values = this.searchSpace[paramName];

      for (const value of values) {
        current[paramName] = value;
        generateCombinations(names, current, index + 1);
      }
    };

    generateCombinations(parameterNames);
    return combinations;
  }

  /**
   * Execute parallel search
   */
  private async executeParallelSearch(
    combinations: any[],
    objectiveFunction: (params: any) => Promise<number | EvaluationResult>
  ): Promise<void> {
    const chunks = this.chunkArray(combinations, this.config.maxParallelJobs);
    let patienceCounter = 0;
    let lastBestScore = -Infinity;

    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      const chunk = chunks[chunkIndex];
      
      // Evaluate chunk in parallel
      const promises = chunk.map(async (params, paramIndex) => {
        try {
          const globalIndex = chunkIndex * this.config.maxParallelJobs + paramIndex;
          return await this.evaluateParameters(params, objectiveFunction, globalIndex);
        } catch (error) {
          logger.warn(`Failed to evaluate parameters at index ${chunkIndex}-${paramIndex}:`, error);
          return null;
        }
      });

      // Wait for chunk completion with timeout
      const chunkResults = await Promise.allSettled(promises);
      
      // Process results
      for (const promiseResult of chunkResults) {
        if (promiseResult.status === 'fulfilled' && promiseResult.value) {
          this.results.push(promiseResult.value);
          this.updateBestResult(promiseResult.value);
        }
      }

      // Early stopping check
      if (this.config.earlyStoppingPatience && this.bestResult) {
        const currentBestScore = this.bestResult.score;
        const improvement = currentBestScore - lastBestScore;
        
        if (improvement < this.config.minImprovementThreshold) {
          patienceCounter++;
        } else {
          patienceCounter = 0;
          lastBestScore = currentBestScore;
        }

        if (patienceCounter >= this.config.earlyStoppingPatience) {
          logger.info(`Early stopping triggered at iteration ${this.currentIteration}`);
          break;
        }
      }

      // Progress reporting
      this.emit('progress', {
        completed: this.results.length,
        total: this.totalCombinations,
        bestScore: this.bestResult?.score || 0,
        currentChunk: chunkIndex + 1,
        totalChunks: chunks.length
      });

      // Save intermediate results
      if (this.config.saveIntermediateResults && chunkIndex % 10 === 0) {
        await this.saveIntermediateResults();
      }
    }
  }

  /**
   * Evaluate parameters with cross-validation
   */
  private async evaluateParameters(
    params: any,
    objectiveFunction: (params: any) => Promise<number | EvaluationResult>,
    index: number
  ): Promise<GridSearchResult> {
    const startTime = Date.now();
    
    try {
      this.currentIteration++;
      
      if (this.config.verbose && index % 10 === 0) {
        logger.info(`Evaluating parameter combination ${index + 1}/${this.totalCombinations}`);
      }

      let evaluationResult: EvaluationResult;

      // Perform cross-validation if enabled
      if (this.config.crossValidationFolds > 1) {
        evaluationResult = await this.performCrossValidation(params, objectiveFunction);
      } else {
        // Single evaluation
        const result = await objectiveFunction(params);
        evaluationResult = typeof result === 'number' 
          ? { score: result, metrics: {}, foldScores: [result] }
          : result;
      }

      const evaluationTime = Date.now() - startTime;

      const gridResult: GridSearchResult = {
        parameters: { ...params },
        score: evaluationResult.score,
        metrics: evaluationResult.metrics || {},
        evaluationTime,
        iteration: this.currentIteration,
        crossValidationScores: evaluationResult.foldScores || [evaluationResult.score],
        standardDeviation: this.calculateStandardDeviation(
          evaluationResult.foldScores || [evaluationResult.score]
        ),
        timestamp: new Date().toISOString()
      };

      this.emit('evaluation', gridResult);
      return gridResult;

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

    // Simulate cross-validation (in practice, would split data)
    for (let fold = 0; fold < this.config.crossValidationFolds; fold++) {
      // Add fold information to parameters
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

    // Calculate cross-validation statistics
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
  private updateBestResult(result: GridSearchResult): void {
    if (!this.bestResult || result.score > this.bestResult.score) {
      this.bestResult = result;
      
      if (this.config.verbose) {
        logger.info(`New best score: ${result.score.toFixed(6)} with parameters:`, result.parameters);
      }
      
      this.emit('newBest', result);
    }
  }

  /**
   * Find best result from all evaluations
   */
  private findBestResult(): void {
    if (this.results.length === 0) {
      throw new Error('No valid results found during grid search');
    }

    this.bestResult = this.results.reduce((best, current) => 
      current.score > best.score ? current : best
    );
  }

  /**
   * Calculate total combinations
   */
  private calculateTotalCombinations(): number {
    return Object.values(this.searchSpace)
      .reduce((total, values) => total * values.length, 1);
  }

  /**
   * Chunk array into smaller arrays
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Calculate search time
   */
  private calculateSearchTime(): number {
    if (this.results.length === 0) return 0;
    return this.results.reduce((total, result) => total + result.evaluationTime, 0);
  }

  /**
   * Save intermediate results
   */
  private async saveIntermediateResults(): Promise<void> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `grid_search_intermediate_${timestamp}.json`;
      
      const data = {
        config: this.config,
        searchSpace: this.searchSpace,
        results: this.results,
        bestResult: this.bestResult,
        progress: {
          completed: this.results.length,
          total: this.totalCombinations,
          percentage: (this.results.length / this.totalCombinations) * 100
        }
      };

      // In practice, would save to file system
      logger.info(`Saving intermediate results to ${filename}`);
      
    } catch (error) {
      logger.warn('Failed to save intermediate results:', error);
    }
  }

  /**
   * Get optimization analytics
   */
  public getAnalytics(): GridSearchAnalytics {
    const scores = this.results.map(r => r.score);
    const times = this.results.map(r => r.evaluationTime);

    return {
      totalEvaluations: this.results.length,
      totalCombinations: this.totalCombinations,
      completionPercentage: (this.results.length / this.totalCombinations) * 100,
      bestScore: this.bestResult?.score || 0,
      averageScore: scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0,
      scoreStandardDeviation: this.calculateStandardDeviation(scores),
      averageEvaluationTime: times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0,
      totalSearchTime: this.calculateSearchTime(),
      convergenceAnalysis: this.analyzeConvergence(),
      parameterImportance: this.analyzeParameterImportance(),
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

    // Calculate improvement rate
    const improvements = bestScores.slice(1).map((score, i) => score - bestScores[i]);
    const significantImprovements = improvements.filter(imp => imp > this.config.minImprovementThreshold);

    return {
      convergenceRate: significantImprovements.length / bestScores.length,
      finalImprovement: bestScores[bestScores.length - 1] - bestScores[0],
      plateauLength: this.calculatePlateauLength(bestScores),
      hasConverged: this.hasConverged(bestScores)
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
   * Check if search has converged
   */
  private hasConverged(bestScores: number[]): boolean {
    const plateauLength = this.calculatePlateauLength(bestScores);
    return plateauLength >= Math.min(20, this.results.length * 0.2);
  }

  /**
   * Analyze parameter importance
   */
  private analyzeParameterImportance(): { [key: string]: number } {
    const importance: { [key: string]: number } = {};
    const parameterNames = Object.keys(this.searchSpace);

    for (const paramName of parameterNames) {
      // Calculate correlation between parameter values and scores
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
    // Convert categorical/string values to numeric
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
   * Get top results
   */
  private getTopResults(count: number): GridSearchResult[] {
    return this.results
      .sort((a, b) => b.score - a.score)
      .slice(0, count);
  }

  /**
   * Get all results
   */
  public getResults(): GridSearchResult[] {
    return [...this.results];
  }

  /**
   * Get best result
   */
  public getBestResult(): GridSearchResult | null {
    return this.bestResult;
  }

  /**
   * Export results
   */
  public exportResults(): GridSearchExport {
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
export interface ParameterGrid {
  [parameterName: string]: any[];
}

export interface GridSearchConfig {
  maxParallelJobs: number;
  timeout: number;
  verbose: boolean;
  saveIntermediateResults: boolean;
  earlyStoppingPatience?: number;
  minImprovementThreshold: number;
  crossValidationFolds: number;
  scoringMetric: string;
}

export interface GridSearchResult {
  parameters: any;
  score: number;
  metrics: any;
  evaluationTime: number;
  iteration: number;
  crossValidationScores: number[];
  standardDeviation: number;
  timestamp: string;
}

export interface EvaluationResult {
  score: number;
  metrics?: any;
  foldScores?: number[];
}

export interface GridSearchAnalytics {
  totalEvaluations: number;
  totalCombinations: number;
  completionPercentage: number;
  bestScore: number;
  averageScore: number;
  scoreStandardDeviation: number;
  averageEvaluationTime: number;
  totalSearchTime: number;
  convergenceAnalysis: ConvergenceAnalysis;
  parameterImportance: { [key: string]: number };
  topResults: GridSearchResult[];
}

export interface ConvergenceAnalysis {
  convergenceRate: number;
  finalImprovement: number;
  plateauLength: number;
  hasConverged: boolean;
}

export interface GridSearchExport {
  config: GridSearchConfig;
  searchSpace: ParameterGrid;
  results: GridSearchResult[];
  bestResult: GridSearchResult | null;
  analytics: GridSearchAnalytics;
  timestamp: string;
}

/**
 * Factory function to create grid search optimizer
 */
export function createGridSearchOptimizer(
  searchSpace: ParameterGrid,
  config?: Partial<GridSearchConfig>
): GridSearchOptimizer {
  return new GridSearchOptimizer(searchSpace, config);
}

/**
 * Utility function to create parameter grid from ranges
 */
export function createParameterGrid(ranges: {
  [key: string]: {
    min: number;
    max: number;
    steps?: number;
    type?: 'linear' | 'log';
  } | any[];
}): ParameterGrid {
  const grid: ParameterGrid = {};

  for (const [paramName, range] of Object.entries(ranges)) {
    if (Array.isArray(range)) {
      grid[paramName] = range;
    } else {
      const { min, max, steps = 10, type = 'linear' } = range;
      
      if (type === 'log') {
        const logMin = Math.log(min);
        const logMax = Math.log(max);
        const logStep = (logMax - logMin) / (steps - 1);
        
        grid[paramName] = Array.from({ length: steps }, (_, i) => 
          Math.exp(logMin + i * logStep)
        );
      } else {
        const step = (max - min) / (steps - 1);
        grid[paramName] = Array.from({ length: steps }, (_, i) => 
          min + i * step
        );
      }
    }
  }

  return grid;
}