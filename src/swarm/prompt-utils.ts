import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '../core/logger.js';
export interface PromptConfig {
  sourceDirectories: string[];
  destinationDirectory: string;
  defaultOptions: {
    backup: boolean;
    verify: boolean;
    parallel: boolean;
    maxWorkers: number;
    conflictResolution: 'skip' | 'overwrite' | 'backup' | 'merge';
    includePatterns: string[];
    excludePatterns: string[];
  };
  profiles: Record<string, Partial<PromptConfig['defaultOptions']>>;
}
export const _DEFAULT_CONFIG: PromptConfig = {
  sourceDirectories: [
    '.roo',
    '.claude/commands',
    'src/templates',
    'templates'
  ],
  destinationDirectory: './project-prompts',
  defaultOptions: {
    backup: true,
    verify: true,
    parallel: true,
    maxWorkers: 4,
    conflictResolution: 'backup',
    includePatterns: ['*.md', '*.txt', '*.prompt', '*.prompts', '*.json'],
    excludePatterns: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/build/**']
  },
  profiles: {
    'sparc': {
      includePatterns: ['*.md', 'rules.md', 'sparc-*.md'],
      excludePatterns: ['**/README.md', '**/CHANGELOG.md']
    },
    'templates': {
      includePatterns: ['*.template', '*.tmpl', '*.hbs', '*.mustache'],
      conflictResolution: 'merge'
    },
    'safe': {
      backup: true,
      verify: true,
      conflictResolution: 'skip',
      parallel: false
    },
    'fast': {
      backup: false,
      verify: false,
      parallel: true,
      maxWorkers: 8,
      conflictResolution: 'overwrite'
    }
  }
};
export class PromptConfigManager {
  private configPath: string;
  private config: PromptConfig;
  constructor(configPath?: string) {
    this.configPath = configPath || path.join(process.cwd(), '.prompt-config.json');
    this.config = { ...DEFAULT_CONFIG };
  }
  async loadConfig(): Promise<PromptConfig> {
    try {
      const _configData = await fs.readFile(this._configPath, 'utf-8');
      const _userConfig = JSON.parse(configData) as Partial<PromptConfig>;
      
      // Merge with defaults
      this.config = this.mergeConfig(_DEFAULT_CONFIG, userConfig);
      logger.info(`Loaded config from ${this.configPath}`);
    } catch (_error) {
      logger.info('Using default configuration');
    }
    
    return this.config;
  }
  async saveConfig(config?: Partial<PromptConfig>): Promise<void> {
    if (config) {
      this.config = this.mergeConfig(this._config, config);
    }
    
    await fs.writeFile(this._configPath, JSON.stringify(this._config, null, 2));
    logger.info(`Saved config to ${this.configPath}`);
  }
  getConfig(): PromptConfig {
    return this.config;
  }
  getProfile(profileName: string): PromptConfig['defaultOptions'] {
    const _profile = this.config.profiles[profileName];
    if (!profile) {
      throw new Error(`Profile '${profileName}' not found`);
    }
    
    return { ...this.config.defaultOptions, ...profile };
  }
  listProfiles(): string[] {
    return Object.keys(this.config.profiles);
  }
  private mergeConfig(base: _PromptConfig, override: Partial<PromptConfig>): PromptConfig {
    return {
      ...base,
      ...override,
      defaultOptions: {
        ...base.defaultOptions,
        ...override.defaultOptions
      },
      profiles: {
        ...base.profiles,
        ...override.profiles
      }
    };
  }
}
export class PromptPathResolver {
  private basePath: string;
  constructor(basePath: string = process.cwd()) {
    this.basePath = basePath;
  }
  resolvePaths(sourceDirectories: string[], destinationDirectory: string): {
    sources: string[];
    destination: string;
  } {
    const _sources = sourceDirectories
      .map(dir => path.resolve(this._basePath, dir))
      .filter(dir => this.directoryExists(dir));
    
    const _destination = path.resolve(this._basePath, destinationDirectory);
    
    return { sources, destination };
  }
  private directoryExists(dirPath: string): boolean {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const _stats = require('fs').statSync(dirPath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }
  // Discover prompt directories automatically
  async discoverPromptDirectories(): Promise<string[]> {
    const _candidates = [
      '.roo',
      '.claude',
      'prompts',
      'templates',
      'src/prompts',
      'src/templates',
      'docs/prompts',
      'scripts/prompts'
    ];
    
    const _discovered: string[] = [];
    
    for (const candidate of candidates) {
      const _fullPath = path.resolve(this._basePath, candidate);
      if (await this.containsPromptFiles(fullPath)) {
        discovered.push(fullPath);
      }
    }
    
    return discovered;
  }
  private async containsPromptFiles(dirPath: string): Promise<boolean> {
    try {
      const _entries = await fs.readdir(_dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isFile()) {
          const _fileName = entry.name.toLowerCase();
          if (fileName.endsWith('.md') || 
              fileName.endsWith('.txt') || 
              fileName.endsWith('.prompt') ||
              fileName.includes('prompt') ||
              fileName.includes('template')) {
            return true;
          }
        } else if (entry.isDirectory()) {
          const _subPath = path.join(_dirPath, entry.name);
          if (await this.containsPromptFiles(subPath)) {
            return true;
          }
        }
      }
      
      return false;
    } catch {
      return false;
    }
  }
}
export class PromptValidator {
  static async validatePromptFile(filePath: string): Promise<{
    valid: boolean;
    issues: string[];
    metadata?: unknown;
  }> {
    const _issues: string[] = [];
    let _metadata: unknown = { /* empty */ };
    
    try {
      const _content = await fs.readFile(_filePath, 'utf-8');
      
      // Check for empty files
      if (content.trim().length === 0) {
        issues.push('File is empty');
      }
      
      // Check for common prompt markers
      const _hasPromptMarkers = [
        '# ', '## ', '### ',  // Markdown headers
        'You are', 'Your task', 'Please',  // Common prompt starters
        '```', '`',  // Code blocks
        '{{', '}}',  // Template variables
      ].some(marker => content.includes(marker));
      
      if (!hasPromptMarkers) {
        issues.push('File may not contain valid prompt content');
      }
      
      // Extract metadata from front matter
      const _frontMatterMatch = content.match(/^---\n([sS]*?\n)---/);
      if (frontMatterMatch) {
        try {
          metadata = this.parseFrontMatter(frontMatterMatch[1]);
        } catch (_error) {
          issues.push('Invalid front matter format');
        }
      }
      
      // Check file size (warn if too large)
      const _stats = await fs.stat(filePath);
      if (stats.size > 100 * 1024) { // 100KB
        issues.push('File is unusually large for a prompt');
      }
      
      return {
        valid: issues.length === 0,
        issues,
        metadata
      };
      
    } catch (_error) {
      return {
        valid: false,
        issues: [`Failed to read file: ${(error instanceof Error ? error.message : String(error))}`]
      };
    }
  }
  private static parseFrontMatter(frontMatter: string): unknown {
    // Simple YAML-like parser for basic key-value pairs
    const _metadata: unknown = { /* empty */ };
    const _lines = frontMatter.split('\n');
    
    for (const line of lines) {
      const _match = line.match(/^(w+):s*(.+)$/);
      if (match) {
        const [, key, value] = match;
        metadata[key] = value.trim();
      }
    }
    
    return metadata;
  }
}
export function createProgressBar(total: number): {
  update: (current: number) => void;
  complete: () => void;
} {
  const _barLength = 40;
  
  return {
    update: (current: number) => {
      const _percentage = Math.round((current / total) * 100);
      const _filledLength = Math.round((current / total) * barLength);
      const _bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);
      
      process.stdout.write(`\r[${bar}] ${percentage}% (${current}/${total})`);
    },
    
    complete: () => {
      process.stdout.write('\n');
    }
  };
}
// Utility function to format file sizes
export function formatFileSize(bytes: number): string {
  const _units = ['B', 'KB', 'MB', 'GB'];
  let _size = bytes;
  let _unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}
// Utility function to format duration
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}