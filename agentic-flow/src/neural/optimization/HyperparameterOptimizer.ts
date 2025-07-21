import * as tf from '@tensorflow/tfjs-node';
import { logger } from '../../utils/logger';

/**
 * Hyperparameter optimization using Bayesian optimization and random search
 * Supports optimization for neural network models with multiple objectives
 */
export class HyperparameterOptimizer {
  private trials: OptimizationTrial[] = [];
  private readonly config: HyperparameterOptimizerConfig;
  private bestTrial: OptimizationTrial | null = null;
  private acquisitionHistory: AcquisitionPoint[] = [];

  constructor(config: HyperparameterOptimizerConfig) {
    this.config = {
      maxTrials: 100,
      acquisitionFunction: 'expected_improvement',
      explorationWeight: 0.1,
      convergenceThreshold: 0.001,
      parallelTrials: 4,
      ...config
    };
  }

  /**
   * Optimize hyperparameters for a given model
   */
  public async optimize(
    modelFactory: ModelFactory,
    parameterSpace: ParameterSpace,
    objective: ObjectiveFunction,
    trainData: TrainingData
  ): Promise<OptimizationResult> {
    try {
      logger.info('Starting hyperparameter optimization...');
      
      // Initialize with random trials
      await this.initializeRandomTrials(modelFactory, parameterSpace, objective, trainData);

      // Bayesian optimization loop
      for (let trial = this.trials.length; trial < this.config.maxTrials; trial++) {
        logger.info(`Trial ${trial + 1}/${this.config.maxTrials}`);

        // Select next hyperparameters using acquisition function
        const nextParams = await this.selectNextParameters(parameterSpace);

        // Evaluate the model with these parameters
        const result = await this.evaluateParameters(
          modelFactory,
          nextParams,
          objective,
          trainData
        );

        // Update trials and surrogate model
        this.updateTrials(result);

        // Check for convergence
        if (this.checkConvergence()) {
          logger.info('Optimization converged early');
          break;
        }

        // Update best trial
        if (!this.bestTrial || result.score > this.bestTrial.score) {
          this.bestTrial = result;
          logger.info(`New best score: ${result.score.toFixed(6)}`);
        }
      }

      const optimizationResult = this.generateOptimizationResult();
      logger.info('Hyperparameter optimization completed');
      
      return optimizationResult;

    } catch (error) {
      logger.error('Error during hyperparameter optimization:', error);
      throw error;
    }
  }

  /**
   * Initialize with random trials for exploration
   */
  private async initializeRandomTrials(
    modelFactory: ModelFactory,
    parameterSpace: ParameterSpace,
    objective: ObjectiveFunction,
    trainData: TrainingData
  ): Promise<void> {
    const initialTrials = Math.min(10, Math.floor(this.config.maxTrials * 0.2));
    
    logger.info(`Initializing with ${initialTrials} random trials...`);

    const randomPromises = [];
    for (let i = 0; i < initialTrials; i++) {
      const randomParams = this.sampleRandomParameters(parameterSpace);
      randomPromises.push(
        this.evaluateParameters(modelFactory, randomParams, objective, trainData)
      );
    }

    // Execute random trials in parallel
    const results = await Promise.all(randomPromises);
    results.forEach(result => this.updateTrials(result));

    logger.info('Random initialization completed');
  }

  /**
   * Sample random parameters from the parameter space
   */
  private sampleRandomParameters(parameterSpace: ParameterSpace): HyperparameterSet {
    const params: HyperparameterSet = {};

    Object.entries(parameterSpace).forEach(([name, space]) => {
      switch (space.type) {
        case 'continuous':
          params[name] = Math.random() * (space.max - space.min) + space.min;
          break;
        case 'discrete':
          params[name] = space.values[Math.floor(Math.random() * space.values.length)];
          break;
        case 'integer':
          params[name] = Math.floor(Math.random() * (space.max - space.min + 1)) + space.min;
          break;
        case 'categorical':
          params[name] = space.choices[Math.floor(Math.random() * space.choices.length)];
          break;
      }
    });

    return params;
  }

  /**
   * Select next parameters using acquisition function
   */
  private async selectNextParameters(parameterSpace: ParameterSpace): Promise<HyperparameterSet> {
    if (this.trials.length < 3) {
      // Use random sampling for first few trials
      return this.sampleRandomParameters(parameterSpace);
    }

    // Use Bayesian optimization
    switch (this.config.acquisitionFunction) {
      case 'expected_improvement':
        return this.expectedImprovement(parameterSpace);
      case 'upper_confidence_bound':
        return this.upperConfidenceBound(parameterSpace);
      case 'probability_improvement':
        return this.probabilityImprovement(parameterSpace);
      default:
        return this.expectedImprovement(parameterSpace);
    }
  }

