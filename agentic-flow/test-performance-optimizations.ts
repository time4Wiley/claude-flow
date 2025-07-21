#!/usr/bin/env node

/**
 * Simple test script to demonstrate performance optimizations
 */

import * as tf from '@tensorflow/tfjs-node';
import { OptimizedNeuralNetwork } from './src/neural/optimization/OptimizedNeuralNetwork';
import { MemoryOptimizer } from './src/neural/optimization/MemoryOptimizer';
import { AgentCoordinationOptimizer } from './src/neural/optimization/AgentCoordinationOptimizer';
import { WeightInitializer } from './src/neural/optimization/WeightInitializer';

async function testOptimizations() {
  console.log('\n🚀 Testing Agentic Flow Performance Optimizations\n');

  // Test 1: Weight Initialization
  console.log('1️⃣ Testing Smart Weight Initialization...');
  const xavierInit = WeightInitializer.xavierInitializer(784, 256);
  const heInit = WeightInitializer.heInitializer(256, 128);
  console.log('✅ Weight initializers created successfully');

  // Test 2: Optimized Neural Network
  console.log('\n2️⃣ Testing Optimized Neural Network...');
  const network = new OptimizedNeuralNetwork({
    inputShape: [10],
    layers: [
      { type: 'dense', units: 64, activation: 'relu', useBatchNorm: true },
      { type: 'dense', units: 32, activation: 'relu', useBatchNorm: true },
      { type: 'dense', units: 3, activation: 'softmax' }
    ]
  });

  await network.buildModel();
  console.log('✅ Optimized neural network built with batch normalization');

  // Generate simple test data
  const xTrain = tf.randomNormal([100, 10]);
  const yTrain = tf.oneHot(tf.randomUniform([100], 0, 3, 'int32'), 3);

  // Train with optimizations
  console.log('\n3️⃣ Testing Optimized Training...');
  const startTime = Date.now();
  const result = await network.trainOptimized(xTrain, yTrain, undefined, undefined, 5);
  const trainingTime = Date.now() - startTime;

  console.log(`✅ Training completed in ${trainingTime}ms`);
  console.log(`   Final accuracy: ${(result.finalAccuracy * 100).toFixed(2)}%`);
  console.log(`   Final loss: ${result.finalLoss.toFixed(4)}`);

  // Test 3: Memory Optimization
  console.log('\n4️⃣ Testing Memory Optimization...');
  const memOptimizer = new MemoryOptimizer({
    enableTensorPooling: true,
    poolSizeLimit: 100
  });

  const memBefore = tf.memory().numBytes;
  
  // Test tensor pooling
  const tensors = [];
  for (let i = 0; i < 20; i++) {
    const t = memOptimizer.getTensor([100, 100]);
    tensors.push(t);
  }

  // Return to pool
  tensors.forEach(t => memOptimizer.returnTensor(t));
  
  const stats = memOptimizer.getStats();
  console.log(`✅ Memory optimization stats:`);
  console.log(`   Cache hit rate: ${((stats.cacheHits / (stats.cacheHits + stats.cacheMisses)) * 100).toFixed(2)}%`);
  console.log(`   Pooled tensors: ${stats.pooledTensors}`);

  // Test 4: Agent Coordination
  console.log('\n5️⃣ Testing Agent Coordination Optimization...');
  const coordOptimizer = new AgentCoordinationOptimizer({
    enableMessagePooling: true,
    batchMessages: true
  });

  const msgStart = performance.now();
  
  // Send test messages
  for (let i = 0; i < 100; i++) {
    await coordOptimizer.sendMessage('agent1', 'agent2', {
      type: 'test',
      data: { value: i },
      timestamp: Date.now()
    });
  }

  const msgTime = performance.now() - msgStart;
  const metrics = coordOptimizer.getMetrics();
  
  console.log(`✅ Coordination optimization stats:`);
  console.log(`   Messages sent: ${metrics.messagesSent}`);
  console.log(`   Average latency: ${metrics.averageLatency.toFixed(2)}ms`);
  console.log(`   Total time: ${msgTime.toFixed(2)}ms`);

  // Cleanup
  network.dispose();
  memOptimizer.dispose();
  coordOptimizer.dispose();
  xTrain.dispose();
  yTrain.dispose();

  console.log('\n✨ All performance optimization tests completed successfully!\n');
}

// Run tests
testOptimizations().catch(console.error);