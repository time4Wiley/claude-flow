import * as tf from '@tensorflow/tfjs-node';
import { logger } from '../../utils/logger';

/**
 * Model ensemble for robust predictions and improved performance
 * Supports multiple ensemble strategies and automatic model selection
 */
export class ModelEnsemble {
  private models: EnsembleModel[] = [];
  private readonly config: ModelEnsembleConfig;
  private ensembleWeights: number[] = [];
  private performanceHistory: EnsemblePerformance[] = [];

  constructor(config?: Partial<ModelEnsembleConfig>) {
    this.config = {
      strategy: 'weighted_average',
      maxModels: 10,
      diversityThreshold: 0.1,
      performanceWeight: 0.7,
      diversityWeight: 0.3,
      autoRebalance: true,
      rebalanceFrequency: 100,
      ...config
    };
  }

  /**
   * Add a model to the ensemble
   */
  public async addModel(
    model: tf.LayersModel,
    name: string,
    metadata?: ModelMetadata
  ): Promise<void> {
    try {
      if (this.models.length >= this.config.maxModels) {
        await this.removeWeakestModel();
      }

      const ensembleModel: EnsembleModel = {
        model,
        name,
        weight: 1.0,
        performance: {
          accuracy: 0,
          loss: Infinity,
          predictions: 0,
          lastUpdated: Date.now()
        },
        metadata: metadata || {},
        id: this.generateModelId()
      };

      this.models.push(ensembleModel);
      this.updateWeights();

      logger.info(`Added model '${name}' to ensemble. Total models: ${this.models.length}`);

    } catch (error) {
      logger.error('Error adding model to ensemble:', error);
      throw error;
    }
  }

  /**
   * Make ensemble predictions
   */
  public async predict(input: tf.Tensor | tf.Tensor[]): Promise<EnsemblePrediction> {
    if (this.models.length === 0) {
      throw new Error('No models in ensemble');
    }

    try {
      const startTime = Date.now();
      
      // Get predictions from all models
      const modelPredictions = await Promise.all(
        this.models.map(async (ensembleModel, index) => {
          try {
            const prediction = ensembleModel.model.predict(input) as tf.Tensor;
            return {
              modelId: ensembleModel.id,
              modelName: ensembleModel.name,
              prediction,
              weight: this.ensembleWeights[index] || ensembleModel.weight,
              confidence: await this.calculateConfidence(prediction)
            };
          } catch (error) {
            logger.warn(`Model ${ensembleModel.name} failed to predict:`, error);
            return null;
          }
        })
      );

      // Filter out failed predictions
      const validPredictions = modelPredictions.filter(p => p !== null) as ModelPrediction[];

      if (validPredictions.length === 0) {
        throw new Error('All models failed to make predictions');
      }

      // Combine predictions based on strategy
      const ensemblePrediction = await this.combinePredictions(validPredictions);

      // Calculate ensemble metrics
      const uncertainty = this.calculateUncertainty(validPredictions);
      const agreement = this.calculateAgreement(validPredictions);

      // Update performance tracking
      this.updatePredictionCount();

      const result: EnsemblePrediction = {
        prediction: ensemblePrediction.prediction,
        confidence: ensemblePrediction.confidence,
        uncertainty,
        agreement,
        modelContributions: validPredictions.map(p => ({
          modelId: p.modelId,
          modelName: p.modelName,
          weight: p.weight,
          confidence: p.confidence
        })),
        strategy: this.config.strategy,
        predictionTime: Date.now() - startTime
      };

      // Cleanup individual predictions
      validPredictions.forEach(p => p.prediction.dispose());

      return result;

    } catch (error) {
      logger.error('Error making ensemble prediction:', error);
      throw error;
    }
  }

  /**
   * Combine predictions based on ensemble strategy
   */
  private async combinePredictions(predictions: ModelPrediction[]): Promise<{
    prediction: tf.Tensor;
    confidence: number;
  }> {
    switch (this.config.strategy) {
      case 'simple_average':
        return this.simpleAverage(predictions);
      case 'weighted_average':
        return this.weightedAverage(predictions);
      case 'voting':
        return this.votingEnsemble(predictions);
      case 'stacking':
        return this.stackingEnsemble(predictions);
      case 'dynamic_selection':
        return this.dynamicSelection(predictions);
      default:
        return this.weightedAverage(predictions);
    }
  }

