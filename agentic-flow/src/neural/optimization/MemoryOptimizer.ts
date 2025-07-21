import * as tf from '@tensorflow/tfjs-node';
import { logger } from '../../utils/logger';
import { EventEmitter } from 'events';

/**
 * Memory optimization for neural networks
 * Implements tensor pooling, gradient checkpointing, and memory-efficient operations
 */
export class MemoryOptimizer extends EventEmitter {
  private tensorPool: Map<string, TensorPoolEntry[]> = new Map();
  private gradientCache: Map<string, tf.Tensor> = new Map();
  private memoryStats: MemoryStats;
  private config: MemoryOptimizerConfig;

  constructor(config?: Partial<MemoryOptimizerConfig>) {
    super();
    
    this.config = {
      enableTensorPooling: true,
      poolSizeLimit: 1000,
      enableGradientCheckpointing: true,
      checkpointInterval: 5,
      memoryThreshold: 0.8,
      aggressiveCleanup: false,
      ...config
    };

    this.memoryStats = {
      totalAllocated: 0,
      totalFreed: 0,
      pooledTensors: 0,
      cacheHits: 0,
      cacheMisses: 0,
      peakMemoryUsage: 0
    };

    this.startMemoryMonitoring();
  }

  /**
   * Get or create tensor from pool
   */
  public getTensor(shape: number[], dtype: tf.DataType = 'float32'): tf.Tensor {
    if (!this.config.enableTensorPooling) {
      return tf.zeros(shape, dtype);
    }

    const key = this.getPoolKey(shape, dtype);
    const pool = this.tensorPool.get(key) || [];
    
    if (pool.length > 0) {
      const entry = pool.pop()!;
      this.tensorPool.set(key, pool);
      this.memoryStats.cacheHits++;
      this.memoryStats.pooledTensors--;
      
      // Clear tensor data
      entry.tensor.assign(tf.zeros(shape, dtype));
      
      return entry.tensor;
    }

    this.memoryStats.cacheMisses++;
    const tensor = tf.zeros(shape, dtype);
    this.memoryStats.totalAllocated += this.getTensorSize(tensor);
    
    return tensor;
  }

  /**
   * Return tensor to pool
   */
  public returnTensor(tensor: tf.Tensor): void {
    if (!this.config.enableTensorPooling || tensor.isDisposed) {
      return;
    }

    const key = this.getPoolKey(tensor.shape, tensor.dtype);
    const pool = this.tensorPool.get(key) || [];
    
    if (pool.length < this.config.poolSizeLimit) {
      pool.push({
        tensor: tensor.clone(),
        size: this.getTensorSize(tensor),
        lastUsed: Date.now()
      });
      
      this.tensorPool.set(key, pool);
      this.memoryStats.pooledTensors++;
    } else {
      tensor.dispose();
      this.memoryStats.totalFreed += this.getTensorSize(tensor);
    }
  }

  /**
   * Memory-efficient matrix multiplication
   */
  public async matMulEfficient(
    a: tf.Tensor2D,
    b: tf.Tensor2D,
    transposeA = false,
    transposeB = false
  ): Promise<tf.Tensor2D> {
    // Check if we need to chunk the operation
    const estimatedMemory = this.estimateMatMulMemory(a.shape, b.shape);
    const currentMemory = tf.memory().numBytes;
    
    if (estimatedMemory + currentMemory > this.getMemoryLimit()) {
      return this.matMulChunked(a, b, transposeA, transposeB);
    }

    return tf.matMul(a, b, transposeA, transposeB);
  }

