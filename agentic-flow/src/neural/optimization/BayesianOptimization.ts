/**
 * Bayesian Optimization for Hyperparameter Tuning
 * 
 * Advanced Bayesian optimization implementation with:
 * - Gaussian Process surrogate models
 * - Multiple acquisition functions (EI, UCB, PI)
 * - Multi-objective optimization support
 * - Parallel evaluation capabilities
 * - Adaptive exploration/exploitation balance
 */

import * as tf from '@tensorflow/tfjs';
import { EventEmitter } from 'events';

export interface HyperparameterSpace {
  [key: string]: {
    type: 'continuous' | 'discrete' | 'categorical';
    bounds?: [number, number]; // For continuous
    values?: any[]; // For discrete/categorical
    scale?: 'linear' | 'log';
    transform?: (value: any) => any;
  };
}

export interface HyperparameterConfig {
  [key: string]: any;
}

export interface OptimizationResult {
  config: HyperparameterConfig;
  objective: number;
  metrics?: { [key: string]: number };
  iteration: number;
  evaluationTime: number;
  convergenceScore?: number;
}

export interface BayesianOptimizerConfig {
  maxIterations: number;
  acquisitionFunction: 'ei' | 'ucb' | 'pi' | 'multi_objective';
  xi: number; // Exploration parameter for EI
  kappa: number; // Exploration parameter for UCB
  nRandomStarts: number;
  parallelEvaluations?: number;
  convergenceThreshold?: number;
  verbose?: boolean;
  earlyStoppingPatience?: number;
  multiObjectiveWeights?: number[]; // Weights for multi-objective optimization
}

export interface GaussianProcessState {
  X: number[][]; // Input observations
  y: number[]; // Output observations
  lengthScale: number[];
  noiseVariance: number;
  signalVariance: number;
  kernelMatrix: number[][];
  choleskyDecomp: number[][];
}

export class BayesianOptimizer extends EventEmitter {
  private config: BayesianOptimizerConfig;
  private hyperparameterSpace: HyperparameterSpace;
  private observations: OptimizationResult[] = [];
  private gaussianProcess: GaussianProcess;
  private acquisitionOptimizer: AcquisitionOptimizer;
  private convergenceAnalyzer: ConvergenceAnalyzer;
  private bestResult: OptimizationResult | null = null;
  private currentIteration: number = 0;
  private patienceCounter: number = 0;

  constructor(
    hyperparameterSpace: HyperparameterSpace,
    config: Partial<BayesianOptimizerConfig> = {}
  ) {
    super();
    
    this.hyperparameterSpace = hyperparameterSpace;
    this.config = {
      maxIterations: 100,
      acquisitionFunction: 'ei',
      xi: 0.01,
      kappa: 2.576,
      nRandomStarts: 5,
      parallelEvaluations: 1,
      convergenceThreshold: 1e-6,
      verbose: false,
      earlyStoppingPatience: 10,
      multiObjectiveWeights: [1.0],
      ...config
    };

    this.gaussianProcess = new GaussianProcess();
    this.acquisitionOptimizer = new AcquisitionOptimizer(this.hyperparameterSpace);
    this.convergenceAnalyzer = new ConvergenceAnalyzer();
  }

  /**
   * Optimize hyperparameters using Bayesian optimization
   */
  public async optimize(
    objectiveFunction: (config: HyperparameterConfig) => Promise<number | number[]>
  ): Promise<OptimizationResult> {
    this.currentIteration = 0;
    this.patienceCounter = 0;
    
    // Generate initial random samples
    await this.generateInitialSamples(objectiveFunction);
    
    // Main optimization loop
    while (this.currentIteration < this.config.maxIterations) {
      // Check convergence
      if (this.checkConvergence()) {
        if (this.config.verbose) {
          console.log(`Converged at iteration ${this.currentIteration}`);
        }
        break;
      }
      
      // Check early stopping
      if (this.patienceCounter >= this.config.earlyStoppingPatience!) {
        if (this.config.verbose) {
          console.log(`Early stopping at iteration ${this.currentIteration}`);
        }
        break;
      }
      
      // Update Gaussian Process
      this.updateGaussianProcess();
      
      // Optimize acquisition function to get next candidates
      const candidates = await this.optimizeAcquisitionFunction();
      
      // Evaluate candidates (potentially in parallel)
      const results = await this.evaluateCandidates(candidates, objectiveFunction);
      
      // Update observations and best result
      this.updateObservations(results);
      
      // Emit progress event
      this.emit('iteration', {
        iteration: this.currentIteration,
        bestResult: this.bestResult,
        candidates: results,
        convergenceScore: this.convergenceAnalyzer.getConvergenceScore()
      });
      
      this.currentIteration++;
    }
    
    return this.bestResult!;
  }