  /**
   * Simple average ensemble
   */
  private async simpleAverage(predictions: ModelPrediction[]): Promise<{
    prediction: tf.Tensor;
    confidence: number;
  }> {
    const tensors = predictions.map(p => p.prediction);
    const avgPrediction = tf.mean(tf.stack(tensors), 0);
    const avgConfidence = predictions.reduce((sum, p) => sum + p.confidence, 0) / predictions.length;

    return {
      prediction: avgPrediction,
      confidence: avgConfidence
    };
  }

  /**
   * Weighted average ensemble
   */
  private async weightedAverage(predictions: ModelPrediction[]): Promise<{
    prediction: tf.Tensor;
    confidence: number;
  }> {
    const totalWeight = predictions.reduce((sum, p) => sum + p.weight, 0);
    
    if (totalWeight === 0) {
      return this.simpleAverage(predictions);
    }

    // Create weighted tensors
    const weightedTensors = predictions.map(p => 
      tf.mul(p.prediction, tf.scalar(p.weight / totalWeight))
    );

    const weightedPrediction = tf.sum(tf.stack(weightedTensors), 0);
    const weightedConfidence = predictions.reduce((sum, p) => 
      sum + (p.confidence * p.weight / totalWeight), 0
    );

    // Cleanup
    weightedTensors.forEach(t => t.dispose());

    return {
      prediction: weightedPrediction,
      confidence: weightedConfidence
    };
  }

  /**
   * Voting ensemble (for classification)
   */
  private async votingEnsemble(predictions: ModelPrediction[]): Promise<{
    prediction: tf.Tensor;
    confidence: number;
  }> {
    // Convert predictions to class votes
    const votes: number[][] = [];
    
    for (const pred of predictions) {
      const predData = await pred.prediction.data();
      const classVote = Array.from(predData).map((prob, idx) => prob > 0.5 ? idx : -1);
      votes.push(classVote);
    }

    // Count votes for each class
    const numClasses = predictions[0].prediction.shape[predictions[0].prediction.shape.length - 1];
    const voteCounts = new Array(numClasses).fill(0);

    votes.forEach(vote => {
      vote.forEach(classIdx => {
        if (classIdx >= 0) {
          voteCounts[classIdx]++;
        }
      });
    });

    // Create final prediction based on majority vote
    const maxVotes = Math.max(...voteCounts);
    const finalPrediction = voteCounts.map(count => count / predictions.length);
    
    const confidence = maxVotes / predictions.length;

    return {
      prediction: tf.tensor(finalPrediction),
      confidence
    };
  }

  /**
   * Stacking ensemble (meta-learning)
   */
  private async stackingEnsemble(predictions: ModelPrediction[]): Promise<{
    prediction: tf.Tensor;
    confidence: number;
  }> {
    // Simplified stacking - in production, would train a meta-model
    // For now, use performance-weighted combination
    const performanceWeights = this.models.map(model => {
      const perf = model.performance;
      return perf.accuracy > 0 ? perf.accuracy : 1.0 / (1.0 + perf.loss);
    });

    const totalPerformanceWeight = performanceWeights.reduce((sum, w) => sum + w, 0);

    if (totalPerformanceWeight === 0) {
      return this.simpleAverage(predictions);
    }

    // Weight by model performance
    const weightedTensors = predictions.map((p, idx) => {
      const weight = performanceWeights[idx] / totalPerformanceWeight;
      return tf.mul(p.prediction, tf.scalar(weight));
    });

    const stackedPrediction = tf.sum(tf.stack(weightedTensors), 0);
    const stackedConfidence = predictions.reduce((sum, p, idx) => 
      sum + (p.confidence * performanceWeights[idx] / totalPerformanceWeight), 0
    );

    // Cleanup
    weightedTensors.forEach(t => t.dispose());

    return {
      prediction: stackedPrediction,
      confidence: stackedConfidence
    };
  }

  /**
   * Dynamic selection ensemble
   */
  private async dynamicSelection(predictions: ModelPrediction[]): Promise<{
    prediction: tf.Tensor;
    confidence: number;
  }> {
    // Select best model based on confidence and recent performance
    const scores = predictions.map((pred, idx) => {
      const model = this.models[idx];
      const recentPerformance = model.performance.accuracy || (1.0 / (1.0 + model.performance.loss));
      return pred.confidence * 0.6 + recentPerformance * 0.4;
    });

    const bestIdx = scores.indexOf(Math.max(...scores));
    const bestPrediction = predictions[bestIdx];

    return {
      prediction: bestPrediction.prediction.clone(),
      confidence: bestPrediction.confidence
    };
  }

