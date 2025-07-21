import * as tf from '@tensorflow/tfjs-node';
import { logger } from '../../utils/logger';

/**
 * Advanced weight initialization strategies for neural networks
 * Implements Xavier/Glorot, He/Kaiming, and custom initialization methods
 */
export class WeightInitializer {
  /**
   * Xavier/Glorot initialization for tanh/sigmoid activations
   */
  public static xavierInitializer(
    fanIn: number,
    fanOut: number,
    mode: 'uniform' | 'normal' = 'uniform'
  ): tf.initializers.Initializer {
    const scale = Math.sqrt(2.0 / (fanIn + fanOut));

    if (mode === 'uniform') {
      const limit = scale * Math.sqrt(3);
      return tf.initializers.randomUniform({ minval: -limit, maxval: limit });
    } else {
      return tf.initializers.randomNormal({ mean: 0, stddev: scale });
    }
  }

  /**
   * He/Kaiming initialization for ReLU activations
   */
  public static heInitializer(
    fanIn: number,
    fanOut: number,
    mode: 'uniform' | 'normal' = 'normal'
  ): tf.initializers.Initializer {
    const scale = Math.sqrt(2.0 / fanIn);

    if (mode === 'uniform') {
      const limit = scale * Math.sqrt(3);
      return tf.initializers.randomUniform({ minval: -limit, maxval: limit });
    } else {
      return tf.initializers.randomNormal({ mean: 0, stddev: scale });
    }
  }

  /**
   * LeCun initialization for SELU activations
   */
  public static leCunInitializer(fanIn: number): tf.initializers.Initializer {
    const scale = Math.sqrt(1.0 / fanIn);
    return tf.initializers.randomNormal({ mean: 0, stddev: scale });
  }

  /**
   * Orthogonal initialization for recurrent networks
   */
  public static orthogonalInitializer(gain: number = 1.0): tf.initializers.Initializer {
    return tf.initializers.orthogonal({ gain });
  }

  /**
   * Smart initialization based on activation function
   */
  public static smartInitializer(
    activation: string,
    shape: number[]
  ): tf.initializers.Initializer {
    const fanIn = shape.length > 1 ? shape[0] : 1;
    const fanOut = shape.length > 1 ? shape[1] : shape[0];

    switch (activation.toLowerCase()) {
      case 'relu':
      case 'leakyrelu':
      case 'elu':
        return WeightInitializer.heInitializer(fanIn, fanOut);
      
      case 'tanh':
      case 'sigmoid':
      case 'softsign':
        return WeightInitializer.xavierInitializer(fanIn, fanOut);
      
      case 'selu':
        return WeightInitializer.leCunInitializer(fanIn);
      
      case 'linear':
      case 'softmax':
        return WeightInitializer.xavierInitializer(fanIn, fanOut, 'uniform');
      
      default:
        logger.warn(`Unknown activation '${activation}', using Xavier initialization`);
        return WeightInitializer.xavierInitializer(fanIn, fanOut);
    }
  }

  /**
   * Variance scaling initializer with custom configuration
   */
  public static varianceScalingInitializer(config: {
    scale?: number;
    mode?: 'fanIn' | 'fanOut' | 'fanAvg';
    distribution?: 'normal' | 'uniform' | 'truncatedNormal';
  }): tf.initializers.Initializer {
    return tf.initializers.varianceScaling({
      scale: config.scale || 1.0,
      mode: config.mode || 'fanIn',
      distribution: config.distribution || 'normal'
    });
  }

  /**
   * Create layer with optimized weight initialization
   */
  public static createOptimizedDenseLayer(config: {
    units: number;
    activation?: string;
    inputShape?: number[];
    useBias?: boolean;
    biasInitializer?: tf.initializers.Initializer;
  }): tf.layers.Layer {
    const { units, activation = 'linear', inputShape, useBias = true } = config;

    // Determine weight initialization based on activation
    let kernelInitializer: tf.initializers.Initializer;
    
    if (inputShape) {
      const fanIn = inputShape[0];
      const fanOut = units;
      kernelInitializer = WeightInitializer.smartInitializer(activation, [fanIn, fanOut]);
    } else {
      // Use default smart initializer
      kernelInitializer = WeightInitializer.varianceScalingInitializer({
        scale: 2.0,
        mode: 'fanIn',
        distribution: 'normal'
      });
    }

    // Bias initialization
    const biasInitializer = config.biasInitializer || tf.initializers.zeros();

    return tf.layers.dense({
      units,
      activation: activation as any,
      inputShape,
      useBias,
      kernelInitializer,
      biasInitializer
    });
  }

