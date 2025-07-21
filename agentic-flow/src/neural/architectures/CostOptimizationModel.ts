import * as tf from '@tensorflow/tfjs-node';
import { logger } from '../../utils/logger';

/**
 * Neural network model for cost optimization across the Agentic Flow platform
 * Optimizes costs for:
 * - LLM provider usage and token consumption
 * - Agent coordination overhead
 * - Workflow execution efficiency
 * - Resource allocation and scaling
 */
export class CostOptimizationModel {
  private model: tf.LayersModel | null = null;
  private readonly modelConfig: CostOptimizationConfig;
  private trainingHistory: tf.History[] = [];
  private costNormalizer: CostNormalizer | null = null;
  private featureScaler: FeatureScaler | null = null;

  constructor(config?: Partial<CostOptimizationConfig>) {
    this.modelConfig = {
      inputDim: 128,
      hiddenLayers: [256, 128, 64],
      outputDim: 32,
      dropout: 0.15,
      learningRate: 0.0005,
      l1Regularization: 0.001,
      l2Regularization: 0.01,
      useBatchNorm: true,
      useLayerNorm: false,
      activationFunction: 'swish',
      outputActivation: 'linear',
      optimizerType: 'adamax',
      enableDeepResidual: true,
      enableAttention: true,
      costTypes: ['token', 'computation', 'storage', 'transfer'],
      optimizationHorizon: 24, // hours
      ...config
    };

    this.costNormalizer = new CostNormalizer();
    this.featureScaler = new FeatureScaler();
  }

