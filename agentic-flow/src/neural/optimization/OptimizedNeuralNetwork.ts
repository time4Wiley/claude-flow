import * as tf from '@tensorflow/tfjs-node';
import { logger } from '../../utils/logger';
import { WeightInitializer } from './WeightInitializer';
import { GradientOptimizer } from '../training/GradientOptimizer';
import { AdaptiveLearningRateScheduler } from '../training/AdaptiveLearningRateScheduler';
import { EarlyStoppingOptimizer } from '../training/EarlyStoppingOptimizer';

/**
 * Optimized Neural Network with all performance enhancements
 * - Smart weight initialization
 * - Batch normalization
 * - Gradient clipping
 * - Learning rate scheduling
 * - Early stopping
 * - Memory optimization
 */
export class OptimizedNeuralNetwork {
  private model: tf.LayersModel | null = null;
  private gradientOptimizer: GradientOptimizer;
  private learningRateScheduler: AdaptiveLearningRateScheduler;
  private earlyStopping: EarlyStoppingOptimizer;
  private memoryPool: Map<string, tf.Tensor> = new Map();
  private performanceMetrics: PerformanceMetrics;

  constructor(private config: OptimizedNetworkConfig) {
    this.gradientOptimizer = new GradientOptimizer({
      clippingMethod: 'norm',
      clipNorm: 1.0,
      gradientCentralization: true,
      adaptiveClipping: {
        enabled: true,
        percentile: 95,
        windowSize: 100
      }
    });

    this.learningRateScheduler = new AdaptiveLearningRateScheduler({
      initialLearningRate: config.learningRate || 0.001,
      mode: 'cosine_annealing_warm_restarts',
      warmupSteps: 100,
      minLearningRate: 1e-6,
      patience: 20
    });

    this.earlyStopping = new EarlyStoppingOptimizer({
      monitor: 'val_loss',
      patience: 15,
      mode: 'min',
      minDelta: 0.0001,
      restoreBestWeights: true
    });

    this.performanceMetrics = {
      trainingTime: 0,
      inferenceSpeed: 0,
      memoryUsage: 0,
      accuracy: 0,
      loss: Infinity
    };
  }

  /**
   * Build optimized model architecture
   */
  public async buildModel(): Promise<void> {
    try {
      logger.info('Building optimized neural network...');

      const inputs = tf.input({ 
        shape: this.config.inputShape, 
        name: 'input' 
      });

      let x = inputs;

      // Add optimized layers with batch normalization
      for (let i = 0; i < this.config.layers.length; i++) {
        const layerConfig = this.config.layers[i];
        x = await this.addOptimizedLayer(x, layerConfig, i);
      }

      // Create model
      this.model = tf.model({
        inputs: inputs,
        outputs: x as tf.SymbolicTensor,
        name: 'OptimizedNeuralNetwork'
      });

      // Compile with optimized settings
      await this.compileOptimized();

      // Validate weight initialization
      await this.validateInitialization();

      logger.info('Optimized neural network built successfully');
      this.model.summary();

    } catch (error) {
      logger.error('Error building optimized model:', error);
      throw error;
    }
  }

