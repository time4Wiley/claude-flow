import { performance } from 'perf_hooks';
import { EventEmitter } from 'events';

export interface MemoryMetrics {
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
  arrayBuffers: number;
  peakMemoryUsage: number;
  memoryLeakRate: number;
  gcFrequency: number;
  gcDuration: number;
  memoryEfficiency: number;
  fragmentationRatio: number;
  allocationRate: number;
  deallocationRate: number;
}

export interface MemoryBenchmarkConfig {
  duration: number; // Test duration in milliseconds
  allocationSize: number; // Size of each allocation in bytes
  allocationCount: number; // Number of allocations to perform
  enableGCProfiling: boolean;
  simulateMemoryLeaks: boolean;
  testFragmentation: boolean;
  monitoringInterval: number; // Memory sampling interval in ms
  stressTestLevels: ('light' | 'medium' | 'heavy')[];
}

export interface MemoryBenchmarkResult {
  config: MemoryBenchmarkConfig;
  metrics: MemoryMetrics;
  memoryTimeline: MemorySnapshot[];
  gcEvents: GCEvent[];
  allocationPatterns: AllocationPattern[];
  leakDetection: LeakDetectionResult;
  analysis: MemoryAnalysis;
  timestamp: Date;
}

export interface MemorySnapshot {
  timestamp: number;
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
  arrayBuffers: number;
}

export interface GCEvent {
  timestamp: number;
  type: string;
  duration: number;
  beforeGC: MemorySnapshot;
  afterGC: MemorySnapshot;
  freedMemory: number;
}

export interface AllocationPattern {
  size: number;
  frequency: number;
  retentionTime: number;
  fragmentationImpact: number;
}

export interface LeakDetectionResult {
  potentialLeaks: LeakSource[];
  leakRate: number; // bytes per second
  confidence: number;
  recommendations: string[];
}

export interface LeakSource {
  type: string;
  size: number;
  lifetime: number;
  severity: 'low' | 'medium' | 'high';
}

export interface MemoryAnalysis {
  memoryUsagePattern: 'stable' | 'growing' | 'fluctuating' | 'declining';
  gcEfficiency: number;
  allocationEfficiency: number;
  recommendations: string[];
  bottlenecks: string[];
  summary: string;
}

export class MemoryBenchmark extends EventEmitter {
  private results: MemoryBenchmarkResult[] = [];
  private memoryTimeline: MemorySnapshot[] = [];
  private gcEvents: GCEvent[] = [];
  private allocations: Map<string, any> = new Map();
  private monitoringInterval?: NodeJS.Timeout;
  private baseline?: MemorySnapshot;

  constructor(private config: MemoryBenchmarkConfig) {
    super();
  }

  async runBenchmark(): Promise<MemoryBenchmarkResult> {
    this.emit('benchmarkStart', this.config);
    
    try {
      // Initialize benchmark
      await this.initializeBenchmark();
      
      // Run memory stress tests
      const stressResults = await this.runStressTests();
      
      // Run allocation patterns test
      const allocationResults = await this.runAllocationTests();
      
      // Run fragmentation test
      const fragmentationResults = await this.runFragmentationTest();
      
      // Run leak detection
      const leakResults = await this.runLeakDetection();
      
      // Calculate final metrics
      const metrics = this.calculateMetrics();
      
      // Analyze results
      const analysis = this.analyzeMemoryBehavior();
      
      // Compile results
      const result: MemoryBenchmarkResult = {
        config: this.config,
        metrics,
        memoryTimeline: [...this.memoryTimeline],
        gcEvents: [...this.gcEvents],
        allocationPatterns: allocationResults,
        leakDetection: leakResults,
        analysis,
        timestamp: new Date()
      };
      
      this.results.push(result);
      this.emit('benchmarkComplete', result);
      
      return result;
    } catch (error) {
      this.emit('benchmarkError', error);
      throw error;
    } finally {
      this.cleanup();
    }
  }

