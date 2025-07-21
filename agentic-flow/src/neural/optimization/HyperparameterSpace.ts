/**
 * Hyperparameter Space Definition and Management System
 * 
 * Comprehensive hyperparameter space definition with:
 * - Multiple parameter types (continuous, discrete, categorical)
 * - Advanced sampling strategies
 * - Constraint handling and validation
 * - Search space optimization
 * - Multi-objective parameter spaces
 * - Dynamic space adjustment
 */

export interface HyperparameterDimension {
  type: 'continuous' | 'discrete' | 'categorical' | 'ordinal';
  bounds?: [number, number]; // For continuous/discrete
  values?: any[]; // For discrete/categorical/ordinal
  scale?: 'linear' | 'log' | 'logit'; // Scaling for continuous parameters
  transform?: (value: any) => any; // Custom transformation function
  prior?: 'uniform' | 'normal' | 'beta' | 'gamma'; // Prior distribution
  priorParams?: any; // Parameters for prior distribution
  constraints?: (value: any, config: any) => boolean; // Constraint function
  dependencies?: string[]; // Parameters this depends on
  conditional?: { // Conditional parameter definition
    when: (config: any) => boolean;
    then: Partial<HyperparameterDimension>;
    else?: Partial<HyperparameterDimension>;
  };
}

export interface HyperparameterSpace {
  [parameterName: string]: HyperparameterDimension;
}

export interface HyperparameterConfig {
  [parameterName: string]: any;
}

export interface SamplingStrategy {
  method: 'random' | 'latin_hypercube' | 'sobol' | 'halton' | 'grid' | 'adaptive';
  nSamples?: number;
  seed?: number;
  stratification?: boolean;
  diversityMetric?: 'euclidean' | 'manhattan' | 'cosine';
  adaptiveParams?: {
    explorationRate: number;
    exploitationThreshold: number;
    diversityWeight: number;
  };
}

export interface SearchConstraints {
  globalConstraints?: (config: HyperparameterConfig) => boolean;
  resourceConstraints?: {
    maxMemory?: number; // MB
    maxTime?: number; // seconds
    maxGPUMemory?: number; // MB
  };
  performanceConstraints?: {
    minAccuracy?: number;
    maxTrainingTime?: number;
    maxInferenceTime?: number;
  };
}

export interface SpaceAnalysis {
  dimensionality: number;
  complexity: 'low' | 'medium' | 'high' | 'extreme';
  estimatedSearchTime: number;
  recommendedSamplingStrategy: SamplingStrategy;
  potentialIssues: string[];
  searchEfficiency: number;
}

export class HyperparameterSpaceManager {
  private space: HyperparameterSpace;
  private constraints: SearchConstraints;
  private samplingHistory: HyperparameterConfig[] = [];
  private performanceHistory: Map<string, number> = new Map();
  private dependencyGraph: Map<string, string[]> = new Map();

  constructor(
    space: HyperparameterSpace,
    constraints: SearchConstraints = {}
  ) {
    this.space = space;
    this.constraints = constraints;
    this.buildDependencyGraph();
    this.validateSpace();
  }

  private buildDependencyGraph(): void {
    Object.entries(this.space).forEach(([paramName, dimension]) => {
      if (dimension.dependencies) {
        this.dependencyGraph.set(paramName, dimension.dependencies);
      }
    });
  }

  private validateSpace(): void {
    // Check for circular dependencies
    this.checkCircularDependencies();
    
    // Validate parameter definitions
    Object.entries(this.space).forEach(([name, dimension]) => {
      this.validateDimension(name, dimension);
    });
  }

  private checkCircularDependencies(): void {
    const visited = new Set<string>();
    const visiting = new Set<string>();
    
    const hasCycle = (param: string): boolean => {
      if (visiting.has(param)) return true;
      if (visited.has(param)) return false;
      
      visiting.add(param);
      const dependencies = this.dependencyGraph.get(param) || [];
      
      for (const dep of dependencies) {
        if (hasCycle(dep)) return true;
      }
      
      visiting.delete(param);
      visited.add(param);
      return false;
    };
    
    Object.keys(this.space).forEach(param => {
      if (hasCycle(param)) {
        throw new Error(`Circular dependency detected involving parameter: ${param}`);
      }
    });
  }

