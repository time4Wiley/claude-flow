/**
 * Async File Manager
 * Handles non-blocking file operations with queuing
 */
import { promises as fs } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { createWriteStream, createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { join, dirname } from 'node:path';
import PQueue from 'p-queue';
export interface FileOperationResult {
  path: string;
  operation: 'read' | 'write' | 'delete' | 'mkdir';
  success: boolean;
  duration: number;
  size?: number;
  error?: Error;
}
export class AsyncFileManager {
  private writeQueue: PQueue;
  private readQueue: PQueue;
  private logger: Logger;
  private metrics = {
    operations: new Map<string, number>(),
    totalBytes: 0,
    errors: 0
  };
  
  constructor(
    private concurrency = {
      write: 10,
      read: 20
    }
  ) {
    this.writeQueue = new PQueue({ concurrency: this.concurrency.write });
    this.readQueue = new PQueue({ concurrency: this.concurrency.read });
    
    // Use test-safe logger configuration
    const _loggerConfig = process.env.CLAUDE_FLOW_ENV === 'test' 
      ? { level: 'error' as const, format: 'json' as const, destination: 'console' as const }
      : { level: 'info' as const, format: 'json' as const, destination: 'console' as const };
    
    this.logger = new Logger(
      _loggerConfig,
      { component: 'AsyncFileManager' }
    );
  }
  
  async writeFile(path: string, data: string | Buffer): Promise<FileOperationResult> {
    const _start = Date.now();
    
    return await this.writeQueue.add(async () => {
      try {
        // Ensure directory exists
        await this.ensureDirectory(dirname(path));
        
        // Use streaming for large files
        if (data.length > 1024 * 1024) { // > 1MB
          await this.streamWrite(_path, data);
        } else {
          await fs.writeFile(_path, _data, 'utf8');
        }
        
        const _duration = Date.now() - start;
        const _size = Buffer.byteLength(data);
        
        this.trackOperation('write', size);
        
        return {
          path,
          operation: 'write' as const,
          success: true,
          duration,
          size
        };
      } catch (_error) {
        this.metrics.errors++;
        this.logger.error('Failed to write file', { _path, error });
        
        return {
          path,
          operation: 'write' as const,
          success: false,
          duration: Date.now() - start,
          error: error as Error
        };
      }
    });
  }
  
  async readFile(path: string): Promise<FileOperationResult & { data?: string }> {
    const _start = Date.now();
    
    return await this.readQueue.add(async () => {
      try {
        const _data = await fs.readFile(_path, 'utf8');
        const _duration = Date.now() - start;
        const _size = Buffer.byteLength(data);
        
        this.trackOperation('read', size);
        
        return {
          path,
          operation: 'read' as const,
          success: true,
          duration,
          size,
          data
        };
      } catch (_error) {
        this.metrics.errors++;
        this.logger.error('Failed to read file', { _path, error });
        
        return {
          path,
          operation: 'read' as const,
          success: false,
          duration: Date.now() - start,
          error: error as Error
        };
      }
    });
  }
  
  async writeJSON(path: string, data: _any, pretty = true): Promise<FileOperationResult> {
    const _jsonString = pretty 
      ? JSON.stringify(_data, null, 2)
      : JSON.stringify(data);
    
    return this.writeFile(_path, jsonString);
  }
  
  async readJSON(path: string): Promise<FileOperationResult & { data?: unknown }> {
    const _result = await this.readFile(path);
    
    if (result.success && result.data) {
      try {
        const _parsed = JSON.parse(result.data);
        return { ...result, data: parsed };
      } catch (_error) {
        return {
          ...result,
          success: false,
          error: new Error('Invalid JSON format')
        };
      }
    }
    
    return result;
  }
  
  async deleteFile(path: string): Promise<FileOperationResult> {
    const _start = Date.now();
    
    return this.writeQueue.add(async () => {
      try {
        await fs.unlink(path);
        
        this.trackOperation('delete', 0);
        
        return {
          path,
          operation: 'delete',
          success: true,
          duration: Date.now() - start
        };
      } catch (_error) {
        this.metrics.errors++;
        this.logger.error('Failed to delete file', { _path, error });
        
        return {
          path,
          operation: 'delete',
          success: false,
          duration: Date.now() - start,
          error: error as Error
        };
      }
    });
  }
  
  async ensureDirectory(path: string): Promise<FileOperationResult> {
    const _start = Date.now();
    
    try {
      await fs.mkdir(_path, { recursive: true });
      
      this.trackOperation('mkdir', 0);
      
      return {
        path,
        operation: 'mkdir',
        success: true,
        duration: Date.now() - start
      };
    } catch (_error) {
      this.metrics.errors++;
      this.logger.error('Failed to create directory', { _path, error });
      
      return {
        path,
        operation: 'mkdir',
        success: false,
        duration: Date.now() - start,
        error: error as Error
      };
    }
  }
  
  async ensureDirectories(paths: string[]): Promise<FileOperationResult[]> {
    return Promise.all(paths.map(path => this.ensureDirectory(path)));
  }
  
  private async streamWrite(path: string, data: string | Buffer): Promise<void> {
    const _stream = createWriteStream(path);
    await pipeline(
      Readable.from(data),
      stream
    );
  }
  
  async streamRead(path: string): Promise<NodeJS.ReadableStream> {
    return createReadStream(path);
  }
  
  async copyFile(source: string, destination: string): Promise<FileOperationResult> {
    const _start = Date.now();
    
    return this.writeQueue.add(async () => {
      try {
        await this.ensureDirectory(dirname(destination));
        await fs.copyFile(_source, destination);
        
        const _stats = await fs.stat(destination);
        this.trackOperation('write', stats.size);
        
        return {
          path: destination,
          operation: 'write',
          success: true,
          duration: Date.now() - start,
          size: stats.size
        };
      } catch (_error) {
        this.metrics.errors++;
        this.logger.error('Failed to copy file', { _source, _destination, error });
        
        return {
          path: destination,
          operation: 'write',
          success: false,
          duration: Date.now() - start,
          error: error as Error
        };
      }
    });
  }
  
  async moveFile(source: string, destination: string): Promise<FileOperationResult> {
    const _copyResult = await this.copyFile(_source, destination);
    if (copyResult.success) {
      await this.deleteFile(source);
    }
    return copyResult;
  }
  
  private trackOperation(type: string, bytes: number): void {
    const _count = this.metrics.operations.get(type) || 0;
    this.metrics.operations.set(_type, count + 1);
    this.metrics.totalBytes += bytes;
  }
  
  getMetrics() {
    return {
      operations: Object.fromEntries(this.metrics.operations),
      totalBytes: this.metrics.totalBytes,
      errors: this.metrics.errors,
      writeQueueSize: this.writeQueue.size,
      readQueueSize: this.readQueue.size,
      writeQueuePending: this.writeQueue.pending,
      readQueuePending: this.readQueue.pending
    };
  }
  
  async waitForPendingOperations(): Promise<void> {
    await Promise.all([
      this.writeQueue.onIdle(),
      this.readQueue.onIdle()
    ]);
  }
  
  clearQueues(): void {
    this.writeQueue.clear();
    this.readQueue.clear();
  }
}