import * as tf from '@tensorflow/tfjs-node';
import { logger } from '../../utils/logger';

/**
 * Neural network model for predicting agent performance metrics
 * Uses LSTM and attention mechanisms for time-series prediction
 */
export class PerformancePredictionModel {
  private model: tf.LayersModel | null = null;
  private readonly modelConfig: PerformancePredictionConfig;
  private trainingHistory: tf.History[] = [];
  private scaler: PerformanceScaler | null = null;

  constructor(config?: Partial<PerformancePredictionConfig>) {
    this.modelConfig = {
      sequenceLength: 20,
      featuresCount: 15,
      lstmUnits: 64,
      attentionUnits: 32,
      denseUnits: 128,
      dropout: 0.2,
      learningRate: 0.001,
      predictionHorizon: 5,
      ...config
    };
  }

  /**
   * Build the performance prediction model
   */
  public async buildModel(): Promise<void> {
    try {
      logger.info('Building Performance Prediction Model...');

      // Input: Historical performance sequences
      const sequenceInput = tf.input({ 
        shape: [this.modelConfig.sequenceLength, this.modelConfig.featuresCount], 
        name: 'performance_sequence' 
      });

      // Agent context input (static features)
      const contextInput = tf.input({ 
        shape: [32], 
        name: 'agent_context' 
      });

      // LSTM layers for temporal pattern learning
      let lstm1 = tf.layers.lstm({
        units: this.modelConfig.lstmUnits,
        returnSequences: true,
        dropout: this.modelConfig.dropout,
        recurrentDropout: this.modelConfig.dropout,
        name: 'lstm_layer_1'
      }).apply(sequenceInput) as tf.SymbolicTensor;

      let lstm2 = tf.layers.lstm({
        units: this.modelConfig.lstmUnits,
        returnSequences: true,
        dropout: this.modelConfig.dropout,
        recurrentDropout: this.modelConfig.dropout,
        name: 'lstm_layer_2'
      }).apply(lstm1) as tf.SymbolicTensor;

      // Attention mechanism for focusing on relevant time steps
      const attention = this.buildAttentionMechanism(lstm2);

      // Global average pooling to reduce dimensionality
      const pooled = tf.layers.globalAveragePooling1d({
        name: 'global_avg_pooling'
      }).apply(attention) as tf.SymbolicTensor;

      // Context processing
      let contextProcessed = tf.layers.dense({
        units: 64,
        activation: 'relu',
        name: 'context_dense_1'
      }).apply(contextInput) as tf.SymbolicTensor;

      contextProcessed = tf.layers.dropout({
        rate: this.modelConfig.dropout,
        name: 'context_dropout'
      }).apply(contextProcessed) as tf.SymbolicTensor;

      // Combine temporal and context features
      const combined = tf.layers.concatenate({
        name: 'feature_combine'
      }).apply([pooled, contextProcessed]) as tf.SymbolicTensor;

      // Feature transformation layers
      let features = tf.layers.dense({
        units: this.modelConfig.denseUnits,
        activation: 'relu',
        name: 'feature_dense_1'
      }).apply(combined) as tf.SymbolicTensor;

      features = tf.layers.dropout({
        rate: this.modelConfig.dropout,
        name: 'feature_dropout_1'
      }).apply(features) as tf.SymbolicTensor;

      features = tf.layers.dense({
        units: this.modelConfig.denseUnits / 2,
        activation: 'relu',
        name: 'feature_dense_2'
      }).apply(features) as tf.SymbolicTensor;

      features = tf.layers.dropout({
        rate: this.modelConfig.dropout,
        name: 'feature_dropout_2'
      }).apply(features) as tf.SymbolicTensor;

      // Multi-output predictions
      const taskCompletionTime = tf.layers.dense({
        units: this.modelConfig.predictionHorizon,
        activation: 'linear',
        name: 'task_completion_time'
      }).apply(features) as tf.SymbolicTensor;

      const successProbability = tf.layers.dense({
        units: this.modelConfig.predictionHorizon,
        activation: 'sigmoid',
        name: 'success_probability'
      }).apply(features) as tf.SymbolicTensor;

      const resourceUtilization = tf.layers.dense({
        units: this.modelConfig.predictionHorizon * 3, // CPU, Memory, Network
        activation: 'sigmoid',
        name: 'resource_utilization'
      }).apply(features) as tf.SymbolicTensor;

      const qualityScore = tf.layers.dense({
        units: this.modelConfig.predictionHorizon,
        activation: 'sigmoid',
        name: 'quality_score'
      }).apply(features) as tf.SymbolicTensor;

      const bottleneckPrediction = tf.layers.dense({
        units: 5, // Different bottleneck types
        activation: 'softmax',
        name: 'bottleneck_prediction'
      }).apply(features) as tf.SymbolicTensor;

      this.model = tf.model({
        inputs: [sequenceInput, contextInput],
        outputs: [
          taskCompletionTime,
          successProbability,
          resourceUtilization,
          qualityScore,
          bottleneckPrediction
        ],
        name: 'PerformancePredictionModel'
      });

      // Compile with appropriate losses for each output
      this.model.compile({
        optimizer: tf.train.adam(this.modelConfig.learningRate),
        loss: {
          'task_completion_time': 'meanSquaredError',
          'success_probability': 'binaryCrossentropy',
          'resource_utilization': 'meanSquaredError',
          'quality_score': 'meanSquaredError',
          'bottleneck_prediction': 'categoricalCrossentropy'
        },
        lossWeights: {
          'task_completion_time': 1.0,
          'success_probability': 0.8,
          'resource_utilization': 0.6,
          'quality_score': 0.7,
          'bottleneck_prediction': 0.5
        },
        metrics: {
          'task_completion_time': ['meanAbsoluteError'],
          'success_probability': ['accuracy'],
          'resource_utilization': ['meanAbsoluteError'],
          'quality_score': ['meanAbsoluteError'],
          'bottleneck_prediction': ['accuracy']
        }
      });

      logger.info('Performance Prediction Model built successfully');
      this.model.summary();

    } catch (error) {
      logger.error('Error building performance prediction model:', error);
      throw error;
    }
  }