  /**
   * Train ensemble with feedback
   */
  public async trainWithFeedback(
    input: tf.Tensor | tf.Tensor[],
    target: tf.Tensor,
    modelSpecificTargets?: { [modelId: string]: tf.Tensor }
  ): Promise<void> {
    try {
      // Get predictions from all models
      const predictions = await this.predict(input);

      // Calculate individual model performance
      for (let i = 0; i < this.models.length; i++) {
        const model = this.models[i];
        const modelPrediction = model.model.predict(input) as tf.Tensor;

        // Calculate loss
        const loss = tf.losses.meanSquaredError(target, modelPrediction);
        const lossValue = await loss.data();

        // Calculate accuracy (for classification)
        const accuracy = await this.calculateAccuracy(modelPrediction, target);

        // Update model performance
        model.performance.loss = lossValue[0];
        model.performance.accuracy = accuracy;
        model.performance.predictions++;
        model.performance.lastUpdated = Date.now();

        // Cleanup
        modelPrediction.dispose();
        loss.dispose();
      }

      // Update ensemble weights based on performance
      if (this.config.autoRebalance) {
        this.updateWeights();
      }

      // Track ensemble performance
      const ensembleLoss = tf.losses.meanSquaredError(target, predictions.prediction);
      const ensembleLossValue = await ensembleLoss.data();
      const ensembleAccuracy = await this.calculateAccuracy(predictions.prediction, target);

      this.performanceHistory.push({
        timestamp: Date.now(),
        ensembleLoss: ensembleLossValue[0],
        ensembleAccuracy,
        modelCount: this.models.length,
        agreement: predictions.agreement
      });

      // Cleanup
      ensembleLoss.dispose();
      predictions.prediction.dispose();

    } catch (error) {
      logger.error('Error training ensemble with feedback:', error);
      throw error;
    }
  }

  /**
   * Update ensemble weights based on model performance
   */
  private updateWeights(): void {
    if (this.models.length === 0) return;

    const performanceScores = this.models.map(model => {
      const perf = model.performance;
      return perf.accuracy > 0 ? perf.accuracy : 1.0 / (1.0 + perf.loss);
    });

    // Calculate diversity scores (simplified)
    const diversityScores = this.models.map((_, idx) => {
      return this.calculateModelDiversity(idx);
    });

    // Combine performance and diversity
    this.ensembleWeights = this.models.map((_, idx) => {
      const perfScore = performanceScores[idx];
      const divScore = diversityScores[idx];
      return this.config.performanceWeight * perfScore + 
             this.config.diversityWeight * divScore;
    });

    // Normalize weights
    const totalWeight = this.ensembleWeights.reduce((sum, w) => sum + w, 0);
    if (totalWeight > 0) {
      this.ensembleWeights = this.ensembleWeights.map(w => w / totalWeight);
    }

    // Update model weights
    this.models.forEach((model, idx) => {
      model.weight = this.ensembleWeights[idx];
    });
  }

  /**
   * Calculate model diversity within ensemble
   */
  private calculateModelDiversity(modelIndex: number): number {
    if (this.models.length < 2) return 1.0;

    // Simplified diversity measure based on architecture differences
    const currentModel = this.models[modelIndex];
    let diversitySum = 0;
    let comparisons = 0;

    this.models.forEach((otherModel, idx) => {
      if (idx !== modelIndex) {
        // Compare model architectures (simplified)
        const archSimilarity = this.compareModelArchitectures(
          currentModel.metadata,
          otherModel.metadata
        );
        diversitySum += 1.0 - archSimilarity;
        comparisons++;
      }
    });

    return comparisons > 0 ? diversitySum / comparisons : 1.0;
  }

  /**
   * Compare model architectures for diversity calculation
   */
  private compareModelArchitectures(meta1: ModelMetadata, meta2: ModelMetadata): number {
    if (!meta1.architecture || !meta2.architecture) return 0.5;

    let similarities = 0;
    let comparisons = 0;

    // Compare layer counts
    if (meta1.architecture.layers && meta2.architecture.layers) {
      similarities += meta1.architecture.layers === meta2.architecture.layers ? 1 : 0;
      comparisons++;
    }

    // Compare hidden units
    if (meta1.architecture.hiddenUnits && meta2.architecture.hiddenUnits) {
      const ratio = Math.min(meta1.architecture.hiddenUnits, meta2.architecture.hiddenUnits) /
                   Math.max(meta1.architecture.hiddenUnits, meta2.architecture.hiddenUnits);
      similarities += ratio;
      comparisons++;
    }

    return comparisons > 0 ? similarities / comparisons : 0.5;
  }