  /**
   * Initialize weights for attention mechanisms
   */
  public static attentionInitializer(
    hiddenDim: number,
    numHeads: number
  ): tf.initializers.Initializer {
    const scale = 1.0 / Math.sqrt(hiddenDim / numHeads);
    return tf.initializers.randomNormal({ mean: 0, stddev: scale });
  }

  /**
   * Initialize embedding layers
   */
  public static embeddingInitializer(
    vocabSize: number,
    embeddingDim: number
  ): tf.initializers.Initializer {
    const scale = 1.0 / Math.sqrt(embeddingDim);
    return tf.initializers.randomUniform({ minval: -scale, maxval: scale });
  }

  /**
   * Residual block initialization
   */
  public static residualInitializer(
    depth: number,
    activation: string = 'relu'
  ): tf.initializers.Initializer {
    // Scale down initialization for deeper networks
    const scaleFactor = Math.sqrt(2.0 / depth);
    
    if (activation.toLowerCase().includes('relu')) {
      return tf.initializers.randomNormal({ 
        mean: 0, 
        stddev: scaleFactor * Math.sqrt(2.0)
      });
    } else {
      return tf.initializers.randomNormal({ 
        mean: 0, 
        stddev: scaleFactor 
      });
    }
  }

  /**
   * LSTM/GRU initialization
   */
  public static recurrentInitializer(
    units: number,
    forgetBias: number = 1.0
  ): {
    kernel: tf.initializers.Initializer;
    recurrentKernel: tf.initializers.Initializer;
    bias: tf.initializers.Initializer;
  } {
    return {
      kernel: WeightInitializer.xavierInitializer(units, units * 4),
      recurrentKernel: WeightInitializer.orthogonalInitializer(1.0),
      bias: tf.initializers.initializers.constant({ value: forgetBias })
    };
  }

  /**
   * Check if weights are properly initialized (not too small or large)
   */
  public static async validateWeights(
    weights: tf.Tensor,
    layerName: string
  ): Promise<{
    isValid: boolean;
    stats: {
      mean: number;
      std: number;
      min: number;
      max: number;
    };
    warnings: string[];
  }> {
    const data = await weights.data();
    const values = Array.from(data);
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const std = Math.sqrt(variance);
    const min = Math.min(...values);
    const max = Math.max(...values);

    const warnings: string[] = [];
    let isValid = true;

    // Check for issues
    if (Math.abs(mean) > 0.1) {
      warnings.push(`Layer ${layerName}: Mean weight ${mean.toFixed(4)} is far from zero`);
    }

    if (std < 0.01) {
      warnings.push(`Layer ${layerName}: Weights may be too small (std=${std.toFixed(4)})`);
      isValid = false;
    }

    if (std > 2.0) {
      warnings.push(`Layer ${layerName}: Weights may be too large (std=${std.toFixed(4)})`);
      isValid = false;
    }

    if (Math.abs(min) > 10 || Math.abs(max) > 10) {
      warnings.push(`Layer ${layerName}: Extreme weight values detected (min=${min.toFixed(4)}, max=${max.toFixed(4)})`);
      isValid = false;
    }

    return {
      isValid,
      stats: { mean, std, min, max },
      warnings
    };
  }
}

/**
 * Factory function for creating initialized layers
 */
export function createInitializedLayer(
  type: 'dense' | 'conv2d' | 'lstm' | 'gru' | 'embedding',
  config: any
): tf.layers.Layer {
  switch (type) {
    case 'dense':
      return WeightInitializer.createOptimizedDenseLayer(config);
    
    case 'conv2d':
      const conv2dKernelInit = WeightInitializer.smartInitializer(
        config.activation || 'relu',
        [config.kernelSize * config.kernelSize * (config.inputShape?.[2] || 3), config.filters]
      );
      return tf.layers.conv2d({
        ...config,
        kernelInitializer: conv2dKernelInit,
        biasInitializer: tf.initializers.zeros()
      });
    
    case 'lstm':
      const lstmInit = WeightInitializer.recurrentInitializer(config.units);
      return tf.layers.lstm({
        ...config,
        kernelInitializer: lstmInit.kernel,
        recurrentInitializer: lstmInit.recurrentKernel,
        biasInitializer: lstmInit.bias
      });
    
    case 'gru':
      const gruInit = WeightInitializer.recurrentInitializer(config.units, 0);
      return tf.layers.gru({
        ...config,
        kernelInitializer: gruInit.kernel,
        recurrentInitializer: gruInit.recurrentKernel,
        biasInitializer: gruInit.bias
      });
    
    case 'embedding':
      return tf.layers.embedding({
        ...config,
        embeddingsInitializer: WeightInitializer.embeddingInitializer(
          config.inputDim,
          config.outputDim
        )
      });
    
    default:
      throw new Error(`Unknown layer type: ${type}`);
  }
}