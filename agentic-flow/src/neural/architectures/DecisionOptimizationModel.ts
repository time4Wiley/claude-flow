import * as tf from '@tensorflow/tfjs-node';
import { logger } from '../../utils/logger';

/**
 * Neural network model for optimal decision making in multi-agent systems
 * Uses Deep Q-Network (DQN) with attention for decision optimization
 */
export class DecisionOptimizationModel {
  private model: tf.LayersModel | null = null;
  private targetModel: tf.LayersModel | null = null;
  private readonly modelConfig: DecisionOptimizationConfig;
  private trainingHistory: tf.History[] = [];
  private epsilon: number = 1.0; // Exploration rate
  private readonly minEpsilon: number = 0.01;
  private readonly epsilonDecay: number = 0.995;

  constructor(config?: Partial<DecisionOptimizationConfig>) {
    this.modelConfig = {
      stateSize: 128,
      actionSize: 64,
      hiddenUnits: 256,
      attentionHeads: 4,
      layers: 3,
      dropout: 0.1,
      learningRate: 0.001,
      gamma: 0.95, // Discount factor
      targetUpdateFreq: 100,
      ...config
    };
  }

  /**
   * Build the decision optimization model (DQN with attention)
   */
  public async buildModel(): Promise<void> {
    try {
      logger.info('Building Decision Optimization Model...');

      // State input (current agent and environment state)
      const stateInput = tf.input({ 
        shape: [this.modelConfig.stateSize], 
        name: 'state_input' 
      });

      // Agent context input (agent-specific information)
      const agentContextInput = tf.input({ 
        shape: [32], 
        name: 'agent_context' 
      });

      // Available actions mask (for masking invalid actions)
      const actionMaskInput = tf.input({ 
        shape: [this.modelConfig.actionSize], 
        name: 'action_mask' 
      });

      // State processing branch
      let stateFeatures = tf.layers.dense({
        units: this.modelConfig.hiddenUnits,
        activation: 'relu',
        name: 'state_dense_1'
      }).apply(stateInput) as tf.SymbolicTensor;

      stateFeatures = tf.layers.dropout({
        rate: this.modelConfig.dropout,
        name: 'state_dropout_1'
      }).apply(stateFeatures) as tf.SymbolicTensor;

      // Multi-layer feature extraction
      for (let i = 0; i < this.modelConfig.layers; i++) {
        stateFeatures = tf.layers.dense({
          units: this.modelConfig.hiddenUnits,
          activation: 'relu',
          name: `state_dense_${i + 2}`
        }).apply(stateFeatures) as tf.SymbolicTensor;

        stateFeatures = tf.layers.dropout({
          rate: this.modelConfig.dropout,
          name: `state_dropout_${i + 2}`
        }).apply(stateFeatures) as tf.SymbolicTensor;
      }

      // Agent context processing
      let agentFeatures = tf.layers.dense({
        units: 64,
        activation: 'relu',
        name: 'agent_dense_1'
      }).apply(agentContextInput) as tf.SymbolicTensor;

      agentFeatures = tf.layers.dropout({
        rate: this.modelConfig.dropout,
        name: 'agent_dropout_1'
      }).apply(agentFeatures) as tf.SymbolicTensor;

      // Combine state and agent features
      const combinedFeatures = tf.layers.concatenate({
        name: 'feature_concatenate'
      }).apply([stateFeatures, agentFeatures]) as tf.SymbolicTensor;

      // Attention mechanism for decision focus
      const attentionFeatures = this.buildAttentionLayer(combinedFeatures);

      // Dueling DQN architecture
      const valueStream = this.buildValueStream(attentionFeatures);
      const advantageStream = this.buildAdvantageStream(attentionFeatures);

      // Combine value and advantage streams
      const qValues = this.combineValueAdvantage(valueStream, advantageStream);

      // Apply action mask (set invalid actions to large negative values)
      const maskedQValues = tf.layers.multiply({
        name: 'apply_action_mask'
      }).apply([qValues, actionMaskInput]) as tf.SymbolicTensor;

      // Add large negative value to invalid actions
      const invalidActionPenalty = tf.layers.lambda({
        func: (x) => {
          const [qVals, mask] = x as tf.Tensor[];
          const inverseMask = tf.sub(1.0, mask);
          const penalty = tf.mul(inverseMask, -1e6);
          return tf.add(qVals, penalty);
        },
        name: 'mask_invalid_actions'
      }).apply([maskedQValues, actionMaskInput]) as tf.SymbolicTensor;

      this.model = tf.model({
        inputs: [stateInput, agentContextInput, actionMaskInput],
        outputs: invalidActionPenalty,
        name: 'DecisionOptimizationModel'
      });

      // Create target model (copy of main model)
      this.targetModel = tf.model({
        inputs: [stateInput, agentContextInput, actionMaskInput],
        outputs: invalidActionPenalty,
        name: 'TargetDecisionOptimizationModel'
      });

      // Compile models
      const optimizer = tf.train.adam(this.modelConfig.learningRate);
      
      this.model.compile({
        optimizer,
        loss: 'meanSquaredError',
        metrics: ['meanAbsoluteError']
      });

      this.targetModel.compile({
        optimizer: tf.train.adam(this.modelConfig.learningRate),
        loss: 'meanSquaredError',
        metrics: ['meanAbsoluteError']
      });

      // Initialize target model with main model weights
      this.updateTargetModel();

      logger.info('Decision Optimization Model built successfully');
      this.model.summary();

    } catch (error) {
      logger.error('Error building decision optimization model:', error);
      throw error;
    }
  }

