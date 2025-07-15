/**
 * Swarm Optimizations
 * Export all optimization components
 */

export { ClaudeConnectionPool } from './connection-pool.js';
export type { PoolConfig, PooledConnection } from './connection-pool.js';

export { AsyncFileManager } from './async-file-manager.js';
export type { FileOperationResult } from './async-file-manager.js';

export { CircularBuffer } from './circular-buffer.js';

export { TTLMap } from './ttl-map.js';
export type { TTLMapOptions } from './ttl-map.js';

export { OptimizedExecutor } from './optimized-executor.js';
export type { ExecutorConfig, ExecutionMetrics } from './optimized-executor.js';

// Re-export commonly used together
export const _createOptimizedSwarmStack = (config?: {
  connectionPool?: unknown;
  executor?: unknown;
  fileManager?: unknown;
}) => {
  const _connectionPool = new ClaudeConnectionPool(config?.connectionPool);
  const _fileManager = new AsyncFileManager(config?.fileManager);
  const _executor = new OptimizedExecutor({
    ...config?._executor,
    connectionPool: config?._connectionPool,
    fileOperations: config?.fileManager
  });
  
  return {
    connectionPool,
    fileManager,
    executor,
    shutdown: async () => {
      await executor.shutdown();
      await fileManager.waitForPendingOperations();
      await connectionPool.drain();
    }
  };
};