  private validateDimension(name: string, dimension: HyperparameterDimension): void {
    switch (dimension.type) {
      case 'continuous':
        if (!dimension.bounds) {
          throw new Error(`Continuous parameter ${name} must have bounds`);
        }
        if (dimension.bounds[0] >= dimension.bounds[1]) {
          throw new Error(`Invalid bounds for parameter ${name}`);
        }
        break;
        
      case 'discrete':
      case 'categorical':
      case 'ordinal':
        if (!dimension.values || dimension.values.length === 0) {
          throw new Error(`${dimension.type} parameter ${name} must have values`);
        }
        break;
    }
  }

  /**
   * Generate samples from the hyperparameter space
   */
  public generateSamples(
    nSamples: number,
    strategy: SamplingStrategy = { method: 'latin_hypercube' }
  ): HyperparameterConfig[] {
    const samples: HyperparameterConfig[] = [];
    
    switch (strategy.method) {
      case 'random':
        samples.push(...this.generateRandomSamples(nSamples, strategy.seed));
        break;
      case 'latin_hypercube':
        samples.push(...this.generateLatinHypercubeSamples(nSamples, strategy));
        break;
      case 'sobol':
        samples.push(...this.generateSobolSamples(nSamples));
        break;
      case 'halton':
        samples.push(...this.generateHaltonSamples(nSamples));
        break;
      case 'grid':
        samples.push(...this.generateGridSamples(nSamples));
        break;
      case 'adaptive':
        samples.push(...this.generateAdaptiveSamples(nSamples, strategy));
        break;
    }
    
    // Filter samples based on constraints
    const validSamples = samples.filter(sample => this.validateSample(sample));
    
    // Add to sampling history
    this.samplingHistory.push(...validSamples);
    
    return validSamples;
  }

  private generateRandomSamples(nSamples: number, seed?: number): HyperparameterConfig[] {
    if (seed !== undefined) {
      Math.seedrandom(seed.toString());
    }
    
    const samples: HyperparameterConfig[] = [];
    
    for (let i = 0; i < nSamples; i++) {
      const sample = this.sampleConfiguration();
      if (sample) {
        samples.push(sample);
      }
    }
    
    return samples;
  }

  private generateLatinHypercubeSamples(
    nSamples: number,
    strategy: SamplingStrategy
  ): HyperparameterConfig[] {
    const paramNames = Object.keys(this.space);
    const nDims = paramNames.length;
    
    // Generate Latin hypercube design
    const lhsMatrix = this.latinHypercubeDesign(nSamples, nDims, strategy.stratification);
    
    const samples: HyperparameterConfig[] = [];
    
    for (let i = 0; i < nSamples; i++) {
      const sample: HyperparameterConfig = {};
      
      paramNames.forEach((paramName, dimIndex) => {
        const dimension = this.space[paramName];
        const uniformValue = lhsMatrix[i][dimIndex];
        sample[paramName] = this.transformUniformToParameter(uniformValue, dimension);
      });
      
      // Handle dependencies and conditional parameters
      const validSample = this.resolveDependencies(sample);
      if (validSample) {
        samples.push(validSample);
      }
    }
    
    return samples;
  }

  private latinHypercubeDesign(nSamples: number, nDims: number, stratified: boolean = true): number[][] {
    const design: number[][] = [];
    
    for (let i = 0; i < nSamples; i++) {
      const sample: number[] = [];
      
      for (let j = 0; j < nDims; j++) {
        if (stratified) {
          // Stratified sampling within each interval
          const interval = i / nSamples;
          const nextInterval = (i + 1) / nSamples;
          sample.push(interval + Math.random() * (nextInterval - interval));
        } else {
          sample.push(Math.random());
        }
      }
      
      design.push(sample);
    }
    
    // Shuffle each dimension independently
    for (let j = 0; j < nDims; j++) {
      const column = design.map(row => row[j]);
      this.shuffleArray(column);
      design.forEach((row, i) => row[j] = column[i]);
    }
    
    return design;
  }

