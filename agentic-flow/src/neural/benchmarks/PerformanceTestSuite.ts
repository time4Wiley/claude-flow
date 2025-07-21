import * as tf from '@tensorflow/tfjs-node';
import { logger } from '../../utils/logger';
import { OptimizedNeuralNetwork } from '../optimization/OptimizedNeuralNetwork';
import { WeightInitializer } from '../optimization/WeightInitializer';
import { MemoryOptimizer } from '../optimization/MemoryOptimizer';
import { AgentCoordinationOptimizer } from '../optimization/AgentCoordinationOptimizer';
import { ProductionMLEngine } from '../../mcp/src/core/production-ml-engine';
import { ModelType } from '../../mcp/src/types';

/**
 * Comprehensive performance testing suite for neural network optimizations
 */
export class PerformanceTestSuite {
  private results: TestResults;
  private baseline: BaselineMetrics | null = null;

  constructor() {
    this.results = {
      neuralNetworkTests: [],
      memoryTests: [],
      coordinationTests: [],
      overallImprovement: 0,
      timestamp: new Date()
    };
  }

  /**
   * Run all performance tests
   */
  public async runAllTests(): Promise<TestResults> {
    logger.info('Starting comprehensive performance test suite...');

    try {
      // Establish baseline
      await this.establishBaseline();

      // Run optimized tests
      await this.testNeuralNetworkPerformance();
      await this.testMemoryOptimization();
      await this.testAgentCoordination();
      await this.testEndToEndPerformance();

      // Calculate overall improvement
      this.calculateOverallImprovement();

      logger.info('Performance test suite completed');
      return this.results;

    } catch (error) {
      logger.error('Error running performance tests:', error);
      throw error;
    }
  }