  /**
   * Build attention layer for decision focus
   */
  private buildAttentionLayer(input: tf.SymbolicTensor): tf.SymbolicTensor {
    const { hiddenUnits, attentionHeads } = this.modelConfig;
    const headDim = Math.floor(hiddenUnits / attentionHeads);

    // Multi-head self-attention
    let attention = tf.layers.dense({
      units: hiddenUnits,
      activation: 'tanh',
      name: 'attention_projection'
    }).apply(input) as tf.SymbolicTensor;

    // Attention weights
    const attentionWeights = tf.layers.dense({
      units: hiddenUnits,
      activation: 'softmax',
      name: 'attention_weights'
    }).apply(attention) as tf.SymbolicTensor;

    // Apply attention
    const attended = tf.layers.multiply({
      name: 'apply_attention'
    }).apply([input, attentionWeights]) as tf.SymbolicTensor;

    // Residual connection
    const residual = tf.layers.add({
      name: 'attention_residual'
    }).apply([input, attended]) as tf.SymbolicTensor;

    // Layer normalization
    return tf.layers.layerNormalization({
      name: 'attention_norm'
    }).apply(residual) as tf.SymbolicTensor;
  }

  /**
   * Build value stream for Dueling DQN
   */
  private buildValueStream(input: tf.SymbolicTensor): tf.SymbolicTensor {
    let value = tf.layers.dense({
      units: this.modelConfig.hiddenUnits / 2,
      activation: 'relu',
      name: 'value_dense_1'
    }).apply(input) as tf.SymbolicTensor;

    value = tf.layers.dropout({
      rate: this.modelConfig.dropout,
      name: 'value_dropout'
    }).apply(value) as tf.SymbolicTensor;

    return tf.layers.dense({
      units: 1,
      activation: 'linear',
      name: 'value_output'
    }).apply(value) as tf.SymbolicTensor;
  }

  /**
   * Build advantage stream for Dueling DQN
   */
  private buildAdvantageStream(input: tf.SymbolicTensor): tf.SymbolicTensor {
    let advantage = tf.layers.dense({
      units: this.modelConfig.hiddenUnits / 2,
      activation: 'relu',
      name: 'advantage_dense_1'
    }).apply(input) as tf.SymbolicTensor;

    advantage = tf.layers.dropout({
      rate: this.modelConfig.dropout,
      name: 'advantage_dropout'
    }).apply(advantage) as tf.SymbolicTensor;

    return tf.layers.dense({
      units: this.modelConfig.actionSize,
      activation: 'linear',
      name: 'advantage_output'
    }).apply(advantage) as tf.SymbolicTensor;
  }