  private shuffleArray<T>(array: T[]): void {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  private generateSobolSamples(nSamples: number): HyperparameterConfig[] {
    // Simplified Sobol sequence generation
    const paramNames = Object.keys(this.space);
    const samples: HyperparameterConfig[] = [];
    
    for (let i = 0; i < nSamples; i++) {
      const sample: HyperparameterConfig = {};
      
      paramNames.forEach((paramName, dimIndex) => {
        const dimension = this.space[paramName];
        // Use van der Corput sequence as approximation for Sobol
        const uniformValue = this.vanDerCorputSequence(i, this.getPrime(dimIndex));
        sample[paramName] = this.transformUniformToParameter(uniformValue, dimension);
      });
      
      const validSample = this.resolveDependencies(sample);
      if (validSample) {
        samples.push(validSample);
      }
    }
    
    return samples;
  }

  private generateHaltonSamples(nSamples: number): HyperparameterConfig[] {
    const paramNames = Object.keys(this.space);
    const samples: HyperparameterConfig[] = [];
    
    for (let i = 0; i < nSamples; i++) {
      const sample: HyperparameterConfig = {};
      
      paramNames.forEach((paramName, dimIndex) => {
        const dimension = this.space[paramName];
        const base = this.getPrime(dimIndex);
        const uniformValue = this.haltonSequence(i + 1, base);
        sample[paramName] = this.transformUniformToParameter(uniformValue, dimension);
      });
      
      const validSample = this.resolveDependencies(sample);
      if (validSample) {
        samples.push(validSample);
      }
    }
    
    return samples;
  }

  private generateGridSamples(nSamples: number): HyperparameterConfig[] {
    const paramNames = Object.keys(this.space);
    const nDims = paramNames.length;
    const samplesPerDim = Math.ceil(Math.pow(nSamples, 1 / nDims));
    
    const gridPoints: number[][] = [];
    this.generateGridRecursive([], 0, paramNames, samplesPerDim, gridPoints);
    
    const samples: HyperparameterConfig[] = [];
    
    for (const point of gridPoints.slice(0, nSamples)) {
      const sample: HyperparameterConfig = {};
      
      paramNames.forEach((paramName, dimIndex) => {
        const dimension = this.space[paramName];
        sample[paramName] = this.transformUniformToParameter(point[dimIndex], dimension);
      });
      
      const validSample = this.resolveDependencies(sample);
      if (validSample) {
        samples.push(validSample);
      }
    }
    
    return samples;
  }

  private generateGridRecursive(
    currentPoint: number[],
    dimIndex: number,
    paramNames: string[],
    samplesPerDim: number,
    gridPoints: number[][]
  ): void {
    if (dimIndex === paramNames.length) {
      gridPoints.push([...currentPoint]);
      return;
    }
    
    for (let i = 0; i < samplesPerDim; i++) {
      const value = i / (samplesPerDim - 1);
      currentPoint[dimIndex] = value;
      this.generateGridRecursive(currentPoint, dimIndex + 1, paramNames, samplesPerDim, gridPoints);
    }
  }

  private generateAdaptiveSamples(
    nSamples: number,
    strategy: SamplingStrategy
  ): HyperparameterConfig[] {
    const samples: HyperparameterConfig[] = [];
    const adaptiveParams = strategy.adaptiveParams || {
      explorationRate: 0.3,
      exploitationThreshold: 0.7,
      diversityWeight: 0.5
    };
    
    for (let i = 0; i < nSamples; i++) {
      let sample: HyperparameterConfig;
      
      if (this.samplingHistory.length < 10 || Math.random() < adaptiveParams.explorationRate) {
        // Exploration: random sampling
        sample = this.sampleConfiguration()!;
      } else {
        // Exploitation: sample near best performing configurations
        sample = this.sampleNearBest(adaptiveParams);
      }
      
      // Ensure diversity
      if (this.calculateDiversity(sample, samples, strategy.diversityMetric) > 0.1) {
        samples.push(sample);
      } else {
        i--; // Retry if not diverse enough
      }
    }
    
    return samples;
  }

  private sampleNearBest(adaptiveParams: any): HyperparameterConfig {
    // Find best performing configurations
    const sortedConfigs = [...this.performanceHistory.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([configStr, _]) => JSON.parse(configStr));
    
    if (sortedConfigs.length === 0) {
      return this.sampleConfiguration()!;
    }
    
    // Select one of the best configurations randomly
    const baseConfig = sortedConfigs[Math.floor(Math.random() * sortedConfigs.length)];
    
    // Add noise to the base configuration
    const noisyConfig: HyperparameterConfig = {};
    
    Object.entries(this.space).forEach(([paramName, dimension]) => {
      const baseValue = baseConfig[paramName];
      noisyConfig[paramName] = this.addNoiseToParameter(baseValue, dimension);
    });
    
    return this.resolveDependencies(noisyConfig) || this.sampleConfiguration()!;
  }

  private addNoiseToParameter(value: any, dimension: HyperparameterDimension): any {
    const noiseLevel = 0.1; // 10% noise
    
    switch (dimension.type) {
      case 'continuous':
        const range = dimension.bounds![1] - dimension.bounds![0];
        const noise = (Math.random() - 0.5) * range * noiseLevel;
        return Math.max(dimension.bounds![0], Math.min(dimension.bounds![1], value + noise));
        
      case 'discrete':
        if (Math.random() < noiseLevel) {
          const randomIndex = Math.floor(Math.random() * dimension.values!.length);
          return dimension.values![randomIndex];
        }
        return value;
        
      case 'categorical':
      case 'ordinal':
        if (Math.random() < noiseLevel) {
          const currentIndex = dimension.values!.indexOf(value);
          const maxShift = Math.max(1, Math.floor(dimension.values!.length * noiseLevel));
          const shift = Math.floor(Math.random() * (2 * maxShift + 1)) - maxShift;
          const newIndex = Math.max(0, Math.min(dimension.values!.length - 1, currentIndex + shift));
          return dimension.values![newIndex];
        }
        return value;
        
      default:
        return value;
    }
  }

  private calculateDiversity(
    sample: HyperparameterConfig,
    existingSamples: HyperparameterConfig[],
    metric: string = 'euclidean'
  ): number {
    if (existingSamples.length === 0) return 1.0;
    
    const distances = existingSamples.map(existing => 
      this.calculateDistance(sample, existing, metric)
    );
    
    return Math.min(...distances);
  }

  private calculateDistance(
    config1: HyperparameterConfig,
    config2: HyperparameterConfig,
    metric: string
  ): number {
    const paramNames = Object.keys(this.space);
    let distance = 0;
    
    paramNames.forEach(paramName => {
      const dimension = this.space[paramName];
      const value1 = config1[paramName];
      const value2 = config2[paramName];
      
      let paramDistance = 0;
      
      switch (dimension.type) {
        case 'continuous':
          const normalizedValue1 = (value1 - dimension.bounds![0]) / (dimension.bounds![1] - dimension.bounds![0]);
          const normalizedValue2 = (value2 - dimension.bounds![0]) / (dimension.bounds![1] - dimension.bounds![0]);
          paramDistance = Math.abs(normalizedValue1 - normalizedValue2);
          break;
          
        case 'discrete':
        case 'ordinal':
          const index1 = dimension.values!.indexOf(value1);
          const index2 = dimension.values!.indexOf(value2);
          paramDistance = Math.abs(index1 - index2) / (dimension.values!.length - 1);
          break;
          
        case 'categorical':
          paramDistance = value1 === value2 ? 0 : 1;
          break;
      }
      
      switch (metric) {
        case 'euclidean':
          distance += paramDistance * paramDistance;
          break;
        case 'manhattan':
          distance += paramDistance;
          break;
        case 'cosine':
          // Simplified cosine distance approximation
          distance += 1 - Math.cos(paramDistance * Math.PI);
          break;
      }
    });
    
    return metric === 'euclidean' ? Math.sqrt(distance) : distance;
  }

  private sampleConfiguration(): HyperparameterConfig | null {
    const config: HyperparameterConfig = {};
    
    // Sample independent parameters first
    const independentParams = Object.entries(this.space)
      .filter(([_, dimension]) => !dimension.dependencies)
      .map(([name, _]) => name);
    
    independentParams.forEach(paramName => {
      const dimension = this.space[paramName];
      config[paramName] = this.sampleFromDimension(dimension);
    });
    
    // Resolve dependent parameters
    return this.resolveDependencies(config);
  }

  private sampleFromDimension(dimension: HyperparameterDimension): any {
    let uniformValue = Math.random();
    
    // Apply prior distribution if specified
    if (dimension.prior) {
      uniformValue = this.sampleFromPrior(dimension.prior, dimension.priorParams);
    }
    
    return this.transformUniformToParameter(uniformValue, dimension);
  }

  private sampleFromPrior(prior: string, priorParams: any): number {
    switch (prior) {
      case 'uniform':
        return Math.random();
      case 'normal':
        return this.sampleNormal(priorParams?.mean || 0.5, priorParams?.std || 0.2);
      case 'beta':
        return this.sampleBeta(priorParams?.alpha || 2, priorParams?.beta || 2);
      case 'gamma':
        return this.sampleGamma(priorParams?.shape || 2, priorParams?.scale || 0.5);
      default:
        return Math.random();
    }
  }

  private sampleNormal(mean: number, std: number): number {
    // Box-Muller transform
    const u1 = Math.random();
    const u2 = Math.random();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return Math.max(0, Math.min(1, mean + std * z));
  }

  private sampleBeta(alpha: number, beta: number): number {
    // Simple rejection sampling for beta distribution
    let sample: number;
    do {
      const u1 = Math.random();
      const u2 = Math.random();
      sample = Math.pow(u1, 1 / alpha) / (Math.pow(u1, 1 / alpha) + Math.pow(u2, 1 / beta));
    } while (isNaN(sample));
    return sample;
  }

  private sampleGamma(shape: number, scale: number): number {
    // Marsaglia's squeeze method (simplified)
    if (shape < 1) {
      return this.sampleGamma(shape + 1, scale) * Math.pow(Math.random(), 1 / shape);
    }
    
    const d = shape - 1 / 3;
    const c = 1 / Math.sqrt(9 * d);
    
    while (true) {
      let x: number;
      do {
        x = this.sampleNormal(0, 1);
      } while (x <= -1 / c);
      
      const v = Math.pow(1 + c * x, 3);
      const u = Math.random();
      
      if (u < 1 - 0.0331 * Math.pow(x, 4) ||
          Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) {
        return Math.min(1, d * v * scale);
      }
    }
  }

  private transformUniformToParameter(uniformValue: number, dimension: HyperparameterDimension): any {
    switch (dimension.type) {
      case 'continuous':
        let value = uniformValue;
        
        // Apply scaling
        if (dimension.scale === 'log') {
          const logMin = Math.log(dimension.bounds![0]);
          const logMax = Math.log(dimension.bounds![1]);
          value = Math.exp(logMin + value * (logMax - logMin));
        } else if (dimension.scale === 'logit') {
          value = 1 / (1 + Math.exp(-value));
        } else {
          value = dimension.bounds![0] + value * (dimension.bounds![1] - dimension.bounds![0]);
        }
        
        // Apply transformation
        return dimension.transform ? dimension.transform(value) : value;
        
      case 'discrete':
        const discreteIndex = Math.floor(uniformValue * dimension.values!.length);
        const discreteValue = dimension.values![Math.min(discreteIndex, dimension.values!.length - 1)];
        return dimension.transform ? dimension.transform(discreteValue) : discreteValue;
        
      case 'categorical':
      case 'ordinal':
        const catIndex = Math.floor(uniformValue * dimension.values!.length);
        const catValue = dimension.values![Math.min(catIndex, dimension.values!.length - 1)];
        return dimension.transform ? dimension.transform(catValue) : catValue;
        
      default:
        return uniformValue;
    }
  }

  private resolveDependencies(partialConfig: HyperparameterConfig): HyperparameterConfig | null {
    const config = { ...partialConfig };
    const resolved = new Set<string>(Object.keys(config));
    const toResolve = new Set<string>();
    
    // Find parameters that need to be resolved
    Object.entries(this.space).forEach(([paramName, dimension]) => {
      if (dimension.dependencies && !resolved.has(paramName)) {
        toResolve.add(paramName);
      }
    });
    
    // Resolve parameters in dependency order
    let maxIterations = 100;
    while (toResolve.size > 0 && maxIterations-- > 0) {
      const currentSize = toResolve.size;
      
      for (const paramName of toResolve) {
        const dimension = this.space[paramName];
        const dependencies = dimension.dependencies || [];
        
        // Check if all dependencies are resolved
        if (dependencies.every(dep => resolved.has(dep))) {
          // Handle conditional parameters
          if (dimension.conditional) {
            const conditionMet = dimension.conditional.when(config);
            const activeDimension = conditionMet 
              ? { ...dimension, ...dimension.conditional.then }
              : { ...dimension, ...dimension.conditional.else };
            
            config[paramName] = this.sampleFromDimension(activeDimension);
          } else {
            config[paramName] = this.sampleFromDimension(dimension);
          }
          
          resolved.add(paramName);
          toResolve.delete(paramName);
        }
      }
      
      // Break if no progress is made
      if (toResolve.size === currentSize) {
        console.warn('Could not resolve all dependencies');
        break;
      }
    }
    
    return this.validateSample(config) ? config : null;
  }

  private validateSample(config: HyperparameterConfig): boolean {
    // Check parameter-specific constraints
    for (const [paramName, dimension] of Object.entries(this.space)) {
      if (dimension.constraints && !dimension.constraints(config[paramName], config)) {
        return false;
      }
    }
    
    // Check global constraints
    if (this.constraints.globalConstraints && !this.constraints.globalConstraints(config)) {
      return false;
    }
    
    return true;
  }

  private vanDerCorputSequence(index: number, base: number): number {
    let result = 0;
    let f = 1 / base;
    let i = index;
    
    while (i > 0) {
      result += f * (i % base);
      i = Math.floor(i / base);
      f /= base;
    }
    
    return result;
  }

  private haltonSequence(index: number, base: number): number {
    let result = 0;
    let f = 1 / base;
    let i = index;
    
    while (i > 0) {
      result += f * (i % base);
      i = Math.floor(i / base);
      f /= base;
    }
    
    return result;
  }

  private getPrime(index: number): number {
    const primes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71];
    return primes[index % primes.length];
  }