  private async generateInitialSamples(
    objectiveFunction: (config: HyperparameterConfig) => Promise<number | number[]>
  ): Promise<void> {
    const initialConfigs = this.generateRandomConfigurations(this.config.nRandomStarts);
    
    for (const config of initialConfigs) {
      const startTime = performance.now();
      const objective = await objectiveFunction(config);
      const evaluationTime = performance.now() - startTime;
      
      const result: OptimizationResult = {
        config,
        objective: Array.isArray(objective) ? objective[0] : objective,
        metrics: Array.isArray(objective) ? this.parseMultiObjective(objective) : undefined,
        iteration: this.currentIteration++,
        evaluationTime
      };
      
      this.observations.push(result);
      this.updateBestResult(result);
    }
  }

  private generateRandomConfigurations(count: number): HyperparameterConfig[] {
    const configs: HyperparameterConfig[] = [];
    
    for (let i = 0; i < count; i++) {
      const config: HyperparameterConfig = {};
      
      Object.entries(this.hyperparameterSpace).forEach(([name, space]) => {
        config[name] = this.sampleFromSpace(space);
      });
      
      configs.push(config);
    }
    
    return configs;
  }

  private sampleFromSpace(space: HyperparameterSpace[string]): any {
    switch (space.type) {
      case 'continuous':
        let value = Math.random() * (space.bounds![1] - space.bounds![0]) + space.bounds![0];
        if (space.scale === 'log') {
          value = Math.exp(value);
        }
        return space.transform ? space.transform(value) : value;
        
      case 'discrete':
        const index = Math.floor(Math.random() * space.values!.length);
        return space.values![index];
        
      case 'categorical':
        const catIndex = Math.floor(Math.random() * space.values!.length);
        return space.values![catIndex];
        
      default:
        throw new Error(`Unknown hyperparameter type: ${space.type}`);
    }
  }

  private parseMultiObjective(objectives: number[]): { [key: string]: number } {
    return {
      primary: objectives[0],
      secondary: objectives[1] || 0,
      tertiary: objectives[2] || 0
    };
  }

  private updateGaussianProcess(): void {
    // Convert configurations to numerical features
    const X = this.observations.map(obs => this.configToVector(obs.config));
    const y = this.observations.map(obs => obs.objective);
    
    this.gaussianProcess.fit(X, y);
  }

  private configToVector(config: HyperparameterConfig): number[] {
    const vector: number[] = [];
    
    Object.entries(this.hyperparameterSpace).forEach(([name, space]) => {
      const value = config[name];
      
      switch (space.type) {
        case 'continuous':
          let normalizedValue = value;
          if (space.scale === 'log') {
            normalizedValue = Math.log(value);
          }
          // Normalize to [0, 1]
          normalizedValue = (normalizedValue - space.bounds![0]) / (space.bounds![1] - space.bounds![0]);
          vector.push(normalizedValue);
          break;
          
        case 'discrete':
        case 'categorical':
          // One-hot encoding
          const oneHot = new Array(space.values!.length).fill(0);
          const index = space.values!.indexOf(value);
          if (index !== -1) {
            oneHot[index] = 1;
          }
          vector.push(...oneHot);
          break;
      }
    });
    
    return vector;
  }

  private async optimizeAcquisitionFunction(): Promise<HyperparameterConfig[]> {
    const nCandidates = this.config.parallelEvaluations || 1;
    const candidates: HyperparameterConfig[] = [];
    
    // Generate multiple candidates using different strategies
    for (let i = 0; i < nCandidates; i++) {
      let candidate: HyperparameterConfig;
      
      if (i === 0) {
        // Best candidate from acquisition optimization
        candidate = await this.acquisitionOptimizer.optimize(
          this.gaussianProcess,
          this.config.acquisitionFunction,
          { xi: this.config.xi, kappa: this.config.kappa }
        );
      } else {
        // Additional candidates with exploration bias
        candidate = await this.acquisitionOptimizer.optimize(
          this.gaussianProcess,
          this.config.acquisitionFunction,
          { xi: this.config.xi * (1 + i * 0.5), kappa: this.config.kappa * (1 + i * 0.2) }
        );
      }
      
      candidates.push(candidate);
    }
    
    return candidates;
  }