  /**
   * Build the cost optimization model with advanced architecture
   */
  public async buildModel(): Promise<void> {
    try {
      logger.info('Building Cost Optimization Model...');

      // Input layers for different cost components
      const workflowInput = tf.input({
        shape: [this.modelConfig.inputDim],
        name: 'workflow_features'
      });

      const providerInput = tf.input({
        shape: [this.modelConfig.inputDim],
        name: 'provider_features'
      });

      const resourceInput = tf.input({
        shape: [this.modelConfig.inputDim],
        name: 'resource_features'
      });

      const historicalInput = tf.input({
        shape: [this.modelConfig.optimizationHorizon, 64], // Time series data
        name: 'historical_costs'
      });

      // Feature preprocessing layers
      let workflowProcessed = this.buildFeatureProcessingBranch(workflowInput, 'workflow');
      let providerProcessed = this.buildFeatureProcessingBranch(providerInput, 'provider');
      let resourceProcessed = this.buildFeatureProcessingBranch(resourceInput, 'resource');

      // Temporal processing for historical data
      let historicalProcessed = this.buildTemporalProcessingBranch(historicalInput);

      // Feature fusion with attention
      let fusedFeatures: tf.SymbolicTensor;
      if (this.modelConfig.enableAttention) {
        fusedFeatures = this.buildAttentionFusion([
          workflowProcessed,
          providerProcessed,
          resourceProcessed,
          historicalProcessed
        ]);
      } else {
        fusedFeatures = tf.layers.concatenate({
          name: 'feature_fusion'
        }).apply([
          workflowProcessed,
          providerProcessed,
          resourceProcessed,
          historicalProcessed
        ]) as tf.SymbolicTensor;
      }

      // Deep residual processing
      if (this.modelConfig.enableDeepResidual) {
        fusedFeatures = this.buildResidualLayers(fusedFeatures);
      } else {
        fusedFeatures = this.buildStandardLayers(fusedFeatures);
      }

      // Multi-head cost prediction
      const tokenCostHead = this.buildCostPredictionHead(fusedFeatures, 'token_cost', 8);
      const computationCostHead = this.buildCostPredictionHead(fusedFeatures, 'computation_cost', 8);
      const storageCostHead = this.buildCostPredictionHead(fusedFeatures, 'storage_cost', 8);
      const transferCostHead = this.buildCostPredictionHead(fusedFeatures, 'transfer_cost', 8);

      // Cost optimization recommendations
      const optimizationRecommendations = tf.layers.dense({
        units: 16,
        activation: 'sigmoid',
        name: 'optimization_recommendations'
      }).apply(fusedFeatures) as tf.SymbolicTensor;

      // Budget allocation prediction
      const budgetAllocation = tf.layers.dense({
        units: this.modelConfig.costTypes.length,
        activation: 'softmax',
        name: 'budget_allocation'
      }).apply(fusedFeatures) as tf.SymbolicTensor;

      // Efficiency score prediction
      const efficiencyScore = tf.layers.dense({
        units: 1,
        activation: 'sigmoid',
        name: 'efficiency_score'
      }).apply(fusedFeatures) as tf.SymbolicTensor;

      // Risk assessment
      const riskAssessment = tf.layers.dense({
        units: 4, // low, medium, high, critical
        activation: 'softmax',
        name: 'risk_assessment'
      }).apply(fusedFeatures) as tf.SymbolicTensor;

      // Create multi-output model
      this.model = tf.model({
        inputs: [workflowInput, providerInput, resourceInput, historicalInput],
        outputs: {
          tokenCost: tokenCostHead,
          computationCost: computationCostHead,
          storageCost: storageCostHead,
          transferCost: transferCostHead,
          optimizationRecommendations,
          budgetAllocation,
          efficiencyScore,
          riskAssessment
        },
        name: 'CostOptimizationModel'
      });

      // Compile with multi-task loss
      const optimizer = this.createOptimizer();
      this.model.compile({
        optimizer,
        loss: {
          tokenCost: 'meanSquaredError',
          computationCost: 'meanSquaredError',
          storageCost: 'meanSquaredError',
          transferCost: 'meanSquaredError',
          optimizationRecommendations: 'binaryCrossentropy',
          budgetAllocation: 'categoricalCrossentropy',
          efficiencyScore: 'meanSquaredError',
          riskAssessment: 'categoricalCrossentropy'
        },
        lossWeights: {
          tokenCost: 1.0,
          computationCost: 0.8,
          storageCost: 0.6,
          transferCost: 0.6,
          optimizationRecommendations: 0.4,
          budgetAllocation: 0.5,
          efficiencyScore: 0.7,
          riskAssessment: 0.3
        },
        metrics: {
          tokenCost: ['meanAbsoluteError', 'meanAbsolutePercentageError'],
          computationCost: ['meanAbsoluteError'],
          storageCost: ['meanAbsoluteError'],
          transferCost: ['meanAbsoluteError'],
          optimizationRecommendations: ['accuracy'],
          budgetAllocation: ['accuracy'],
          efficiencyScore: ['meanAbsoluteError'],
          riskAssessment: ['accuracy']
        }
      });

      logger.info('Cost Optimization Model built successfully');
      this.model.summary();

    } catch (error) {
      logger.error('Error building cost optimization model:', error);
      throw error;
    }
  }

  /**
   * Build feature processing branch
   */
  private buildFeatureProcessingBranch(
    input: tf.SymbolicTensor,
    branchName: string
  ): tf.SymbolicTensor {
    let processed = tf.layers.dense({
      units: 128,
      activation: this.modelConfig.activationFunction,
      kernelRegularizer: tf.regularizers.l1l2({
        l1: this.modelConfig.l1Regularization,
        l2: this.modelConfig.l2Regularization
      }),
      name: `${branchName}_dense_1`
    }).apply(input) as tf.SymbolicTensor;

    if (this.modelConfig.useBatchNorm) {
      processed = tf.layers.batchNormalization({
        name: `${branchName}_bn_1`
      }).apply(processed) as tf.SymbolicTensor;
    }

    processed = tf.layers.dropout({
      rate: this.modelConfig.dropout,
      name: `${branchName}_dropout_1`
    }).apply(processed) as tf.SymbolicTensor;

    processed = tf.layers.dense({
      units: 64,
      activation: this.modelConfig.activationFunction,
      name: `${branchName}_dense_2`
    }).apply(processed) as tf.SymbolicTensor;

    if (this.modelConfig.useLayerNorm) {
      processed = tf.layers.layerNormalization({
        name: `${branchName}_ln_2`
      }).apply(processed) as tf.SymbolicTensor;
    }

    return processed;
  }

