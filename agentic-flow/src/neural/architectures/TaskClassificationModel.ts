import * as tf from '@tensorflow/tfjs-node';
import { logger } from '../../utils/logger';

/**
 * Neural network model for classifying task types and complexity
 * Uses CNN and LSTM layers for text and sequence analysis
 */
export class TaskClassificationModel {
  private model: tf.LayersModel | null = null;
  private readonly modelConfig: TaskClassificationConfig;
  private trainingHistory: tf.History[] = [];
  private vocabularySize: number = 10000;
  private maxSequenceLength: number = 100;

  constructor(config?: Partial<TaskClassificationConfig>) {
    this.modelConfig = {
      embeddingDim: 128,
      lstmUnits: 64,
      convFilters: 64,
      kernelSize: 3,
      denseUnits: 128,
      numClasses: 10,
      dropout: 0.3,
      learningRate: 0.001,
      ...config
    };
  }

  /**
   * Build the task classification model
   */
  public async buildModel(): Promise<void> {
    try {
      logger.info('Building Task Classification Model...');

      // Text input (tokenized sequences)
      const textInput = tf.input({ 
        shape: [this.maxSequenceLength], 
        name: 'text_input' 
      });

      // Numerical features input (task metrics, complexity indicators)
      const numericalInput = tf.input({ 
        shape: [32], 
        name: 'numerical_features' 
      });

      // Text processing branch
      let textBranch = tf.layers.embedding({
        inputDim: this.vocabularySize,
        outputDim: this.modelConfig.embeddingDim,
        inputLength: this.maxSequenceLength,
        name: 'text_embedding'
      }).apply(textInput) as tf.SymbolicTensor;

      // Convolutional layers for local pattern recognition
      textBranch = tf.layers.conv1d({
        filters: this.modelConfig.convFilters,
        kernelSize: this.modelConfig.kernelSize,
        activation: 'relu',
        padding: 'same',
        name: 'conv1d_1'
      }).apply(textBranch) as tf.SymbolicTensor;

      textBranch = tf.layers.maxPooling1d({
        poolSize: 2,
        name: 'maxpool_1'
      }).apply(textBranch) as tf.SymbolicTensor;

      textBranch = tf.layers.conv1d({
        filters: this.modelConfig.convFilters * 2,
        kernelSize: this.modelConfig.kernelSize,
        activation: 'relu',
        padding: 'same',
        name: 'conv1d_2'
      }).apply(textBranch) as tf.SymbolicTensor;

      textBranch = tf.layers.maxPooling1d({
        poolSize: 2,
        name: 'maxpool_2'
      }).apply(textBranch) as tf.SymbolicTensor;

      // Bidirectional LSTM for sequence understanding
      textBranch = tf.layers.bidirectional({
        layer: tf.layers.lstm({
          units: this.modelConfig.lstmUnits,
          returnSequences: false,
          dropout: this.modelConfig.dropout,
          recurrentDropout: this.modelConfig.dropout
        }),
        name: 'bidirectional_lstm'
      }).apply(textBranch) as tf.SymbolicTensor;

      // Numerical features branch
      let numericalBranch = tf.layers.dense({
        units: 64,
        activation: 'relu',
        name: 'numerical_dense_1'
      }).apply(numericalInput) as tf.SymbolicTensor;

      numericalBranch = tf.layers.dropout({
        rate: this.modelConfig.dropout,
        name: 'numerical_dropout_1'
      }).apply(numericalBranch) as tf.SymbolicTensor;

      numericalBranch = tf.layers.dense({
        units: 32,
        activation: 'relu',
        name: 'numerical_dense_2'
      }).apply(numericalBranch) as tf.SymbolicTensor;

      // Combine text and numerical features
      const combined = tf.layers.concatenate({
        name: 'feature_concatenate'
      }).apply([textBranch, numericalBranch]) as tf.SymbolicTensor;

      // Final classification layers
      let classification = tf.layers.dense({
        units: this.modelConfig.denseUnits,
        activation: 'relu',
        name: 'classification_dense_1'
      }).apply(combined) as tf.SymbolicTensor;

      classification = tf.layers.dropout({
        rate: this.modelConfig.dropout,
        name: 'classification_dropout'
      }).apply(classification) as tf.SymbolicTensor;

      classification = tf.layers.dense({
        units: this.modelConfig.denseUnits / 2,
        activation: 'relu',
        name: 'classification_dense_2'
      }).apply(classification) as tf.SymbolicTensor;

      // Multi-output for different classification tasks
      const taskTypeOutput = tf.layers.dense({
        units: this.modelConfig.numClasses,
        activation: 'softmax',
        name: 'task_type'
      }).apply(classification) as tf.SymbolicTensor;

      const complexityOutput = tf.layers.dense({
        units: 5, // Low, Medium-Low, Medium, Medium-High, High
        activation: 'softmax',
        name: 'complexity_level'
      }).apply(classification) as tf.SymbolicTensor;

      const priorityOutput = tf.layers.dense({
        units: 4, // Low, Medium, High, Critical
        activation: 'softmax',
        name: 'priority_level'
      }).apply(classification) as tf.SymbolicTensor;

      const estimatedTimeOutput = tf.layers.dense({
        units: 1,
        activation: 'linear',
        name: 'estimated_time'
      }).apply(classification) as tf.SymbolicTensor;

      this.model = tf.model({
        inputs: [textInput, numericalInput],
        outputs: [taskTypeOutput, complexityOutput, priorityOutput, estimatedTimeOutput],
        name: 'TaskClassificationModel'
      });

      // Compile with multi-output losses
      this.model.compile({
        optimizer: tf.train.adam(this.modelConfig.learningRate),
        loss: {
          'task_type': 'categoricalCrossentropy',
          'complexity_level': 'categoricalCrossentropy',
          'priority_level': 'categoricalCrossentropy',
          'estimated_time': 'meanSquaredError'
        },
        lossWeights: {
          'task_type': 1.0,
          'complexity_level': 0.8,
          'priority_level': 0.6,
          'estimated_time': 0.4
        },
        metrics: {
          'task_type': ['accuracy'],
          'complexity_level': ['accuracy'],
          'priority_level': ['accuracy'],
          'estimated_time': ['meanAbsoluteError']
        }
      });

      logger.info('Task Classification Model built successfully');
      this.model.summary();

    } catch (error) {
      logger.error('Error building task classification model:', error);
      throw error;
    }
  }