  /**
   * Analyze the hyperparameter space
   */
  public analyzeSpace(): SpaceAnalysis {
    const paramNames = Object.keys(this.space);
    const dimensionality = paramNames.length;
    
    // Calculate total search space size
    let totalCombinations = 1;
    paramNames.forEach(paramName => {
      const dimension = this.space[paramName];
      switch (dimension.type) {
        case 'continuous':
          totalCombinations *= 1000; // Assume 1000 discrete points for continuous
          break;
        case 'discrete':
        case 'categorical':
        case 'ordinal':
          totalCombinations *= dimension.values!.length;
          break;
      }
    });
    
    // Determine complexity
    let complexity: 'low' | 'medium' | 'high' | 'extreme';
    if (dimensionality <= 5 && totalCombinations <= 1000) {
      complexity = 'low';
    } else if (dimensionality <= 10 && totalCombinations <= 100000) {
      complexity = 'medium';
    } else if (dimensionality <= 20 && totalCombinations <= 10000000) {
      complexity = 'high';
    } else {
      complexity = 'extreme';
    }
    
    // Estimate search time (in arbitrary units)
    const estimatedSearchTime = Math.log(totalCombinations) * dimensionality;
    
    // Recommend sampling strategy
    const recommendedSamplingStrategy = this.recommendSamplingStrategy(complexity, dimensionality);
    
    // Identify potential issues
    const potentialIssues = this.identifyPotentialIssues();
    
    // Calculate search efficiency
    const searchEfficiency = this.calculateSearchEfficiency(complexity, dimensionality);
    
    return {
      dimensionality,
      complexity,
      estimatedSearchTime,
      recommendedSamplingStrategy,
      potentialIssues,
      searchEfficiency
    };
  }

