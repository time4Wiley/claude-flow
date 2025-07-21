import * as tf from '@tensorflow/tfjs-node';
import { logger } from '../../utils/logger';

/**
 * Neural network model for multi-agent coordination patterns
 * Uses attention mechanisms to learn optimal coordination strategies
 */
export class AgentCoordinationModel {
  private model: tf.LayersModel | null = null;
  private readonly modelConfig: CoordinationModelConfig;
  private trainingHistory: tf.History[] = [];

  constructor(config?: Partial<CoordinationModelConfig>) {
    this.modelConfig = {
      agentCount: 8,
      hiddenDim: 128,
      attentionHeads: 4,
      layers: 3,
      dropout: 0.1,
      learningRate: 0.001,
      ...config
    };
  }

  /**
   * Build the coordination model with attention mechanisms
   */
  public async buildModel(): Promise<void> {
    try {
      logger.info('Building Agent Coordination Model...');

      // Input layer: agent states and task features
      const agentInput = tf.input({ 
        shape: [this.modelConfig.agentCount, this.modelConfig.hiddenDim], 
        name: 'agent_states' 
      });
      
      const taskInput = tf.input({ 
        shape: [this.modelConfig.hiddenDim], 
        name: 'task_features' 
      });

      // Multi-head attention for agent coordination
      let coordination = this.buildAttentionLayer(agentInput);
      
      // Add positional encoding for agent positions
      coordination = this.addPositionalEncoding(coordination);

      // Feed-forward network for each agent
      for (let i = 0; i < this.modelConfig.layers; i++) {
        coordination = tf.layers.dense({
          units: this.modelConfig.hiddenDim,
          activation: 'relu',
          name: `coordination_dense_${i}`
        }).apply(coordination) as tf.SymbolicTensor;

        coordination = tf.layers.dropout({
          rate: this.modelConfig.dropout,
          name: `coordination_dropout_${i}`
        }).apply(coordination) as tf.SymbolicTensor;
      }

      // Task-aware coordination (incorporate task context)
      const taskExpanded = tf.layers.repeatVector({
        n: this.modelConfig.agentCount,
        name: 'task_repeat'
      }).apply(taskInput) as tf.SymbolicTensor;

      const combined = tf.layers.concatenate({
        name: 'task_agent_combine'
      }).apply([coordination, taskExpanded]) as tf.SymbolicTensor;

      // Final coordination decisions
      let output = tf.layers.dense({
        units: this.modelConfig.hiddenDim,
        activation: 'relu',
        name: 'final_dense'
      }).apply(combined) as tf.SymbolicTensor;

      // Output: coordination actions for each agent
      output = tf.layers.dense({
        units: 64, // Action space size
        activation: 'softmax',
        name: 'coordination_actions'
      }).apply(output) as tf.SymbolicTensor;

      this.model = tf.model({
        inputs: [agentInput, taskInput],
        outputs: output,
        name: 'AgentCoordinationModel'
      });

      // Compile model
      this.model.compile({
        optimizer: tf.train.adam(this.modelConfig.learningRate),
        loss: 'categoricalCrossentropy',
        metrics: ['accuracy', 'categoricalAccuracy']
      });

      logger.info('Agent Coordination Model built successfully');
      this.model.summary();

    } catch (error) {
      logger.error('Error building coordination model:', error);
      throw error;
    }
  }

  /**
   * Build multi-head attention layer for agent coordination
   */
  private buildAttentionLayer(input: tf.SymbolicTensor): tf.SymbolicTensor {
    const { hiddenDim, attentionHeads } = this.modelConfig;
    const headDim = Math.floor(hiddenDim / attentionHeads);

    // Query, Key, Value transformations
    const queries = tf.layers.dense({
      units: hiddenDim,
      name: 'attention_queries'
    }).apply(input) as tf.SymbolicTensor;

    const keys = tf.layers.dense({
      units: hiddenDim,
      name: 'attention_keys'
    }).apply(input) as tf.SymbolicTensor;

    const values = tf.layers.dense({
      units: hiddenDim,
      name: 'attention_values'
    }).apply(input) as tf.SymbolicTensor;

    // Reshape for multi-head attention
    const reshapeQ = tf.layers.reshape({
      targetShape: [this.modelConfig.agentCount, attentionHeads, headDim],
      name: 'reshape_queries'
    }).apply(queries) as tf.SymbolicTensor;

    const reshapeK = tf.layers.reshape({
      targetShape: [this.modelConfig.agentCount, attentionHeads, headDim],
      name: 'reshape_keys'
    }).apply(keys) as tf.SymbolicTensor;

    const reshapeV = tf.layers.reshape({
      targetShape: [this.modelConfig.agentCount, attentionHeads, headDim],
      name: 'reshape_values'
    }).apply(values) as tf.SymbolicTensor;

    // Simplified attention mechanism (scaled dot-product)
    // Note: This is a simplified version - full implementation would require custom layers
    let attended = tf.layers.dense({
      units: hiddenDim,
      activation: 'tanh',
      name: 'attention_output'
    }).apply(tf.layers.concatenate({
      name: 'attention_concat'
    }).apply([reshapeQ, reshapeK, reshapeV])) as tf.SymbolicTensor;

    // Add residual connection
    attended = tf.layers.add({
      name: 'attention_residual'
    }).apply([input, attended]) as tf.SymbolicTensor;

    // Layer normalization
    attended = tf.layers.layerNormalization({
      name: 'attention_norm'
    }).apply(attended) as tf.SymbolicTensor;

    return attended;
  }