  private async evaluateCandidates(
    candidates: HyperparameterConfig[],
    objectiveFunction: (config: HyperparameterConfig) => Promise<number | number[]>
  ): Promise<OptimizationResult[]> {
    const results: OptimizationResult[] = [];
    
    // Evaluate candidates (potentially in parallel)
    if (this.config.parallelEvaluations! > 1) {
      const promises = candidates.map(async (config) => {
        const startTime = performance.now();
        const objective = await objectiveFunction(config);
        const evaluationTime = performance.now() - startTime;
        
        return {
          config,
          objective: Array.isArray(objective) ? objective[0] : objective,
          metrics: Array.isArray(objective) ? this.parseMultiObjective(objective) : undefined,
          iteration: this.currentIteration,
          evaluationTime
        };
      });
      
      results.push(...await Promise.all(promises));
    } else {
      for (const config of candidates) {
        const startTime = performance.now();
        const objective = await objectiveFunction(config);
        const evaluationTime = performance.now() - startTime;
        
        results.push({
          config,
          objective: Array.isArray(objective) ? objective[0] : objective,
          metrics: Array.isArray(objective) ? this.parseMultiObjective(objective) : undefined,
          iteration: this.currentIteration,
          evaluationTime
        });
      }
    }
    
    return results;
  }

  private updateObservations(results: OptimizationResult[]): void {
    this.observations.push(...results);
    
    results.forEach(result => this.updateBestResult(result));
    
    // Update convergence analysis
    this.convergenceAnalyzer.addObservations(results);
  }

  private updateBestResult(result: OptimizationResult): void {
    if (!this.bestResult || result.objective > this.bestResult.objective) {
      this.bestResult = result;
      this.patienceCounter = 0;
      
      if (this.config.verbose) {
        console.log(`New best result at iteration ${result.iteration}: ${result.objective}`);
      }
      
      this.emit('newBest', result);
    } else {
      this.patienceCounter++;
    }
  }

  private checkConvergence(): boolean {
    if (this.observations.length < 10) return false;
    
    const convergenceScore = this.convergenceAnalyzer.getConvergenceScore();
    return convergenceScore > (1 - this.config.convergenceThreshold!);
  }

  /**
   * Get optimization analytics and performance metrics
   */
  public getAnalytics(): any {
    return {
      iterations: this.currentIteration,
      totalEvaluations: this.observations.length,
      bestResult: this.bestResult,
      convergenceScore: this.convergenceAnalyzer.getConvergenceScore(),
      explorationExploitation: this.analyzeExplorationExploitation(),
      hyperparameterImportance: this.calculateHyperparameterImportance(),
      performanceMetrics: this.calculatePerformanceMetrics(),
      recommendations: this.generateRecommendations()
    };
  }

  private analyzeExplorationExploitation(): any {
    // Analyze the balance between exploration and exploitation
    const acquisitionValues = this.observations.map((obs, idx) => {
      if (idx < this.config.nRandomStarts) return 1; // Random exploration
      
      // Calculate acquisition function value at the time of selection
      const X = this.observations.slice(0, idx).map(o => this.configToVector(o.config));
      const y = this.observations.slice(0, idx).map(o => o.objective);
      
      const tempGP = new GaussianProcess();
      tempGP.fit(X, y);
      
      const vector = this.configToVector(obs.config);
      return this.calculateAcquisitionValue(tempGP, vector);
    });
    
    const explorationPhases = acquisitionValues.filter(v => v > 0.5).length;
    const exploitationPhases = acquisitionValues.filter(v => v <= 0.5).length;
    
    return {
      explorationRatio: explorationPhases / acquisitionValues.length,
      exploitationRatio: exploitationPhases / acquisitionValues.length,
      balance: Math.abs(0.5 - (explorationPhases / acquisitionValues.length))
    };
  }