  /**
   * Build attention mechanism for sequence processing
   */
  private buildAttentionMechanism(input: tf.SymbolicTensor): tf.SymbolicTensor {
    // Query, Key, Value for attention
    const queries = tf.layers.dense({
      units: this.modelConfig.attentionUnits,
      name: 'attention_queries'
    }).apply(input) as tf.SymbolicTensor;

    const keys = tf.layers.dense({
      units: this.modelConfig.attentionUnits,
      name: 'attention_keys'
    }).apply(input) as tf.SymbolicTensor;

    const values = tf.layers.dense({
      units: this.modelConfig.attentionUnits,
      name: 'attention_values'
    }).apply(input) as tf.SymbolicTensor;

    // Simplified attention mechanism
    // In a full implementation, this would use proper attention operations
    const attended = tf.layers.dense({
      units: this.modelConfig.lstmUnits,
      activation: 'tanh',
      name: 'attention_output'
    }).apply(tf.layers.concatenate({
      name: 'attention_concat'
    }).apply([queries, keys, values])) as tf.SymbolicTensor;

    // Add residual connection
    const residual = tf.layers.add({
      name: 'attention_residual'
    }).apply([input, attended]) as tf.SymbolicTensor;

    // Layer normalization
    return tf.layers.layerNormalization({
      name: 'attention_norm'
    }).apply(residual) as tf.SymbolicTensor;
  }