  /**
   * Train the task classification model
   */
  public async train(
    textData: tf.Tensor,
    numericalData: tf.Tensor,
    labels: TaskClassificationLabels,
    epochs: number = 50,
    batchSize: number = 32
  ): Promise<tf.History> {
    if (!this.model) {
      throw new Error('Model not built. Call buildModel() first.');
    }

    try {
      logger.info('Training Task Classification Model...');

      const history = await this.model.fit(
        [textData, numericalData],
        {
          'task_type': labels.taskType,
          'complexity_level': labels.complexity,
          'priority_level': labels.priority,
          'estimated_time': labels.estimatedTime
        },
        {
          epochs,
          batchSize,
          validationSplit: 0.2,
          shuffle: true,
          callbacks: {
            onEpochEnd: (epoch, logs) => {
              logger.info(`Epoch ${epoch + 1}: loss=${logs?.loss?.toFixed(4)}, task_type_acc=${logs?.task_type_acc?.toFixed(4)}`);
            }
          }
        }
      );

      this.trainingHistory.push(history);
      logger.info('Training completed successfully');
      return history;

    } catch (error) {
      logger.error('Error training task classification model:', error);
      throw error;
    }
  }

  /**
   * Predict task classification
   */
  public async predict(
    textData: tf.Tensor,
    numericalData: tf.Tensor
  ): Promise<TaskClassificationPrediction> {
    if (!this.model) {
      throw new Error('Model not built. Call buildModel() first.');
    }

    try {
      const predictions = this.model.predict([textData, numericalData]) as tf.Tensor[];
      
      return {
        taskType: predictions[0],
        complexity: predictions[1],
        priority: predictions[2],
        estimatedTime: predictions[3]
      };

    } catch (error) {
      logger.error('Error making task classification predictions:', error);
      throw error;
    }
  }

  /**
   * Classify a single task with text preprocessing
   */
  public async classifyTask(
    taskDescription: string,
    numericalFeatures: number[]
  ): Promise<{
    taskType: string;
    complexity: string;
    priority: string;
    estimatedTime: number;
    confidence: number;
  }> {
    if (!this.model) {
      throw new Error('Model not built. Call buildModel() first.');
    }

    try {
      // Preprocess text (simplified tokenization)
      const tokens = this.tokenizeText(taskDescription);
      const textTensor = tf.tensor2d([tokens], [1, this.maxSequenceLength]);
      
      // Prepare numerical features
      const numericalTensor = tf.tensor2d([numericalFeatures], [1, 32]);

      const predictions = await this.predict(textTensor, numericalTensor);

      // Get class predictions and confidence scores
      const taskTypeProbs = await predictions.taskType.data();
      const complexityProbs = await predictions.complexity.data();
      const priorityProbs = await predictions.priority.data();
      const estimatedTime = await predictions.estimatedTime.data();

      const taskTypeIdx = taskTypeProbs.indexOf(Math.max(...Array.from(taskTypeProbs)));
      const complexityIdx = complexityProbs.indexOf(Math.max(...Array.from(complexityProbs)));
      const priorityIdx = priorityProbs.indexOf(Math.max(...Array.from(priorityProbs)));

      // Calculate average confidence
      const confidence = (
        Math.max(...Array.from(taskTypeProbs)) +
        Math.max(...Array.from(complexityProbs)) +
        Math.max(...Array.from(priorityProbs))
      ) / 3;

      // Clean up tensors
      textTensor.dispose();
      numericalTensor.dispose();
      predictions.taskType.dispose();
      predictions.complexity.dispose();
      predictions.priority.dispose();
      predictions.estimatedTime.dispose();

      return {
        taskType: this.getTaskTypeName(taskTypeIdx),
        complexity: this.getComplexityName(complexityIdx),
        priority: this.getPriorityName(priorityIdx),
        estimatedTime: estimatedTime[0],
        confidence
      };

    } catch (error) {
      logger.error('Error classifying task:', error);
      throw error;
    }
  }