  private calculateAcquisitionValue(gp: GaussianProcess, x: number[]): number {
    const prediction = gp.predict([x])[0];
    const mean = prediction.mean;
    const std = Math.sqrt(prediction.variance);
    
    switch (this.config.acquisitionFunction) {
      case 'ei':
        return this.expectedImprovement(mean, std, Math.max(...this.observations.map(o => o.objective)));
      case 'ucb':
        return mean + this.config.kappa * std;
      case 'pi':
        return this.probabilityOfImprovement(mean, std, Math.max(...this.observations.map(o => o.objective)));
      default:
        return mean;
    }
  }

  private expectedImprovement(mean: number, std: number, bestValue: number): number {
    if (std === 0) return 0;
    
    const z = (mean - bestValue - this.config.xi) / std;
    const phi = this.standardNormalPDF(z);
    const Phi = this.standardNormalCDF(z);
    
    return (mean - bestValue - this.config.xi) * Phi + std * phi;
  }

  private probabilityOfImprovement(mean: number, std: number, bestValue: number): number {
    if (std === 0) return 0;
    
    const z = (mean - bestValue - this.config.xi) / std;
    return this.standardNormalCDF(z);
  }

  private standardNormalPDF(x: number): number {
    return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
  }

  private standardNormalCDF(x: number): number {
    return 0.5 * (1 + this.erf(x / Math.sqrt(2)));
  }

  private erf(x: number): number {
    // Approximation of error function
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;
    
    const sign = x >= 0 ? 1 : -1;
    x = Math.abs(x);
    
    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
    
    return sign * y;
  }

  private calculateHyperparameterImportance(): { [key: string]: number } {
    // Calculate importance of each hyperparameter using ANOVA or similar
    const importance: { [key: string]: number } = {};
    
    Object.keys(this.hyperparameterSpace).forEach(param => {
      // Simple correlation-based importance
      const values = this.observations.map(obs => obs.config[param]);
      const objectives = this.observations.map(obs => obs.objective);
      
      importance[param] = this.calculateCorrelation(values, objectives);
    });
    
    return importance;
  }