  /**
   * Remove the weakest performing model
   */
  private async removeWeakestModel(): Promise<void> {
    if (this.models.length === 0) return;

    const performanceScores = this.models.map(model => {
      const perf = model.performance;
      return perf.accuracy > 0 ? perf.accuracy : 1.0 / (1.0 + perf.loss);
    });

    const weakestIdx = performanceScores.indexOf(Math.min(...performanceScores));
    const removedModel = this.models.splice(weakestIdx, 1)[0];

    // Dispose of the model
    removedModel.model.dispose();

    logger.info(`Removed weakest model: ${removedModel.name}`);
    this.updateWeights();
  }

  /**
   * Calculate prediction confidence
   */
  private async calculateConfidence(prediction: tf.Tensor): Promise<number> {
    const predData = await prediction.data();
    const probabilities = Array.from(predData);
    
    // For classification: max probability
    if (probabilities.every(p => p >= 0 && p <= 1)) {
      return Math.max(...probabilities);
    }
    
    // For regression: inverse of variance
    const mean = probabilities.reduce((sum, p) => sum + p, 0) / probabilities.length;
    const variance = probabilities.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / probabilities.length;
    
    return 1.0 / (1.0 + variance);
  }

  /**
   * Calculate uncertainty across ensemble
   */
  private calculateUncertainty(predictions: ModelPrediction[]): number {
    if (predictions.length < 2) return 0;

    // Calculate variance across predictions
    const confidences = predictions.map(p => p.confidence);
    const mean = confidences.reduce((sum, c) => sum + c, 0) / confidences.length;
    const variance = confidences.reduce((sum, c) => sum + Math.pow(c - mean, 2), 0) / confidences.length;

    return Math.sqrt(variance);
  }

  /**
   * Calculate agreement across models
   */
  private calculateAgreement(predictions: ModelPrediction[]): number {
    if (predictions.length < 2) return 1.0;

    // Simplified agreement based on confidence correlation
    const confidences = predictions.map(p => p.confidence);
    const mean = confidences.reduce((sum, c) => sum + c, 0) / confidences.length;
    const deviations = confidences.map(c => Math.abs(c - mean));
    const avgDeviation = deviations.reduce((sum, d) => sum + d, 0) / deviations.length;

    return Math.max(0, 1.0 - avgDeviation);
  }

  /**
   * Calculate accuracy between prediction and target
   */
  private async calculateAccuracy(prediction: tf.Tensor, target: tf.Tensor): Promise<number> {
    // For classification (softmax output)
    if (prediction.shape.length > 1 && prediction.shape[prediction.shape.length - 1] > 1) {
      const predClasses = tf.argMax(prediction, -1);
      const targetClasses = tf.argMax(target, -1);
      const correct = tf.equal(predClasses, targetClasses);
      const accuracy = tf.mean(tf.cast(correct, 'float32'));
      const accuracyValue = await accuracy.data();
      
      predClasses.dispose();
      targetClasses.dispose();
      correct.dispose();
      accuracy.dispose();
      
      return accuracyValue[0];
    }
    
    // For regression (MAE-based accuracy)
    const mae = tf.losses.absoluteDifference(target, prediction);
    const maeValue = await mae.data();
    mae.dispose();
    
    return 1.0 / (1.0 + maeValue[0]);
  }

  /**
   * Update prediction count for all models
   */
  private updatePredictionCount(): void {
    this.models.forEach(model => {
      model.performance.predictions++;
    });
  }

  /**
   * Generate unique model ID
   */
  private generateModelId(): string {
    return `model_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get ensemble statistics
   */
  public getStatistics(): EnsembleStatistics {
    const models = this.models.map(model => ({
      id: model.id,
      name: model.name,
      weight: model.weight,
      performance: model.performance,
      metadata: model.metadata
    }));

    const recentPerformance = this.performanceHistory.slice(-10);
    const avgAccuracy = recentPerformance.length > 0 
      ? recentPerformance.reduce((sum, p) => sum + p.ensembleAccuracy, 0) / recentPerformance.length 
      : 0;

    return {
      modelCount: this.models.length,
      totalPredictions: this.models.reduce((sum, m) => sum + m.performance.predictions, 0),
      averageAccuracy: avgAccuracy,
      ensembleWeights: this.ensembleWeights.slice(),
      strategy: this.config.strategy,
      performanceHistory: recentPerformance
    };
  }

  /**
   * Save ensemble to disk
   */
  public async save(basePath: string): Promise<void> {
    try {
      // Save individual models
      for (let i = 0; i < this.models.length; i++) {
        const model = this.models[i];
        await model.model.save(`file://${basePath}/model_${i}`);
      }

