import * as tf from '@tensorflow/tfjs-node';
import { EventEmitter } from 'events';
import { logger } from '../../utils/logger';

/**
 * Population-Based Training (PBT) for Neural Network Optimization
 * Combines random search with evolutionary optimization for hyperparameter tuning
 * and model architecture optimization during training
 */
export class PopulationBasedTraining extends EventEmitter {
  private readonly config: PBTConfig;
  private population: PBTMember[] = [];
  private generation: number = 0;
  private globalBestMember: PBTMember | null = null;
  private trainingHistory: PBTGenerationHistory[] = [];
  private populationStats: PopulationStatistics[] = [];

  constructor(config: Partial<PBTConfig> = {}) {
    super();
    
    this.config = {
      populationSize: 20,
      maxGenerations: 50,
      trainingStepsPerGeneration: 1000,
      truncationPercentage: 0.2,
      mutationProbability: 0.8,
      mutationStrength: 0.1,
      resampleProbability: 0.25,
      elitePercentage: 0.1,
      diversityPenalty: 0.1,
      convergenceThreshold: 0.001,
      parallelTraining: true,
      maxParallelJobs: 4,
      modelFactory: null,
      hyperparameterSpace: {},
      fitnessFunction: 'validation_accuracy',
      ...config
    };

    if (!this.config.modelFactory) {
      throw new Error('Model factory function is required for PBT');
    }
  }

  /**
   * Initialize population with diverse hyperparameters
   */
  public async initializePopulation(): Promise<void> {
    try {
      logger.info(`Initializing PBT population with ${this.config.populationSize} members`);
      
      this.population = [];
      const initPromises: Promise<PBTMember>[] = [];

      for (let i = 0; i < this.config.populationSize; i++) {
        initPromises.push(this.createMember(i));
      }

      // Initialize members in parallel
      if (this.config.parallelTraining) {
        const chunks = this.chunkArray(initPromises, this.config.maxParallelJobs);
        for (const chunk of chunks) {
          const members = await Promise.all(chunk);
          this.population.push(...members);
        }
      } else {
        for (const promise of initPromises) {
          const member = await promise;
          this.population.push(member);
        }
      }

      logger.info(`Population initialized with ${this.population.length} members`);
      this.emit('populationInitialized', { population: this.population });

    } catch (error) {
      logger.error('Failed to initialize population:', error);
      throw error;
    }
  }

  /**
   * Execute population-based training
   */
  public async train(): Promise<PBTResult> {
    try {
      logger.info('Starting Population-Based Training');
      this.emit('trainingStart', { config: this.config });

      // Initialize population if not already done
      if (this.population.length === 0) {
        await this.initializePopulation();
      }

      // Main training loop
      for (this.generation = 0; this.generation < this.config.maxGenerations; this.generation++) {
        logger.info(`Starting generation ${this.generation + 1}/${this.config.maxGenerations}`);
        
        // Train all members for specified steps
        await this.trainGeneration();
        
        // Evaluate population
        await this.evaluatePopulation();
        
        // Record statistics
        this.recordGenerationStats();
        
        // Check for convergence
        if (this.hasConverged()) {
          logger.info(`Population converged at generation ${this.generation + 1}`);
          break;
        }
        
        // Evolve population (except for last generation)
        if (this.generation < this.config.maxGenerations - 1) {
          await this.evolvePopulation();
        }

        // Emit progress
        this.emit('generationComplete', {
          generation: this.generation,
          bestFitness: this.globalBestMember?.fitness || 0,
          populationStats: this.populationStats[this.populationStats.length - 1]
        });
      }

      // Prepare final result
      const result = this.prepareFinalResult();
      
      this.emit('trainingComplete', result);
      logger.info('Population-Based Training completed');
      
      return result;

    } catch (error) {
      logger.error('PBT training failed:', error);
      this.emit('trainingError', error);
      throw error;
    }
  }