  private calculateCorrelation(x: any[], y: number[]): number {
    // Convert categorical values to numeric
    const numericX = x.map((val, idx) => {
      if (typeof val === 'number') return val;
      return x.indexOf(val); // Simple categorical encoding
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
    
    return Math.abs(numerator / Math.sqrt(denomX * denomY));
  }

  private calculatePerformanceMetrics(): any {
    const objectives = this.observations.map(o => o.objective);
    const evaluationTimes = this.observations.map(o => o.evaluationTime);
    
    return {
      bestObjective: Math.max(...objectives),
      meanObjective: objectives.reduce((a, b) => a + b, 0) / objectives.length,
      objectiveStd: Math.sqrt(objectives.reduce((sum, val) => sum + Math.pow(val - this.bestResult!.objective, 2), 0) / objectives.length),
      totalEvaluationTime: evaluationTimes.reduce((a, b) => a + b, 0),
      averageEvaluationTime: evaluationTimes.reduce((a, b) => a + b, 0) / evaluationTimes.length,
      convergenceRate: this.convergenceAnalyzer.getConvergenceRate(),
      efficiencyScore: this.calculateEfficiencyScore()
    };
  }

  private calculateEfficiencyScore(): number {
    // Score based on how quickly we found good solutions
    const bestObjective = this.bestResult!.objective;
    const iterationOfBest = this.bestResult!.iteration;
    
    // Efficiency decreases as we take more iterations to find the best
    return Math.max(0, 1 - (iterationOfBest / this.config.maxIterations));
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    const analytics = this.getAnalytics();
    
    if (analytics.explorationExploitation.balance > 0.3) {
      recommendations.push('Consider adjusting exploration parameters (xi, kappa) for better balance');
    }
    
    if (analytics.convergenceScore < 0.7 && this.currentIteration > this.config.maxIterations * 0.8) {
      recommendations.push('Optimization may not have converged - consider increasing max iterations');
    }
    
    if (analytics.performanceMetrics.efficiencyScore < 0.3) {
      recommendations.push('Poor efficiency - consider better initial sampling or different acquisition function');
    }
    
    const importantParams = Object.entries(analytics.hyperparameterImportance)
      .filter(([_, importance]) => importance > 0.7)
      .map(([param, _]) => param);
    
    if (importantParams.length > 0) {
      recommendations.push(`Focus on optimizing: ${importantParams.join(', ')}`);
    }
    
    return recommendations;
  }

  /**
   * Reset optimizer state
   */
  public reset(): void {
    this.observations = [];
    this.bestResult = null;
    this.currentIteration = 0;
    this.patienceCounter = 0;
    this.gaussianProcess = new GaussianProcess();
    this.convergenceAnalyzer = new ConvergenceAnalyzer();
  }

  /**
   * Get current best result
   */
  public getBestResult(): OptimizationResult | null {
    return this.bestResult;
  }

  /**
   * Get all observations
   */
  public getObservations(): OptimizationResult[] {
    return [...this.observations];
  }
}

/**
 * Gaussian Process implementation for Bayesian optimization
 */
class GaussianProcess {
  private X: number[][] = [];
  private y: number[] = [];
  private kernelMatrix: number[][] = [];
  private choleskyDecomp: number[][] = [];
  private lengthScale: number[] = [];
  private noiseVariance: number = 1e-6;
  private signalVariance: number = 1.0;

  public fit(X: number[][], y: number[]): void {
    this.X = X.map(row => [...row]);
    this.y = [...y];
    
    if (X.length === 0) return;
    
    // Initialize hyperparameters
    this.lengthScale = new Array(X[0].length).fill(1.0);
    
    // Optimize hyperparameters (simplified)
    this.optimizeHyperparameters();
    
    // Build kernel matrix
    this.buildKernelMatrix();
    
    // Compute Cholesky decomposition
    this.computeCholesky();
  }

  private optimizeHyperparameters(): void {
    // Simplified hyperparameter optimization
    // In practice, you would use gradient-based optimization
    
    // Estimate length scales based on data variance
    for (let i = 0; i < this.lengthScale.length; i++) {
      const values = this.X.map(row => row[i]);
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
      this.lengthScale[i] = Math.sqrt(variance) || 1.0;
    }
    
    // Estimate signal variance
    const yMean = this.y.reduce((a, b) => a + b, 0) / this.y.length;
    this.signalVariance = this.y.reduce((sum, val) => sum + Math.pow(val - yMean, 2), 0) / this.y.length;
  }

  private buildKernelMatrix(): void {
    const n = this.X.length;
    this.kernelMatrix = Array(n).fill(null).map(() => Array(n).fill(0));
    
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        this.kernelMatrix[i][j] = this.rbfKernel(this.X[i], this.X[j]);
        if (i === j) {
          this.kernelMatrix[i][j] += this.noiseVariance;
        }
      }
    }
  }

  private rbfKernel(x1: number[], x2: number[]): number {
    let sum = 0;
    for (let i = 0; i < x1.length; i++) {
      const diff = x1[i] - x2[i];
      sum += (diff * diff) / (this.lengthScale[i] * this.lengthScale[i]);
    }
    return this.signalVariance * Math.exp(-0.5 * sum);
  }

  private computeCholesky(): void {
    const n = this.kernelMatrix.length;
    this.choleskyDecomp = Array(n).fill(null).map(() => Array(n).fill(0));
    
    for (let i = 0; i < n; i++) {
      for (let j = 0; j <= i; j++) {
        if (i === j) {
          let sum = 0;
          for (let k = 0; k < j; k++) {
            sum += this.choleskyDecomp[j][k] * this.choleskyDecomp[j][k];
          }
          this.choleskyDecomp[i][j] = Math.sqrt(this.kernelMatrix[i][i] - sum);
        } else {
          let sum = 0;
          for (let k = 0; k < j; k++) {
            sum += this.choleskyDecomp[i][k] * this.choleskyDecomp[j][k];
          }
          this.choleskyDecomp[i][j] = (this.kernelMatrix[i][j] - sum) / this.choleskyDecomp[j][j];
        }
      }
    }
  }

