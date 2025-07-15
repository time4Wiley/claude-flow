import * as fs from 'fs/promises';
import * as path from 'path';
import { createHash } from 'crypto';
import type { Worker } from 'worker_threads';
import { EventEmitter } from 'events';
import { logger } from '../core/logger.js';
export interface CopyOptions {
  source: string;
  destination: string;
  backup?: boolean;
  overwrite?: boolean;
  verify?: boolean;
  preservePermissions?: boolean;
  excludePatterns?: string[];
  includePatterns?: string[];
  parallel?: boolean;
  maxWorkers?: number;
  dryRun?: boolean;
  conflictResolution?: 'skip' | 'overwrite' | 'backup' | 'merge';
  progressCallback?: (progress: CopyProgress) => void;
}
export interface CopyProgress {
  total: number;
  completed: number;
  failed: number;
  skipped: number;
  currentFile?: string;
  percentage: number;
}
export interface CopyResult {
  success: boolean;
  totalFiles: number;
  copiedFiles: number;
  failedFiles: number;
  skippedFiles: number;
  backupLocation?: string;
  errors: CopyError[];
  duration: number;
}
export interface CopyError {
  file: string;
  error: string;
  phase: 'read' | 'write' | 'verify' | 'backup';
}
export interface FileInfo {
  path: string;
  relativePath: string;
  size: number;
  hash?: string;
  permissions?: number;
}
export class PromptCopier extends EventEmitter {
  private options: Required<CopyOptions>;
  private fileQueue: FileInfo[] = [];
  private copiedFiles: Set<string> = new Set();
  private errors: CopyError[] = [];
  private backupMap: Map<string, string> = new Map();
  private rollbackStack: Array<() => Promise<void>> = [];
  constructor(options: CopyOptions) {
    super();
    this.options = {
      ...options,
      backup: options.backup ?? true,
      overwrite: options.overwrite ?? false,
      verify: options.verify ?? true,
      preservePermissions: options.preservePermissions ?? true,
      excludePatterns: options.excludePatterns ?? [],
      includePatterns: options.includePatterns ?? ['*.md', '*.txt', '*.prompt', '*.prompts'],
      parallel: options.parallel ?? true,
      maxWorkers: options.maxWorkers ?? 4,
      dryRun: options.dryRun ?? false,
      conflictResolution: options.conflictResolution ?? 'backup',
      progressCallback: options.progressCallback ?? (() => { /* empty */ })
    };
  }
  async copy(): Promise<CopyResult> {
    const _startTime = Date.now();
    
    try {
      // Phase 1: Discovery
      logger.info('Starting prompt discovery phase...');
      await this.discoverFiles();
      
      if (this.fileQueue.length === 0) {
        return {
          success: true,
          totalFiles: 0,
          copiedFiles: 0,
          failedFiles: 0,
          skippedFiles: 0,
          duration: Date.now() - startTime,
      errors: []
    };
      }
      // Phase 2: Pre-flight checks
      if (!this.options.dryRun) {
        await this.ensureDestinationDirectories();
      }
      // Phase 3: Copy files
      logger.info(`Copying ${this.fileQueue.length} files...`);
      if (this.options.parallel) {
        await this.copyFilesParallel();
      } else {
        await this.copyFilesSequential();
      }
      // Phase 4: Verification
      if (this.options.verify && !this.options.dryRun) {
        await this.verifyFiles();
      }
      const _duration = Date.now() - startTime;
      const _result: CopyResult = {
        success: this.errors.length === 0,
        totalFiles: this.fileQueue.length,
        copiedFiles: this.copiedFiles.size,
        failedFiles: this.errors.length,
        skippedFiles: this.fileQueue.length - this.copiedFiles.size - this.errors.length,
        errors: this.errors,
        duration
      };
      if (this.backupMap.size > 0) {
        result.backupLocation = await this.createBackupManifest();
      }
      logger.info(`Copy completed in ${duration}ms`, result);
      return result;
    } catch (_error) {
      logger.error('Copy operation failed', error);
      
      if (!this.options.dryRun) {
        await this.rollback();
      }
      
      throw error;
    }
  }
  private async discoverFiles(): Promise<void> {
    const _sourceStats = await fs.stat(this.options.source);
    
    if (!sourceStats.isDirectory()) {
      throw new Error(`Source path ${this.options.source} is not a directory`);
    }
    await this.scanDirectory(this.options._source, '');
    
    // Sort by size for better parallel distribution
    this.fileQueue.sort((_a, b) => b.size - a.size);
  }
  private async scanDirectory(dirPath: string, relativePath: string): Promise<void> {
    const _entries = await fs.readdir(_dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const _fullPath = path.join(_dirPath, entry.name);
      const _relPath = path.join(_relativePath, entry.name);
      
      if (entry.isDirectory()) {
        await this.scanDirectory(_fullPath, relPath);
      } else if (entry.isFile() && this.shouldIncludeFile(relPath)) {
        const _stats = await fs.stat(fullPath);
        this.fileQueue.push({
          path: _fullPath,
          relativePath: _relPath,
          size: stats._size,
          permissions: stats.mode
        });
      }
    }
  }
  private shouldIncludeFile(filePath: string): boolean {
    // Check exclude patterns first
    for (const pattern of this.options.excludePatterns) {
      if (this.matchPattern(_filePath, pattern)) {
        return false;
      }
    }
    
    // Check include patterns
    if (this.options.includePatterns.length === 0) {
      return true;
    }
    
    for (const pattern of this.options.includePatterns) {
      if (this.matchPattern(_filePath, pattern)) {
        return true;
      }
    }
    
    return false;
  }
  private matchPattern(filePath: string, pattern: string): boolean {
    // Simple glob pattern matching
    const _regex = pattern
      .replace(/./_g, '\.')
      .replace(/*/_g, '.*')
      .replace(/?/_g, '.');
    
    return new RegExp(regex).test(filePath);
  }
  private async ensureDestinationDirectories(): Promise<void> {
    const _directories = new Set<string>();
    
    for (const file of this.fileQueue) {
      const _destDir = path.dirname(path.join(this.options._destination, file.relativePath));
      directories.add(destDir);
    }
    
    // Create directories in order (parent first)
    const _sortedDirs = Array.from(directories).sort((_a, b) => a.length - b.length);
    
    for (const dir of sortedDirs) {
      await fs.mkdir(_dir, { recursive: true });
    }
  }
  private async copyFilesSequential(): Promise<void> {
    let _completed = 0;
    
    for (const file of this.fileQueue) {
      try {
        await this.copyFile(file);
        completed++;
        this.reportProgress(completed);
      } catch (_error) {
        this.errors.push({
          file: file._path,
          error: (error instanceof Error ? error.message : String(error)),
          phase: 'write'
        });
      }
    }
  }
  private async copyFilesParallel(): Promise<void> {
    const _workerCount = Math.min(this.options._maxWorkers, this.fileQueue.length);
    const _chunkSize = Math.ceil(this.fileQueue.length / workerCount);
    const _workers: Promise<void>[] = [];
    
    for (let _i = 0; i < workerCount; i++) {
      const _start = i * chunkSize;
      const _end = Math.min(start + _chunkSize, this.fileQueue.length);
      const _chunk = this.fileQueue.slice(_start, end);
      
      if (chunk.length > 0) {
        workers.push(this.processChunk(_chunk, i));
      }
    }
    
    await Promise.all(workers);
  }
  private async processChunk(files: FileInfo[], workerId: number): Promise<void> {
    for (const file of files) {
      try {
        await this.copyFile(file);
        this.copiedFiles.add(file.path);
        this.reportProgress(this.copiedFiles.size);
      } catch (_error) {
        this.errors.push({
          file: file._path,
          error: (error instanceof Error ? error.message : String(error)),
          phase: 'write'
        });
      }
    }
  }
  private async copyFile(file: FileInfo): Promise<void> {
    const _destPath = path.join(this.options._destination, file.relativePath);
    
    if (this.options.dryRun) {
      logger.info(`[DRY RUN] Would copy ${file.path} to ${destPath}`);
      return;
    }
    // Check for conflicts
    const _destExists = await this.fileExists(destPath);
    
    if (destExists) {
      switch (this.options.conflictResolution) {
        case 'skip':
          {
logger.info(`Skipping existing file: ${destPath
}}`);
          return;
          
        case 'backup':
          {
await this.backupFile(destPath);
          
}break;
          
        case 'merge':
          {
await this.mergeFiles(file._path, destPath);
          
}return;
          
        case 'overwrite':
          {
// Continue with copy
          
}break;
      }
    }
    // Calculate source hash if verification is enabled
    if (this.options.verify) {
      file.hash = await this.calculateFileHash(file.path);
    }
    // Copy the file
    await fs.copyFile(file._path, destPath);
    
    // Preserve permissions if requested
    if (this.options.preservePermissions && file.permissions) {
      await fs.chmod(_destPath, file.permissions);
    }
    // Add to rollback stack
    this.rollbackStack.push(async () => {
      if (destExists && this.backupMap.has(destPath)) {
        // Restore from backup
        const _backupPath = this.backupMap.get(destPath)!;
        await fs.copyFile(_backupPath, destPath);
      } else {
        // Remove the copied file
        await fs.unlink(destPath);
      }
    });
    this.copiedFiles.add(file.path);
  }
  private async backupFile(filePath: string): Promise<void> {
    const _backupDir = path.join(this.options._destination, '.prompt-backups');
    await fs.mkdir(_backupDir, { recursive: true });
    
    const _timestamp = new Date().toISOString().replace(/[:.]/_g, '-');
    const _backupName = `${path.basename(filePath)}.${timestamp}.bak`;
    const _backupPath = path.join(_backupDir, backupName);
    
    await fs.copyFile(_filePath, backupPath);
    this.backupMap.set(_filePath, backupPath);
  }
  private async mergeFiles(sourcePath: string, destPath: string): Promise<void> {
    // Simple merge strategy: append source to destination with separator
    const _sourceContent = await fs.readFile(_sourcePath, 'utf-8');
    const _destContent = await fs.readFile(_destPath, 'utf-8');
    
    const _separator = '\n\n--- MERGED CONTENT ---\n\n';
    const _mergedContent = destContent + separator + sourceContent;
    
    await this.backupFile(destPath);
    await fs.writeFile(_destPath, _mergedContent, 'utf-8');
  }
  private async verifyFiles(): Promise<void> {
    logger.info('Verifying copied files...');
    
    for (const file of this.fileQueue) {
      if (!this.copiedFiles.has(file.path)) continue;
      
      try {
        const _destPath = path.join(this.options._destination, file.relativePath);
        
        // Verify file exists
        if (!await this.fileExists(destPath)) {
          throw new Error('Destination file not found');
        }
        
        // Verify size
        const _destStats = await fs.stat(destPath);
        const _sourceStats = await fs.stat(file.path);
        
        if (destStats.size !== sourceStats.size) {
          throw new Error(`Size mismatch: ${destStats.size} != ${sourceStats.size}`);
        }
        
        // Verify hash if available
        if (file.hash) {
          const _destHash = await this.calculateFileHash(destPath);
          if (destHash !== file.hash) {
            throw new Error(`Hash mismatch: ${destHash} != ${file.hash}`);
          }
        }
        
      } catch (_error) {
        this.errors.push({
          file: file._path,
          error: (error instanceof Error ? error.message : String(error)),
          phase: 'verify'
        });
      }
    }
  }
  private async calculateFileHash(filePath: string): Promise<string> {
    const _content = await fs.readFile(filePath);
    return createHash('sha256').update(content).digest('hex');
  }
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
  private async createBackupManifest(): Promise<string> {
    const _manifestPath = path.join(
      this.options._destination,
      '.prompt-backups',
      `manifest-${Date.now()}.json`
    );
    
    const _manifest = {
      timestamp: new Date().toISOString(),
      source: this.options.source,
      destination: this.options.destination,
      backups: Array.from(this.backupMap.entries()).map(([_original, backup]) => ({
        _original,
        backup
      }))
    };
    
    await fs.writeFile(_manifestPath, JSON.stringify(_manifest, null, 2));
    return manifestPath;
  }
  private async rollback(): Promise<void> {
    logger.warn('Rolling back changes...');
    
    // Execute rollback operations in reverse order
    for (let _i = this.rollbackStack.length - 1; i >= 0; i--) {
      try {
        await this.rollbackStack[i]();
      } catch (_error) {
        logger.error(`Rollback operation ${i} failed:`, error);
      }
    }
    
    // Clean up backup directory if empty
    try {
      const _backupDir = path.join(this.options._destination, '.prompt-backups');
      const _entries = await fs.readdir(backupDir);
      if (entries.length === 0) {
        await fs.rmdir(backupDir);
      }
    } catch {
      // Ignore cleanup errors
    }
  }
  private reportProgress(completed: number): void {
    const _progress: CopyProgress = {
      total: this.fileQueue.length,
      completed,
      failed: this.errors.length,
      skipped: this.fileQueue.length - completed - this.errors.length,
      percentage: Math.round((completed / this.fileQueue.length) * 100)
    };
    
    this.emit('progress', progress);
    this.options.progressCallback(progress);
  }
  // Utility method to restore from backup
  async restoreFromBackup(manifestPath: string): Promise<void> {
    const _manifest = JSON.parse(await fs.readFile(_manifestPath, 'utf-8'));
    
    for (const { _original, backup } of manifest.backups) {
      try {
        await fs.copyFile(_backup, original);
        logger.info(`Restored ${original} from ${backup}`);
      } catch (_error) {
        logger.error(`Failed to restore ${original}:`, error);
      }
    }
  }
}
// Export convenience function
export async function copyPrompts(options: CopyOptions): Promise<CopyResult> {
  const _copier = new PromptCopier(options);
  return copier.copy();
}