  /**
   * Add optimized layer with proper initialization and normalization
   */
  private async addOptimizedLayer(
    input: tf.SymbolicTensor,
    layerConfig: LayerConfig,
    layerIndex: number
  ): Promise<tf.SymbolicTensor> {
    let output = input;

    // Determine optimal initialization
    const shape = layerConfig.units ? 
      [input.shape[input.shape.length - 1] as number, layerConfig.units] : 
      undefined;

    switch (layerConfig.type) {
      case 'dense':
        output = tf.layers.dense({
          units: layerConfig.units!,
          activation: layerConfig.useBatchNorm ? 'linear' : layerConfig.activation,
          kernelInitializer: shape ? 
            WeightInitializer.smartInitializer(layerConfig.activation || 'relu', shape) :
            undefined,
          name: `dense_${layerIndex}`
        }).apply(output) as tf.SymbolicTensor;
        break;

      case 'conv2d':
        output = tf.layers.conv2d({
          filters: layerConfig.filters!,
          kernelSize: layerConfig.kernelSize || 3,
          activation: layerConfig.useBatchNorm ? 'linear' : layerConfig.activation,
          kernelInitializer: WeightInitializer.heInitializer(
            9 * (input.shape[3] as number), // 3x3 kernel * input channels
            layerConfig.filters!
          ),
          padding: 'same',
          name: `conv2d_${layerIndex}`
        }).apply(output) as tf.SymbolicTensor;
        break;

      case 'lstm':
        const lstmInit = WeightInitializer.recurrentInitializer(layerConfig.units!);
        output = tf.layers.lstm({
          units: layerConfig.units!,
          returnSequences: layerConfig.returnSequences,
          kernelInitializer: lstmInit.kernel,
          recurrentInitializer: lstmInit.recurrentKernel,
          biasInitializer: lstmInit.bias,
          name: `lstm_${layerIndex}`
        }).apply(output) as tf.SymbolicTensor;
        break;
    }

    // Add batch normalization if enabled
    if (layerConfig.useBatchNorm) {
      output = tf.layers.batchNormalization({
        axis: -1,
        momentum: 0.99,
        epsilon: 0.001,
        center: true,
        scale: true,
        betaInitializer: tf.initializers.zeros(),
        gammaInitializer: tf.initializers.ones(),
        name: `batch_norm_${layerIndex}`
      }).apply(output) as tf.SymbolicTensor;

      // Apply activation after batch norm
      if (layerConfig.activation && layerConfig.activation !== 'linear') {
        output = tf.layers.activation({
          activation: layerConfig.activation as any,
          name: `activation_${layerIndex}`
        }).apply(output) as tf.SymbolicTensor;
      }
    }

    // Add dropout for regularization
    if (layerConfig.dropout && layerConfig.dropout > 0) {
      output = tf.layers.dropout({
        rate: layerConfig.dropout,
        name: `dropout_${layerIndex}`
      }).apply(output) as tf.SymbolicTensor;
    }

    return output;
  }

  /**
   * Compile model with optimized settings
   */
  private async compileOptimized(): Promise<void> {
    if (!this.model) throw new Error('Model not built');

    const optimizer = tf.train.adam(this.config.learningRate || 0.001);
    
    this.model.compile({
      optimizer,
      loss: this.config.loss || 'categoricalCrossentropy',
      metrics: this.config.metrics || ['accuracy']
    });
  }

  /**
   * Validate weight initialization
   */
  private async validateInitialization(): Promise<void> {
    if (!this.model) return;

    const weights = this.model.getWeights();
    let allValid = true;

    for (let i = 0; i < weights.length; i++) {
      const weight = weights[i];
      const layerName = `Layer_${i}`;
      
      const validation = await WeightInitializer.validateWeights(weight, layerName);
      
      if (!validation.isValid) {
        allValid = false;
        logger.warn(`Weight initialization issue in ${layerName}:`, validation.warnings);
      }
    }

    if (allValid) {
      logger.info('All weights properly initialized');
    }
  }