  private recommendSamplingStrategy(complexity: string, dimensionality: number): SamplingStrategy {
    switch (complexity) {
      case 'low':
        return { method: 'grid', nSamples: 100 };
      case 'medium':
        return { method: 'latin_hypercube', nSamples: 200, stratification: true };
      case 'high':
        return { 
          method: 'adaptive', 
          nSamples: 500,
          adaptiveParams: {
            explorationRate: 0.4,
            exploitationThreshold: 0.6,
            diversityWeight: 0.6
          }
        };
      case 'extreme':
        return {
          method: 'sobol',
          nSamples: 1000
        };
      default:
        return { method: 'latin_hypercube', nSamples: 100 };
    }
  }

  private identifyPotentialIssues(): string[] {
    const issues: string[] = [];
    
    // Check for high dimensionality
    if (Object.keys(this.space).length > 15) {
      issues.push('High dimensionality may lead to curse of dimensionality');
    }
    
    // Check for mixed parameter types
    const types = Object.values(this.space).map(d => d.type);
    const uniqueTypes = new Set(types);
    if (uniqueTypes.size > 2) {
      issues.push('Mixed parameter types may complicate optimization');
    }
    
    // Check for log-scale parameters
    const hasLogScale = Object.values(this.space).some(d => d.scale === 'log');
    if (hasLogScale) {
      issues.push('Log-scale parameters require careful handling');
    }
    
    // Check for dependencies
    const hasDependencies = Object.values(this.space).some(d => d.dependencies);
    if (hasDependencies) {
      issues.push('Parameter dependencies may reduce search efficiency');
    }
    
    // Check for conditional parameters
    const hasConditionals = Object.values(this.space).some(d => d.conditional);
    if (hasConditionals) {
      issues.push('Conditional parameters add complexity to the search space');
    }
    
    return issues;
  }