  /**
   * Build temporal processing branch for time series data
   */
  private buildTemporalProcessingBranch(input: tf.SymbolicTensor): tf.SymbolicTensor {
    // LSTM for temporal patterns
    let temporal = tf.layers.lstm({
      units: 64,
      returnSequences: true,
      dropout: this.modelConfig.dropout,
      recurrentDropout: this.modelConfig.dropout,
      name: 'temporal_lstm_1'
    }).apply(input) as tf.SymbolicTensor;

    temporal = tf.layers.lstm({
      units: 32,
      returnSequences: false,
      dropout: this.modelConfig.dropout,
      recurrentDropout: this.modelConfig.dropout,
      name: 'temporal_lstm_2'
    }).apply(temporal) as tf.SymbolicTensor;

    // Trend analysis
    const trend = tf.layers.dense({
      units: 16,
      activation: this.modelConfig.activationFunction,
      name: 'trend_analysis'
    }).apply(temporal) as tf.SymbolicTensor;

    // Seasonality analysis
    const seasonality = tf.layers.dense({
      units: 16,
      activation: this.modelConfig.activationFunction,
      name: 'seasonality_analysis'
    }).apply(temporal) as tf.SymbolicTensor;

    return tf.layers.concatenate({
      name: 'temporal_features'
    }).apply([temporal, trend, seasonality]) as tf.SymbolicTensor;
  }

  /**
   * Build attention-based feature fusion
   */
  private buildAttentionFusion(features: tf.SymbolicTensor[]): tf.SymbolicTensor {
    // Multi-head attention across feature types
    const stackedFeatures = tf.layers.concatenate({
      axis: -1,
      name: 'stack_features'
    }).apply(features) as tf.SymbolicTensor;

    // Self-attention mechanism
    const queries = tf.layers.dense({
      units: 64,
      name: 'attention_queries'
    }).apply(stackedFeatures) as tf.SymbolicTensor;

    const keys = tf.layers.dense({
      units: 64,
      name: 'attention_keys'
    }).apply(stackedFeatures) as tf.SymbolicTensor;

    const values = tf.layers.dense({
      units: 64,
      name: 'attention_values'
    }).apply(stackedFeatures) as tf.SymbolicTensor;

    // Simplified attention (in practice, would implement proper scaled dot-product attention)
    const attended = tf.layers.dense({
      units: 128,
      activation: 'tanh',
      name: 'attended_features'
    }).apply(tf.layers.concatenate({
      name: 'attention_concat'
    }).apply([queries, keys, values])) as tf.SymbolicTensor;

    // Residual connection
    return tf.layers.add({
      name: 'attention_residual'
    }).apply([stackedFeatures, attended]) as tf.SymbolicTensor;
  }