  private async initializeBenchmark(): Promise<void> {
    this.emit('initializationStart');
    
    // Clear previous state
    this.memoryTimeline = [];
    this.gcEvents = [];
    this.allocations.clear();
    
    // Force garbage collection to establish baseline
    if (global.gc) {
      global.gc();
      await this.sleep(100);
    }
    
    // Capture baseline memory usage
    this.baseline = this.captureMemorySnapshot();
    
    // Start memory monitoring
    this.startMemoryMonitoring();
    
    // Setup GC profiling if enabled
    if (this.config.enableGCProfiling) {
      this.setupGCProfiling();
    }
    
    this.emit('initializationComplete');
  }

  private captureMemorySnapshot(): MemorySnapshot {
    const memUsage = process.memoryUsage();
    return {
      timestamp: Date.now(),
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      rss: memUsage.rss,
      arrayBuffers: memUsage.arrayBuffers || 0
    };
  }

  private startMemoryMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      const snapshot = this.captureMemorySnapshot();
      this.memoryTimeline.push(snapshot);
      
      this.emit('memorySnapshot', snapshot);
    }, this.config.monitoringInterval);
  }

  private setupGCProfiling(): void {
    // Simulate GC event monitoring
    const gcInterval = setInterval(() => {
      if (Math.random() < 0.1) { // 10% chance of GC event per interval
        this.simulateGCEvent();
      }
    }, 1000);
    
    // Clean up after benchmark
    setTimeout(() => {
      clearInterval(gcInterval);
    }, this.config.duration);
  }

  private simulateGCEvent(): void {
    const beforeGC = this.captureMemorySnapshot();
    
    // Simulate GC processing time
    const gcDuration = Math.random() * 50 + 10; // 10-60ms
    
    setTimeout(() => {
      const afterGC = this.captureMemorySnapshot();
      const freedMemory = beforeGC.heapUsed - afterGC.heapUsed;
      
      const gcEvent: GCEvent = {
        timestamp: Date.now(),
        type: Math.random() < 0.7 ? 'minor' : 'major',
        duration: gcDuration,
        beforeGC,
        afterGC,
        freedMemory: Math.max(0, freedMemory)
      };
      
      this.gcEvents.push(gcEvent);
      this.emit('gcEvent', gcEvent);
    }, gcDuration);
  }

  private async runStressTests(): Promise<void> {
    this.emit('stressTestStart');
    
    for (const level of this.config.stressTestLevels) {
      await this.runStressTest(level);
    }
    
    this.emit('stressTestComplete');
  }

  private async runStressTest(level: 'light' | 'medium' | 'heavy'): Promise<void> {
    this.emit('stressTestLevelStart', { level });
    
    const testConfig = this.getStressTestConfig(level);
    const allocations: any[] = [];
    
    for (let i = 0; i < testConfig.iterations; i++) {
      // Allocate memory
      const allocation = this.performAllocation(testConfig.allocationSize);
      allocations.push(allocation);
      
      // Periodic cleanup
      if (i % testConfig.cleanupInterval === 0) {
        this.performCleanup(allocations, testConfig.retentionRate);
      }
      
      // Add delay for controlled stress
      if (testConfig.delay > 0) {
        await this.sleep(testConfig.delay);
      }
      
      if (i % 100 === 0) {
        this.emit('stressTestProgress', {
          level,
          iteration: i,
          totalIterations: testConfig.iterations,
          allocatedMemory: allocations.length * testConfig.allocationSize
        });
      }
    }
    
    // Final cleanup
    this.performCleanup(allocations, 0);
    
    this.emit('stressTestLevelComplete', { level });
  }

  private getStressTestConfig(level: 'light' | 'medium' | 'heavy') {
    switch (level) {
      case 'light':
        return {
          iterations: 1000,
          allocationSize: 1024, // 1KB
          cleanupInterval: 100,
          retentionRate: 0.2,
          delay: 1
        };
      case 'medium':
        return {
          iterations: 5000,
          allocationSize: 10240, // 10KB
          cleanupInterval: 200,
          retentionRate: 0.3,
          delay: 0.5
        };
      case 'heavy':
        return {
          iterations: 10000,
          allocationSize: 102400, // 100KB
          cleanupInterval: 500,
          retentionRate: 0.5,
          delay: 0
        };
    }
  }

  private performAllocation(size: number): any {
    const id = `alloc_${Date.now()}_${Math.random()}`;
    const data = Buffer.alloc(size);
    
    // Fill with random data to prevent optimization
    for (let i = 0; i < Math.min(size, 1000); i++) {
      data[i] = Math.floor(Math.random() * 256);
    }
    
    const allocation = {
      id,
      data,
      size,
      timestamp: Date.now()
    };
    
    this.allocations.set(id, allocation);
    return allocation;
  }

  private performCleanup(allocations: any[], retentionRate: number): void {
    const retainCount = Math.floor(allocations.length * retentionRate);
    const toRemove = allocations.splice(0, allocations.length - retainCount);
    
    toRemove.forEach(allocation => {
      this.allocations.delete(allocation.id);
    });
  }

  private async runAllocationTests(): Promise<AllocationPattern[]> {
    this.emit('allocationTestStart');
    
    const patterns: AllocationPattern[] = [];
    const allocationSizes = [1024, 10240, 102400, 1048576]; // 1KB, 10KB, 100KB, 1MB
    
    for (const size of allocationSizes) {
      const pattern = await this.testAllocationPattern(size);
      patterns.push(pattern);
    }
    
    this.emit('allocationTestComplete');
    return patterns;
  }

  private async testAllocationPattern(size: number): Promise<AllocationPattern> {
    const startTime = Date.now();
    const allocations: any[] = [];
    const maxAllocations = Math.min(100, Math.floor(100 * 1024 * 1024 / size)); // 100MB limit
    
    // Allocation phase
    for (let i = 0; i < maxAllocations; i++) {
      const allocation = this.performAllocation(size);
      allocations.push(allocation);
      
      if (i % 10 === 0) {
        await this.sleep(1); // Small delay to measure allocation rate
      }
    }
    
    const allocationTime = Date.now() - startTime;
    
    // Measure retention time
    const retentionStart = Date.now();
    await this.sleep(1000); // Keep allocations for 1 second
    const retentionTime = Date.now() - retentionStart;
    
    // Cleanup and measure fragmentation impact
    const beforeCleanup = this.captureMemorySnapshot();
    this.performCleanup(allocations, 0);
    
    // Force GC to measure fragmentation
    if (global.gc) {
      global.gc();
      await this.sleep(100);
    }
    
    const afterCleanup = this.captureMemorySnapshot();
    const fragmentationImpact = afterCleanup.heapUsed - (beforeCleanup.heapUsed - (maxAllocations * size));
    
    return {
      size,
      frequency: maxAllocations / (allocationTime / 1000), // allocations per second
      retentionTime,
      fragmentationImpact: Math.max(0, fragmentationImpact)
    };
  }

  private async runFragmentationTest(): Promise<void> {
    if (!this.config.testFragmentation) {
      return;
    }
    
    this.emit('fragmentationTestStart');
    
    // Create fragmentation by allocating and deallocating in patterns
    const allocations: any[] = [];
    
    // Phase 1: Allocate many small objects
    for (let i = 0; i < 1000; i++) {
      allocations.push(this.performAllocation(1024));
    }
    
    // Phase 2: Deallocate every other object
    for (let i = 0; i < allocations.length; i += 2) {
      this.allocations.delete(allocations[i].id);
    }
    
    // Phase 3: Try to allocate larger objects
    const largeAllocations: any[] = [];
    for (let i = 0; i < 100; i++) {
      try {
        largeAllocations.push(this.performAllocation(10240));
      } catch (error) {
        // Fragmentation may prevent large allocations
        break;
      }
    }
    
    // Cleanup
    allocations.forEach(alloc => this.allocations.delete(alloc.id));
    largeAllocations.forEach(alloc => this.allocations.delete(alloc.id));
    
    this.emit('fragmentationTestComplete');
  }

  private async runLeakDetection(): Promise<LeakDetectionResult> {
    this.emit('leakDetectionStart');
    
    const potentialLeaks: LeakSource[] = [];
    
    if (this.config.simulateMemoryLeaks) {
      // Simulate memory leaks for testing
      for (let i = 0; i < 10; i++) {
        const leak = this.simulateMemoryLeak();
        potentialLeaks.push(leak);
      }
    }
    
    // Analyze memory timeline for leak patterns
    const leakRate = this.calculateLeakRate();
    const confidence = this.calculateLeakConfidence();
    const recommendations = this.generateLeakRecommendations(potentialLeaks);
    
    this.emit('leakDetectionComplete');
    
    return {
      potentialLeaks,
      leakRate,
      confidence,
      recommendations
    };
  }

  private simulateMemoryLeak(): LeakSource {
    const types = ['closure', 'event_listener', 'timer', 'cache', 'reference'];
    const type = types[Math.floor(Math.random() * types.length)];
    
    return {
      type,
      size: Math.floor(Math.random() * 1048576) + 1024, // 1KB - 1MB
      lifetime: Math.floor(Math.random() * 30000) + 5000, // 5-35 seconds
      severity: Math.random() < 0.3 ? 'high' : Math.random() < 0.6 ? 'medium' : 'low'
    };
  }

  private calculateLeakRate(): number {
    if (this.memoryTimeline.length < 2) {
      return 0;
    }
    
    const start = this.memoryTimeline[0];
    const end = this.memoryTimeline[this.memoryTimeline.length - 1];
    const timeDiff = end.timestamp - start.timestamp;
    const memoryDiff = end.heapUsed - start.heapUsed;
    
    return timeDiff > 0 ? (memoryDiff / timeDiff) * 1000 : 0; // bytes per second
  }

  private calculateLeakConfidence(): number {
    if (this.memoryTimeline.length < 10) {
      return 0;
    }
    
    // Calculate trend using linear regression
    const n = this.memoryTimeline.length;
    const sumX = this.memoryTimeline.reduce((sum, snapshot, index) => sum + index, 0);
    const sumY = this.memoryTimeline.reduce((sum, snapshot) => sum + snapshot.heapUsed, 0);
    const sumXY = this.memoryTimeline.reduce((sum, snapshot, index) => sum + (index * snapshot.heapUsed), 0);
    const sumX2 = this.memoryTimeline.reduce((sum, snapshot, index) => sum + (index * index), 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const correlation = Math.abs(slope) / (sumY / n);
    
    return Math.min(1, correlation);
  }

  private generateLeakRecommendations(leaks: LeakSource[]): string[] {
    const recommendations: string[] = [];
    
    if (leaks.length > 0) {
      recommendations.push('Review closures and event listeners for proper cleanup');
      recommendations.push('Implement proper disposal patterns for long-lived objects');
      recommendations.push('Use weak references where appropriate');
    }
    
    const highSeverityLeaks = leaks.filter(leak => leak.severity === 'high');
    if (highSeverityLeaks.length > 0) {
      recommendations.push('Prioritize fixing high-severity memory leaks');
    }
    
    recommendations.push('Consider using memory profiling tools for detailed analysis');
    
    return recommendations;
  }

  private calculateMetrics(): MemoryMetrics {
    if (this.memoryTimeline.length === 0) {
      throw new Error('No memory data collected');
    }
    
    const latest = this.memoryTimeline[this.memoryTimeline.length - 1];
    const peak = this.memoryTimeline.reduce((max, snapshot) => 
      snapshot.heapUsed > max.heapUsed ? snapshot : max
    );
    
    // Calculate GC metrics
    const gcFrequency = this.gcEvents.length / (this.config.duration / 1000); // GCs per second
    const avgGCDuration = this.gcEvents.length > 0 
      ? this.gcEvents.reduce((sum, event) => sum + event.duration, 0) / this.gcEvents.length 
      : 0;
    
    // Calculate allocation/deallocation rates
    const allocationRate = this.allocations.size / (this.config.duration / 1000);
    const totalFreed = this.gcEvents.reduce((sum, event) => sum + event.freedMemory, 0);
    const deallocationRate = totalFreed / (this.config.duration / 1000);
    
    // Calculate efficiency metrics
    const memoryEfficiency = latest.heapUsed / latest.heapTotal;
    const fragmentationRatio = this.calculateFragmentationRatio();
    const leakRate = this.calculateLeakRate();
    
    return {
      heapUsed: latest.heapUsed,
      heapTotal: latest.heapTotal,
      external: latest.external,
      rss: latest.rss,
      arrayBuffers: latest.arrayBuffers,
      peakMemoryUsage: peak.heapUsed,
      memoryLeakRate: leakRate,
      gcFrequency,
      gcDuration: avgGCDuration,
      memoryEfficiency,
      fragmentationRatio,
      allocationRate,
      deallocationRate
    };
  }

  private calculateFragmentationRatio(): number {
    if (this.memoryTimeline.length < 2) {
      return 0;
    }
    
    // Simplified fragmentation calculation
    const latest = this.memoryTimeline[this.memoryTimeline.length - 1];
    const unusedHeap = latest.heapTotal - latest.heapUsed;
    
    return unusedHeap / latest.heapTotal;
  }

  private analyzeMemoryBehavior(): MemoryAnalysis {
    const recommendations: string[] = [];
    const bottlenecks: string[] = [];
    
    const metrics = this.calculateMetrics();
    
    // Determine memory usage pattern
    let memoryUsagePattern: 'stable' | 'growing' | 'fluctuating' | 'declining' = 'stable';
    
    if (this.memoryTimeline.length >= 3) {
      const start = this.memoryTimeline[0].heapUsed;
      const end = this.memoryTimeline[this.memoryTimeline.length - 1].heapUsed;
      const variance = this.calculateMemoryVariance();
      
      if (end > start * 1.2) {
        memoryUsagePattern = 'growing';
      } else if (end < start * 0.8) {
        memoryUsagePattern = 'declining';
      } else if (variance > start * 0.3) {
        memoryUsagePattern = 'fluctuating';
      }
    }
    
    // Analyze GC efficiency
    const gcEfficiency = this.gcEvents.length > 0 
      ? this.gcEvents.reduce((sum, event) => sum + event.freedMemory, 0) / this.gcEvents.length 
      : 0;
    
    // Analyze allocation efficiency
    const allocationEfficiency = metrics.deallocationRate / (metrics.allocationRate || 1);
    
    // Generate recommendations based on analysis
    if (memoryUsagePattern === 'growing') {
      recommendations.push('Memory usage is growing - check for memory leaks');
      bottlenecks.push('Potential memory leak detected');
    }
    
    if (metrics.gcFrequency > 5) {
      recommendations.push('High GC frequency - optimize object allocation patterns');
      bottlenecks.push('Frequent garbage collection');
    }
    
    if (metrics.memoryEfficiency < 0.5) {
      recommendations.push('Low memory efficiency - consider memory optimization');
    }
    
    if (metrics.fragmentationRatio > 0.3) {
      recommendations.push('High memory fragmentation - review allocation patterns');
      bottlenecks.push('Memory fragmentation');
    }
    
    if (allocationEfficiency < 0.8) {
      recommendations.push('Poor allocation efficiency - review object lifecycle management');
    }
    
    const summary = `Memory benchmark completed. Pattern: ${memoryUsagePattern}, Peak usage: ${(metrics.peakMemoryUsage / 1024 / 1024).toFixed(1)}MB, GC efficiency: ${gcEfficiency.toFixed(0)} bytes/GC`;
    
    return {
      memoryUsagePattern,
      gcEfficiency,
      allocationEfficiency,
      recommendations,
      bottlenecks,
      summary
    };
  }

  private calculateMemoryVariance(): number {
    if (this.memoryTimeline.length < 2) {
      return 0;
    }
    
    const mean = this.memoryTimeline.reduce((sum, snapshot) => sum + snapshot.heapUsed, 0) / this.memoryTimeline.length;
    const variance = this.memoryTimeline.reduce((sum, snapshot) => sum + Math.pow(snapshot.heapUsed - mean, 2), 0) / this.memoryTimeline.length;
    
    return Math.sqrt(variance);
  }

  private cleanup(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
    
    // Clear allocations
    this.allocations.clear();
    
    // Force final GC
    if (global.gc) {
      global.gc();
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getResults(): MemoryBenchmarkResult[] {
    return [...this.results];
  }

  getLatestResult(): MemoryBenchmarkResult | null {
    return this.results.length > 0 ? this.results[this.results.length - 1] : null;
  }

  async compareResults(
    baseline: MemoryBenchmarkResult,
    current: MemoryBenchmarkResult
  ): Promise<{
    improvement: number;
    regressions: string[];
    improvements: string[];
    summary: string;
  }> {
    const improvements: string[] = [];
    const regressions: string[] = [];
    
    // Compare peak memory usage
    const memoryImprovement = (baseline.metrics.peakMemoryUsage - current.metrics.peakMemoryUsage) / baseline.metrics.peakMemoryUsage;
    if (memoryImprovement > 0.05) {
      improvements.push(`Peak memory usage improved by ${(memoryImprovement * 100).toFixed(1)}%`);
    } else if (memoryImprovement < -0.05) {
      regressions.push(`Peak memory usage regressed by ${(Math.abs(memoryImprovement) * 100).toFixed(1)}%`);
    }
    
    // Compare GC efficiency
    const gcImprovement = (current.metrics.gcFrequency - baseline.metrics.gcFrequency) / baseline.metrics.gcFrequency;
    if (gcImprovement < -0.1) {
      improvements.push(`GC frequency improved by ${(Math.abs(gcImprovement) * 100).toFixed(1)}%`);
    } else if (gcImprovement > 0.1) {
      regressions.push(`GC frequency regressed by ${(gcImprovement * 100).toFixed(1)}%`);
    }
    
    // Compare memory efficiency
    const efficiencyImprovement = (current.metrics.memoryEfficiency - baseline.metrics.memoryEfficiency) / baseline.metrics.memoryEfficiency;
    if (efficiencyImprovement > 0.05) {
      improvements.push(`Memory efficiency improved by ${(efficiencyImprovement * 100).toFixed(1)}%`);
    } else if (efficiencyImprovement < -0.05) {
      regressions.push(`Memory efficiency regressed by ${(Math.abs(efficiencyImprovement) * 100).toFixed(1)}%`);
    }
    
    const overallImprovement = (memoryImprovement - gcImprovement + efficiencyImprovement) / 3;
    
    const summary = `Memory performance ${overallImprovement > 0 ? 'improved' : 'regressed'} by ${(Math.abs(overallImprovement) * 100).toFixed(1)}% overall`;
    
    return {
      improvement: overallImprovement,
      regressions,
      improvements,
      summary
    };
  }
}

// Export factory function
export function createMemoryBenchmark(config: Partial<MemoryBenchmarkConfig> = {}): MemoryBenchmark {
  const defaultConfig: MemoryBenchmarkConfig = {
    duration: 30000, // 30 seconds
    allocationSize: 1024, // 1KB
    allocationCount: 1000,
    enableGCProfiling: true,
    simulateMemoryLeaks: false,
    testFragmentation: true,
    monitoringInterval: 100, // 100ms
    stressTestLevels: ['light', 'medium', 'heavy']
  };
  
  return new MemoryBenchmark({ ...defaultConfig, ...config });
}