      // Save ensemble metadata
      const metadata = {
        config: this.config,
        models: this.models.map((model, idx) => ({
          id: model.id,
          name: model.name,
          weight: model.weight,
          performance: model.performance,
          metadata: model.metadata,
          modelPath: `model_${idx}`
        })),
        ensembleWeights: this.ensembleWeights,
        performanceHistory: this.performanceHistory
      };

      const fs = require('fs');
      fs.writeFileSync(`${basePath}/ensemble.json`, JSON.stringify(metadata));

      logger.info(`Ensemble saved to ${basePath}`);

    } catch (error) {
      logger.error('Error saving ensemble:', error);
      throw error;
    }
  }

  /**
   * Load ensemble from disk
   */
  public async load(basePath: string): Promise<void> {
    try {
      const fs = require('fs');
      const metadataPath = `${basePath}/ensemble.json`;
      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));

      // Clear existing models
      this.models.forEach(model => model.model.dispose());
      this.models = [];

      // Load individual models
      for (const modelInfo of metadata.models) {
        const model = await tf.loadLayersModel(`file://${basePath}/${modelInfo.modelPath}`);
        
        this.models.push({
          model,
          id: modelInfo.id,
          name: modelInfo.name,
          weight: modelInfo.weight,
          performance: modelInfo.performance,
          metadata: modelInfo.metadata
        });
      }

      // Restore ensemble state
      this.ensembleWeights = metadata.ensembleWeights;
      this.performanceHistory = metadata.performanceHistory;

      logger.info(`Ensemble loaded from ${basePath}, ${this.models.length} models`);

    } catch (error) {
      logger.error('Error loading ensemble:', error);
      throw error;
    }
  }

  /**
   * Dispose of all models and free memory
   */
  public dispose(): void {
    this.models.forEach(model => model.model.dispose());
    this.models = [];
    this.ensembleWeights = [];
    this.performanceHistory = [];
  }
}

// Type definitions
export interface ModelEnsembleConfig {
  strategy: 'simple_average' | 'weighted_average' | 'voting' | 'stacking' | 'dynamic_selection';
  maxModels: number;
  diversityThreshold: number;
  performanceWeight: number;
  diversityWeight: number;
  autoRebalance: boolean;
  rebalanceFrequency: number;
}

export interface EnsembleModel {
  model: tf.LayersModel;
  id: string;
  name: string;
  weight: number;
  performance: ModelPerformance;
  metadata: ModelMetadata;
}

export interface ModelPerformance {
  accuracy: number;
  loss: number;
  predictions: number;
  lastUpdated: number;
}

export interface ModelMetadata {
  architecture?: {
    layers?: number;
    hiddenUnits?: number;
    type?: string;
  };
  training?: {
    epochs?: number;
    batchSize?: number;
    optimizer?: string;
  };
  created?: number;
  version?: string;
}

export interface ModelPrediction {
  modelId: string;
  modelName: string;
  prediction: tf.Tensor;
  weight: number;
  confidence: number;
}

export interface EnsemblePrediction {
  prediction: tf.Tensor;
  confidence: number;
  uncertainty: number;
  agreement: number;
  modelContributions: Array<{
    modelId: string;
    modelName: string;
    weight: number;
    confidence: number;
  }>;
  strategy: string;
  predictionTime: number;
}

export interface EnsemblePerformance {
  timestamp: number;
  ensembleLoss: number;
  ensembleAccuracy: number;
  modelCount: number;
  agreement: number;
}

export interface EnsembleStatistics {
  modelCount: number;
  totalPredictions: number;
  averageAccuracy: number;
  ensembleWeights: number[];
  strategy: string;
  performanceHistory: EnsemblePerformance[];
}

/**
 * Factory function to create model ensemble
 */
export function createModelEnsemble(
  config?: Partial<ModelEnsembleConfig>
): ModelEnsemble {
  return new ModelEnsemble(config);
}