  /**
   * Build residual layers
   */
  private buildResidualLayers(input: tf.SymbolicTensor): tf.SymbolicTensor {
    let current = input;

    for (let i = 0; i < this.modelConfig.hiddenLayers.length; i++) {
      const units = this.modelConfig.hiddenLayers[i];
      const residualInput = current;

      // First layer of residual block
      current = tf.layers.dense({
        units,
        activation: this.modelConfig.activationFunction,
        kernelRegularizer: tf.regularizers.l1l2({
          l1: this.modelConfig.l1Regularization,
          l2: this.modelConfig.l2Regularization
        }),
        name: `residual_${i}_dense_1`
      }).apply(current) as tf.SymbolicTensor;

      if (this.modelConfig.useBatchNorm) {
        current = tf.layers.batchNormalization({
          name: `residual_${i}_bn_1`
        }).apply(current) as tf.SymbolicTensor;
      }

      current = tf.layers.dropout({
        rate: this.modelConfig.dropout,
        name: `residual_${i}_dropout_1`
      }).apply(current) as tf.SymbolicTensor;

      // Second layer of residual block
      current = tf.layers.dense({
        units,
        activation: 'linear',
        name: `residual_${i}_dense_2`
      }).apply(current) as tf.SymbolicTensor;

      // Residual connection (with projection if needed)
      if (residualInput.shape[residualInput.shape.length - 1] !== units) {
        const projected = tf.layers.dense({
          units,
          activation: 'linear',
          name: `residual_${i}_projection`
        }).apply(residualInput) as tf.SymbolicTensor;
        current = tf.layers.add({
          name: `residual_${i}_add`
        }).apply([current, projected]) as tf.SymbolicTensor;
      } else {
        current = tf.layers.add({
          name: `residual_${i}_add`
        }).apply([current, residualInput]) as tf.SymbolicTensor;
      }

      // Activation after residual connection
      current = tf.layers.activation({
        activation: this.modelConfig.activationFunction,
        name: `residual_${i}_activation`
      }).apply(current) as tf.SymbolicTensor;
    }

    return current;
  }

  /**
   * Build standard dense layers
   */
  private buildStandardLayers(input: tf.SymbolicTensor): tf.SymbolicTensor {
    let current = input;

    for (let i = 0; i < this.modelConfig.hiddenLayers.length; i++) {
      const units = this.modelConfig.hiddenLayers[i];

      current = tf.layers.dense({
        units,
        activation: this.modelConfig.activationFunction,
        kernelRegularizer: tf.regularizers.l1l2({
          l1: this.modelConfig.l1Regularization,
          l2: this.modelConfig.l2Regularization
        }),
        name: `standard_${i}_dense`
      }).apply(current) as tf.SymbolicTensor;

      if (this.modelConfig.useBatchNorm) {
        current = tf.layers.batchNormalization({
          name: `standard_${i}_bn`
        }).apply(current) as tf.SymbolicTensor;
      }

      current = tf.layers.dropout({
        rate: this.modelConfig.dropout,
        name: `standard_${i}_dropout`
      }).apply(current) as tf.SymbolicTensor;
    }

    return current;
  }

  /**
   * Build cost prediction head
   */
  private buildCostPredictionHead(
    input: tf.SymbolicTensor,
    headName: string,
    outputUnits: number
  ): tf.SymbolicTensor {
    let head = tf.layers.dense({
      units: 64,
      activation: this.modelConfig.activationFunction,
      name: `${headName}_dense_1`
    }).apply(input) as tf.SymbolicTensor;

    head = tf.layers.dropout({
      rate: this.modelConfig.dropout * 0.5,
      name: `${headName}_dropout`
    }).apply(head) as tf.SymbolicTensor;

    return tf.layers.dense({
      units: outputUnits,
      activation: this.modelConfig.outputActivation,
      name: headName
    }).apply(head) as tf.SymbolicTensor;
  }

  /**
   * Create optimizer based on config
   */
  private createOptimizer(): tf.Optimizer {
    switch (this.modelConfig.optimizerType) {
      case 'adam':
        return tf.train.adam(this.modelConfig.learningRate);
      case 'adamax':
        return tf.train.adamax(this.modelConfig.learningRate);
      case 'rmsprop':
        return tf.train.rmsprop(this.modelConfig.learningRate);
      case 'sgd':
        return tf.train.sgd(this.modelConfig.learningRate);
      default:
        return tf.train.adam(this.modelConfig.learningRate);
    }
  }