  /**
   * Expected Improvement acquisition function
   */
  private expectedImprovement(parameterSpace: ParameterSpace): HyperparameterSet {
    const candidates = this.generateCandidates(parameterSpace, 1000);
    let bestCandidate = candidates[0];
    let bestEI = -Infinity;

    const currentBest = Math.max(...this.trials.map(t => t.score));

    candidates.forEach(candidate => {
      const { mean, std } = this.predictPerformance(candidate);
      const improvement = mean - currentBest;
      
      if (std > 0) {
        const z = improvement / std;
        const ei = improvement * this.normalCDF(z) + std * this.normalPDF(z);
        
        if (ei > bestEI) {
          bestEI = ei;
          bestCandidate = candidate;
        }
      }
    });

    this.acquisitionHistory.push({
      parameters: bestCandidate,
      acquisitionValue: bestEI,
      function: 'expected_improvement'
    });

    return bestCandidate;
  }

  /**
   * Upper Confidence Bound acquisition function
   */
  private upperConfidenceBound(parameterSpace: ParameterSpace): HyperparameterSet {
    const candidates = this.generateCandidates(parameterSpace, 1000);
    let bestCandidate = candidates[0];
    let bestUCB = -Infinity;

    candidates.forEach(candidate => {
      const { mean, std } = this.predictPerformance(candidate);
      const ucb = mean + this.config.explorationWeight * std;
      
      if (ucb > bestUCB) {
        bestUCB = ucb;
        bestCandidate = candidate;
      }
    });

    this.acquisitionHistory.push({
      parameters: bestCandidate,
      acquisitionValue: bestUCB,
      function: 'upper_confidence_bound'
    });

    return bestCandidate;
  }

  /**
   * Probability of Improvement acquisition function
   */
  private probabilityImprovement(parameterSpace: ParameterSpace): HyperparameterSet {
    const candidates = this.generateCandidates(parameterSpace, 1000);
    let bestCandidate = candidates[0];
    let bestPI = -Infinity;

    const currentBest = Math.max(...this.trials.map(t => t.score));

    candidates.forEach(candidate => {
      const { mean, std } = this.predictPerformance(candidate);
      
      if (std > 0) {
        const z = (mean - currentBest) / std;
        const pi = this.normalCDF(z);
        
        if (pi > bestPI) {
          bestPI = pi;
          bestCandidate = candidate;
        }
      }
    });

    this.acquisitionHistory.push({
      parameters: bestCandidate,
      acquisitionValue: bestPI,
      function: 'probability_improvement'
    });

    return bestCandidate;
  }

  /**
   * Generate candidate parameter sets
   */
  private generateCandidates(parameterSpace: ParameterSpace, count: number): HyperparameterSet[] {
    const candidates = [];
    
    for (let i = 0; i < count; i++) {
      candidates.push(this.sampleRandomParameters(parameterSpace));
    }

    return candidates;
  }

  /**
   * Predict performance using Gaussian Process surrogate model
   */
  private predictPerformance(parameters: HyperparameterSet): { mean: number; std: number } {
    if (this.trials.length === 0) {
      return { mean: 0, std: 1 };
    }

    // Simplified GP prediction using k-nearest neighbors
    const similarities = this.trials.map(trial => ({
      trial,
      similarity: this.calculateSimilarity(parameters, trial.parameters)
    }));

    // Sort by similarity and take top k
    similarities.sort((a, b) => b.similarity - a.similarity);
    const k = Math.min(5, similarities.length);
    const neighbors = similarities.slice(0, k);

    // Weighted mean and variance
    const weights = neighbors.map(n => n.similarity);
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);

    if (totalWeight === 0) {
      return { mean: 0, std: 1 };
    }

    const mean = neighbors.reduce((sum, n, i) => 
      sum + (weights[i] / totalWeight) * n.trial.score, 0
    );

    const variance = neighbors.reduce((sum, n, i) => 
      sum + (weights[i] / totalWeight) * Math.pow(n.trial.score - mean, 2), 0
    );