  /**
   * Add positional encoding for agent positions
   */
  private addPositionalEncoding(input: tf.SymbolicTensor): tf.SymbolicTensor {
    // Simplified positional encoding
    const posEncoding = tf.layers.embedding({
      inputDim: this.modelConfig.agentCount,
      outputDim: this.modelConfig.hiddenDim,
      name: 'positional_encoding'
    });

    // Create position indices
    const positions = tf.range(0, this.modelConfig.agentCount);
    const posEnc = posEncoding.apply(positions) as tf.SymbolicTensor;

    return tf.layers.add({
      name: 'add_positional_encoding'
    }).apply([input, posEnc]) as tf.SymbolicTensor;
  }

  /**
   * Train the coordination model
   */
  public async train(
    agentStates: tf.Tensor,
    taskFeatures: tf.Tensor,
    coordinationLabels: tf.Tensor,
    epochs: number = 50,
    batchSize: number = 32
  ): Promise<tf.History> {
    if (!this.model) {
      throw new Error('Model not built. Call buildModel() first.');
    }

    try {
      logger.info('Training Agent Coordination Model...');

      const history = await this.model.fit(
        [agentStates, taskFeatures],
        coordinationLabels,
        {
          epochs,
          batchSize,
          validationSplit: 0.2,
          shuffle: true,
          callbacks: {
            onEpochEnd: (epoch, logs) => {
              logger.info(`Epoch ${epoch + 1}: loss=${logs?.loss?.toFixed(4)}, accuracy=${logs?.acc?.toFixed(4)}`);
            }
          }
        }
      );

      this.trainingHistory.push(history);
      logger.info('Training completed successfully');
      return history;

    } catch (error) {
      logger.error('Error training coordination model:', error);
      throw error;
    }
  }

  /**
   * Predict optimal coordination actions
   */
  public async predict(
    agentStates: tf.Tensor,
    taskFeatures: tf.Tensor
  ): Promise<tf.Tensor> {
    if (!this.model) {
      throw new Error('Model not built. Call buildModel() first.');
    }

    try {
      const predictions = this.model.predict([agentStates, taskFeatures]) as tf.Tensor;
      return predictions;
    } catch (error) {
      logger.error('Error making coordination predictions:', error);
      throw error;
    }
  }

  /**
   * Save the model to disk
   */
  public async saveModel(path: string): Promise<void> {
    if (!this.model) {
      throw new Error('Model not built. Call buildModel() first.');
    }

    try {
      await this.model.save(`file://${path}`);
      logger.info(`Model saved to ${path}`);
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
      logger.info(`Model loaded from ${path}`);
    } catch (error) {
      logger.error('Error loading model:', error);
      throw error;
    }
  }

  /**
   * Get model performance metrics
   */
  public getMetrics(): CoordinationModelMetrics {
    if (this.trainingHistory.length === 0) {
      return {
        trainingLoss: 0,
        validationLoss: 0,
        accuracy: 0,
        epochs: 0
      };
    }

    const lastHistory = this.trainingHistory[this.trainingHistory.length - 1];
    const lastEpoch = lastHistory.history;

    return {
      trainingLoss: lastEpoch.loss[lastEpoch.loss.length - 1],
      validationLoss: lastEpoch.val_loss ? lastEpoch.val_loss[lastEpoch.val_loss.length - 1] : 0,
      accuracy: lastEpoch.acc ? lastEpoch.acc[lastEpoch.acc.length - 1] : 0,
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

export interface CoordinationModelConfig {
  agentCount: number;
  hiddenDim: number;
  attentionHeads: number;
  layers: number;
  dropout: number;
  learningRate: number;
}

export interface CoordinationModelMetrics {
  trainingLoss: number;
  validationLoss: number;
  accuracy: number;
  epochs: number;
}

/**
 * Factory function to create and initialize coordination model
 */
export async function createCoordinationModel(
  config?: Partial<CoordinationModelConfig>
): Promise<AgentCoordinationModel> {
  const model = new AgentCoordinationModel(config);
  await model.buildModel();
  return model;
}