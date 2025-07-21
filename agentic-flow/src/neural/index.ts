/**
 * Neural Network System - Main Export
 * Production-ready TensorFlow.js neural networks for Agentic Flow
 */

export { default as NeuralNetworkArchitect } from './NeuralNetworkArchitect';
export { default as BenchmarkingSystem } from './BenchmarkingSystem';
export { default as NeuralNetworkDemo } from './NeuralNetworkDemo';

export * from './NeuralNetworkArchitect';
export * from './BenchmarkingSystem';
export * from './NeuralNetworkDemo';

// Re-export key types for convenience
export type {
  NetworkArchitecture,
  LayerConfig,
  OptimizerConfig,
  HyperparameterSpace,
  TrainingConfig,
  ModelPerformance
} from './NeuralNetworkArchitect';

export type {
  BenchmarkConfig,
  BenchmarkResult,
  BenchmarkDetails,
  SystemBenchmark,
  PerformanceThresholds
} from './BenchmarkingSystem';

export type {
  DemoConfig,
  DemoResults,
  ModelResults,
  OptimizationResults
} from './NeuralNetworkDemo';

/**
 * Quick access utilities
 */
export class NeuralSystem {
  private architect: NeuralNetworkArchitect;
  private benchmarking: BenchmarkingSystem;
  private demo: NeuralNetworkDemo;

  constructor() {
    this.architect = new NeuralNetworkArchitect();
    this.benchmarking = new BenchmarkingSystem();
    this.demo = new NeuralNetworkDemo();
  }

  /**
   * Get neural network architect
   */
  getArchitect(): NeuralNetworkArchitect {
    return this.architect;
  }

  /**
   * Get benchmarking system
   */
  getBenchmarking(): BenchmarkingSystem {
    return this.benchmarking;
  }

  /**
   * Get demo system
   */
  getDemo(): NeuralNetworkDemo {
    return this.demo;
  }

  /**
   * Quick setup for production use
   */
  async setupProduction(): Promise<void> {
    // Create all standard models
    const architectures = this.architect.getAvailableArchitectures();
    
    for (const arch of architectures) {
      await this.architect.createModel(arch.id);
    }
  }

  /**
   * Run quick validation
   */
  async validate(): Promise<{ success: boolean; details: string[] }> {
    try {
      const results = await this.demo.runQuickDemo();
      const details: string[] = [];
      
      details.push(`Models trained: ${results.models.size}`);
      details.push(`Optimizations completed: ${results.optimizations.size}`);
      details.push(`Benchmarks executed: ${results.benchmarks.length}`);
      
      if (results.systemPerformance) {
        details.push(`System score: ${results.systemPerformance.overallScore.toFixed(2)}/100`);
      }

      const success = results.models.size > 0 && 
                     results.optimizations.size > 0 && 
                     results.benchmarks.length > 0;

      return { success, details };
    } catch (error) {
      return { 
        success: false, 
        details: [`Validation failed: ${error.message}`] 
      };
    }
  }

  /**
   * Cleanup all resources
   */
  cleanup(): void {
    this.architect.cleanup();
    this.benchmarking.cleanup();
    this.demo.cleanup();
  }
}

// Default export for convenience
export default NeuralSystem;