  /**
   * Chunked matrix multiplication for large matrices
   */
  private async matMulChunked(
    a: tf.Tensor2D,
    b: tf.Tensor2D,
    transposeA = false,
    transposeB = false,
    chunkSize = 128
  ): Promise<tf.Tensor2D> {
    const [m, k1] = transposeA ? [a.shape[1], a.shape[0]] : a.shape;
    const [k2, n] = transposeB ? [b.shape[1], b.shape[0]] : b.shape;
    
    if (k1 !== k2) {
      throw new Error(`Incompatible shapes for matrix multiplication: ${k1} vs ${k2}`);
    }

    const result = tf.zeros([m, n]);
    
    // Process in chunks
    for (let i = 0; i < m; i += chunkSize) {
      const iEnd = Math.min(i + chunkSize, m);
      
      for (let j = 0; j < n; j += chunkSize) {
        const jEnd = Math.min(j + chunkSize, n);
        
        // Get chunks
        const aChunk = transposeA ? 
          a.slice([0, i], [k1, iEnd - i]).transpose() :
          a.slice([i, 0], [iEnd - i, k1]);
          
        const bChunk = transposeB ?
          b.slice([j, 0], [jEnd - j, k2]).transpose() :
          b.slice([0, j], [k2, jEnd - j]);
        
        // Compute chunk
        const chunkResult = tf.matMul(aChunk, bChunk);
        
        // Update result
        const indices = tf.buffer([iEnd - i, jEnd - j, 2], 'int32');
        for (let ci = 0; ci < iEnd - i; ci++) {
          for (let cj = 0; cj < jEnd - j; cj++) {
            indices.set(i + ci, ci, cj, 0);
            indices.set(j + cj, ci, cj, 1);
          }
        }
        
        const updates = chunkResult;
        const scatterResult = tf.scatterND(
          indices.toTensor() as tf.Tensor2D,
          updates,
          result.shape
        );
        
        result.assign(result.add(scatterResult));
        
        // Cleanup
        aChunk.dispose();
        bChunk.dispose();
        chunkResult.dispose();
        indices.toTensor().dispose();
        scatterResult.dispose();
        
        // Yield to prevent blocking
        await tf.nextFrame();
      }
    }
    
    return result as tf.Tensor2D;
  }

  /**
   * Gradient checkpointing for memory-efficient backpropagation
   */
  public async computeGradientsWithCheckpointing(
    f: () => tf.Scalar,
    vars: tf.Variable[],
    checkpointLayers: number[]
  ): Promise<{ [varName: string]: tf.Tensor }> {
    if (!this.config.enableGradientCheckpointing) {
      return tf.variableGrads(f).grads;
    }

    const checkpoints: Map<number, tf.Tensor[]> = new Map();
    const gradients: { [varName: string]: tf.Tensor } = {};

    // Forward pass with checkpointing
    let activations: tf.Tensor[] = [];
    const loss = tf.tidy(() => {
      // Custom forward pass that saves checkpoints
      // This is a simplified version - real implementation would need layer tracking
      return f();
    });

    // Backward pass with recomputation
    for (let i = vars.length - 1; i >= 0; i--) {
      if (checkpointLayers.includes(i)) {
        // Recompute from nearest checkpoint
        const nearestCheckpoint = this.findNearestCheckpoint(i, checkpointLayers);
        activations = await this.recomputeFromCheckpoint(
          nearestCheckpoint,
          i,
          checkpoints
        );
      }

      // Compute gradient for this variable
      const grad = tf.grad((v: tf.Variable) => {
        // Recompute forward pass up to this variable
        return loss;
      })(vars[i]);

      gradients[vars[i].name] = grad;
    }

    // Cleanup checkpoints
    checkpoints.forEach(tensors => tensors.forEach(t => t.dispose()));
    loss.dispose();

    return gradients;
  }

  /**
   * Memory-efficient batch processing
   */
  public async processBatchesEfficiently<T>(
    data: tf.Tensor,
    batchSize: number,
    processFn: (batch: tf.Tensor) => Promise<T>
  ): Promise<T[]> {
    const numBatches = Math.ceil(data.shape[0] / batchSize);
    const results: T[] = [];

    for (let i = 0; i < numBatches; i++) {
      const start = i * batchSize;
      const end = Math.min((i + 1) * batchSize, data.shape[0]);
      
      // Extract batch
      const batch = data.slice([start, ...Array(data.shape.length - 1).fill(0)], 
                               [end - start, ...data.shape.slice(1)]);
      
      try {
        // Process batch
        const result = await processFn(batch);
        results.push(result);
        
        // Memory cleanup
        if (i % 10 === 0) {
          await this.cleanupMemory();
        }
        
        // Yield to prevent blocking
        await tf.nextFrame();
        
      } finally {
        batch.dispose();
      }
    }

    return results;
  }

  /**
   * Optimize memory layout for tensors
   */
  public optimizeTensorLayout(tensor: tf.Tensor): tf.Tensor {
    // Ensure contiguous memory layout
    if (!this.isContiguous(tensor)) {
      const optimized = tf.tidy(() => {
        // Force contiguous layout by cloning
        return tensor.clone();
      });
      
      logger.debug('Optimized tensor layout for better memory access');
      return optimized;
    }
    
    return tensor;
  }