  public predict(XTest: number[][]): { mean: number; variance: number }[] {
    if (this.X.length === 0) {
      return XTest.map(() => ({ mean: 0, variance: 1 }));
    }
    
    return XTest.map(xTest => {
      // Compute kernel vector
      const kStar = this.X.map(xTrain => this.rbfKernel(xTest, xTrain));
      
      // Solve for alpha using forward/backward substitution
      const alpha = this.solveCholesky(this.y);
      
      // Predictive mean
      const mean = kStar.reduce((sum, k, i) => sum + k * alpha[i], 0);
      
      // Predictive variance
      const kStarStar = this.rbfKernel(xTest, xTest);
      const v = this.solveCholesky(kStar);
      const variance = kStarStar - kStar.reduce((sum, k, i) => sum + k * v[i], 0);
      
      return { mean, variance: Math.max(variance, 1e-8) };
    });
  }

  private solveCholesky(b: number[]): number[] {
    const n = b.length;
    const y = new Array(n);
    const x = new Array(n);
    
    // Forward substitution
    for (let i = 0; i < n; i++) {
      let sum = 0;
      for (let j = 0; j < i; j++) {
        sum += this.choleskyDecomp[i][j] * y[j];
      }
      y[i] = (b[i] - sum) / this.choleskyDecomp[i][i];
    }
    
    // Backward substitution
    for (let i = n - 1; i >= 0; i--) {
      let sum = 0;
      for (let j = i + 1; j < n; j++) {
        sum += this.choleskyDecomp[j][i] * x[j];
      }
      x[i] = (y[i] - sum) / this.choleskyDecomp[i][i];
    }
    
    return x;
  }
}

/**
 * Acquisition Function Optimizer
 */
class AcquisitionOptimizer {
  private hyperparameterSpace: HyperparameterSpace;

  constructor(hyperparameterSpace: HyperparameterSpace) {
    this.hyperparameterSpace = hyperparameterSpace;
  }

  public async optimize(
    gp: GaussianProcess,
    acquisitionFunction: string,
    params: { xi: number; kappa: number }
  ): Promise<HyperparameterConfig> {
    // Simple random search for acquisition function optimization
    // In practice, you would use more sophisticated methods like L-BFGS
    
    const nCandidates = 1000;
    let bestConfig: HyperparameterConfig | null = null;
    let bestValue = -Infinity;
    
    for (let i = 0; i < nCandidates; i++) {
      const config = this.generateRandomConfiguration();
      const vector = this.configToVector(config);
      const predictions = gp.predict([vector]);
      
      if (predictions.length > 0) {
        const { mean, variance } = predictions[0];
        const std = Math.sqrt(variance);
        
        let acquisitionValue = 0;
        switch (acquisitionFunction) {
          case 'ei':
            acquisitionValue = this.expectedImprovement(mean, std, 0, params.xi); // Simplified
            break;
          case 'ucb':
            acquisitionValue = mean + params.kappa * std;
            break;
          case 'pi':
            acquisitionValue = this.probabilityOfImprovement(mean, std, 0, params.xi); // Simplified
            break;
        }
        
        if (acquisitionValue > bestValue) {
          bestValue = acquisitionValue;
          bestConfig = config;
        }
      }
    }
    
    return bestConfig || this.generateRandomConfiguration();
  }

  private generateRandomConfiguration(): HyperparameterConfig {
    const config: HyperparameterConfig = {};
    
    Object.entries(this.hyperparameterSpace).forEach(([name, space]) => {
      switch (space.type) {
        case 'continuous':
          let value = Math.random() * (space.bounds![1] - space.bounds![0]) + space.bounds![0];
          if (space.scale === 'log') {
            value = Math.exp(value);
          }
          config[name] = space.transform ? space.transform(value) : value;
          break;
          
        case 'discrete':
        case 'categorical':
          const index = Math.floor(Math.random() * space.values!.length);
          config[name] = space.values![index];
          break;
      }
    });
    
    return config;
  }

  private configToVector(config: HyperparameterConfig): number[] {
    const vector: number[] = [];
    
    Object.entries(this.hyperparameterSpace).forEach(([name, space]) => {
      const value = config[name];
      
      switch (space.type) {
        case 'continuous':
          let normalizedValue = value;
          if (space.scale === 'log') {
            normalizedValue = Math.log(value);
          }
          normalizedValue = (normalizedValue - space.bounds![0]) / (space.bounds![1] - space.bounds![0]);
          vector.push(normalizedValue);
          break;
          
        case 'discrete':
        case 'categorical':
          const oneHot = new Array(space.values!.length).fill(0);
          const index = space.values!.indexOf(value);
          if (index !== -1) {
            oneHot[index] = 1;
          }
          vector.push(...oneHot);
          break;
      }
    });
    
    return vector;
  }