  /**
   * Train with all optimizations
   */
  public async trainOptimized(
    xTrain: tf.Tensor,
    yTrain: tf.Tensor,
    xVal?: tf.Tensor,
    yVal?: tf.Tensor,
    epochs: number = 100
  ): Promise<TrainingResult> {
    if (!this.model) throw new Error('Model not built');

    const startTime = Date.now();
    const history: TrainingHistory = {
      loss: [],
      accuracy: [],
      val_loss: [],
      val_accuracy: [],
      learningRate: []
    };

    try {
      logger.info('Starting optimized training...');

      // Custom training loop with all optimizations
      for (let epoch = 0; epoch < epochs; epoch++) {
        const epochStartTime = Date.now();

        // Update learning rate
        const currentLR = this.learningRateScheduler.getCurrentLearningRate();
        this.model.optimizer.learningRate = currentLR;

        // Train one epoch with gradient optimization
        const epochLogs = await this.trainEpochOptimized(
          xTrain, 
          yTrain, 
          xVal, 
          yVal,
          epoch
        );

        // Update history
        history.loss.push(epochLogs.loss);
        history.accuracy.push(epochLogs.accuracy);
        if (epochLogs.val_loss !== undefined) {
          history.val_loss.push(epochLogs.val_loss);
          history.val_accuracy.push(epochLogs.val_accuracy || 0);
        }
        history.learningRate.push(currentLR);

        // Update learning rate scheduler
        this.learningRateScheduler.updateMetrics({
          loss: epochLogs.loss,
          val_loss: epochLogs.val_loss,
          accuracy: epochLogs.accuracy,
          val_accuracy: epochLogs.val_accuracy
        });

        // Check early stopping
        const shouldStop = this.earlyStopping.checkEarlyStopping(
          epochLogs.val_loss || epochLogs.loss,
          this.model
        );

        if (shouldStop) {
          logger.info(`Early stopping at epoch ${epoch + 1}`);
          this.earlyStopping.restoreBestWeights(this.model);
          break;
        }

        const epochTime = Date.now() - epochStartTime;
        logger.info(
          `Epoch ${epoch + 1}: loss=${epochLogs.loss.toFixed(4)}, ` +
          `accuracy=${epochLogs.accuracy.toFixed(4)}, ` +
          `lr=${currentLR.toFixed(6)}, ` +
          `time=${epochTime}ms`
        );

        // Memory cleanup every 10 epochs
        if (epoch % 10 === 0) {
          await this.cleanupMemory();
        }
      }

      const trainingTime = Date.now() - startTime;
      this.performanceMetrics.trainingTime = trainingTime;
      this.performanceMetrics.accuracy = history.accuracy[history.accuracy.length - 1];
      this.performanceMetrics.loss = history.loss[history.loss.length - 1];

      logger.info(`Training completed in ${trainingTime}ms`);

      return {
        history,
        finalAccuracy: this.performanceMetrics.accuracy,
        finalLoss: this.performanceMetrics.loss,
        trainingTime,
        modelSize: await this.getModelSize()
      };

    } catch (error) {
      logger.error('Error during optimized training:', error);
      throw error;
    }
  }

  /**
   * Train single epoch with optimizations
   */
  private async trainEpochOptimized(
    xTrain: tf.Tensor,
    yTrain: tf.Tensor,
    xVal?: tf.Tensor,
    yVal?: tf.Tensor,
    epoch: number = 0
  ): Promise<EpochLogs> {
    if (!this.model) throw new Error('Model not built');

    const batchSize = this.config.batchSize || 32;
    const numBatches = Math.ceil(xTrain.shape[0] / batchSize);
    
    let totalLoss = 0;
    let totalAccuracy = 0;
    let batchCount = 0;

    // Training batches
    for (let i = 0; i < numBatches; i++) {
      const batchStart = i * batchSize;
      const batchEnd = Math.min((i + 1) * batchSize, xTrain.shape[0]);
      
      const xBatch = xTrain.slice([batchStart, 0], [batchEnd - batchStart, -1]);
      const yBatch = yTrain.slice([batchStart, 0], [batchEnd - batchStart, -1]);

      // Custom gradient computation with optimization
      const grads = tf.variableGrads(() => {
        const predictions = this.model!.apply(xBatch) as tf.Tensor;
        const loss = tf.losses.softmaxCrossEntropy(yBatch, predictions);
        return loss as tf.Scalar;
      });

      // Process gradients with optimizer
      const processedGrads = this.gradientOptimizer.processGradients(grads.grads);

      // Apply gradients
      this.model.optimizer.applyGradients(processedGrads);

      // Calculate metrics
      const predictions = this.model.predict(xBatch) as tf.Tensor;
      const accuracy = this.calculateAccuracy(predictions, yBatch);
      
      totalLoss += grads.value.dataSync()[0];
      totalAccuracy += await accuracy.data();
      batchCount++;

      // Cleanup
      xBatch.dispose();
      yBatch.dispose();
      predictions.dispose();
      grads.value.dispose();
      accuracy.dispose();
    }

    const epochLogs: EpochLogs = {
      loss: totalLoss / batchCount,
      accuracy: totalAccuracy / batchCount
    };

    // Validation
    if (xVal && yVal) {
      const valMetrics = await this.evaluate(xVal, yVal);
      epochLogs.val_loss = valMetrics.loss;
      epochLogs.val_accuracy = valMetrics.accuracy;
    }

    return epochLogs;
  }