  /**
   * Train the cost optimization model
   */
  public async train(
    trainingData: CostOptimizationTrainingData,
    epochs: number = 150,
    batchSize: number = 32,
    validationSplit: number = 0.2
  ): Promise<tf.History> {
    if (!this.model) {
      throw new Error('Model not built. Call buildModel() first.');
    }

    try {
      logger.info('Training Cost Optimization Model...');

      // Preprocess training data
      const processedData = await this.preprocessTrainingData(trainingData);

      const callbacks = {
        onEpochEnd: (epoch: number, logs: any) => {
          logger.info(
            `Epoch ${epoch + 1}: ` +
            `loss=${logs?.loss?.toFixed(4)}, ` +
            `token_cost_mae=${logs?.tokenCost_mean_absolute_error?.toFixed(4)}, ` +
            `efficiency_score_mae=${logs?.efficiencyScore_mean_absolute_error?.toFixed(4)}`
          );
        }
      };

      // Advanced callbacks
      const earlyStopping = tf.callbacks.earlyStopping({
        monitor: 'val_loss',
        patience: 15,
        restoreBestWeights: true
      });

      const reduceLR = tf.callbacks.reduceLROnPlateau({
        monitor: 'val_loss',
        factor: 0.7,
        patience: 8,
        minLr: 1e-7
      });

      const history = await this.model.fit(
        processedData.inputs,
        processedData.outputs,
        {
          epochs,
          batchSize,
          validationSplit,
          shuffle: true,
          callbacks: {
            ...callbacks,
            earlyStopping,
            reduceLR
          }
        }
      );

      this.trainingHistory.push(history);
      logger.info('Cost optimization model training completed successfully');
      return history;

    } catch (error) {
      logger.error('Error training cost optimization model:', error);
      throw error;
    }
  }

  /**
   * Preprocess training data
   */
  private async preprocessTrainingData(
    data: CostOptimizationTrainingData
  ): Promise<{ inputs: tf.Tensor[], outputs: any }> {
    // Normalize costs
    const normalizedCosts = await this.costNormalizer!.normalize(data.costs);
    
    // Scale features
    const scaledFeatures = await this.featureScaler!.scale([
      data.workflowFeatures,
      data.providerFeatures,
      data.resourceFeatures
    ]);

    return {
      inputs: [...scaledFeatures, data.historicalCosts],
      outputs: normalizedCosts
    };
  }

  /**
   * Predict cost optimization strategies
   */
  public async predict(
    workflowFeatures: tf.Tensor,
    providerFeatures: tf.Tensor,
    resourceFeatures: tf.Tensor,
    historicalCosts: tf.Tensor
  ): Promise<CostOptimizationPrediction> {
    if (!this.model) {
      throw new Error('Model not built. Call buildModel() first.');
    }

    try {
      // Scale inputs
      const scaledInputs = await this.featureScaler!.scale([
        workflowFeatures,
        providerFeatures,
        resourceFeatures
      ]);

      const predictions = this.model.predict([
        ...scaledInputs,
        historicalCosts
      ]) as { [key: string]: tf.Tensor };

      // Extract predictions
      const tokenCost = await predictions.tokenCost.data();
      const computationCost = await predictions.computationCost.data();
      const storageCost = await predictions.storageCost.data();
      const transferCost = await predictions.transferCost.data();
      const optimizationRecommendations = await predictions.optimizationRecommendations.data();
      const budgetAllocation = await predictions.budgetAllocation.data();
      const efficiencyScore = await predictions.efficiencyScore.data();
      const riskAssessment = await predictions.riskAssessment.data();

      // Denormalize costs
      const denormalizedCosts = await this.costNormalizer!.denormalize({
        token: Array.from(tokenCost),
        computation: Array.from(computationCost),
        storage: Array.from(storageCost),
        transfer: Array.from(transferCost)
      });

      return {
        predictedCosts: denormalizedCosts,
        optimizationRecommendations: Array.from(optimizationRecommendations),
        budgetAllocation: Array.from(budgetAllocation),
        efficiencyScore: efficiencyScore[0],
        riskLevel: this.interpretRiskLevel(Array.from(riskAssessment)),
        totalCostEstimate: this.calculateTotalCost(denormalizedCosts),
        potentialSavings: this.calculatePotentialSavings(denormalizedCosts),
        recommendations: this.generateRecommendations(
          Array.from(optimizationRecommendations),
          Array.from(budgetAllocation),
          efficiencyScore[0]
        )
      };

    } catch (error) {
      logger.error('Error making cost optimization prediction:', error);
      throw error;
    }
  }