  private calculateSearchEfficiency(complexity: string, dimensionality: number): number {
    let efficiency = 1.0;
    
    // Penalty for high dimensionality
    efficiency *= Math.exp(-dimensionality / 20);
    
    // Penalty for complexity
    const complexityPenalty = {
      'low': 1.0,
      'medium': 0.8,
      'high': 0.6,
      'extreme': 0.4
    };
    efficiency *= complexityPenalty[complexity as keyof typeof complexityPenalty];
    
    // Penalty for dependencies and conditionals
    const dependentParams = Object.values(this.space).filter(d => d.dependencies).length;
    const conditionalParams = Object.values(this.space).filter(d => d.conditional).length;
    efficiency *= Math.exp(-(dependentParams + conditionalParams) / 10);
    
    return Math.max(0.1, efficiency);
  }

  /**
   * Update performance history for adaptive sampling
   */
  public updatePerformance(config: HyperparameterConfig, performance: number): void {
    const configKey = JSON.stringify(config);
    this.performanceHistory.set(configKey, performance);
  }

  /**
   * Get optimal configuration from history
   */
  public getBestConfiguration(): { config: HyperparameterConfig; performance: number } | null {
    if (this.performanceHistory.size === 0) return null;
    
    const best = [...this.performanceHistory.entries()]
      .reduce((best, current) => current[1] > best[1] ? current : best);
    
    return {
      config: JSON.parse(best[0]),
      performance: best[1]
    };
  }