    return { mean, std: Math.sqrt(variance + 1e-6) };
  }

  /**
   * Calculate similarity between parameter sets
   */
  private calculateSimilarity(params1: HyperparameterSet, params2: HyperparameterSet): number {
    const keys = Object.keys(params1);
    let similarity = 0;
    let count = 0;

    keys.forEach(key => {
      if (key in params2) {
        const val1 = params1[key];
        const val2 = params2[key];

        if (typeof val1 === 'number' && typeof val2 === 'number') {
          // Normalized difference for numeric values
          const diff = Math.abs(val1 - val2);
          const range = Math.max(Math.abs(val1), Math.abs(val2), 1);
          similarity += 1 - (diff / range);
        } else {
          // Exact match for categorical values
          similarity += val1 === val2 ? 1 : 0;
        }
        count++;
      }
    });

    return count > 0 ? similarity / count : 0;
  }

  /**
   * Evaluate model with given parameters
   */
  private async evaluateParameters(
    modelFactory: ModelFactory,
    parameters: HyperparameterSet,
    objective: ObjectiveFunction,
    trainData: TrainingData
  ): Promise<OptimizationTrial> {
    const startTime = Date.now();

    try {
      // Create model with hyperparameters
      const model = await modelFactory(parameters);

      // Train model
      const history = await model.fit(
        trainData.x,
        trainData.y,
        {
          epochs: parameters.epochs as number || 10,
          batchSize: parameters.batchSize as number || 32,
          validationSplit: 0.2,
          verbose: 0
        }
      );

      // Evaluate using objective function
      const score = await objective(model, history, trainData);

      // Clean up
      model.dispose();

      const trial: OptimizationTrial = {
        parameters,
        score,
        duration: Date.now() - startTime,
        metadata: {
          finalLoss: history.history.loss[history.history.loss.length - 1],
          finalValLoss: history.history.val_loss ? history.history.val_loss[history.history.val_loss.length - 1] : undefined,
          epochs: history.epoch.length
        }
      };

      return trial;

    } catch (error) {
      logger.error('Error evaluating parameters:', error);
      
      // Return failed trial
      return {
        parameters,
        score: -Infinity,
        duration: Date.now() - startTime,
        metadata: { error: error.message }
      };
    }
  }

  /**
   * Update trials with new result
   */
  private updateTrials(trial: OptimizationTrial): void {
    this.trials.push(trial);
    
    // Sort trials by score (descending)
    this.trials.sort((a, b) => b.score - a.score);
  }

  /**
   * Check for convergence
   */
  private checkConvergence(): boolean {
    if (this.trials.length < 10) return false;

    // Check if recent trials show little improvement
    const recentTrials = this.trials.slice(0, 5);
    const scores = recentTrials.map(t => t.score);
    const mean = scores.reduce((sum, s) => sum + s, 0) / scores.length;
    const variance = scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / scores.length;
    const std = Math.sqrt(variance);

    return std < this.config.convergenceThreshold;
  }

  /**
   * Generate final optimization result
   */
  private generateOptimizationResult(): OptimizationResult {
    if (!this.bestTrial) {
      throw new Error('No successful trials found');
    }

    // Get performance statistics
    const scores = this.trials.filter(t => t.score !== -Infinity).map(t => t.score);
    const validTrials = this.trials.filter(t => t.score !== -Infinity);

    return {
      bestParameters: this.bestTrial.parameters,
      bestScore: this.bestTrial.score,
      totalTrials: this.trials.length,
      successfulTrials: validTrials.length,
      convergenceReached: this.checkConvergence(),
      statistics: {
        meanScore: scores.reduce((sum, s) => sum + s, 0) / scores.length,
        stdScore: Math.sqrt(scores.reduce((sum, s) => sum + Math.pow(s - scores[0], 2), 0) / scores.length),
        minScore: Math.min(...scores),
        maxScore: Math.max(...scores)
      },
      trialHistory: this.trials.slice(),
      acquisitionHistory: this.acquisitionHistory.slice()
    };
  }

  /**
   * Normal cumulative distribution function
   */
  private normalCDF(x: number): number {
    return 0.5 * (1 + this.erf(x / Math.sqrt(2)));
  }

  /**
   * Normal probability density function
   */
  private normalPDF(x: number): number {
    return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
  }

  /**
   * Error function approximation
   */
  private erf(x: number): number {
    // Abramowitz and Stegun approximation
    const a1 =  0.254829592;
    const a2 = -0.284496736;
    const a3 =  1.421413741;
    const a4 = -1.453152027;
    const a5 =  1.061405429;
    const p  =  0.3275911;

    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x);

    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return sign * y;
  }

  /**
   * Get optimization history
   */
  public getHistory(): OptimizationTrial[] {
    return this.trials.slice();
  }

  /**
   * Get best trial
   */
  public getBestTrial(): OptimizationTrial | null {
    return this.bestTrial;
  }

  /**
   * Export optimization results
   */
  public exportResults(): OptimizationExport {
    return {
      config: this.config,
      trials: this.trials,
      bestTrial: this.bestTrial,
      acquisitionHistory: this.acquisitionHistory,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Import optimization results
   */
  public importResults(data: OptimizationExport): void {
    this.trials = data.trials;
    this.bestTrial = data.bestTrial;
    this.acquisitionHistory = data.acquisitionHistory;
  }
}

// Type definitions
export interface HyperparameterOptimizerConfig {
  maxTrials: number;
  acquisitionFunction: 'expected_improvement' | 'upper_confidence_bound' | 'probability_improvement';
  explorationWeight: number;
  convergenceThreshold: number;
  parallelTrials: number;
}

export interface ParameterSpace {
  [key: string]: ParameterDefinition;
}

export interface ParameterDefinition {
  type: 'continuous' | 'discrete' | 'integer' | 'categorical';
  min?: number;
  max?: number;
  values?: number[];
  choices?: string[];
}

export interface HyperparameterSet {
  [key: string]: number | string;
}

export interface OptimizationTrial {
  parameters: HyperparameterSet;
  score: number;
  duration: number;
  metadata?: any;
}

export interface TrainingData {
  x: tf.Tensor;
  y: tf.Tensor;
}

export interface OptimizationResult {
  bestParameters: HyperparameterSet;
  bestScore: number;
  totalTrials: number;
  successfulTrials: number;
  convergenceReached: boolean;
  statistics: {
    meanScore: number;
    stdScore: number;
    minScore: number;
    maxScore: number;
  };
  trialHistory: OptimizationTrial[];
  acquisitionHistory: AcquisitionPoint[];
}

export interface AcquisitionPoint {
  parameters: HyperparameterSet;
  acquisitionValue: number;
  function: string;
}

export interface OptimizationExport {
  config: HyperparameterOptimizerConfig;
  trials: OptimizationTrial[];
  bestTrial: OptimizationTrial | null;
  acquisitionHistory: AcquisitionPoint[];
  timestamp: string;
}

export type ModelFactory = (parameters: HyperparameterSet) => Promise<tf.LayersModel>;
export type ObjectiveFunction = (model: tf.LayersModel, history: tf.History, data: TrainingData) => Promise<number>;

/**
 * Factory function to create hyperparameter optimizer
 */
export function createHyperparameterOptimizer(
  config?: Partial<HyperparameterOptimizerConfig>
): HyperparameterOptimizer {
  return new HyperparameterOptimizer(config || {
    maxTrials: 100,
    acquisitionFunction: 'expected_improvement',
    explorationWeight: 0.1,
    convergenceThreshold: 0.001,
    parallelTrials: 4
  });
}

/**
 * Common parameter spaces for neural networks
 */
export const commonParameterSpaces = {
  basicNN: {
    learningRate: { type: 'continuous' as const, min: 0.0001, max: 0.1 },
    batchSize: { type: 'discrete' as const, values: [16, 32, 64, 128] },
    hiddenUnits: { type: 'integer' as const, min: 32, max: 512 },
    dropout: { type: 'continuous' as const, min: 0.0, max: 0.5 },
    epochs: { type: 'integer' as const, min: 10, max: 100 }
  },
  
  coordination: {
    learningRate: { type: 'continuous' as const, min: 0.0001, max: 0.01 },
    agentCount: { type: 'discrete' as const, values: [4, 8, 16, 32] },
    hiddenDim: { type: 'discrete' as const, values: [64, 128, 256] },
    attentionHeads: { type: 'discrete' as const, values: [2, 4, 8] },
    layers: { type: 'integer' as const, min: 2, max: 6 },
    dropout: { type: 'continuous' as const, min: 0.05, max: 0.3 }
  },

  performance: {
    learningRate: { type: 'continuous' as const, min: 0.0001, max: 0.01 },
    lstmUnits: { type: 'discrete' as const, values: [32, 64, 128, 256] },
    attentionUnits: { type: 'discrete' as const, values: [16, 32, 64] },
    denseUnits: { type: 'discrete' as const, values: [64, 128, 256] },
    dropout: { type: 'continuous' as const, min: 0.1, max: 0.4 },
    sequenceLength: { type: 'discrete' as const, values: [10, 20, 30, 50] }
  }
};

/**
 * Common objective functions
 */
export const commonObjectives = {
  /**
   * Validation accuracy objective (higher is better)
   */
  validationAccuracy: async (model: tf.LayersModel, history: tf.History): Promise<number> => {
    const valAcc = history.history.val_acc || history.history.val_accuracy;
    return valAcc ? valAcc[valAcc.length - 1] : 0;
  },

  /**
   * Validation loss objective (lower is better, so we negate it)
   */
  validationLoss: async (model: tf.LayersModel, history: tf.History): Promise<number> => {
    const valLoss = history.history.val_loss;
    return valLoss ? -valLoss[valLoss.length - 1] : -Infinity;
  },

  /**
   * Combined accuracy and loss objective
   */
  combined: async (model: tf.LayersModel, history: tf.History): Promise<number> => {
    const valAcc = history.history.val_acc || history.history.val_accuracy;
    const valLoss = history.history.val_loss;
    
    const accuracy = valAcc ? valAcc[valAcc.length - 1] : 0;
    const loss = valLoss ? valLoss[valLoss.length - 1] : Infinity;
    
    // Combined score: accuracy - normalized loss
    return accuracy - Math.min(loss, 10) / 10;
  }
};