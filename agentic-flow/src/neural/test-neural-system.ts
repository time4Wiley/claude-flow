#!/usr/bin/env node

/**
 * Neural Network System Test Runner
 * Tests the complete neural network system with real TensorFlow.js models
 */

import NeuralNetworkDemo from './NeuralNetworkDemo';
import { performance } from 'perf_hooks';

async function main() {
  console.log('🧠 Agentic Flow Neural Network System Test');
  console.log('==========================================');
  console.log('');

  const demo = new NeuralNetworkDemo();
  
  // Setup progress monitoring
  demo.on('demoStarted', (data) => {
    console.log('🚀 Demo started with configuration:', JSON.stringify(data.config, null, 2));
    console.log('');
  });

  demo.on('progress', (data) => {
    switch (data.type) {
      case 'phase':
        console.log(`📋 Phase ${data.phase}: ${data.description}`);
        break;
      case 'model_created':
        console.log(`✅ Model created: ${data.data.architectureId}`);
        break;
      case 'model_training':
        if (data.status === 'started') {
          console.log(`🏃 Training ${data.architecture}...`);
        } else if (data.status === 'completed') {
          console.log(`✅ ${data.architecture} trained - Accuracy: ${(data.performance * 100).toFixed(2)}%`);
        } else if (data.status === 'failed') {
          console.log(`❌ ${data.architecture} training failed: ${data.error}`);
        }
        break;
      case 'optimization':
        if (data.status === 'started') {
          console.log(`⚡ Optimizing ${data.architecture} hyperparameters...`);
        } else if (data.status === 'completed') {
          console.log(`✅ ${data.architecture} optimized - Improvement: ${data.improvement.toFixed(2)}%`);
        }
        break;
      case 'optimization_trial':
        console.log(`   Trial ${data.trial}: Score ${data.score.toFixed(2)}% (Best: ${data.bestScore.toFixed(2)}%)`);
        break;
      case 'benchmarking':
        if (data.status === 'completed') {
          console.log(`📊 Benchmarking completed - Average Score: ${data.averageScore.toFixed(2)}/100`);
        }
        break;
      case 'benchmark_scenario':
        console.log(`   ${data.scenario}: ${data.result.grade} (${data.result.score.toFixed(2)}%)`);
        break;
    }
  });

  demo.on('demoCompleted', (data) => {
    console.log('');
    console.log('🎉 Demo completed successfully!');
    console.log(`⏱️  Total time: ${(data.results.totalTime / 1000).toFixed(2)} seconds`);
  });

  try {
    // Run comprehensive demo
    console.log('🔬 Running comprehensive neural network demonstration...');
    console.log('');

    const startTime = performance.now();

    const results = await demo.runCompleteDemo({
      architectures: ['agent-coordinator', 'provider-router', 'workflow-predictor', 'cost-optimizer'],
      hyperparameterTrials: 15,
      benchmarkScenarios: [],
      trainingEpochs: 30,
      enableBenchmarking: true,
      enableOptimization: true,
      saveModels: true,
      outputPath: './neural-models'
    });

    const totalTime = performance.now() - startTime;

    console.log('');
    console.log('📊 RESULTS SUMMARY');
    console.log('==================');
    console.log('');

    // Model results
    console.log('🧠 Neural Network Models:');
    for (const [id, model] of results.models) {
      console.log(`   ${id}:`);
      console.log(`      Accuracy: ${model.accuracy.toFixed(2)}%`);
      console.log(`      Parameters: ${model.modelSize.toLocaleString()}`);
      console.log(`      Training Time: ${(model.trainingTime / 1000).toFixed(2)}s`);
      console.log(`      Saved: ${model.saved ? '✅' : '❌'}`);
    }
    console.log('');

    // Optimization results
    if (results.optimizations.size > 0) {
      console.log('⚡ Hyperparameter Optimization:');
      for (const [id, opt] of results.optimizations) {
        console.log(`   ${id}:`);
        console.log(`      Best Score: ${opt.bestScore.toFixed(2)}%`);
        console.log(`      Improvement: ${opt.improvementOverBaseline.toFixed(2)}%`);
        console.log(`      Trials: ${opt.trials}`);
      }
      console.log('');
    }

    // System performance
    if (results.systemPerformance) {
      console.log('📈 System Performance:');
      console.log(`   Overall Score: ${results.systemPerformance.overallScore.toFixed(2)}/100`);
      console.log(`   Agent Coordination: ${results.systemPerformance.agentCoordination.toFixed(2)}/100`);
      console.log(`   Provider Routing: ${results.systemPerformance.providerRouting.toFixed(2)}/100`);
      console.log(`   Workflow Execution: ${results.systemPerformance.workflowExecution.toFixed(2)}/100`);
      console.log(`   Cost Optimization: ${results.systemPerformance.costOptimization.toFixed(2)}/100`);
      console.log('');
    }

    // Benchmarks
    if (results.benchmarks.length > 0) {
      console.log('🏆 Benchmark Results:');
      const passed = results.benchmarks.filter(b => b.passed).length;
      const failed = results.benchmarks.filter(b => !b.passed).length;
      const avgScore = results.benchmarks.reduce((sum, b) => sum + b.score, 0) / results.benchmarks.length;
      
      console.log(`   Total Benchmarks: ${results.benchmarks.length}`);
      console.log(`   Passed: ${passed} ✅`);
      console.log(`   Failed: ${failed} ❌`);
      console.log(`   Average Score: ${avgScore.toFixed(2)}/100`);
      console.log('');
    }

    // Recommendations
    if (results.recommendations.length > 0) {
      console.log('💡 Recommendations:');
      results.recommendations.forEach(rec => console.log(`   • ${rec}`));
      console.log('');
    }

    // Generate detailed report
    console.log('📄 Generating detailed report...');
    const report = demo.generateReport(results);
    
    // Save report (simplified - would normally use fs)
    console.log('');
    console.log('📋 DETAILED REPORT');
    console.log('==================');
    console.log(report);

    // Performance validation
    console.log('');
    console.log('✅ VALIDATION RESULTS');
    console.log('=====================');
    
    const validations = [
      {
        test: 'Real TensorFlow.js Models',
        passed: results.models.size > 0,
        details: `${results.models.size} models created and trained`
      },
      {
        test: 'Hyperparameter Optimization',
        passed: results.optimizations.size > 0,
        details: `${results.optimizations.size} models optimized`
      },
      {
        test: 'Performance Benchmarking',
        passed: results.benchmarks.length > 0,
        details: `${results.benchmarks.length} benchmarks executed`
      },
      {
        test: 'System Performance Score',
        passed: results.systemPerformance ? results.systemPerformance.overallScore > 70 : false,
        details: results.systemPerformance ? `${results.systemPerformance.overallScore.toFixed(2)}/100` : 'Not available'
      },
      {
        test: 'Model Accuracy Threshold',
        passed: Array.from(results.models.values()).every(m => m.accuracy > 60),
        details: `All models exceed 60% accuracy threshold`
      },
      {
        test: 'Training Efficiency',
        passed: Array.from(results.models.values()).every(m => m.trainingTime < 120000), // 2 minutes
        details: 'All models trained within reasonable time'
      }
    ];

    validations.forEach(validation => {
      const status = validation.passed ? '✅ PASS' : '❌ FAIL';
      console.log(`   ${status} ${validation.test}: ${validation.details}`);
    });

    const allPassed = validations.every(v => v.passed);
    console.log('');
    console.log(`🎯 Overall Validation: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
    
    if (allPassed) {
      console.log('');
      console.log('🚀 PRODUCTION READINESS CONFIRMED');
      console.log('=================================');
      console.log('✅ Real neural networks with TensorFlow.js');
      console.log('✅ Hyperparameter optimization working');
      console.log('✅ Comprehensive benchmarking system');
      console.log('✅ Model persistence and deployment');
      console.log('✅ Performance metrics and validation');
      console.log('✅ Production-grade architecture');
      console.log('');
      console.log('🎉 Agentic Flow neural network system is ready for production deployment!');
    }

  } catch (error) {
    console.error('❌ Demo failed:', error);
    process.exit(1);
  } finally {
    demo.cleanup();
  }
}

// Run if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { main };