  /**
   * Export space definition
   */
  public exportSpace(): any {
    return {
      space: this.space,
      constraints: this.constraints,
      analysis: this.analyzeSpace(),
      samplingHistory: this.samplingHistory.length,
      performanceHistory: this.performanceHistory.size
    };
  }
}

/**
 * Predefined hyperparameter spaces for common ML models
 */
export const PredefinedSpaces = {
  neuralNetwork: (): HyperparameterSpace => ({
    learningRate: {
      type: 'continuous',
      bounds: [1e-5, 1e-1],
      scale: 'log',
      prior: 'uniform'
    },
    batchSize: {
      type: 'discrete',
      values: [16, 32, 64, 128, 256, 512]
    },
    hiddenLayers: {
      type: 'discrete',
      values: [1, 2, 3, 4, 5]
    },
    hiddenUnits: {
      type: 'discrete',
      values: [32, 64, 128, 256, 512, 1024],
      dependencies: ['hiddenLayers']
    },
    activation: {
      type: 'categorical',
      values: ['relu', 'tanh', 'sigmoid', 'leaky_relu', 'elu']
    },
    optimizer: {
      type: 'categorical',
      values: ['adam', 'sgd', 'rmsprop', 'adagrad']
    },
    dropout: {
      type: 'continuous',
      bounds: [0.0, 0.8],
      conditional: {
        when: (config) => config.hiddenLayers > 2,
        then: { bounds: [0.1, 0.5] },
        else: { bounds: [0.0, 0.3] }
      }
    }
  }),

  cnn: (): HyperparameterSpace => ({
    learningRate: {
      type: 'continuous',
      bounds: [1e-5, 1e-2],
      scale: 'log'
    },
    batchSize: {
      type: 'discrete',
      values: [8, 16, 32, 64, 128]
    },
    convLayers: {
      type: 'discrete',
      values: [2, 3, 4, 5, 6]
    },
    filters: {
      type: 'discrete',
      values: [32, 64, 128, 256, 512]
    },
    kernelSize: {
      type: 'discrete',
      values: [3, 5, 7]
    },
    poolingSize: {
      type: 'discrete',
      values: [2, 3, 4]
    },
    dropout: {
      type: 'continuous',
      bounds: [0.0, 0.6]
    },
    l2Regularization: {
      type: 'continuous',
      bounds: [1e-6, 1e-2],
      scale: 'log'
    }
  }),

  rnn: (): HyperparameterSpace => ({
    learningRate: {
      type: 'continuous',
      bounds: [1e-4, 1e-2],
      scale: 'log'
    },
    batchSize: {
      type: 'discrete',
      values: [16, 32, 64, 128]
    },
    sequenceLength: {
      type: 'discrete',
      values: [10, 20, 50, 100, 200]
    },
    rnnType: {
      type: 'categorical',
      values: ['lstm', 'gru', 'simple_rnn']
    },
    hiddenUnits: {
      type: 'discrete',
      values: [64, 128, 256, 512, 1024]
    },
    layers: {
      type: 'discrete',
      values: [1, 2, 3, 4]
    },
    dropout: {
      type: 'continuous',
      bounds: [0.0, 0.5]
    },
    recurrentDropout: {
      type: 'continuous',
      bounds: [0.0, 0.3],
      conditional: {
        when: (config) => config.rnnType !== 'simple_rnn',
        then: { bounds: [0.0, 0.3] },
        else: { bounds: [0.0, 0.1] }
      }
    }
  })
};

// Extend Math object to include seedrandom (if available)
declare global {
  interface Math {
    seedrandom?: (seed: string) => void;
  }
}