  /**
   * Train the performance prediction model
   */
  public async train(
    sequenceData: tf.Tensor,
    contextData: tf.Tensor,
    labels: PerformancePredictionLabels,
    epochs: number = 50,
    batchSize: number = 32
  ): Promise<tf.History> {
    if (!this.model) {
      throw new Error('Model not built. Call buildModel() first.');
    }

    try {
      logger.info('Training Performance Prediction Model...');

      // Normalize the data
      this.scaler = this.fitScaler(sequenceData, contextData, labels);
      const scaledData = this.transformData(sequenceData, contextData, labels);

      const history = await this.model.fit(
        [scaledData.sequenceData, scaledData.contextData],
        {
          'task_completion_time': scaledData.labels.taskCompletionTime,
          'success_probability': labels.successProbability,
          'resource_utilization': scaledData.labels.resourceUtilization,
          'quality_score': labels.qualityScore,
          'bottleneck_prediction': labels.bottleneckPrediction
        },
        {
          epochs,
          batchSize,
          validationSplit: 0.2,
          shuffle: true,
          callbacks: {
            onEpochEnd: (epoch, logs) => {
              logger.info(`Epoch ${epoch + 1}: loss=${logs?.loss?.toFixed(4)}, completion_time_mae=${logs?.task_completion_time_mean_absolute_error?.toFixed(4)}`);
            }
          }
        }
      );

      this.trainingHistory.push(history);
      logger.info('Training completed successfully');
      return history;

    } catch (error) {
      logger.error('Error training performance prediction model:', error);
      throw error;
    }
  }

  /**
   * Predict agent performance
   */
  public async predict(
    sequenceData: tf.Tensor,
    contextData: tf.Tensor
  ): Promise<PerformancePredictionResult> {
    if (!this.model) {
      throw new Error('Model not built. Call buildModel() first.');
    }

    try {
      // Apply scaling if available
      let scaledSequence = sequenceData;
      let scaledContext = contextData;

      if (this.scaler) {
        const scaled = this.transformData(sequenceData, contextData, {
          taskCompletionTime: tf.zeros([1, this.modelConfig.predictionHorizon]),
          successProbability: tf.zeros([1, this.modelConfig.predictionHorizon]),
          resourceUtilization: tf.zeros([1, this.modelConfig.predictionHorizon * 3]),
          qualityScore: tf.zeros([1, this.modelConfig.predictionHorizon]),
          bottleneckPrediction: tf.zeros([1, 5])
        });
        scaledSequence = scaled.sequenceData;
        scaledContext = scaled.contextData;
      }

      const predictions = this.model.predict([scaledSequence, scaledContext]) as tf.Tensor[];

      // Inverse transform predictions if scaler is available
      let taskCompletionTime = predictions[0];
      let resourceUtilization = predictions[2];

      if (this.scaler) {
        taskCompletionTime = this.inverseTransformTensor(taskCompletionTime, 'taskCompletionTime');
        resourceUtilization = this.inverseTransformTensor(resourceUtilization, 'resourceUtilization');
      }

      return {
        taskCompletionTime,
        successProbability: predictions[1],
        resourceUtilization,
        qualityScore: predictions[3],
        bottleneckPrediction: predictions[4]
      };

    } catch (error) {
      logger.error('Error making performance predictions:', error);
      throw error;
    }
  }

  /**
   * Predict performance for a single agent
   */
  public async predictAgentPerformance(
    performanceHistory: number[][],
    agentContext: number[]
  ): Promise<{
    completionTimes: number[];
    successProbabilities: number[];
    resourceUsage: { cpu: number[]; memory: number[]; network: number[] };
    qualityScores: number[];
    predictedBottleneck: string;
    confidence: number;
  }> {
    if (!this.model) {
      throw new Error('Model not built. Call buildModel() first.');
    }

    try {
      // Prepare input tensors
      const sequenceTensor = tf.tensor3d([performanceHistory], [1, this.modelConfig.sequenceLength, this.modelConfig.featuresCount]);
      const contextTensor = tf.tensor2d([agentContext], [1, 32]);

      const predictions = await this.predict(sequenceTensor, contextTensor);

      // Extract predictions
      const completionTimes = Array.from(await predictions.taskCompletionTime.data());
      const successProbs = Array.from(await predictions.successProbability.data());
      const resourceData = Array.from(await predictions.resourceUtilization.data());
      const qualityData = Array.from(await predictions.qualityScore.data());
      const bottleneckProbs = Array.from(await predictions.bottleneckPrediction.data());

      // Process resource utilization
      const resourceUsage = {
        cpu: resourceData.slice(0, this.modelConfig.predictionHorizon),
        memory: resourceData.slice(this.modelConfig.predictionHorizon, this.modelConfig.predictionHorizon * 2),
        network: resourceData.slice(this.modelConfig.predictionHorizon * 2)
      };

      // Determine predicted bottleneck
      const bottleneckTypes = ['cpu', 'memory', 'network', 'io', 'none'];
      const bottleneckIdx = bottleneckProbs.indexOf(Math.max(...bottleneckProbs));
      const predictedBottleneck = bottleneckTypes[bottleneckIdx];

      // Calculate overall confidence (average of max probabilities)
      const confidence = (
        Math.max(...successProbs) +
        Math.max(...qualityData) +
        Math.max(...bottleneckProbs)
      ) / 3;

      // Clean up tensors
      sequenceTensor.dispose();
      contextTensor.dispose();
      predictions.taskCompletionTime.dispose();
      predictions.successProbability.dispose();
      predictions.resourceUtilization.dispose();
      predictions.qualityScore.dispose();
      predictions.bottleneckPrediction.dispose();

      return {
        completionTimes,
        successProbabilities: successProbs,
        resourceUsage,
        qualityScores: qualityData,
        predictedBottleneck,
        confidence
      };

    } catch (error) {
      logger.error('Error predicting agent performance:', error);
      throw error;
    }
  }