  /**
   * Establish baseline performance metrics
   */
  private async establishBaseline(): Promise<void> {
    logger.info('Establishing baseline performance metrics...');

    const startTime = Date.now();

    // Create unoptimized model
    const model = tf.sequential({
      layers: [
        tf.layers.dense({ units: 128, activation: 'relu', inputShape: [784] }),
        tf.layers.dense({ units: 64, activation: 'relu' }),
        tf.layers.dense({ units: 10, activation: 'softmax' })
      ]
    });

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });

    // Generate test data
    const { xTrain, yTrain, xTest, yTest } = this.generateTestData();

    // Train baseline
    const history = await model.fit(xTrain, yTrain, {
      epochs: 10,
      batchSize: 32,
      validationData: [xTest, yTest],
      verbose: 0
    });

    const trainingTime = Date.now() - startTime;

    // Test inference
    const inferenceStart = performance.now();
    const predictions = model.predict(xTest) as tf.Tensor;
    const inferenceTime = performance.now() - inferenceStart;
    predictions.dispose();

    // Memory usage
    const memInfo = tf.memory();

    this.baseline = {
      accuracy: history.history.acc[history.history.acc.length - 1],
      loss: history.history.loss[history.history.loss.length - 1],
      trainingTime,
      inferenceTime,
      memoryUsage: memInfo.numBytes,
      modelSize: model.getWeights().reduce((sum, w) => sum + w.size * 4, 0)
    };

    // Cleanup
    model.dispose();
    xTrain.dispose();
    yTrain.dispose();
    xTest.dispose();
    yTest.dispose();

    logger.info('Baseline established:', this.baseline);
  }

  /**
   * Test neural network performance improvements
   */
  private async testNeuralNetworkPerformance(): Promise<void> {
    logger.info('Testing neural network performance improvements...');

    const testResult: NeuralNetworkTestResult = {
      testName: 'Optimized Neural Network',
      metrics: {
        accuracy: 0,
        trainingTime: 0,
        inferenceSpeed: 0,
        memoryUsage: 0,
        improvement: {}
      }
    };

    try {
      // Create optimized model
      const optimizedNN = new OptimizedNeuralNetwork({
        inputShape: [784],
        layers: [
          { type: 'dense', units: 128, activation: 'relu', useBatchNorm: true, dropout: 0.2 },
          { type: 'dense', units: 64, activation: 'relu', useBatchNorm: true, dropout: 0.2 },
          { type: 'dense', units: 10, activation: 'softmax' }
        ],
        learningRate: 0.001,
        batchSize: 32
      });

      await optimizedNN.buildModel();

      // Generate test data
      const { xTrain, yTrain, xTest, yTest } = this.generateTestData();

      // Train optimized model
      const startTime = Date.now();
      const result = await optimizedNN.trainOptimized(xTrain, yTrain, xTest, yTest, 10);
      
      testResult.metrics.accuracy = result.finalAccuracy;
      testResult.metrics.trainingTime = result.trainingTime;

      // Test inference speed
      const inferenceStart = performance.now();
      for (let i = 0; i < 100; i++) {
        const prediction = await optimizedNN.predictOptimized(xTest.slice([i, 0], [1, -1]));
        prediction.dispose();
      }
      testResult.metrics.inferenceSpeed = (performance.now() - inferenceStart) / 100;

      // Memory usage
      const perfMetrics = optimizedNN.getPerformanceMetrics();
      testResult.metrics.memoryUsage = perfMetrics.memoryUsage;

      // Calculate improvements
      if (this.baseline) {
        testResult.metrics.improvement = {
          accuracy: ((testResult.metrics.accuracy - this.baseline.accuracy) / this.baseline.accuracy) * 100,
          trainingTime: ((this.baseline.trainingTime - testResult.metrics.trainingTime) / this.baseline.trainingTime) * 100,
          inferenceSpeed: ((this.baseline.inferenceTime - testResult.metrics.inferenceSpeed) / this.baseline.inferenceTime) * 100,
          memory: ((this.baseline.memoryUsage - testResult.metrics.memoryUsage) / this.baseline.memoryUsage) * 100
        };
      }

      // Cleanup
      optimizedNN.dispose();
      xTrain.dispose();
      yTrain.dispose();
      xTest.dispose();
      yTest.dispose();

      this.results.neuralNetworkTests.push(testResult);
      logger.info('Neural network test completed:', testResult);

    } catch (error) {
      logger.error('Neural network test failed:', error);
      testResult.metrics.improvement = { error: error.message };
      this.results.neuralNetworkTests.push(testResult);
    }
  }

  /**
   * Test memory optimization
   */
  private async testMemoryOptimization(): Promise<void> {
    logger.info('Testing memory optimization...');

    const testResult: MemoryTestResult = {
      testName: 'Memory Optimization',
      metrics: {
        peakMemoryUsage: 0,
        averageMemoryUsage: 0,
        cacheHitRate: 0,
        tensorPoolEfficiency: 0,
        improvement: {}
      }
    };

    try {
      const memOptimizer = new MemoryOptimizer({
        enableTensorPooling: true,
        poolSizeLimit: 500,
        enableGradientCheckpointing: true,
        memoryThreshold: 0.8
      });

      // Track memory usage
      const memorySnapshots: number[] = [];
      const startMem = tf.memory().numBytes;

      // Perform memory-intensive operations
      for (let i = 0; i < 50; i++) {
        // Get tensor from pool
        const tensor1 = memOptimizer.getTensor([1000, 1000]);
        const tensor2 = memOptimizer.getTensor([1000, 1000]);

        // Perform operation
        const result = await memOptimizer.matMulEfficient(
          tensor1 as tf.Tensor2D,
          tensor2 as tf.Tensor2D
        );

        // Return to pool
        memOptimizer.returnTensor(tensor1);
        memOptimizer.returnTensor(tensor2);
        result.dispose();

        // Record memory
        memorySnapshots.push(tf.memory().numBytes);

        // Simulate attention computation
        if (i % 10 === 0) {
          const queries = tf.randomNormal([8, 100, 64]);
          const keys = tf.randomNormal([8, 100, 64]);
          const values = tf.randomNormal([8, 100, 64]);

          const attention = await memOptimizer.computeAttentionEfficient(
            queries, keys, values
          );

          queries.dispose();
          keys.dispose();
          values.dispose();
          attention.dispose();
        }
      }

      // Get final stats
      const stats = memOptimizer.getStats();
      
      testResult.metrics.peakMemoryUsage = stats.peakMemoryUsage;
      testResult.metrics.averageMemoryUsage = 
        memorySnapshots.reduce((a, b) => a + b, 0) / memorySnapshots.length;
      testResult.metrics.cacheHitRate = 
        stats.cacheHits / (stats.cacheHits + stats.cacheMisses);
      testResult.metrics.tensorPoolEfficiency = 
        stats.pooledTensors / stats.totalAllocated;

      // Calculate improvement
      const endMem = tf.memory().numBytes;
      const memoryGrowth = endMem - startMem;
      const expectedGrowth = 50 * 1000 * 1000 * 4 * 2; // 50 iterations * 2 matrices * size * float32

      testResult.metrics.improvement = {
        memoryReduction: ((expectedGrowth - memoryGrowth) / expectedGrowth) * 100,
        cacheEfficiency: testResult.metrics.cacheHitRate * 100
      };

      memOptimizer.dispose();
      this.results.memoryTests.push(testResult);
      logger.info('Memory optimization test completed:', testResult);

    } catch (error) {
      logger.error('Memory optimization test failed:', error);
      testResult.metrics.improvement = { error: error.message };
      this.results.memoryTests.push(testResult);
    }
  }

  /**
   * Test agent coordination optimization
   */
  private async testAgentCoordination(): Promise<void> {
    logger.info('Testing agent coordination optimization...');

    const testResult: CoordinationTestResult = {
      testName: 'Agent Coordination',
      metrics: {
        messageLatency: 0,
        throughput: 0,
        coordinationOverhead: 0,
        compressionRatio: 0,
        improvement: {}
      }
    };

    try {
      const coordOptimizer = new AgentCoordinationOptimizer({
        enableMessagePooling: true,
        batchMessages: true,
        compressionEnabled: true,
        asyncCoordination: true
      });

      const agents = ['agent1', 'agent2', 'agent3', 'agent4', 'agent5'];
      const startTime = performance.now();
      let messageCount = 0;

      // Test message passing
      for (let i = 0; i < 1000; i++) {
        const fromAgent = agents[Math.floor(Math.random() * agents.length)];
        const toAgent = agents[Math.floor(Math.random() * agents.length)];
        
        if (fromAgent !== toAgent) {
          await coordOptimizer.sendMessage(fromAgent, toAgent, {
            type: 'test',
            data: { value: Math.random(), timestamp: Date.now() }
          });
          messageCount++;
        }
      }

      const duration = performance.now() - startTime;

      // Test batch messaging
      const batchStart = performance.now();
      const batchMessages = [];
      
      for (let i = 0; i < 100; i++) {
        for (let j = 0; j < agents.length; j++) {
          for (let k = 0; k < agents.length; k++) {
            if (j !== k) {
              batchMessages.push({
                fromAgent: agents[j],
                toAgent: agents[k],
                message: {
                  type: 'batch_test',
                  data: { batch: i, value: Math.random() }
                }
              });
            }
          }
        }
      }

      await coordOptimizer.sendBatch(batchMessages);
      const batchDuration = performance.now() - batchStart;

      // Test synchronization
      const syncStart = performance.now();
      await coordOptimizer.synchronizeAgents(agents, {
        version: 1,
        state: { synchronized: true },
        timestamp: Date.now()
      });
      const syncDuration = performance.now() - syncStart;

      // Get metrics
      const metrics = coordOptimizer.getMetrics();
      
      testResult.metrics.messageLatency = metrics.averageLatency;
      testResult.metrics.throughput = messageCount / (duration / 1000);
      testResult.metrics.coordinationOverhead = metrics.coordinationOverhead;
      testResult.metrics.compressionRatio = metrics.compressionRatio;

      // Calculate improvements (assuming baseline 10ms per message)
      const baselineLatency = 10;
      const baselineThroughput = 100; // messages per second

      testResult.metrics.improvement = {
        latencyReduction: ((baselineLatency - metrics.averageLatency) / baselineLatency) * 100,
        throughputIncrease: ((testResult.metrics.throughput - baselineThroughput) / baselineThroughput) * 100,
        batchEfficiency: ((batchMessages.length * baselineLatency - batchDuration) / (batchMessages.length * baselineLatency)) * 100
      };

      coordOptimizer.dispose();
      this.results.coordinationTests.push(testResult);
      logger.info('Agent coordination test completed:', testResult);

    } catch (error) {
      logger.error('Agent coordination test failed:', error);
      testResult.metrics.improvement = { error: error.message };
      this.results.coordinationTests.push(testResult);
    }
  }

  /**
   * Test end-to-end performance improvements
   */
  private async testEndToEndPerformance(): Promise<void> {
    logger.info('Testing end-to-end performance...');

    try {
      // Create ML engine with optimizations
      const mlEngine = new ProductionMLEngine();

      // Test data
      const data = {
        features: Array(1000).fill(0).map(() => 
          Array(20).fill(0).map(() => Math.random())
        ),
        labels: Array(1000).fill(0).map(() => 
          Math.floor(Math.random() * 3)
        )
      };

      // Train with optimizations
      const startTime = Date.now();
      
      const model = await mlEngine.trainModel(
        ModelType.CLASSIFICATION,
        data,
        {
          epochs: 20,
          batchSize: 32,
          learningRate: 0.001,
          earlyStopping: {
            monitor: 'val_loss',
            patience: 5,
            minDelta: 0.001,
            mode: 'min'
          }
        }
      );

      const trainingTime = Date.now() - startTime;

      // Test predictions
      const testData = Array(100).fill(0).map(() => 
        Array(20).fill(0).map(() => Math.random())
      );

      const predStart = performance.now();
      const predictions = await mlEngine.predict(model.id, testData);
      const predTime = performance.now() - predStart;

      logger.info('End-to-end test completed', {
        modelAccuracy: model.performance.accuracy,
        trainingTime,
        predictionTime: predTime,
        predictionsPerSecond: 100 / (predTime / 1000)
      });

      await mlEngine.shutdown();

    } catch (error) {
      logger.error('End-to-end test failed:', error);
    }
  }

  /**
   * Generate test data
   */
  private generateTestData(): {
    xTrain: tf.Tensor;
    yTrain: tf.Tensor;
    xTest: tf.Tensor;
    yTest: tf.Tensor;
  } {
    // MNIST-like data
    const trainSize = 1000;
    const testSize = 200;
    const inputSize = 784;
    const numClasses = 10;

    const xTrain = tf.randomNormal([trainSize, inputSize]);
    const yTrain = tf.oneHot(
      tf.randomUniform([trainSize], 0, numClasses, 'int32'),
      numClasses
    );

    const xTest = tf.randomNormal([testSize, inputSize]);
    const yTest = tf.oneHot(
      tf.randomUniform([testSize], 0, numClasses, 'int32'),
      numClasses
    );

    return { xTrain, yTrain, xTest, yTest };
  }

  /**
   * Calculate overall improvement
   */
  private calculateOverallImprovement(): void {
    let totalImprovement = 0;
    let count = 0;

    // Neural network improvements
    this.results.neuralNetworkTests.forEach(test => {
      if (test.metrics.improvement.accuracy) {
        totalImprovement += test.metrics.improvement.accuracy;
        count++;
      }
      if (test.metrics.improvement.trainingTime) {
        totalImprovement += test.metrics.improvement.trainingTime;
        count++;
      }
    });

    // Memory improvements
    this.results.memoryTests.forEach(test => {
      if (test.metrics.improvement.memoryReduction) {
        totalImprovement += test.metrics.improvement.memoryReduction;
        count++;
      }
    });

    // Coordination improvements
    this.results.coordinationTests.forEach(test => {
      if (test.metrics.improvement.latencyReduction) {
        totalImprovement += test.metrics.improvement.latencyReduction;
        count++;
      }
      if (test.metrics.improvement.throughputIncrease) {
        totalImprovement += test.metrics.improvement.throughputIncrease;
        count++;
      }
    });

    this.results.overallImprovement = count > 0 ? totalImprovement / count : 0;
  }

  /**
   * Generate performance report
   */
  public generateReport(): string {
    const report = [`
Performance Test Suite Report
=============================
Generated: ${this.results.timestamp.toISOString()}

Overall Improvement: ${this.results.overallImprovement.toFixed(2)}%

Neural Network Performance:
`];

    this.results.neuralNetworkTests.forEach(test => {
      report.push(`
${test.testName}:
- Accuracy: ${(test.metrics.accuracy * 100).toFixed(2)}% (${test.metrics.improvement.accuracy?.toFixed(2)}% improvement)
- Training Time: ${test.metrics.trainingTime}ms (${test.metrics.improvement.trainingTime?.toFixed(2)}% faster)
- Inference Speed: ${test.metrics.inferenceSpeed.toFixed(2)}ms (${test.metrics.improvement.inferenceSpeed?.toFixed(2)}% faster)
- Memory Usage: ${(test.metrics.memoryUsage / 1024 / 1024).toFixed(2)}MB (${test.metrics.improvement.memory?.toFixed(2)}% reduction)
`);
    });

    report.push('\nMemory Optimization:');
    this.results.memoryTests.forEach(test => {
      report.push(`
${test.testName}:
- Peak Memory: ${(test.metrics.peakMemoryUsage / 1024 / 1024).toFixed(2)}MB
- Cache Hit Rate: ${(test.metrics.cacheHitRate * 100).toFixed(2)}%
- Tensor Pool Efficiency: ${(test.metrics.tensorPoolEfficiency * 100).toFixed(2)}%
- Memory Reduction: ${test.metrics.improvement.memoryReduction?.toFixed(2)}%
`);
    });

    report.push('\nAgent Coordination:');
    this.results.coordinationTests.forEach(test => {
      report.push(`
${test.testName}:
- Message Latency: ${test.metrics.messageLatency.toFixed(2)}ms (${test.metrics.improvement.latencyReduction?.toFixed(2)}% reduction)
- Throughput: ${test.metrics.throughput.toFixed(2)} msg/s (${test.metrics.improvement.throughputIncrease?.toFixed(2)}% increase)
- Coordination Overhead: ${(test.metrics.coordinationOverhead * 100).toFixed(2)}%
- Compression Ratio: ${test.metrics.compressionRatio.toFixed(2)}x
`);
    });

    return report.join('\n');
  }
}