  /**
   * Interpret risk level from prediction
   */
  private interpretRiskLevel(riskProbs: number[]): string {
    const maxIndex = riskProbs.indexOf(Math.max(...riskProbs));
    const levels = ['low', 'medium', 'high', 'critical'];
    return levels[maxIndex];
  }

  /**
   * Calculate total cost estimate
   */
  private calculateTotalCost(costs: any): number {
    return costs.token.reduce((a: number, b: number) => a + b, 0) +
           costs.computation.reduce((a: number, b: number) => a + b, 0) +
           costs.storage.reduce((a: number, b: number) => a + b, 0) +
           costs.transfer.reduce((a: number, b: number) => a + b, 0);
  }

  /**
   * Calculate potential savings
   */
  private calculatePotentialSavings(costs: any): number {
    const totalCost = this.calculateTotalCost(costs);
    // Simplified - would use baseline comparison
    return totalCost * 0.15; // Assume 15% potential savings
  }

  /**
   * Generate optimization recommendations
   */
  private generateRecommendations(
    optimizations: number[],
    budgetAllocation: number[],
    efficiencyScore: number
  ): string[] {
    const recommendations: string[] = [];

    if (efficiencyScore < 0.7) {
      recommendations.push('Consider optimizing workflow execution patterns');
    }

    if (optimizations[0] > 0.8) {
      recommendations.push('Implement token usage optimization strategies');
    }

    if (optimizations[1] > 0.8) {
      recommendations.push('Optimize computational resource allocation');
    }

    if (budgetAllocation[0] > 0.5) {
      recommendations.push('Focus budget optimization on token costs');
    }

    return recommendations;
  }

  /**
   * Save model
   */
  public async saveModel(path: string): Promise<void> {
    if (!this.model) {
      throw new Error('Model not built. Call buildModel() first.');
    }

    try {
      await this.model.save(`file://${path}`);
      
      // Save normalizers
      await this.costNormalizer!.save(`${path}/cost_normalizer`);
      await this.featureScaler!.save(`${path}/feature_scaler`);
      
      logger.info(`Cost optimization model saved to ${path}`);
    } catch (error) {
      logger.error('Error saving cost optimization model:', error);
      throw error;
    }
  }

  /**
   * Load model
   */
  public async loadModel(path: string): Promise<void> {
    try {
      this.model = await tf.loadLayersModel(`file://${path}`);
      
      // Load normalizers
      await this.costNormalizer!.load(`${path}/cost_normalizer`);
      await this.featureScaler!.load(`${path}/feature_scaler`);
      
      logger.info(`Cost optimization model loaded from ${path}`);
    } catch (error) {
      logger.error('Error loading cost optimization model:', error);
      throw error;
    }
  }