  /**
   * Create a new population member
   */
  private async createMember(id: number): Promise<PBTMember> {
    try {
      // Sample hyperparameters
      const hyperparameters = this.sampleHyperparameters();
      
      // Create model using factory
      const model = await this.config.modelFactory!(hyperparameters);
      
      const member: PBTMember = {
        id,
        model,
        hyperparameters,
        fitness: 0,
        trainingHistory: [],
        age: 0,
        parentIds: [],
        mutationHistory: [],
        isElite: false,
        diversity: 0
      };

      return member;

    } catch (error) {
      logger.error(`Failed to create member ${id}:`, error);
      throw error;
    }
  }

  /**
   * Sample hyperparameters from space
   */
  private sampleHyperparameters(): any {
    const hyperparams: any = {};
    
    for (const [name, space] of Object.entries(this.config.hyperparameterSpace)) {
      hyperparams[name] = this.sampleFromSpace(space);
    }
    
    return hyperparams;
  }

  /**
   * Sample value from hyperparameter space
   */
  private sampleFromSpace(space: HyperparameterSpace): any {
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
        return space.values[0];
    }
  }

  /**
   * Train all members for one generation
   */
  private async trainGeneration(): Promise<void> {
    const trainingPromises = this.population.map(async (member) => {
      try {
        return await this.trainMember(member);
      } catch (error) {
        logger.warn(`Failed to train member ${member.id}:`, error);
        return member;
      }
    });

    if (this.config.parallelTraining) {
      // Train in parallel batches
      const chunks = this.chunkArray(trainingPromises, this.config.maxParallelJobs);
      for (const chunk of chunks) {
        await Promise.all(chunk);
      }
    } else {
      // Train sequentially
      for (const promise of trainingPromises) {
        await promise;
      }
    }
  }

  /**
   * Train a single member
   */
  private async trainMember(member: PBTMember): Promise<PBTMember> {
    try {
      // Simulate training steps (would be replaced with actual training)
      const trainingMetrics = await this.simulateTraining(
        member.model,
        this.config.trainingStepsPerGeneration
      );

      // Update member
      member.trainingHistory.push(...trainingMetrics);
      member.age++;

      return member;

    } catch (error) {
      logger.error(`Error training member ${member.id}:`, error);
      throw error;
    }
  }

  /**
   * Simulate training process
   */
  private async simulateTraining(
    model: tf.LayersModel,
    steps: number
  ): Promise<TrainingMetrics[]> {
    const metrics: TrainingMetrics[] = [];
    
    // Simulate training loop
    for (let step = 0; step < steps; step++) {
      // Simulate training step
      const loss = Math.random() * 0.1 + 0.05; // Random loss between 0.05 and 0.15
      const accuracy = Math.min(0.99, 0.5 + (step / steps) * 0.4 + Math.random() * 0.1);
      
      if (step % 100 === 0) {
        metrics.push({
          step,
          loss,
          accuracy,
          timestamp: Date.now()
        });
      }
    }

    return metrics;
  }

  /**
   * Evaluate all members in population
   */
  private async evaluatePopulation(): Promise<void> {
    for (const member of this.population) {
      // Calculate fitness based on training history
      member.fitness = this.calculateFitness(member);
      
      // Calculate diversity
      member.diversity = this.calculateDiversity(member);
      
      // Apply diversity penalty
      const adjustedFitness = member.fitness - (this.config.diversityPenalty * (1 - member.diversity));
      member.fitness = adjustedFitness;
    }

    // Sort population by fitness
    this.population.sort((a, b) => b.fitness - a.fitness);

    // Update global best
    if (!this.globalBestMember || this.population[0].fitness > this.globalBestMember.fitness) {
      this.globalBestMember = { ...this.population[0] };
    }

    // Mark elite members
    const eliteCount = Math.ceil(this.config.populationSize * this.config.elitePercentage);
    this.population.forEach((member, index) => {
      member.isElite = index < eliteCount;
    });
  }

  /**
   * Calculate fitness for a member
   */
  private calculateFitness(member: PBTMember): number {
    if (member.trainingHistory.length === 0) return 0;

    // Use latest metrics
    const latest = member.trainingHistory[member.trainingHistory.length - 1];
    
    switch (this.config.fitnessFunction) {
      case 'validation_accuracy':
        return latest.accuracy;
      case 'negative_loss':
        return -latest.loss;
      case 'combined':
        return latest.accuracy - latest.loss;
      default:
        return latest.accuracy;
    }
  }

  /**
   * Calculate diversity of a member relative to population
   */
  private calculateDiversity(member: PBTMember): number {
    if (this.population.length < 2) return 1;

    let totalDistance = 0;
    let count = 0;

    for (const other of this.population) {
      if (other.id !== member.id) {
        const distance = this.calculateHyperparameterDistance(
          member.hyperparameters,
          other.hyperparameters
        );
        totalDistance += distance;
        count++;
      }
    }

    return count > 0 ? totalDistance / count : 1;
  }

  /**
   * Calculate distance between hyperparameter sets
   */
  private calculateHyperparameterDistance(params1: any, params2: any): number {
    const keys = Object.keys(this.config.hyperparameterSpace);
    let distance = 0;
    let count = 0;

    for (const key of keys) {
      const space = this.config.hyperparameterSpace[key];
      const val1 = params1[key];
      const val2 = params2[key];

      if (space.type === 'continuous' || space.type === 'integer') {
        const range = space.bounds[1] - space.bounds[0];
        const normDist = Math.abs(val1 - val2) / range;
        distance += normDist;
      } else {
        // Categorical/discrete: 0 if same, 1 if different
        distance += val1 === val2 ? 0 : 1;
      }
      count++;
    }

    return count > 0 ? distance / count : 0;
  }

  /**
   * Evolve population using truncation selection and mutation
   */
  private async evolvePopulation(): Promise<void> {
    logger.info(`Evolving population for generation ${this.generation + 1}`);

    // Determine truncation point
    const truncationPoint = Math.floor(this.config.populationSize * this.config.truncationPercentage);
    const eliteCount = Math.ceil(this.config.populationSize * this.config.elitePercentage);

    // Keep elite members
    const newPopulation: PBTMember[] = [];
    
    // Copy elite members
    for (let i = 0; i < eliteCount; i++) {
      newPopulation.push({ ...this.population[i] });
    }

    // Fill rest through exploitation and exploration
    const remainingSlots = this.config.populationSize - eliteCount;
    const exploitSlots = Math.floor(remainingSlots * (1 - this.config.resampleProbability));
    const exploreSlots = remainingSlots - exploitSlots;

    // Exploitation: copy and mutate good members
    for (let i = 0; i < exploitSlots; i++) {
      const parentIndex = Math.floor(Math.random() * truncationPoint);
      const parent = this.population[parentIndex];
      const child = await this.createChildFromParent(parent);
      newPopulation.push(child);
    }

    // Exploration: create new random members
    for (let i = 0; i < exploreSlots; i++) {
      const newMember = await this.createMember(this.config.populationSize + i);
      newPopulation.push(newMember);
    }

    this.population = newPopulation;
  }

  /**
   * Create child member from parent through mutation
   */
  private async createChildFromParent(parent: PBTMember): Promise<PBTMember> {
    // Copy parent hyperparameters
    let childHyperparams = { ...parent.hyperparameters };

    // Apply mutations
    const mutations: string[] = [];
    if (Math.random() < this.config.mutationProbability) {
      childHyperparams = this.mutateHyperparameters(childHyperparams, mutations);
    }

    // Create new model with mutated hyperparameters
    const childModel = await this.config.modelFactory!(childHyperparams);

    // Copy weights from parent (transfer learning)
    await this.transferWeights(parent.model, childModel);

    const child: PBTMember = {
      id: this.generateMemberId(),
      model: childModel,
      hyperparameters: childHyperparams,
      fitness: 0,
      trainingHistory: [],
      age: 0,
      parentIds: [parent.id],
      mutationHistory: mutations,
      isElite: false,
      diversity: 0
    };

    return child;
  }

  /**
   * Mutate hyperparameters
   */
  private mutateHyperparameters(hyperparams: any, mutations: string[]): any {
    const mutated = { ...hyperparams };

    for (const [name, space] of Object.entries(this.config.hyperparameterSpace)) {
      if (Math.random() < 0.3) { // 30% chance to mutate each parameter
        const oldValue = mutated[name];
        mutated[name] = this.mutateParameter(oldValue, space);
        mutations.push(`${name}: ${oldValue} -> ${mutated[name]}`);
      }
    }

    return mutated;
  }

  /**
   * Mutate a single parameter
   */
  private mutateParameter(currentValue: any, space: HyperparameterSpace): any {
    switch (space.type) {
      case 'continuous':
        const range = space.bounds[1] - space.bounds[0];
        const mutation = (Math.random() - 0.5) * range * this.config.mutationStrength;
        let newValue = currentValue + mutation;
        newValue = Math.max(space.bounds[0], Math.min(space.bounds[1], newValue));
        return space.transform ? space.transform(newValue) : newValue;

      case 'integer':
        const intRange = space.bounds[1] - space.bounds[0];
        const intMutation = Math.floor((Math.random() - 0.5) * intRange * this.config.mutationStrength);
        let newIntValue = currentValue + intMutation;
        newIntValue = Math.max(space.bounds[0], Math.min(space.bounds[1], newIntValue));
        return newIntValue;

      case 'discrete':
      case 'categorical':
        // Random selection from available values
        return space.values[Math.floor(Math.random() * space.values.length)];

      default:
        return currentValue;
    }
  }

  /**
   * Transfer weights from parent to child model
   */
  private async transferWeights(parentModel: tf.LayersModel, childModel: tf.LayersModel): Promise<void> {
    try {
      // Simple weight transfer - copy compatible layers
      const parentWeights = parentModel.getWeights();
      const childWeights = childModel.getWeights();

      const transferableWeights: tf.Tensor[] = [];
      for (let i = 0; i < Math.min(parentWeights.length, childWeights.length); i++) {
        const parentWeight = parentWeights[i];
        const childWeight = childWeights[i];

        // Check if shapes are compatible
        if (this.arraysEqual(parentWeight.shape, childWeight.shape)) {
          transferableWeights.push(parentWeight);
        } else {
          // Keep child's random weights if shapes don't match
          transferableWeights.push(childWeight);
        }
      }

      // Add remaining child weights if child has more layers
      for (let i = transferableWeights.length; i < childWeights.length; i++) {
        transferableWeights.push(childWeights[i]);
      }

      childModel.setWeights(transferableWeights);

    } catch (error) {
      logger.warn('Failed to transfer weights, using random initialization:', error);
    }
  }

  /**
   * Check if arrays are equal
   */
  private arraysEqual(a: number[], b: number[]): boolean {
    return a.length === b.length && a.every((val, index) => val === b[index]);
  }

  /**
   * Generate unique member ID
   */
  private generateMemberId(): number {
    return Date.now() + Math.floor(Math.random() * 1000);
  }

  /**
   * Record generation statistics
   */
  private recordGenerationStats(): void {
    const fitnesses = this.population.map(m => m.fitness);
    const diversities = this.population.map(m => m.diversity);
    const ages = this.population.map(m => m.age);

    const stats: PopulationStatistics = {
      generation: this.generation,
      bestFitness: Math.max(...fitnesses),
      averageFitness: fitnesses.reduce((a, b) => a + b, 0) / fitnesses.length,
      worstFitness: Math.min(...fitnesses),
      fitnessStd: this.calculateStandardDeviation(fitnesses),
      averageDiversity: diversities.reduce((a, b) => a + b, 0) / diversities.length,
      averageAge: ages.reduce((a, b) => a + b, 0) / ages.length,
      eliteCount: this.population.filter(m => m.isElite).length,
      timestamp: Date.now()
    };

    this.populationStats.push(stats);

    const generationHistory: PBTGenerationHistory = {
      generation: this.generation,
      population: this.population.map(m => ({
        id: m.id,
        fitness: m.fitness,
        hyperparameters: { ...m.hyperparameters },
        parentIds: [...m.parentIds],
        isElite: m.isElite
      })),
      statistics: stats
    };

    this.trainingHistory.push(generationHistory);
  }

  /**
   * Calculate standard deviation
   */
  private calculateStandardDeviation(values: number[]): number {
    if (values.length < 2) return 0;

    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(value => Math.pow(value - mean, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / (values.length - 1);

    return Math.sqrt(variance);
  }

  /**
   * Check if population has converged
   */
  private hasConverged(): boolean {
    if (this.populationStats.length < 5) return false;

    const recentStats = this.populationStats.slice(-5);
    const fitnessVariance = this.calculateStandardDeviation(
      recentStats.map(s => s.bestFitness)
    );

    return fitnessVariance < this.config.convergenceThreshold;
  }

  /**
   * Prepare final result
   */
  private prepareFinalResult(): PBTResult {
    return {
      bestMember: this.globalBestMember!,
      finalPopulation: this.population,
      trainingHistory: this.trainingHistory,
      populationStats: this.populationStats,
      totalGenerations: this.generation + 1,
      converged: this.hasConverged(),
      config: this.config
    };
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
   * Get current best member
   */
  public getBestMember(): PBTMember | null {
    return this.globalBestMember;
  }

  /**
   * Get population statistics
   */
  public getPopulationStats(): PopulationStatistics[] {
    return [...this.populationStats];
  }

  /**
   * Export training results
   */
  public exportResults(): PBTExport {
    return {
      bestMember: this.globalBestMember,
      trainingHistory: this.trainingHistory,
      populationStats: this.populationStats,
      config: this.config,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Dispose of all models in population
   */
  public dispose(): void {
    for (const member of this.population) {
      if (member.model) {
        member.model.dispose();
      }
    }
    
    if (this.globalBestMember?.model) {
      this.globalBestMember.model.dispose();
    }
  }
}

// Type definitions
export interface PBTConfig {
  populationSize: number;
  maxGenerations: number;
  trainingStepsPerGeneration: number;
  truncationPercentage: number;
  mutationProbability: number;
  mutationStrength: number;
  resampleProbability: number;
  elitePercentage: number;
  diversityPenalty: number;
  convergenceThreshold: number;
  parallelTraining: boolean;
  maxParallelJobs: number;
  modelFactory: ((hyperparams: any) => Promise<tf.LayersModel>) | null;
  hyperparameterSpace: { [key: string]: HyperparameterSpace };
  fitnessFunction: string;
}

export interface PBTMember {
  id: number;
  model: tf.LayersModel;
  hyperparameters: any;
  fitness: number;
  trainingHistory: TrainingMetrics[];
  age: number;
  parentIds: number[];
  mutationHistory: string[];
  isElite: boolean;
  diversity: number;
}

export interface HyperparameterSpace {
  type: 'continuous' | 'discrete' | 'categorical' | 'integer';
  bounds?: [number, number];
  values?: any[];
  scale?: 'linear' | 'log';
  transform?: (value: any) => any;
}

export interface TrainingMetrics {
  step: number;
  loss: number;
  accuracy: number;
  timestamp: number;
}

export interface PopulationStatistics {
  generation: number;
  bestFitness: number;
  averageFitness: number;
  worstFitness: number;
  fitnessStd: number;
  averageDiversity: number;
  averageAge: number;
  eliteCount: number;
  timestamp: number;
}

export interface PBTGenerationHistory {
  generation: number;
  population: Array<{
    id: number;
    fitness: number;
    hyperparameters: any;
    parentIds: number[];
    isElite: boolean;
  }>;
  statistics: PopulationStatistics;
}

export interface PBTResult {
  bestMember: PBTMember;
  finalPopulation: PBTMember[];
  trainingHistory: PBTGenerationHistory[];
  populationStats: PopulationStatistics[];
  totalGenerations: number;
  converged: boolean;
  config: PBTConfig;
}

export interface PBTExport {
  bestMember: PBTMember | null;
  trainingHistory: PBTGenerationHistory[];
  populationStats: PopulationStatistics[];
  config: PBTConfig;
  timestamp: string;
}

/**
 * Factory function to create PBT optimizer
 */
export function createPopulationBasedTraining(
  modelFactory: (hyperparams: any) => Promise<tf.LayersModel>,
  hyperparameterSpace: { [key: string]: HyperparameterSpace },
  config?: Partial<PBTConfig>
): PopulationBasedTraining {
  return new PopulationBasedTraining({
    modelFactory,
    hyperparameterSpace,
    ...config
  });
}