  /**
   * Optimized inference with caching
   */
  public async predictOptimized(input: tf.Tensor): Promise<tf.Tensor> {
    if (!this.model) throw new Error('Model not built');

    const startTime = performance.now();

    // Check cache
    const cacheKey = this.generateCacheKey(input);
    if (this.memoryPool.has(cacheKey)) {
      const cached = this.memoryPool.get(cacheKey)!;
      this.performanceMetrics.inferenceSpeed = performance.now() - startTime;
      return cached.clone();
    }

    // Perform inference
    const prediction = this.model.predict(input) as tf.Tensor;

    // Cache result (with size limit)
    if (this.memoryPool.size < 100) {
      this.memoryPool.set(cacheKey, prediction.clone());
    }

    this.performanceMetrics.inferenceSpeed = performance.now() - startTime;
    return prediction;
  }

  /**
   * Evaluate model performance
   */
  private async evaluate(x: tf.Tensor, y: tf.Tensor): Promise<{
    loss: number;
    accuracy: number;
  }> {
    if (!this.model) throw new Error('Model not built');

    const result = this.model.evaluate(x, y) as tf.Scalar[];
    const loss = await result[0].data();
    const accuracy = result.length > 1 ? await result[1].data() : [0];

    result.forEach(t => t.dispose());

    return {
      loss: loss[0],
      accuracy: accuracy[0]
    };
  }

  /**
   * Calculate accuracy
   */
  private calculateAccuracy(predictions: tf.Tensor, labels: tf.Tensor): tf.Scalar {
    const predArgMax = predictions.argMax(-1);
    const labelArgMax = labels.argMax(-1);
    const correct = predArgMax.equal(labelArgMax);
    const accuracy = correct.mean();
    
    predArgMax.dispose();
    labelArgMax.dispose();
    correct.dispose();
    
    return accuracy;
  }

  /**
   * Generate cache key for predictions
   */
  private generateCacheKey(input: tf.Tensor): string {
    const shape = input.shape.join(',');
    const sample = input.dataSync().slice(0, 10).join(',');
    return `${shape}_${sample}`;
  }

  /**
   * Memory cleanup
   */
  private async cleanupMemory(): Promise<void> {
    // Clear old cache entries
    if (this.memoryPool.size > 50) {
      const entriesToRemove = this.memoryPool.size - 50;
      let removed = 0;
      
      for (const [key, tensor] of this.memoryPool) {
        if (removed >= entriesToRemove) break;
        tensor.dispose();
        this.memoryPool.delete(key);
        removed++;
      }
    }

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    // Update memory usage
    const memInfo = tf.memory();
    this.performanceMetrics.memoryUsage = memInfo.numBytes;
  }

  /**
   * Get model size in bytes
   */
  private async getModelSize(): Promise<number> {
    if (!this.model) return 0;

    const weights = this.model.getWeights();
    let totalSize = 0;

    weights.forEach(weight => {
      totalSize += weight.size * 4; // 4 bytes per float32
    });

    return totalSize;
  }