  /**
   * Memory-efficient attention computation
   */
  public async computeAttentionEfficient(
    queries: tf.Tensor,
    keys: tf.Tensor,
    values: tf.Tensor,
    mask?: tf.Tensor
  ): Promise<tf.Tensor> {
    const [batchSize, seqLen, hiddenDim] = queries.shape;
    const headDim = hiddenDim;
    
    // Check if we need chunked attention
    const estimatedMemory = seqLen * seqLen * batchSize * 4; // float32
    
    if (estimatedMemory > 100 * 1024 * 1024) { // 100MB threshold
      return this.computeChunkedAttention(queries, keys, values, mask);
    }

    // Standard attention
    return tf.tidy(() => {
      // Q @ K^T
      const scores = tf.matMul(queries, keys, false, true);
      const scaledScores = scores.div(tf.sqrt(tf.scalar(headDim)));
      
      // Apply mask if provided
      if (mask) {
        const maskValue = tf.scalar(-1e9);
        const maskedScores = tf.where(mask, scaledScores, maskValue);
        maskValue.dispose();
        return tf.softmax(maskedScores).matMul(values);
      }
      
      return tf.softmax(scaledScores).matMul(values);
    });
  }

  /**
   * Chunked attention for long sequences
   */
  private async computeChunkedAttention(
    queries: tf.Tensor,
    keys: tf.Tensor,
    values: tf.Tensor,
    mask?: tf.Tensor,
    chunkSize = 64
  ): Promise<tf.Tensor> {
    const [batchSize, seqLen, hiddenDim] = queries.shape;
    const numChunks = Math.ceil(seqLen / chunkSize);
    
    const outputs: tf.Tensor[] = [];
    
    for (let i = 0; i < numChunks; i++) {
      const startIdx = i * chunkSize;
      const endIdx = Math.min((i + 1) * chunkSize, seqLen);
      const currentChunkSize = endIdx - startIdx;
      
      // Get query chunk
      const qChunk = queries.slice(
        [0, startIdx, 0],
        [batchSize, currentChunkSize, hiddenDim]
      );
      
      // Compute attention scores for this chunk against all keys
      const chunkOutput = tf.tidy(() => {
        const scores = tf.matMul(qChunk, keys, false, true);
        const scaledScores = scores.div(tf.sqrt(tf.scalar(hiddenDim)));
        
        // Apply mask if provided
        if (mask) {
          const maskChunk = mask.slice(
            [0, startIdx, 0],
            [batchSize, currentChunkSize, seqLen]
          );
          const maskValue = tf.scalar(-1e9);
          const maskedScores = tf.where(maskChunk, scaledScores, maskValue);
          maskValue.dispose();
          maskChunk.dispose();
          return tf.softmax(maskedScores).matMul(values);
        }
        
        return tf.softmax(scaledScores).matMul(values);
      });
      
      outputs.push(chunkOutput);
      qChunk.dispose();
      
      // Yield to prevent blocking
      await tf.nextFrame();
    }
    
    // Concatenate outputs
    const result = tf.concat(outputs, 1);
    outputs.forEach(o => o.dispose());
    
    return result;
  }

  /**
   * Start memory monitoring
   */
  private startMemoryMonitoring(): void {
    setInterval(() => {
      const memInfo = tf.memory();
      const usage = memInfo.numBytes / (1024 * 1024 * 1024); // GB
      
      this.memoryStats.peakMemoryUsage = Math.max(
        this.memoryStats.peakMemoryUsage,
        memInfo.numBytes
      );

      if (usage > this.config.memoryThreshold) {
        this.emit('memory:warning', {
          usage,
          threshold: this.config.memoryThreshold,
          numTensors: memInfo.numTensors
        });

        if (this.config.aggressiveCleanup) {
          this.aggressiveMemoryCleanup();
        }
      }
    }, 5000);
  }

  /**
   * Aggressive memory cleanup
   */
  private aggressiveMemoryCleanup(): void {
    logger.warn('Performing aggressive memory cleanup');

    // Clear tensor pool
    let freedMemory = 0;
    this.tensorPool.forEach((pool, key) => {
      pool.forEach(entry => {
        freedMemory += entry.size;
        entry.tensor.dispose();
      });
      this.tensorPool.delete(key);
    });

    // Clear gradient cache
    this.gradientCache.forEach(tensor => {
      freedMemory += this.getTensorSize(tensor);
      tensor.dispose();
    });
    this.gradientCache.clear();

    this.memoryStats.totalFreed += freedMemory;
    this.memoryStats.pooledTensors = 0;

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    this.emit('memory:cleanup', {
      freedMemory,
      totalFreed: this.memoryStats.totalFreed
    });
  }