  /**
   * Fit scaler for data normalization
   */
  private fitScaler(
    sequenceData: tf.Tensor,
    contextData: tf.Tensor,
    labels: PerformancePredictionLabels
  ): PerformanceScaler {
    // Simplified min-max scaling
    const sequenceStats = {
      min: sequenceData.min().dataSync()[0],
      max: sequenceData.max().dataSync()[0]
    };

    const contextStats = {
      min: contextData.min().dataSync()[0],
      max: contextData.max().dataSync()[0]
    };

    const taskTimeStats = {
      min: labels.taskCompletionTime.min().dataSync()[0],
      max: labels.taskCompletionTime.max().dataSync()[0]
    };

    const resourceStats = {
      min: labels.resourceUtilization.min().dataSync()[0],
      max: labels.resourceUtilization.max().dataSync()[0]
    };

    return {
      sequence: sequenceStats,
      context: contextStats,
      taskTime: taskTimeStats,
      resource: resourceStats
    };
  }

  /**
   * Transform data using the fitted scaler
   */
  private transformData(
    sequenceData: tf.Tensor,
    contextData: tf.Tensor,
    labels: PerformancePredictionLabels
  ): {
    sequenceData: tf.Tensor;
    contextData: tf.Tensor;
    labels: PerformancePredictionLabels;
  } {
    if (!this.scaler) {
      return { sequenceData, contextData, labels };
    }

    // Min-max normalization
    const normalizedSequence = sequenceData.sub(this.scaler.sequence.min)
      .div(this.scaler.sequence.max - this.scaler.sequence.min);

    const normalizedContext = contextData.sub(this.scaler.context.min)
      .div(this.scaler.context.max - this.scaler.context.min);

    const normalizedTaskTime = labels.taskCompletionTime.sub(this.scaler.taskTime.min)
      .div(this.scaler.taskTime.max - this.scaler.taskTime.min);

    const normalizedResource = labels.resourceUtilization.sub(this.scaler.resource.min)
      .div(this.scaler.resource.max - this.scaler.resource.min);

    return {
      sequenceData: normalizedSequence,
      contextData: normalizedContext,
      labels: {
        ...labels,
        taskCompletionTime: normalizedTaskTime,
        resourceUtilization: normalizedResource
      }
    };
  }

  /**
   * Inverse transform predictions
   */
  private inverseTransformTensor(tensor: tf.Tensor, type: 'taskCompletionTime' | 'resourceUtilization'): tf.Tensor {
    if (!this.scaler) {
      return tensor;
    }

    const stats = type === 'taskCompletionTime' ? this.scaler.taskTime : this.scaler.resource;
    return tensor.mul(stats.max - stats.min).add(stats.min);
  }

  /**
   * Save the model and scaler
   */
  public async saveModel(path: string): Promise<void> {
    if (!this.model) {
      throw new Error('Model not built. Call buildModel() first.');
    }

    try {
      await this.model.save(`file://${path}`);
      
      // Save scaler separately
      if (this.scaler) {
        const fs = require('fs');
        fs.writeFileSync(`${path}/scaler.json`, JSON.stringify(this.scaler));
      }

      logger.info(`Performance Prediction Model saved to ${path}`);
    } catch (error) {
      logger.error('Error saving model:', error);
      throw error;
    }
  }