  /**
   * Get model metrics
   */
  public getMetrics(): CostOptimizationMetrics {
    if (this.trainingHistory.length === 0) {
      return {
        trainingLoss: 0,
        validationLoss: 0,
        tokenCostMAE: 0,
        computationCostMAE: 0,
        storageCostMAE: 0,
        transferCostMAE: 0,
        efficiencyScoreMAE: 0,
        optimizationAccuracy: 0,
        budgetAllocationAccuracy: 0,
        riskAssessmentAccuracy: 0,
        epochs: 0
      };
    }

    const lastHistory = this.trainingHistory[this.trainingHistory.length - 1];
    const history = lastHistory.history;

    return {
      trainingLoss: history.loss[history.loss.length - 1],
      validationLoss: history.val_loss ? history.val_loss[history.val_loss.length - 1] : 0,
      tokenCostMAE: history.tokenCost_mean_absolute_error[history.tokenCost_mean_absolute_error.length - 1],
      computationCostMAE: history.computationCost_mean_absolute_error[history.computationCost_mean_absolute_error.length - 1],
      storageCostMAE: history.storageCost_mean_absolute_error[history.storageCost_mean_absolute_error.length - 1],
      transferCostMAE: history.transferCost_mean_absolute_error[history.transferCost_mean_absolute_error.length - 1],
      efficiencyScoreMAE: history.efficiencyScore_mean_absolute_error[history.efficiencyScore_mean_absolute_error.length - 1],
      optimizationAccuracy: history.optimizationRecommendations_accuracy[history.optimizationRecommendations_accuracy.length - 1],
      budgetAllocationAccuracy: history.budgetAllocation_accuracy[history.budgetAllocation_accuracy.length - 1],
      riskAssessmentAccuracy: history.riskAssessment_accuracy[history.riskAssessment_accuracy.length - 1],
      epochs: lastHistory.epoch.length
    };
  }

  /**
   * Dispose model
   */
  public dispose(): void {
    if (this.model) {
      this.model.dispose();
      this.model = null;
    }
  }
}

// Helper classes
class CostNormalizer {
  private means: { [key: string]: number } = {};
  private stds: { [key: string]: number } = {};

  async normalize(costs: any): Promise<any> {
    // Implement cost normalization
    return costs; // Placeholder
  }

  async denormalize(costs: any): Promise<any> {
    // Implement cost denormalization
    return costs; // Placeholder
  }

  async save(path: string): Promise<void> {
    // Save normalization parameters
  }

  async load(path: string): Promise<void> {
    // Load normalization parameters
  }
}

class FeatureScaler {
  private scalers: { [key: string]: any } = {};

  async scale(features: tf.Tensor[]): Promise<tf.Tensor[]> {
    // Implement feature scaling
    return features; // Placeholder
  }

  async save(path: string): Promise<void> {
    // Save scaling parameters
  }

  async load(path: string): Promise<void> {
    // Load scaling parameters
  }
}

// Type definitions
export interface CostOptimizationConfig {
  inputDim: number;
  hiddenLayers: number[];
  outputDim: number;
  dropout: number;
  learningRate: number;
  l1Regularization: number;
  l2Regularization: number;
  useBatchNorm: boolean;
  useLayerNorm: boolean;
  activationFunction: string;
  outputActivation: string;
  optimizerType: string;
  enableDeepResidual: boolean;
  enableAttention: boolean;
  costTypes: string[];
  optimizationHorizon: number;
}

export interface CostOptimizationTrainingData {
  workflowFeatures: tf.Tensor;
  providerFeatures: tf.Tensor;
  resourceFeatures: tf.Tensor;
  historicalCosts: tf.Tensor;
  costs: any;
}

export interface CostOptimizationPrediction {
  predictedCosts: any;
  optimizationRecommendations: number[];
  budgetAllocation: number[];
  efficiencyScore: number;
  riskLevel: string;
  totalCostEstimate: number;
  potentialSavings: number;
  recommendations: string[];
}

export interface CostOptimizationMetrics {
  trainingLoss: number;
  validationLoss: number;
  tokenCostMAE: number;
  computationCostMAE: number;
  storageCostMAE: number;
  transferCostMAE: number;
  efficiencyScoreMAE: number;
  optimizationAccuracy: number;
  budgetAllocationAccuracy: number;
  riskAssessmentAccuracy: number;
  epochs: number;
}

/**
 * Factory function to create cost optimization model
 */
export async function createCostOptimizationModel(
  config?: Partial<CostOptimizationConfig>
): Promise<CostOptimizationModel> {
  const model = new CostOptimizationModel(config);
  await model.buildModel();
  return model;
}