#!/usr/bin/env node

/**
 * Script to run performance optimization tests
 */

import { runPerformanceTests } from './benchmarks/PerformanceTestSuite';
import { logger } from '../utils/logger';

async function main() {
  logger.info('Starting Agentic Flow Performance Optimization Tests...');
  
  try {
    await runPerformanceTests();
    logger.info('Performance tests completed successfully!');
    process.exit(0);
  } catch (error) {
    logger.error('Performance tests failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { main as runPerformanceOptimizationTests };