  /**
   * Combine value and advantage streams
   */
  private combineValueAdvantage(
    value: tf.SymbolicTensor,
    advantage: tf.SymbolicTensor
  ): tf.SymbolicTensor {
    // Q(s,a) = V(s) + (A(s,a) - mean(A(s,*)))
    return tf.layers.lambda({
      func: (inputs) => {
        const [v, a] = inputs as tf.Tensor[];
        const advantageMean = tf.mean(a, 1, true);
        const normalizedAdvantage = tf.sub(a, advantageMean);
        return tf.add(v, normalizedAdvantage);
      },
      name: 'combine_value_advantage'
    }).apply([value, advantage]) as tf.SymbolicTensor;
  }

  /**
   * Select action using epsilon-greedy policy
   */
  public async selectAction(
    state: tf.Tensor,
    agentContext: tf.Tensor,
    actionMask: tf.Tensor,
    training: boolean = true
  ): Promise<number> {
    if (!this.model) {
      throw new Error('Model not built. Call buildModel() first.');
    }

    try {
      // Epsilon-greedy exploration
      if (training && Math.random() < this.epsilon) {
        // Random action from valid actions
        const validActions = Array.from(await actionMask.data())
          .map((mask, index) => mask > 0 ? index : -1)
          .filter(index => index >= 0);
        
        return validActions[Math.floor(Math.random() * validActions.length)];
      }

      // Get Q-values from model
      const qValues = this.model.predict([state, agentContext, actionMask]) as tf.Tensor;
      const qValuesData = await qValues.data();

      // Select action with highest Q-value
      const actionIndex = qValuesData.indexOf(Math.max(...Array.from(qValuesData)));

      qValues.dispose();
      return actionIndex;

    } catch (error) {
      logger.error('Error selecting action:', error);
      throw error;
    }
  }

  /**
   * Train the decision optimization model using experience replay
   */
  public async trainBatch(
    states: tf.Tensor,
    agentContexts: tf.Tensor,
    actions: tf.Tensor,
    rewards: tf.Tensor,
    nextStates: tf.Tensor,
    nextAgentContexts: tf.Tensor,
    actionMasks: tf.Tensor,
    nextActionMasks: tf.Tensor,
    dones: tf.Tensor
  ): Promise<tf.History> {
    if (!this.model || !this.targetModel) {
      throw new Error('Models not built. Call buildModel() first.');
    }

    try {
      // Get current Q-values
      const currentQValues = this.model.predict([states, agentContexts, actionMasks]) as tf.Tensor;

      // Get next Q-values from target model
      const nextQValues = this.targetModel.predict([nextStates, nextAgentContexts, nextActionMasks]) as tf.Tensor;

      // Calculate target Q-values using Bellman equation
      const targetQValues = await this.calculateTargetQValues(
        currentQValues,
        nextQValues,
        actions,
        rewards,
        dones
      );

      // Train the model
      const history = await this.model.fit(
        [states, agentContexts, actionMasks],
        targetQValues,
        {
          epochs: 1,
          batchSize: states.shape[0],
          verbose: 0
        }
      );

      // Update epsilon (reduce exploration)
      if (this.epsilon > this.minEpsilon) {
        this.epsilon *= this.epsilonDecay;
      }

      // Clean up tensors
      currentQValues.dispose();
      nextQValues.dispose();
      targetQValues.dispose();

      this.trainingHistory.push(history);
      return history;

    } catch (error) {
      logger.error('Error training decision optimization model:', error);
      throw error;
    }
  }

  /**
   * Calculate target Q-values using Bellman equation
   */
  private async calculateTargetQValues(
    currentQValues: tf.Tensor,
    nextQValues: tf.Tensor,
    actions: tf.Tensor,
    rewards: tf.Tensor,
    dones: tf.Tensor
  ): Promise<tf.Tensor> {
    const currentQData = await currentQValues.data();
    const nextQData = await nextQValues.data();
    const actionsData = await actions.data();
    const rewardsData = await rewards.data();
    const donesData = await dones.data();

    const batchSize = currentQValues.shape[0];
    const actionSize = currentQValues.shape[1];
    const targetData = new Float32Array(currentQData);

    for (let i = 0; i < batchSize; i++) {
      const action = actionsData[i];
      const reward = rewardsData[i];
      const done = donesData[i];

      if (done) {
        targetData[i * actionSize + action] = reward;
      } else {
        const nextMaxQ = Math.max(...Array.from(nextQData.slice(i * actionSize, (i + 1) * actionSize)));
        targetData[i * actionSize + action] = reward + this.modelConfig.gamma * nextMaxQ;
      }
    }

    return tf.tensor2d(targetData, [batchSize, actionSize]);
  }