  private expectedImprovement(mean: number, std: number, bestValue: number, xi: number): number {
    if (std === 0) return 0;
    
    const z = (mean - bestValue - xi) / std;
    const phi = Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);
    const Phi = 0.5 * (1 + this.erf(z / Math.sqrt(2)));
    
    return (mean - bestValue - xi) * Phi + std * phi;
  }

  private probabilityOfImprovement(mean: number, std: number, bestValue: number, xi: number): number {
    if (std === 0) return 0;
    
    const z = (mean - bestValue - xi) / std;
    return 0.5 * (1 + this.erf(z / Math.sqrt(2)));
  }

  private erf(x: number): number {
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;
    
    const sign = x >= 0 ? 1 : -1;
    x = Math.abs(x);
    
    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
    
    return sign * y;
  }
}

/**
 * Convergence Analysis Helper Class
 */
class ConvergenceAnalyzer {
  private observations: OptimizationResult[] = [];

  public addObservations(results: OptimizationResult[]): void {
    this.observations.push(...results);
  }

  public getConvergenceScore(): number {
    if (this.observations.length < 5) return 0;
    
    const recentObjectives = this.observations.slice(-10).map(o => o.objective);
    const bestObjective = Math.max(...this.observations.map(o => o.objective));
    
    // Calculate improvement rate
    const improvementRate = this.calculateImprovementRate(recentObjectives);
    
    // Calculate stability
    const stability = this.calculateStability(recentObjectives);
    
    return (stability + (1 - improvementRate)) / 2;
  }

  public getConvergenceRate(): number {
    if (this.observations.length < 10) return 0;
    
    const objectives = this.observations.map(o => o.objective);
    const bestObjective = Math.max(...objectives);
    
    // Find iteration where we reached 95% of best
    const threshold = bestObjective * 0.95;
    for (let i = 0; i < objectives.length; i++) {
      if (objectives[i] >= threshold) {
        return i / objectives.length;
      }
    }
    
    return 1.0;
  }

  private calculateImprovementRate(objectives: number[]): number {
    if (objectives.length < 2) return 1;
    
    const improvements = objectives.slice(1).map((obj, i) => 
      Math.max(0, obj - objectives[i])
    );
    
    const avgImprovement = improvements.reduce((a, b) => a + b, 0) / improvements.length;
    return Math.min(avgImprovement, 1);
  }

  private calculateStability(objectives: number[]): number {
    if (objectives.length < 3) return 1;
    
    const mean = objectives.reduce((a, b) => a + b, 0) / objectives.length;
    const variance = objectives.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / objectives.length;
    const coefficientOfVariation = Math.sqrt(variance) / Math.abs(mean);
    
    return Math.max(0, 1 - coefficientOfVariation);
  }
}

/**
 * Factory function for creating optimized Bayesian optimizer configurations
 */
export function createOptimalBayesianOptimizer(
  hyperparameterSpace: HyperparameterSpace,
  budget: number, // Total evaluation budget
  complexity: 'simple' | 'moderate' | 'complex'
): BayesianOptimizer {
  let config: Partial<BayesianOptimizerConfig>;
  
  switch (complexity) {
    case 'simple':
      config = {
        maxIterations: Math.min(budget, 50),
        acquisitionFunction: 'ei',
        xi: 0.01,
        kappa: 1.96,
        nRandomStarts: Math.min(budget * 0.2, 10),
        parallelEvaluations: 1,
        earlyStoppingPatience: 5
      };
      break;
      
    case 'moderate':
      config = {
        maxIterations: Math.min(budget, 100),
        acquisitionFunction: 'ucb',
        xi: 0.05,
        kappa: 2.576,
        nRandomStarts: Math.min(budget * 0.15, 15),
        parallelEvaluations: 2,
        earlyStoppingPatience: 10
      };
      break;
      
    case 'complex':
      config = {
        maxIterations: budget,
        acquisitionFunction: 'ei',
        xi: 0.1,
        kappa: 3.0,
        nRandomStarts: Math.min(budget * 0.1, 20),
        parallelEvaluations: 4,
        earlyStoppingPatience: 15
      };
      break;
  }
  
  return new BayesianOptimizer(hyperparameterSpace, config);
}