  /**
   * Simple text tokenization (in production, use proper tokenizer)
   */
  private tokenizeText(text: string): number[] {
    const words = text.toLowerCase().split(/\s+/);
    const tokens = words.map(word => {
      // Simple hash-based tokenization (replace with proper vocabulary mapping)
      let hash = 0;
      for (let i = 0; i < word.length; i++) {
        const char = word.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
      }
      return Math.abs(hash) % this.vocabularySize;
    });

    // Pad or truncate to max length
    const padded = new Array(this.maxSequenceLength).fill(0);
    for (let i = 0; i < Math.min(tokens.length, this.maxSequenceLength); i++) {
      padded[i] = tokens[i];
    }

    return padded;
  }

  private getTaskTypeName(index: number): string {
    const types = [
      'data_processing', 'machine_learning', 'web_development', 
      'api_integration', 'testing', 'deployment', 'analysis', 
      'documentation', 'optimization', 'maintenance'
    ];
    return types[index] || 'unknown';
  }

  private getComplexityName(index: number): string {
    const levels = ['low', 'medium-low', 'medium', 'medium-high', 'high'];
    return levels[index] || 'unknown';
  }

  private getPriorityName(index: number): string {
    const priorities = ['low', 'medium', 'high', 'critical'];
    return priorities[index] || 'unknown';
  }

  /**
   * Save the model
   */
  public async saveModel(path: string): Promise<void> {
    if (!this.model) {
      throw new Error('Model not built. Call buildModel() first.');
    }

    try {
      await this.model.save(`file://${path}`);
      logger.info(`Task Classification Model saved to ${path}`);
    } catch (error) {
      logger.error('Error saving model:', error);
      throw error;
    }
  }

  /**
   * Load a saved model
   */
  public async loadModel(path: string): Promise<void> {
    try {
      this.model = await tf.loadLayersModel(`file://${path}`);
      logger.info(`Task Classification Model loaded from ${path}`);
    } catch (error) {
      logger.error('Error loading model:', error);
      throw error;
    }
  }

  /**
   * Get model performance metrics
   */
  public getMetrics(): TaskClassificationMetrics {
    if (this.trainingHistory.length === 0) {
      return {
        overallLoss: 0,
        taskTypeAccuracy: 0,
        complexityAccuracy: 0,
        priorityAccuracy: 0,
        timeEstimationMAE: 0,
        epochs: 0
      };
    }

    const lastHistory = this.trainingHistory[this.trainingHistory.length - 1];
    const lastEpoch = lastHistory.history;

    return {
      overallLoss: lastEpoch.loss[lastEpoch.loss.length - 1],
      taskTypeAccuracy: lastEpoch.task_type_acc ? lastEpoch.task_type_acc[lastEpoch.task_type_acc.length - 1] : 0,
      complexityAccuracy: lastEpoch.complexity_level_acc ? lastEpoch.complexity_level_acc[lastEpoch.complexity_level_acc.length - 1] : 0,
      priorityAccuracy: lastEpoch.priority_level_acc ? lastEpoch.priority_level_acc[lastEpoch.priority_level_acc.length - 1] : 0,
      timeEstimationMAE: lastEpoch.estimated_time_mean_absolute_error ? lastEpoch.estimated_time_mean_absolute_error[lastEpoch.estimated_time_mean_absolute_error.length - 1] : 0,
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

export interface TaskClassificationConfig {
  embeddingDim: number;
  lstmUnits: number;
  convFilters: number;
  kernelSize: number;
  denseUnits: number;
  numClasses: number;
  dropout: number;
  learningRate: number;
}

export interface TaskClassificationLabels {
  taskType: tf.Tensor;
  complexity: tf.Tensor;
  priority: tf.Tensor;
  estimatedTime: tf.Tensor;
}

export interface TaskClassificationPrediction {
  taskType: tf.Tensor;
  complexity: tf.Tensor;
  priority: tf.Tensor;
  estimatedTime: tf.Tensor;
}

export interface TaskClassificationMetrics {
  overallLoss: number;
  taskTypeAccuracy: number;
  complexityAccuracy: number;
  priorityAccuracy: number;
  timeEstimationMAE: number;
  epochs: number;
}

/**
 * Factory function to create and initialize task classification model
 */
export async function createTaskClassificationModel(
  config?: Partial<TaskClassificationConfig>
): Promise<TaskClassificationModel> {
  const model = new TaskClassificationModel(config);
  await model.buildModel();
  return model;
}