  /**
   * Update target model weights
   */
  public updateTargetModel(): void {
    if (!this.model || !this.targetModel) {
      throw new Error('Models not built. Call buildModel() first.');
    }

    const mainWeights = this.model.getWeights();
    this.targetModel.setWeights(mainWeights);
    
    logger.info('Target model updated');
  }

  /**
   * Optimize decision for a specific scenario
   */
  public async optimizeDecision(
    currentState: number[],
    agentContext: number[],
    availableActions: boolean[],
    constraints?: DecisionConstraints
  ): Promise<DecisionOptimizationResult> {
    if (!this.model) {
      throw new Error('Model not built. Call buildModel() first.');
    }

    try {
      // Prepare input tensors
      const stateTensor = tf.tensor2d([currentState], [1, this.modelConfig.stateSize]);
      const contextTensor = tf.tensor2d([agentContext], [1, 32]);
      const maskTensor = tf.tensor2d([availableActions.map(a => a ? 1 : 0)], [1, this.modelConfig.actionSize]);

      // Get Q-values
      const qValues = this.model.predict([stateTensor, contextTensor, maskTensor]) as tf.Tensor;
      const qValuesData = Array.from(await qValues.data());

      // Apply constraints if provided
      if (constraints) {
        this.applyConstraints(qValuesData, availableActions, constraints);
      }

      // Find best action
      const bestActionIndex = qValuesData.indexOf(Math.max(...qValuesData));
      const confidence = this.calculateConfidence(qValuesData, availableActions);

      // Get top-k actions for alternative recommendations
      const actionScores = qValuesData.map((score, index) => ({ index, score }))
        .filter((_, index) => availableActions[index])
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);

      // Clean up tensors
      stateTensor.dispose();
      contextTensor.dispose();
      maskTensor.dispose();
      qValues.dispose();

      return {
        recommendedAction: bestActionIndex,
        confidence,
        alternativeActions: actionScores.slice(1).map(a => a.index),
        expectedReward: Math.max(...qValuesData),
        decisionRationale: this.generateRationale(bestActionIndex, qValuesData, constraints)
      };

    } catch (error) {
      logger.error('Error optimizing decision:', error);
      throw error;
    }
  }

  /**
   * Apply constraints to Q-values
   */
  private applyConstraints(
    qValues: number[],
    availableActions: boolean[],
    constraints: DecisionConstraints
  ): void {
    // Apply cost constraints
    if (constraints.maxCost !== undefined) {
      constraints.actionCosts?.forEach((cost, index) => {
        if (cost > constraints.maxCost! && availableActions[index]) {
          qValues[index] -= (cost - constraints.maxCost!) * 100; // Penalty for exceeding cost
        }
      });
    }

    // Apply time constraints
    if (constraints.maxTime !== undefined) {
      constraints.actionTimes?.forEach((time, index) => {
        if (time > constraints.maxTime! && availableActions[index]) {
          qValues[index] -= (time - constraints.maxTime!) * 50; // Penalty for exceeding time
        }
      });
    }

    // Apply risk constraints
    if (constraints.maxRisk !== undefined) {
      constraints.actionRisks?.forEach((risk, index) => {
        if (risk > constraints.maxRisk! && availableActions[index]) {
          qValues[index] -= (risk - constraints.maxRisk!) * 75; // Penalty for exceeding risk
        }
      });
    }
  }

  /**
   * Calculate decision confidence
   */
  private calculateConfidence(qValues: number[], availableActions: boolean[]): number {
    const validQValues = qValues.filter((_, index) => availableActions[index]);
    
    if (validQValues.length < 2) return 1.0;

    const sorted = validQValues.sort((a, b) => b - a);
    const difference = sorted[0] - sorted[1];
    const range = sorted[0] - sorted[sorted.length - 1];

    return range === 0 ? 1.0 : Math.min(difference / range, 1.0);
  }

  /**
   * Generate decision rationale
   */
  private generateRationale(
    actionIndex: number,
    qValues: number[],
    constraints?: DecisionConstraints
  ): string {
    let rationale = `Action ${actionIndex} selected with Q-value ${qValues[actionIndex].toFixed(3)}. `;

    if (constraints) {
      if (constraints.actionCosts?.[actionIndex]) {
        rationale += `Cost: ${constraints.actionCosts[actionIndex]}. `;
      }
      if (constraints.actionTimes?.[actionIndex]) {
        rationale += `Time: ${constraints.actionTimes[actionIndex]}. `;
      }
      if (constraints.actionRisks?.[actionIndex]) {
        rationale += `Risk: ${constraints.actionRisks[actionIndex]}. `;
      }
    }

    return rationale;
  }

  /**
   * Save the model
   */
  public async saveModel(path: string): Promise<void> {
    if (!this.model || !this.targetModel) {
      throw new Error('Models not built. Call buildModel() first.');
    }

    try {
      await this.model.save(`file://${path}/main`);
      await this.targetModel.save(`file://${path}/target`);
      
      // Save training state
      const state = {
        epsilon: this.epsilon,
        config: this.modelConfig
      };
      
      const fs = require('fs');
      fs.writeFileSync(`${path}/state.json`, JSON.stringify(state));

      logger.info(`Decision Optimization Model saved to ${path}`);
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
      this.model = await tf.loadLayersModel(`file://${path}/main`);
      this.targetModel = await tf.loadLayersModel(`file://${path}/target`);
      
      // Load training state
      try {
        const fs = require('fs');
        const stateData = fs.readFileSync(`${path}/state.json`, 'utf8');
        const state = JSON.parse(stateData);
        this.epsilon = state.epsilon;
      } catch (stateError) {
        logger.warn('Could not load training state, using defaults');
      }

      logger.info(`Decision Optimization Model loaded from ${path}`);
    } catch (error) {
      logger.error('Error loading model:', error);
      throw error;
    }
  }

  /**
   * Get model performance metrics
   */
  public getMetrics(): DecisionOptimizationMetrics {
    if (this.trainingHistory.length === 0) {
      return {
        trainingLoss: 0,
        meanAbsoluteError: 0,
        epsilon: this.epsilon,
        episodes: 0
      };
    }

    const lastHistory = this.trainingHistory[this.trainingHistory.length - 1];
    const lastEpoch = lastHistory.history;

    return {
      trainingLoss: lastEpoch.loss[lastEpoch.loss.length - 1],
      meanAbsoluteError: lastEpoch.mean_absolute_error ? lastEpoch.mean_absolute_error[lastEpoch.mean_absolute_error.length - 1] : 0,
      epsilon: this.epsilon,
      episodes: this.trainingHistory.length
    };
  }

  /**
   * Dispose of the models and free memory
   */
  public dispose(): void {
    if (this.model) {
      this.model.dispose();
      this.model = null;
    }
    if (this.targetModel) {
      this.targetModel.dispose();
      this.targetModel = null;
    }
  }
}

export interface DecisionOptimizationConfig {
  stateSize: number;
  actionSize: number;
  hiddenUnits: number;
  attentionHeads: number;
  layers: number;
  dropout: number;
  learningRate: number;
  gamma: number;
  targetUpdateFreq: number;
}

export interface DecisionConstraints {
  maxCost?: number;
  maxTime?: number;
  maxRisk?: number;
  actionCosts?: number[];
  actionTimes?: number[];
  actionRisks?: number[];
}

export interface DecisionOptimizationResult {
  recommendedAction: number;
  confidence: number;
  alternativeActions: number[];
  expectedReward: number;
  decisionRationale: string;
}

export interface DecisionOptimizationMetrics {
  trainingLoss: number;
  meanAbsoluteError: number;
  epsilon: number;
  episodes: number;
}

/**
 * Factory function to create and initialize decision optimization model
 */
export async function createDecisionOptimizationModel(
  config?: Partial<DecisionOptimizationConfig>
): Promise<DecisionOptimizationModel> {
  const model = new DecisionOptimizationModel(config);
  await model.buildModel();
  return model;
}