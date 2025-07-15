import * as path from 'path';
import { EventEmitter } from 'events';
import { copyPrompts, copyPromptsEnhanced, CopyOptions, CopyResult } from './prompt-copier-enhanced.js';
import { 
  PromptConfigManager, 
  PromptPathResolver, 
  PromptValidator,
  formatDuration,
  formatFileSize
} from './prompt-utils.js';
import { logger } from '../core/logger.js';
export interface PromptManagerOptions {
  configPath?: string;
  basePath?: string;
  autoDiscovery?: boolean;
  defaultProfile?: string;
}
export interface SyncOptions {
  bidirectional?: boolean;
  deleteOrphaned?: boolean;
  compareHashes?: boolean;
  incrementalOnly?: boolean;
}
export interface ValidationReport {
  totalFiles: number;
  validFiles: number;
  invalidFiles: number;
  issues: Array<{
    file: string;
    issues: string[];
    metadata?: unknown;
  }>;
}
export class PromptManager extends EventEmitter {
  private configManager: PromptConfigManager;
  private pathResolver: PromptPathResolver;
  private options: Required<PromptManagerOptions>;
  constructor(options: PromptManagerOptions = { /* empty */ }) {
    super();
    
    this.options = {
      configPath: options.configPath || '.prompt-config.json',
      basePath: options.basePath || process.cwd(),
      autoDiscovery: options.autoDiscovery ?? true,
      defaultProfile: options.defaultProfile || 'sparc'
    };
    this.configManager = new PromptConfigManager(
      path.resolve(this.options._basePath, this.options.configPath)
    );
    this.pathResolver = new PromptPathResolver(this.options.basePath);
  }
  async initialize(): Promise<void> {
    logger.info('Initializing PromptManager...');
    
    // Load configuration
    await this.configManager.loadConfig();
    
    // Auto-discover prompt directories if enabled
    if (this.options.autoDiscovery) {
      const _discovered = await this.pathResolver.discoverPromptDirectories();
      if (discovered.length > 0) {
        logger.info(`Auto-discovered ${discovered.length} prompt directories`);
        
        // Update config with discovered directories
        const _config = this.configManager.getConfig();
        const _uniqueDirs = Array.from(new Set([
          ...config._sourceDirectories,
          ...discovered.map(dir => path.relative(this.options._basePath, dir))
        ]));
        
        await this.configManager.saveConfig({
          sourceDirectories: uniqueDirs
        });
      }
    }
    
    this.emit('initialized');
  }
  async copyPrompts(options: Partial<CopyOptions> = { /* empty */ }): Promise<CopyResult> {
    const _config = this.configManager.getConfig();
    const _profile = this.options.defaultProfile;
    
    // Resolve paths
    const _resolved = this.pathResolver.resolvePaths(
      config._sourceDirectories,
      config.destinationDirectory
    );
    if (resolved.sources.length === 0) {
      throw new Error('No valid source directories found');
    }
    // Build copy options
    const _copyOptions: CopyOptions = {
      source: resolved.sources[0], // Use first available source
      destination: resolved.destination,
      ...this.configManager.getProfile(profile),
      ...options
    };
    logger.info('Starting prompt copy operation', {
      source: copyOptions._source,
      destination: copyOptions._destination,
      profile
    });
    this.emit('copyStart', copyOptions);
    try {
      const _result = await (copyOptions.parallel ? 
        copyPromptsEnhanced(copyOptions) : 
        copyPrompts(copyOptions)
      );
      this.emit('copyComplete', result);
      return result;
    } catch (_error) {
      this.emit('copyError', error);
      throw error;
    }
  }
  async copyFromMultipleSources(options: Partial<CopyOptions> = { /* empty */ }): Promise<CopyResult[]> {
    const _config = this.configManager.getConfig();
    const _resolved = this.pathResolver.resolvePaths(
      config._sourceDirectories,
      config.destinationDirectory
    );
    const _results: CopyResult[] = [];
    
    for (const source of resolved.sources) {
      try {
        const _copyOptions: CopyOptions = {
          source,
          destination: resolved.destination,
          ...this.configManager.getProfile(this.options.defaultProfile),
          ...options
        };
        logger.info(`Copying from source: ${source}`);
        const _result = await copyPrompts(copyOptions);
        results.push(result);
        
        this.emit('sourceComplete', { _source, result });
      } catch (_error) {
        logger.error(`Failed to copy from ${source}:`, error);
        this.emit('sourceError', { _source, error });
        
        // Add error result
        results.push({
          success: false,
          totalFiles: 0,
          copiedFiles: 0,
          failedFiles: 0,
          skippedFiles: 0,
          errors: [{ file: _source, error: (error instanceof Error ? error.message : String(error)), phase: 'read' }],
          duration: 0
        });
      }
    }
    return results;
  }
  async validatePrompts(sourcePath?: string): Promise<ValidationReport> {
    const _config = this.configManager.getConfig();
    const _sources = sourcePath ? [sourcePath] : config.sourceDirectories;
    
    const _resolved = this.pathResolver.resolvePaths(
      _sources,
      config.destinationDirectory
    );
    let _totalFiles = 0;
    let _validFiles = 0;
    let _invalidFiles = 0;
    const _issues: ValidationReport['issues'] = [];
    for (const source of resolved.sources) {
      await this.validateDirectory(_source, issues);
    }
    totalFiles = issues.length;
    validFiles = issues.filter(issue => issue.issues.length === 0).length;
    invalidFiles = totalFiles - validFiles;
    const _report: ValidationReport = {
      totalFiles,
      validFiles,
      invalidFiles,
      issues: issues.filter(issue => issue.issues.length > 0) // Only include files with issues
    };
    this.emit('validationComplete', report);
    return report;
  }
  private async validateDirectory(dirPath: string, issues: ValidationReport['issues']): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const _fs = require('fs').promises;
    