  /**
   * Load a saved model and scaler
   */
  public async loadModel(path: string): Promise<void> {
    try {
      this.model = await tf.loadLayersModel(`file://${path}`);
      
      // Load scaler
      try {
        const fs = require('fs');
        const scalerData = fs.readFileSync(`${path}/scaler.json`, 'utf8');
        this.scaler = JSON.parse(scalerData);
      } catch (scalerError) {
        logger.warn('Could not load scaler, predictions may be unnormalized');
      }

      logger.info(`Performance Prediction Model loaded from ${path}`);
    } catch (error) {
      logger.error('Error loading model:', error);
      throw error;
    }
  }

  /**
   * Get model performance metrics
   */
  public getMetrics(): PerformancePredictionMetrics {
    if (this.trainingHistory.length === 0) {
      return {
        overallLoss: 0,
        completionTimeMAE: 0,
        successAccuracy: 0,
        resourceMAE: 0,
        qualityMAE: 0,
        bottleneckAccuracy: 0,
        epochs: 0
      };
    }

    const lastHistory = this.trainingHistory[this.trainingHistory.length - 1];
    const lastEpoch = lastHistory.history;

    return {
      overallLoss: lastEpoch.loss[lastEpoch.loss.length - 1],
      completionTimeMAE: lastEpoch.task_completion_time_mean_absolute_error ? lastEpoch.task_completion_time_mean_absolute_error[lastEpoch.task_completion_time_mean_absolute_error.length - 1] : 0,
      successAccuracy: lastEpoch.success_probability_acc ? lastEpoch.success_probability_acc[lastEpoch.success_probability_acc.length - 1] : 0,
      resourceMAE: lastEpoch.resource_utilization_mean_absolute_error ? lastEpoch.resource_utilization_mean_absolute_error[lastEpoch.resource_utilization_mean_absolute_error.length - 1] : 0,
      qualityMAE: lastEpoch.quality_score_mean_absolute_error ? lastEpoch.quality_score_mean_absolute_error[lastEpoch.quality_score_mean_absolute_error.length - 1] : 0,
      bottleneckAccuracy: lastEpoch.bottleneck_prediction_acc ? lastEpoch.bottleneck_prediction_acc[lastEpoch.bottleneck_prediction_acc.length - 1] : 0,
      epochs: lastHistory.epoch.length
    };
  }

  /**
   * Dispose of the model and free memory
   */
  public dispose(): void {
    if (this.model) {
      this.model.dispose();
      this.model = null;
    }
  }
}

export interface PerformancePredictionConfig {
  sequenceLength: number;
  featuresCount: number;
  lstmUnits: number;
  attentionUnits: number;
  denseUnits: number;
  dropout: number;
  learningRate: number;
  predictionHorizon: number;
}

export interface PerformancePredictionLabels {
  taskCompletionTime: tf.Tensor;
  successProbability: tf.Tensor;
  resourceUtilization: tf.Tensor;
  qualityScore: tf.Tensor;
  bottleneckPrediction: tf.Tensor;
}

export interface PerformancePredictionResult {
  taskCompletionTime: tf.Tensor;
  successProbability: tf.Tensor;
  resourceUtilization: tf.Tensor;
  qualityScore: tf.Tensor;
  bottleneckPrediction: tf.Tensor;
}

export interface PerformancePredictionMetrics {
  overallLoss: number;
  completionTimeMAE: number;
  successAccuracy: number;
  resourceMAE: number;
  qualityMAE: number;
  bottleneckAccuracy: number;
  epochs: number;
}

interface PerformanceScaler {
  sequence: { min: number; max: number };
  context: { min: number; max: number };
  taskTime: { min: number; max: number };
  resource: { min: number; max: number };
}

/**
 * Factory function to create and initialize performance prediction model
 */
export async function createPerformancePredictionModel(
  config?: Partial<PerformancePredictionConfig>
): Promise<PerformancePredictionModel> {
  const model = new PerformancePredictionModel(config);
  await model.buildModel();
  return model;
}