  /**
   * Regular memory cleanup
   */
  private async cleanupMemory(): Promise<void> {
    // Remove old pooled tensors
    const now = Date.now();
    const maxAge = 60000; // 1 minute

    this.tensorPool.forEach((pool, key) => {
      const newPool = pool.filter(entry => {
        if (now - entry.lastUsed > maxAge) {
          entry.tensor.dispose();
          this.memoryStats.totalFreed += entry.size;
          this.memoryStats.pooledTensors--;
          return false;
        }
        return true;
      });
      
      if (newPool.length > 0) {
        this.tensorPool.set(key, newPool);
      } else {
        this.tensorPool.delete(key);
      }
    });
  }

  /**
   * Helper methods
   */
  private getPoolKey(shape: number[], dtype: tf.DataType): string {
    return `${shape.join('x')}_${dtype}`;
  }

  private getTensorSize(tensor: tf.Tensor): number {
    const bytesPerElement = tensor.dtype === 'float32' ? 4 : 
                           tensor.dtype === 'int32' ? 4 : 
                           tensor.dtype === 'bool' ? 1 : 4;
    return tensor.size * bytesPerElement;
  }

  private estimateMatMulMemory(shapeA: number[], shapeB: number[]): number {
    const [m, k] = shapeA;
    const n = shapeB[1];
    return m * n * 4; // float32
  }

  private getMemoryLimit(): number {
    const totalMemory = require('os').totalmem();
    return totalMemory * this.config.memoryThreshold;
  }

  private isContiguous(tensor: tf.Tensor): boolean {
    // Simplified check - in practice would check strides
    return true;
  }

  private findNearestCheckpoint(layer: number, checkpoints: number[]): number {
    return checkpoints.reduce((nearest, checkpoint) => {
      if (checkpoint <= layer && checkpoint > nearest) {
        return checkpoint;
      }
      return nearest;
    }, -1);
  }

  private async recomputeFromCheckpoint(
    checkpointLayer: number,
    targetLayer: number,
    checkpoints: Map<number, tf.Tensor[]>
  ): Promise<tf.Tensor[]> {
    // Simplified - would recompute activations from checkpoint
    return checkpoints.get(checkpointLayer) || [];
  }

  /**
   * Get memory statistics
   */
  public getStats(): MemoryStats & { current: tf.MemoryInfo } {
    return {
      ...this.memoryStats,
      current: tf.memory()
    };
  }

  /**
   * Reset statistics
   */
  public resetStats(): void {
    this.memoryStats = {
      totalAllocated: 0,
      totalFreed: 0,
      pooledTensors: 0,
      cacheHits: 0,
      cacheMisses: 0,
      peakMemoryUsage: this.memoryStats.peakMemoryUsage
    };
  }

  /**
   * Dispose of all resources
   */
  public dispose(): void {
    this.tensorPool.forEach(pool => {
      pool.forEach(entry => entry.tensor.dispose());
    });
    this.tensorPool.clear();

    this.gradientCache.forEach(tensor => tensor.dispose());
    this.gradientCache.clear();

    this.removeAllListeners();
  }
}

// Type definitions
export interface MemoryOptimizerConfig {
  enableTensorPooling: boolean;
  poolSizeLimit: number;
  enableGradientCheckpointing: boolean;
  checkpointInterval: number;
  memoryThreshold: number;
  aggressiveCleanup: boolean;
}

export interface TensorPoolEntry {
  tensor: tf.Tensor;
  size: number;
  lastUsed: number;
}

export interface MemoryStats {
  totalAllocated: number;
  totalFreed: number;
  pooledTensors: number;
  cacheHits: number;
  cacheMisses: number;
  peakMemoryUsage: number;
}

/**
 * Factory function for creating memory optimizer
 */
export function createMemoryOptimizer(
  config?: Partial<MemoryOptimizerConfig>
): MemoryOptimizer {
  return new MemoryOptimizer(config);
}

/**
 * Memory-efficient layer wrapper
 */
export function memoryEfficientLayer(
  layer: tf.layers.Layer,
  memoryOptimizer: MemoryOptimizer
): tf.layers.Layer {
  const originalApply = layer.apply.bind(layer);
  
  layer.apply = function(inputs: tf.Tensor | tf.Tensor[] | tf.SymbolicTensor | tf.SymbolicTensor[]) {
    if (inputs instanceof tf.Tensor || Array.isArray(inputs)) {
      return tf.tidy(() => {
        const result = originalApply(inputs);
        
        // Return input tensors to pool if they're no longer needed
        if (inputs instanceof tf.Tensor) {
          memoryOptimizer.returnTensor(inputs);
        } else if (Array.isArray(inputs)) {
          inputs.forEach(input => {
            if (input instanceof tf.Tensor) {
              memoryOptimizer.returnTensor(input);
            }
          });
        }
        
        return result;
      });
    }
    
    return originalApply(inputs);
  };
  
  return layer;
}