  /**
   * Get performance metrics
   */
  public getPerformanceMetrics(): PerformanceMetrics {
    return { ...this.performanceMetrics };
  }

  /**
   * Model quantization for faster inference
   */
  public async quantizeModel(bits: 8 | 16 = 8): Promise<void> {
    if (!this.model) throw new Error('Model not built');

    logger.info(`Quantizing model to ${bits}-bit...`);
    
    // Get current weights
    const weights = this.model.getWeights();
    const quantizedWeights: tf.Tensor[] = [];

    for (const weight of weights) {
      const quantized = await this.quantizeTensor(weight, bits);
      quantizedWeights.push(quantized);
    }

    // Set quantized weights
    this.model.setWeights(quantizedWeights);

    // Cleanup
    weights.forEach(w => w.dispose());

    logger.info('Model quantization completed');
  }

  /**
   * Quantize individual tensor
   */
  private async quantizeTensor(tensor: tf.Tensor, bits: number): Promise<tf.Tensor> {
    const data = await tensor.data();
    const min = Math.min(...Array.from(data));
    const max = Math.max(...Array.from(data));
    const scale = (max - min) / (Math.pow(2, bits) - 1);
    
    const quantized = tf.tidy(() => {
      const shifted = tensor.sub(tf.scalar(min));
      const scaled = shifted.div(tf.scalar(scale));
      const rounded = scaled.round();
      const dequantized = rounded.mul(tf.scalar(scale)).add(tf.scalar(min));
      return dequantized;
    });

    return quantized;
  }

  /**
   * Save optimized model
   */
  public async save(path: string): Promise<void> {
    if (!this.model) throw new Error('Model not built');

    await this.model.save(`file://${path}`);
    
    // Save optimization metadata
    const metadata = {
      config: this.config,
      performanceMetrics: this.performanceMetrics,
      gradientOptimizerConfig: this.gradientOptimizer.getAnalytics(),
      learningRateHistory: this.learningRateScheduler.getHistory()
    };

    const fs = require('fs').promises;
    await fs.writeFile(
      `${path}/optimization_metadata.json`,
      JSON.stringify(metadata, null, 2)
    );

    logger.info(`Optimized model saved to ${path}`);
  }

  /**
   * Dispose of resources
   */
  public dispose(): void {
    if (this.model) {
      this.model.dispose();
    }
    
    this.memoryPool.forEach(tensor => tensor.dispose());
    this.memoryPool.clear();
    
    this.gradientOptimizer.dispose();
  }
}

// Type definitions
export interface OptimizedNetworkConfig {
  inputShape: number[];
  layers: LayerConfig[];
  learningRate?: number;
  batchSize?: number;
  loss?: string;
  metrics?: string[];
}

export interface LayerConfig {
  type: 'dense' | 'conv2d' | 'lstm' | 'gru';
  units?: number;
  filters?: number;
  kernelSize?: number;
  activation?: string;
  useBatchNorm?: boolean;
  dropout?: number;
  returnSequences?: boolean;
}

export interface PerformanceMetrics {
  trainingTime: number;
  inferenceSpeed: number;
  memoryUsage: number;
  accuracy: number;
  loss: number;
}

export interface TrainingHistory {
  loss: number[];
  accuracy: number[];
  val_loss: number[];
  val_accuracy: number[];
  learningRate: number[];
}

export interface TrainingResult {
  history: TrainingHistory;
  finalAccuracy: number;
  finalLoss: number;
  trainingTime: number;
  modelSize: number;
}

export interface EpochLogs {
  loss: number;
  accuracy: number;
  val_loss?: number;
  val_accuracy?: number;
}

/**
 * Factory function for creating optimized models
 */
export function createOptimizedModel(config: OptimizedNetworkConfig): OptimizedNeuralNetwork {
  return new OptimizedNeuralNetwork(config);
}