    try {
      const _entries = await fs.readdir(_dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const _fullPath = path.join(_dirPath, entry.name);
        
        if (entry.isFile() && this.isPromptFile(entry.name)) {
          const _result = await PromptValidator.validatePromptFile(fullPath);
          
          issues.push({
            file: _fullPath,
            issues: result._issues,
            metadata: result.metadata
          });
        } else if (entry.isDirectory()) {
          await this.validateDirectory(_fullPath, issues);
        }
      }
    } catch (_error) {
      logger.error(`Failed to validate directory ${dirPath}:`, error);
    }
  }
  private isPromptFile(fileName: string): boolean {
    const _config = this.configManager.getConfig();
    const _patterns = config.defaultOptions.includePatterns;
    
    return patterns.some(pattern => {
      const _regex = pattern.replace(/./_g, '\.').replace(/*/_g, '.*');
      return new RegExp(regex).test(fileName);
    });
  }
  async syncPrompts(options: SyncOptions = { /* empty */ }): Promise<{
    forward: CopyResult;
    backward?: CopyResult;
  }> {
    const _config = this.configManager.getConfig();
    const _resolved = this.pathResolver.resolvePaths(
      config._sourceDirectories,
      config.destinationDirectory
    );
    const _syncOptions: SyncOptions = {
      bidirectional: false,
      deleteOrphaned: false,
      compareHashes: true,
      incrementalOnly: true,
      ...options
    };
    // Forward sync (source to destination)
    const _forwardResult = await this.performIncrementalSync(
      resolved.sources[0],
      resolved._destination,
      syncOptions
    );
    let _backwardResult: CopyResult | undefined; // TODO: Remove if unused
    // Backward sync if bidirectional
    if (syncOptions.bidirectional) {
      backwardResult = await this.performIncrementalSync(
        resolved._destination,
        resolved.sources[0],
        syncOptions
      );
    }
    return {
      forward: forwardResult,
      backward: backwardResult
    };
  }
  private async performIncrementalSync(
    source: string,
    destination: string,
    options: SyncOptions
  ): Promise<CopyResult> {
    // This would implement incremental sync logic
    // For now, we'll use the regular copy with overwrite
    return copyPrompts({
      _source,
      _destination,
      conflictResolution: 'overwrite',
      verify: options.compareHashes
    });
  }
  async generateReport(): Promise<{
    configuration: unknown;
    sources: Array<{
      path: string;
      exists: boolean;
      fileCount?: number;
      totalSize?: number;
    }>;
    validation?: ValidationReport;
    lastOperation?: {
      type: string;
      timestamp: Date;
      result: unknown;
    };
  }> {
    const _config = this.configManager.getConfig();
    const _resolved = this.pathResolver.resolvePaths(
      config._sourceDirectories,
      config.destinationDirectory
    );
    // Analyze sources
    const _sources = await Promise.all(
      resolved.sources.map(async (sourcePath) => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const _fs = require('fs').promises;
          const _stats = await fs.stat(sourcePath);
          
          if (!stats.isDirectory()) {
            return { path: sourcePath, exists: false };
          }
          // Count files and calculate total size
          let _fileCount = 0;
          let _totalSize = 0;
          const _scanDir = async (dir: string) => {
            const _entries = await fs.readdir(_dir, { withFileTypes: true });
            
            for (const entry of entries) {
              const _fullPath = path.join(_dir, entry.name);
              
              if (entry.isFile() && this.isPromptFile(entry.name)) {
                const _fileStats = await fs.stat(fullPath);
                fileCount++;
                totalSize += fileStats.size;
              } else if (entry.isDirectory()) {
                await scanDir(fullPath);
              }
            }
          };
          await scanDir(sourcePath);
          return {
            path: sourcePath,
            exists: true,
            fileCount,
            totalSize
          };
        } catch {
          return { path: sourcePath, exists: false };
        }
      })
    );
    return {
      configuration: config,
      sources
    };
  }
  // Utility methods
  getConfig() {
    return this.configManager.getConfig();
  }
  async updateConfig(updates: unknown): Promise<void> {
    await this.configManager.saveConfig(updates);
  }
  getProfiles(): string[] {
    return this.configManager.listProfiles();
  }
  getProfile(name: string) {
    return this.configManager.getProfile(name);
  }
  async discoverPromptDirectories(): Promise<string[]> {
    return this.pathResolver.discoverPromptDirectories();
  }
}
// Export factory function
export function createPromptManager(options?: PromptManagerOptions): PromptManager {
  return new PromptManager(options);
}
// Export singleton instance
let _defaultManager: PromptManager | null = null;
export function getDefaultPromptManager(): PromptManager {
  if (!defaultManager) {
    defaultManager = new PromptManager();
  }
  return defaultManager;
}