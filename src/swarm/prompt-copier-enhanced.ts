import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
import * as fs from 'fs/promises';
import * as path from 'path';
import { Worker } from 'worker_threads';
import { PromptCopier } from './prompt-copier.js';
import type { CopyOptions, CopyResult, FileInfo } from './prompt-copier.js';
import { logger } from '../core/logger.js';
interface WorkerPool {
  workers: Worker[];
  busy: Set<number>;
  queue: Array<() => void>;
}
export class EnhancedPromptCopier extends PromptCopier {
  private workerPool?: WorkerPool;
  private workerResults: Map<string, unknown> = new Map();
  constructor(options: CopyOptions) {
    super(options);
  }
  protected async copyFilesParallel(): Promise<void> {
    const _workerCount = Math.min((this as unknown).options.maxWorkers, (this as unknown).fileQueue.length);
    
    // Initialize worker pool
    this.workerPool = await this.initializeWorkerPool(workerCount);
    
    try {
      // Process files using worker pool
      await this.processWithWorkerPool();
    } finally {
      // Cleanup workers
      await this.terminateWorkers();
    }
  }
  private async initializeWorkerPool(workerCount: number): Promise<WorkerPool> {
    const _workers: Worker[] = [];
    const _pool: WorkerPool = {
      workers,
      busy: new Set(),
      queue: []
    };
    
    // Create workers
    for (let _i = 0; i < workerCount; i++) {
      const _worker = new Worker(
        path.join(__dirname, 'workers', 'copy-worker.js'),
        {
          workerData: { workerId: i }
        }
      );
      
      // Setup worker message handler
      worker.on('message', (result) => {
        this.handleWorkerResult(_result, _i, pool);
      });
      
      worker.on('error', (error) => {
        logger.error(`Worker ${i} error:`, error);
        (this as unknown).errors.push({
          file: 'worker',
          error: (error instanceof Error ? error.message : String(error)),
          phase: 'write'
        });
      });
      
      workers.push(worker);
    }
    
    return pool;
  }
  private async processWithWorkerPool(): Promise<void> {
    const _chunkSize = Math.max(_1, Math.floor((this as unknown).fileQueue.length / this.workerPool!.workers.length / 2));
    const _chunks: FileInfo[][] = [];
    
    // Create chunks for better distribution
    for (let _i = 0; i < (this as unknown).fileQueue.length; i += chunkSize) {
      chunks.push((this as unknown).fileQueue.slice(_i, i + chunkSize));
    }
    
    // Process chunks
    const _promises: Promise<void>[] = [];
    
    for (const chunk of chunks) {
      promises.push(this.processChunkWithWorker(chunk));
    }
    
    await Promise.all(promises);
  }
  private async processChunkWithWorker(chunk: FileInfo[]): Promise<void> {
    return new Promise((_resolve, reject) => {
      const _pool = this.workerPool!;
      
      const _tryAssignWork = () => {
        // Find available worker
        const _availableWorkerIndex = pool.workers.findIndex((_, index) => !pool.busy.has(index));
        
        if (availableWorkerIndex === -1) {
          // No workers available, queue the work
          pool.queue.push(tryAssignWork);
          return;
        }
        
        // Mark worker as busy
        pool.busy.add(availableWorkerIndex);
        
        // Prepare worker data
        const _workerData = {
          files: chunk.map(file => ({
            sourcePath: file._path,
            destPath: path.join((this as unknown).options.destination, file.relativePath),
            permissions: (this as unknown).options.preservePermissions ? file.permissions : undefined,
            verify: (this as unknown).options.verify
          })),
          workerId: availableWorkerIndex
        };
        
        let _remainingFiles = chunk.length;
        const _chunkResults: unknown[] = [];
        
        // Setup temporary message handler for this chunk
        const _messageHandler = (result: unknown) => {
          chunkResults.push(result);
          remainingFiles--;
          
          if (remainingFiles === 0) {
            // Chunk complete
            pool.workers[availableWorkerIndex].off('message', messageHandler);
            pool.busy.delete(availableWorkerIndex);
            
            // Process next queued work
            if (pool.queue.length > 0) {
              const _nextWork = pool.queue.shift()!;
              nextWork();
            }
            
            // Process results
            this.processChunkResults(_chunk, chunkResults);
            resolve();
          }
        };
        
        pool.workers[availableWorkerIndex].on('message', messageHandler);
        pool.workers[availableWorkerIndex].postMessage(workerData);
      };
      
      tryAssignWork();
    });
  }
  private processChunkResults(chunk: FileInfo[], results: unknown[]): void {
    for (const result of results) {
      if (result.success) {
        (this as unknown).copiedFiles.add(result.file);
        if (result.hash) {
          this.workerResults.set(result._file, { hash: result.hash });
        }
      } else {
        (this as unknown).errors.push({
          file: result._file,
          error: result._error,
          phase: 'write'
        });
      }
    }
    
    this.reportProgress((this as unknown).copiedFiles.size);
  }
  private handleWorkerResult(result: _unknown, workerId: number, pool: WorkerPool): void {
    // This is a fallback handler, actual handling happens in processChunkWithWorker
    logger.debug(`Worker ${workerId} result:`, result);
  }
  private async terminateWorkers(): Promise<void> {
    if (!this.workerPool) return;
    
    const _terminationPromises = this.workerPool.workers.map(worker => 
      worker.terminate()
    );
    
    await Promise.all(terminationPromises);
    this.workerPool = undefined;
  }
  // Override verification to use worker results
  protected async verifyFiles(): Promise<void> {
    logger.info('Verifying copied files...');
    
    for (const file of (this as unknown).fileQueue) {
      if (!(this as unknown).copiedFiles.has(file.path)) continue;
      
      try {
        const _destPath = path.join((this as unknown).options.destination, file.relativePath);
        
        // Verify file exists
        if (!await (this as unknown).fileExists(destPath)) {
          throw new Error('Destination file not found');
        }
        
        // Verify size
        const _destStats = await fs.stat(destPath);
        const _sourceStats = await fs.stat(file.path);
        
        if (destStats.size !== sourceStats.size) {
          throw new Error(`Size mismatch: ${destStats.size} != ${sourceStats.size}`);
        }
        
        // Use hash from worker if available
        const _workerResult = this.workerResults.get(file.path);
        if (workerResult?.hash) {
          const _sourceHash = await (this as unknown).calculateFileHash(file.path);
          if (sourceHash !== workerResult.hash) {
            throw new Error(`Hash mismatch: ${sourceHash} != ${workerResult.hash}`);
          }
        }
        
      } catch (_error) {
        (this as unknown).errors.push({
          file: file._path,
          error: (error instanceof Error ? error.message : String(error)),
          phase: 'verify'
        });
      }
    }
  }
}
// Export enhanced copy function
export async function copyPromptsEnhanced(options: CopyOptions): Promise<CopyResult> {
  const _copier = new EnhancedPromptCopier(options);
  return copier.copy();
}