// Type definitions
export interface TestResults {
  neuralNetworkTests: NeuralNetworkTestResult[];
  memoryTests: MemoryTestResult[];
  coordinationTests: CoordinationTestResult[];
  overallImprovement: number;
  timestamp: Date;
}

export interface BaselineMetrics {
  accuracy: number;
  loss: number;
  trainingTime: number;
  inferenceTime: number;
  memoryUsage: number;
  modelSize: number;
}

export interface NeuralNetworkTestResult {
  testName: string;
  metrics: {
    accuracy: number;
    trainingTime: number;
    inferenceSpeed: number;
    memoryUsage: number;
    improvement: any;
  };
}

export interface MemoryTestResult {
  testName: string;
  metrics: {
    peakMemoryUsage: number;
    averageMemoryUsage: number;
    cacheHitRate: number;
    tensorPoolEfficiency: number;
    improvement: any;
  };
}

export interface CoordinationTestResult {
  testName: string;
  metrics: {
    messageLatency: number;
    throughput: number;
    coordinationOverhead: number;
    compressionRatio: number;
    improvement: any;
  };
}

/**
 * Run performance test suite
 */
export async function runPerformanceTests(): Promise<void> {
  const suite = new PerformanceTestSuite();
  const results = await suite.runAllTests();
  const report = suite.generateReport();
  
  logger.info('\n' + report);
  
  // Save report
  const fs = require('fs').promises;
  await fs.writeFile(
    `performance-report-${Date.now()}.txt`,
    report
  );
}