import { getErrorMessage as _getErrorMessage } from '../utils/error-handler.js';
/**
 * Enterprise Configuration Management for Claude-Flow
 * Features: Security masking, change tracking, multi-format support, credential management
 */
import { promises as fs } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { createHash, randomBytes, createCipheriv, createDecipheriv } from 'crypto';
import { deepMerge, safeParseJSON } from '../utils/helpers.js';
import { ConfigError, ValidationError } from '../utils/errors.js';
// Format parsers
interface FormatParser {
  parse(content: string): unknown;
  stringify(obj: Record<string, unknown>): string;
  extension: string;
}
// Configuration change record
interface ConfigChange {
  timestamp: string;
  path: string;
  oldValue: unknown;
  newValue: unknown;
  user?: string;
  reason?: string;
  source: 'cli' | 'api' | 'file' | 'env';
}
// Security classification
interface SecurityClassification {
  level: 'public' | 'internal' | 'confidential' | 'secret';
  maskPattern?: string;
  encrypted?: boolean;
}
// Validation rule
interface ValidationRule {
  type: string;
  required?: boolean;
  min?: number;
  max?: number;
  values?: string[];
  pattern?: RegExp;
  validator?: (value: _any, config: Config) => string | null;
  dependencies?: string[];
}
/**
 * Security classifications for configuration paths
 */
const _SECURITY_CLASSIFICATIONS: Record<string, SecurityClassification> = {
  'credentials': { level: 'secret', encrypted: true },
  'credentials.apiKey': { level: 'secret', maskPattern: '****...****', encrypted: true },
  'credentials.token': { level: 'secret', maskPattern: '****...****', encrypted: true },
  'credentials.password': { level: 'secret', maskPattern: '********', encrypted: true },
  'mcp.apiKey': { level: 'confidential', maskPattern: '****...****' },
  'logging.destination': { level: 'internal' },
  'orchestrator': { level: 'internal' },
  'terminal': { level: 'public' },
};
/**
 * Sensitive configuration paths that should be masked in output
 */
const _SENSITIVE_PATHS = [
  'credentials',
  'apiKey',
  'token',
  'password',
  'secret',
  'key',
  'auth',
];
/**
 * Format parsers for different configuration file types
 */
const _FORMAT_PARSERS: Record<string, FormatParser> = {
  json: {
    parse: JSON.parse,
    stringify: (obj) => JSON.stringify(_obj, null, 2),
    extension: '.json'
  },
  yaml: {
    parse: (content) => {
      // Simple YAML parser for basic key-value pairs
      const _lines = content.split('\n');
      const _result: unknown = { /* empty */ };
      const _current = result;
      const _stack: unknown[] = [result];
      
      for (const line of lines) {
        const _trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        
        const _indent = line.length - line.trimStart().length;
        const _colonIndex = trimmed.indexOf(':');
        
        if (colonIndex === -1) continue;
        
        const _key = trimmed.substring(_0, colonIndex).trim();
        const _value = trimmed.substring(colonIndex + 1).trim();
        
        // Simple value parsing
        let _parsedValue: unknown = value;
        if (value === 'true') parsedValue = true;
        else if (value === 'false') parsedValue = false;
        else if (!isNaN(Number(value)) && value !== '') parsedValue = Number(value);
        else if (value.startsWith('"') && value.endsWith('"')) {
          parsedValue = value.slice(_1, -1);
        }
        
        current[key] = parsedValue;
      }
      
      return result;
    },
    stringify: (obj) => {
      const stringify = (obj: Record<string, unknown>, indent = 0): string => {
        const _spaces = '  '.repeat(indent);
        let _result = '';
        
        for (const [_key, value] of Object.entries(obj)) {
          if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            result += `${spaces}${key}:\n${stringify(_value, indent + 1)}`;
          } else {
            const _formattedValue = typeof value === 'string' ? `"${value}"` : String(value);
            result += `${spaces}${key}: ${formattedValue}\n`;
          }
        }
        
        return result;
      };
      
      return stringify(obj);
    },
    extension: '.yaml'
  },
  toml: {
    parse: (content) => {
      // Simple TOML parser for basic sections and key-value pairs
      const _lines = content.split('\n');
      const _result: unknown = { /* empty */ };
      let _currentSection = result;
      
      for (const line of lines) {
        const _trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        
        // Section header
        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
          const _sectionName = trimmed.slice(_1, -1);
          currentSection = result[sectionName] = { /* empty */ };
          continue;
        }
        
        // Key-value pair
        const _equalsIndex = trimmed.indexOf('=');
        if (equalsIndex === -1) continue;
        
        const _key = trimmed.substring(_0, equalsIndex).trim();
        const _value = trimmed.substring(equalsIndex + 1).trim();
        
        // Simple value parsing
        let _parsedValue: unknown = value;
        if (value === 'true') parsedValue = true;
        else if (value === 'false') parsedValue = false;
        else if (!isNaN(Number(value)) && value !== '') parsedValue = Number(value);
        else if (value.startsWith('"') && value.endsWith('"')) {
          parsedValue = value.slice(_1, -1);
        }
        
        currentSection[key] = parsedValue;
      }
      
      return result;
    },
    stringify: (obj) => {
      let _result = '';
      
      for (const [_section, values] of Object.entries(obj)) {
        if (typeof values === 'object' && values !== null && !Array.isArray(values)) {
          result += `[${section}]\n`;
          for (const [_key, value] of Object.entries(values)) {
            const _formattedValue = typeof value === 'string' ? `"${value}"` : String(value);
            result += `${key} = ${formattedValue}\n`;
          }
          result += '\n';
        }
      }
      
      return result;
    },
    extension: '.toml'
  }
};
/**
 * Default configuration values
 */
const _DEFAULT_CONFIG: Config = {
  orchestrator: {
    maxConcurrentAgents: 10,
    taskQueueSize: 100,
    healthCheckInterval: 30000, // 30 seconds
    shutdownTimeout: 30000, // 30 seconds
  },
  terminal: {
    type: 'auto',
    poolSize: 5,
    recycleAfter: 10, // recycle after 10 uses
    healthCheckInterval: 60000, // 1 minute
    commandTimeout: 300000, // 5 minutes
  },
  memory: {
    backend: 'hybrid',
    cacheSizeMB: 100,
    syncInterval: 5000, // 5 seconds
    conflictResolution: 'crdt',
    retentionDays: 30,
  },
  coordination: {
    maxRetries: 3,
    retryDelay: 1000, // 1 second
    deadlockDetection: true,
    resourceTimeout: 60000, // 1 minute
    messageTimeout: 30000, // 30 seconds
  },
  mcp: {
    transport: 'stdio',
    port: 3000,
    tlsEnabled: false,
  },
  logging: {
    level: 'info',
    format: 'json',
    destination: 'console',
  },
  credentials: {
    // Encrypted credentials storage
  },
  security: {
    encryptionEnabled: true,
    auditLogging: true,
    maskSensitiveValues: true,
    allowEnvironmentOverrides: true,
  },
};
/**
 * Configuration manager
 */
export class ConfigManager {
  private static instance: ConfigManager;
  private config: Config;
  private configPath?: string;
  private profiles: Map<string, Partial<Config>> = new Map();
  private currentProfile?: string;
  private userConfigDir: string;
  private changeHistory: ConfigChange[] = [];
  private encryptionKey?: Buffer;
  private validationRules: Map<string, ValidationRule> = new Map();
  private formatParsers = FORMAT_PARSERS;
  private constructor() {
    this.config = deepClone(DEFAULT_CONFIG);
    this.userConfigDir = this.getUserConfigDir();
    this.setupValidationRules();
    // Encryption will be initialized via init() method
  }
  /**
   * Gets the singleton instance
   */
  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }
  /**
   * Initialize async components
   */
  async init(): Promise<void> {
    await this.initializeEncryption();
  }
  /**
   * Initializes encryption for sensitive configuration values
   */
  private async initializeEncryption(): Promise<void> {
    try {
      const _keyFile = join(this._userConfigDir, '.encryption-key');
      // Check if key file exists (simplified for demo)
      try {
        await fs.access(keyFile);
        // In a real implementation, this would be more secure
        this.encryptionKey = randomBytes(32);
      } catch {
        this.encryptionKey = randomBytes(32);
        // Store key securely (in _production, use proper key management)
      }
    } catch (_error) {
      console.warn('Failed to initialize encryption:', (error as Error).message);
    }
  }
  /**
   * Sets up validation rules for configuration paths
   */
  private setupValidationRules(): void {
    // Orchestrator validation rules
    this.validationRules.set('orchestrator.maxConcurrentAgents', {
      type: 'number',
      required: true,
      min: 1,
      max: 100,
      validator: (_value, config) => {
        if (value > config.terminal?.poolSize * 2) {
          return 'maxConcurrentAgents should not exceed 2x terminal pool size';
        }
        return null;
      }
    });
    this.validationRules.set('orchestrator.taskQueueSize', {
      type: 'number',
      required: true,
      min: 1,
      max: 10000,
      dependencies: ['orchestrator.maxConcurrentAgents'],
      validator: (_value, config) => {
        const _maxAgents = config.orchestrator?.maxConcurrentAgents || 1;
        if (value < maxAgents * 10) {
          return 'taskQueueSize should be at least 10x maxConcurrentAgents';
        }
        return null;
      }
    });
    // Terminal validation rules
    this.validationRules.set('terminal.type', {
      type: 'string',
      required: true,
      values: ['auto', 'vscode', 'native']
    });
    this.validationRules.set('terminal.poolSize', {
      type: 'number',
      required: true,
      min: 1,
      max: 50
    });
    // Memory validation rules
    this.validationRules.set('memory.backend', {
      type: 'string',
      required: true,
      values: ['sqlite', 'markdown', 'hybrid']
    });
    this.validationRules.set('memory.cacheSizeMB', {
      type: 'number',
      required: true,
      min: 1,
      max: 10000,
      validator: (value) => {
        if (value > 1000) {
          return 'Large cache sizes may impact system performance';
        }
        return null;
      }
    });
    // Security validation rules
    this.validationRules.set('security.encryptionEnabled', {
      type: 'boolean',
      required: true
    });
    // Credentials validation
    this.validationRules.set('credentials.apiKey', {
      type: 'string',
      pattern: /^[a-zA-Z0-9_-]+$/,
      validator: (value) => {
        if (value && value.length < 16) {
          return 'API key should be at least 16 characters long';
        }
        return null;
      }
    });
  }
  /**
   * Loads configuration from various sources
   */
  async load(configPath?: string): Promise<Config> {
    if (configPath !== undefined) {
      this.configPath = configPath;
    }
    // Start with defaults
    let _config = deepClone(DEFAULT_CONFIG);
    // Load from file if specified
    if (configPath) {
      const _fileConfig = await this.loadFromFile(configPath);
      config = deepMergeConfig(_config, fileConfig);
    }
    // Load from environment variables
    const _envConfig = this.loadFromEnv();
    config = deepMergeConfig(_config, envConfig);
    // Validate the final configuration
    this.validate(config);
    this.config = config;
    return config;
  }
  /**
   * Gets the current configuration with optional security masking
   */
  get(maskSensitive = false): Config {
    const _config = deepClone(this.config);
    
    if (maskSensitive && this.config.security?.maskSensitiveValues) {
      return this.maskSensitiveValues(config);
    }
    
    return config;
  }
  /**
   * Gets configuration with security masking applied
   */
  getSecure(): Config {
    return this.get(true);
  }
  /**
   * Gets all configuration values (alias for get method for backward compatibility)
   */
  async getAll(): Promise<Config> {
    return this.get();
  }
  /**
   * Updates configuration values with change tracking
   */
  update(updates: Partial<Config>, options: { user?: string, reason?: string, source?: 'cli' | 'api' | 'file' | 'env' } = { /* empty */ }): Config {
    const _oldConfig = deepClone(this.config);
    
    // Track changes before applying
    this.trackChanges(_oldConfig, _updates, options);
    
    // Apply updates
    this.config = deepMergeConfig(this._config, updates);
    
    // Validate the updated configuration
    this.validateWithDependencies(this.config);
    
    return this.get();
  }
  /**
   * Loads default configuration
   */
  loadDefault(): void {
    this.config = deepClone(DEFAULT_CONFIG);
  }
  /**
   * Saves configuration to file with format support
   */
  async save(path?: string, format?: string): Promise<void> {
    const _savePath = path || this.configPath;
    if (!savePath) {
      throw new ConfigError('No configuration file path specified');
    }
    const _detectedFormat = format || this.detectFormat(savePath);
    const _parser = this.formatParsers[detectedFormat];
    
    if (!parser) {
      throw new ConfigError(`Unsupported format for saving: ${detectedFormat}`);
    }
    
    // Get configuration without sensitive values for saving
    const _configToSave = this.getConfigForSaving();
    const _content = parser.stringify(configToSave);
    
    await fs.writeFile(_savePath, _content, 'utf8');
    
    // Record the save operation
    this.recordChange({
      timestamp: new Date().toISOString(),
      path: 'CONFIG_SAVED',
      oldValue: null,
      newValue: savePath,
      source: 'file'
    });
  }
  
  /**
   * Gets configuration suitable for saving (excludes runtime-only values)
   */
  private getConfigForSaving(): Partial<Config> {
    const _config = deepClone(this.config);
    
    // Remove encrypted credentials from the saved config
    // They should be stored separately in a secure location
    if (config.credentials) {
      delete config.credentials;
    }
    
    return config;
  }
  /**
   * Gets user configuration directory
   */
  private getUserConfigDir(): string {
    const _home = homedir();
    return join(_home, '.claude-flow');
  }
  /**
   * Creates user config directory if it doesn't exist
   */
  private async ensureUserConfigDir(): Promise<void> {
    try {
      await fs.mkdir(this._userConfigDir, { recursive: true });
    } catch (_error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw new ConfigError(`Failed to create config directory: ${(error as Error).message}`);
      }
    }
  }
  /**
   * Loads all profiles from the profiles directory
   */
  async loadProfiles(): Promise<void> {
    const _profilesDir = join(this._userConfigDir, 'profiles');
    
    try {
      const _entries = await fs.readdir(_profilesDir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.json')) {
          const _profileName = entry.name.replace('.json', '');
          const _profilePath = join(_profilesDir, entry.name);
          
          try {
            const _content = await fs.readFile(_profilePath, 'utf8');
            const _profileConfig = safeParseJSON<Partial<Config>>(content);
            
            if (profileConfig) {
              this.profiles.set(_profileName, profileConfig);
            }
          } catch (_error) {
            console.warn(`Failed to load profile ${profileName}: ${(error as Error).message}`);
          }
        }
      }
    } catch (_error) {
      // Profiles directory doesn't exist - this is okay
    }
  }
  /**
   * Applies a named profile
   */
  async applyProfile(profileName: string): Promise<void> {
    await this.loadProfiles();
    
    const _profile = this.profiles.get(profileName);
    if (!profile) {
      throw new ConfigError(`Profile '${profileName}' not found`);
    }
    this.config = deepMergeConfig(this._config, profile);
    this.currentProfile = profileName;
    this.validate(this.config);
  }
  /**
   * Saves current configuration as a profile
   */
  async saveProfile(profileName: string, config?: Partial<Config>): Promise<void> {
    await this.ensureUserConfigDir();
    
    const _profilesDir = join(this._userConfigDir, 'profiles');
    await fs.mkdir(_profilesDir, { recursive: true });
    
    const _profileConfig = config || this.config;
    const _profilePath = join(_profilesDir, `${profileName}.json`);
    
    const _content = JSON.stringify(_profileConfig, null, 2);
    await fs.writeFile(_profilePath, _content, 'utf8');
    
    this.profiles.set(_profileName, profileConfig);
  }
  /**
   * Deletes a profile
   */
  async deleteProfile(profileName: string): Promise<void> {
    const _profilePath = join(this._userConfigDir, 'profiles', `${profileName}.json`);
    
    try {
      await fs.unlink(profilePath);
      this.profiles.delete(profileName);
    } catch (_error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new ConfigError(`Profile '${profileName}' not found`);
      }
      throw new ConfigError(`Failed to delete profile: ${(error as Error).message}`);
    }
  }
  /**
   * Lists all available profiles
   */
  async listProfiles(): Promise<string[]> {
    await this.loadProfiles();
    return Array.from(this.profiles.keys());
  }
  /**
   * Gets a specific profile configuration
   */
  async getProfile(profileName: string): Promise<Partial<Config> | undefined> {
    await this.loadProfiles();
    return this.profiles.get(profileName);
  }
  /**
   * Gets the current active profile name
   */
  getCurrentProfile(): string | undefined {
    return this.currentProfile;
  }
  /**
   * Sets a configuration value by path with change tracking and validation
   */
  set(path: string, value: _any, options: { user?: string, reason?: string, source?: 'cli' | 'api' | 'file' | 'env' } = { /* empty */ }): void {
    const _oldValue = this.getValue(path);
    
    // Record the change
    this.recordChange({
      timestamp: new Date().toISOString(),
      path,
      oldValue,
      newValue: value,
      user: options.user,
      reason: options.reason,
      source: options.source || 'cli'
    });
    
    // Encrypt sensitive values
    if (this.isSensitivePath(path) && this.config.security?.encryptionEnabled) {
      value = this.encryptValue(value);
    }
    
    const _keys = path.split('.');
    let _current: unknown = this.config;
    
    for (let _i = 0; i < keys.length - 1; i++) {
      const _key = keys[i];
      if (!(key in current)) {
        current[key] = { /* empty */ };
      }
      current = current[key];
    }
    
    current[keys[keys.length - 1]] = value;
    
    // Validate the path-specific rule and dependencies
    this.validatePath(_path, value);
    this.validateWithDependencies(this.config);
  }
  /**
   * Gets a configuration value by path with decryption for sensitive values
   */
  getValue(path: string, decrypt = true): unknown {
    const _keys = path.split('.');
    let _current: unknown = this.config;
    
    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        return undefined;
      }
    }
    
    // Decrypt sensitive values if requested
    if (decrypt && this.isSensitivePath(path) && this.isEncryptedValue(current)) {
      try {
        return this.decryptValue(current);
      } catch (_error) {
        console.warn(`Failed to decrypt value at path ${path}:`, (error as Error).message);
        return current;
      }
    }
    
    return current;
  }
  /**
   * Resets configuration to defaults
   */
  reset(): void {
    this.config = deepClone(DEFAULT_CONFIG);
    delete this.currentProfile;
  }
  /**
   * Gets configuration schema for validation
   */
  getSchema(): unknown {
    return {
      orchestrator: {
        maxConcurrentAgents: { type: 'number', min: 1, max: 100 },
        taskQueueSize: { type: 'number', min: 1, max: 10000 },
        healthCheckInterval: { type: 'number', min: 1000, max: 300000 },
        shutdownTimeout: { type: 'number', min: 1000, max: 300000 },
      },
      terminal: {
        type: { type: 'string', values: ['auto', 'vscode', 'native'] },
        poolSize: { type: 'number', min: 1, max: 50 },
        recycleAfter: { type: 'number', min: 1, max: 1000 },
        healthCheckInterval: { type: 'number', min: 1000, max: 3600000 },
        commandTimeout: { type: 'number', min: 1000, max: 3600000 },
      },
      memory: {
        backend: { type: 'string', values: ['sqlite', 'markdown', 'hybrid'] },
        cacheSizeMB: { type: 'number', min: 1, max: 10000 },
        syncInterval: { type: 'number', min: 1000, max: 300000 },
        conflictResolution: { type: 'string', values: ['crdt', 'timestamp', 'manual'] },
        retentionDays: { type: 'number', min: 1, max: 3650 },
      },
      coordination: {
        maxRetries: { type: 'number', min: 0, max: 100 },
        retryDelay: { type: 'number', min: 100, max: 60000 },
        deadlockDetection: { type: 'boolean' },
        resourceTimeout: { type: 'number', min: 1000, max: 3600000 },
        messageTimeout: { type: 'number', min: 1000, max: 300000 },
      },
      mcp: {
        transport: { type: 'string', values: ['stdio', 'http', 'websocket'] },
        port: { type: 'number', min: 1, max: 65535 },
        tlsEnabled: { type: 'boolean' },
      },
      logging: {
        level: { type: 'string', values: ['debug', 'info', 'warn', 'error'] },
        format: { type: 'string', values: ['json', 'text'] },
        destination: { type: 'string', values: ['console', 'file'] },
      },
    };
  }
  /**
   * Validates a value against schema
   */
  private validateValue(value: _any, schema: _any, path: string): void {
    if (schema.type === 'number') {
      if (typeof value !== 'number' || isNaN(value)) {
        throw new ValidationError(`${path}: must be a number`);
      }
      if (schema.min !== undefined && value < schema.min) {
        throw new ValidationError(`${path}: must be at least ${schema.min}`);
      }
      if (schema.max !== undefined && value > schema.max) {
        throw new ValidationError(`${path}: must be at most ${schema.max}`);
      }
    } else if (schema.type === 'string') {
      if (typeof value !== 'string') {
        throw new ValidationError(`${path}: must be a string`);
      }
      if (schema.values && !schema.values.includes(value)) {
        throw new ValidationError(`${path}: must be one of [${schema.values.join(', ')}]`);
      }
    } else if (schema.type === 'boolean') {
      if (typeof value !== 'boolean') {
        throw new ValidationError(`${path}: must be a boolean`);
      }
    }
  }
  /**
   * Gets configuration diff between current and default
   */
  getDiff(): unknown {
    const _defaultConfig = DEFAULT_CONFIG;
    const _diff: unknown = { /* empty */ };
    
    const _findDifferences = (current: _any, defaults: _any, path: string = '') => {
      for (const key in current) {
        const _currentValue = current[key];
        const _defaultValue = defaults[key];
        const _fullPath = path ? `${path}.${key}` : key;
        
        if (typeof currentValue === 'object' && currentValue !== null && !Array.isArray(currentValue)) {
          if (typeof defaultValue === 'object' && defaultValue !== null) {
            const _nestedDiff = { /* empty */ };
            findDifferences(_currentValue, _defaultValue, fullPath);
            if (Object.keys(nestedDiff).length > 0) {
              if (!path) {
                diff[key] = nestedDiff;
              }
            }
          }
        } else if (currentValue !== defaultValue) {
          const _pathParts = fullPath.split('.');
          let _target = diff;
          for (let _i = 0; i < pathParts.length - 1; i++) {
            if (!target[pathParts[i]]) {
              target[pathParts[i]] = { /* empty */ };
            }
            target = target[pathParts[i]];
          }
          target[pathParts[pathParts.length - 1]] = currentValue;
        }
      }
    };
    
    findDifferences(this._config, defaultConfig);
    return diff;
  }
  /**
   * Exports configuration with metadata
   */
  export(): unknown {
    return {
      version: '1.0.0',
      exported: new Date().toISOString(),
      profile: this.currentProfile,
      config: this.config,
      diff: this.getDiff(),
    };
  }
  /**
   * Imports configuration from export
   */
  import(data: unknown): void {
    if (!data.config) {
      throw new ConfigError('Invalid configuration export format');
    }
    
    this.validateWithDependencies(data.config);
    this.config = data.config;
    this.currentProfile = data.profile;
    
    // Record the import operation
    this.recordChange({
      timestamp: new Date().toISOString(),
      path: 'CONFIG_IMPORTED',
      oldValue: null,
      newValue: data.version || 'unknown',
      source: 'file'
    });
  }
  /**
   * Loads configuration from file with format detection
   */
  private async loadFromFile(path: string): Promise<Partial<Config>> {
    try {
      const _content = await fs.readFile(_path, 'utf8');
      const _format = this.detectFormat(_path, content);
      const _parser = this.formatParsers[format];
      
      if (!parser) {
        throw new ConfigError(`Unsupported configuration format: ${format}`);
      }
      
      const _config = parser.parse(content) as Partial<Config>;
      
      if (!config) {
        throw new ConfigError(`Invalid ${format.toUpperCase()} in configuration file: ${path}`);
      }
      return config;
    } catch (_error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // File doesn't exist, use defaults
        return { /* empty */ };
      }
      throw new ConfigError(`Failed to load configuration from ${path}: ${(error as Error).message}`);
    }
  }
  
  /**
   * Detects configuration file format
   */
  private detectFormat(path: string, content?: string): string {
    const _ext = path.split('.').pop()?.toLowerCase();
    
    if (ext === 'yaml' || ext === 'yml') return 'yaml';
    if (ext === 'toml') return 'toml';
    if (ext === 'json') return 'json';
    
    // Try to detect from content
    if (content) {
      const _trimmed = content.trim();
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) return 'json';
      if (trimmed.includes('=') && trimmed.includes('[')) return 'toml';
      if (trimmed.includes(':') && !trimmed.includes('=')) return 'yaml';
    }
    
    // Default to JSON
    return 'json';
  }
  /**
   * Loads configuration from environment variables
   */
  private loadFromEnv(): Partial<Config> {
    const _config: Partial<Config> = { /* empty */ };
    // Orchestrator settings
    const _maxAgents = process.env.CLAUDE_FLOW_MAX_AGENTS;
    if (maxAgents) {
      if (!config.orchestrator) {
        config.orchestrator = { /* empty */ } as unknown;
      }
      config.orchestrator = {
        ...DEFAULT_CONFIG.orchestrator,
        ...config.orchestrator,
        maxConcurrentAgents: parseInt(_maxAgents, 10),
      };
    }
    // Terminal settings
    const _terminalType = process.env.CLAUDE_FLOW_TERMINAL_TYPE;
    if (terminalType === 'vscode' || terminalType === 'native' || terminalType === 'auto') {
      config.terminal = {
        ...DEFAULT_CONFIG.terminal,
        ...config.terminal,
        type: terminalType,
      };
    }
    // Memory settings
    const _memoryBackend = process.env.CLAUDE_FLOW_MEMORY_BACKEND;
    if (memoryBackend === 'sqlite' || memoryBackend === 'markdown' || memoryBackend === 'hybrid') {
      config.memory = {
        ...DEFAULT_CONFIG.memory,
        ...config.memory,
        backend: memoryBackend,
      };
    }
    // MCP settings
    const _mcpTransport = process.env.CLAUDE_FLOW_MCP_TRANSPORT;
    if (mcpTransport === 'stdio' || mcpTransport === 'http' || mcpTransport === 'websocket') {
      config.mcp = {
        ...DEFAULT_CONFIG.mcp,
        ...config.mcp,
        transport: mcpTransport,
      };
    }
    const _mcpPort = process.env.CLAUDE_FLOW_MCP_PORT;
    if (mcpPort) {
      config.mcp = {
        ...DEFAULT_CONFIG.mcp,
        ...config.mcp,
        port: parseInt(_mcpPort, 10),
      };
    }
    // Logging settings
    const _logLevel = process.env.CLAUDE_FLOW_LOG_LEVEL;
    if (logLevel === 'debug' || logLevel === 'info' || logLevel === 'warn' || logLevel === 'error') {
      config.logging = {
        ...DEFAULT_CONFIG.logging,
        ...config.logging,
        level: logLevel,
      };
    }
    return config;
  }
  /**
   * Validates configuration with dependency checking
   */
  private validateWithDependencies(config: Config): void {
    const _errors: string[] = [];
    const _warnings: string[] = [];
    
    // Validate all paths with rules
    for (const [_path, rule] of this.validationRules.entries()) {
      const _value = this.getValueByPath(_config, path);
      
      try {
        this.validatePath(_path, _value, config);
      } catch (_error) {
        errors.push((error as Error).message);
      }
    }
    
    // Additional cross-field validations
    if (config.orchestrator.maxConcurrentAgents > config.terminal.poolSize * 3) {
      warnings.push('High agent-to-terminal ratio may cause resource contention');
    }
    
    if (config.memory.cacheSizeMB > 1000 && config.memory.backend === 'sqlite') {
      warnings.push('Large cache size with SQLite backend may impact performance');
    }
    
    if (config.mcp.transport === 'http' && !config.mcp.tlsEnabled) {
      warnings.push('HTTP transport without TLS is not recommended for production');
    }
    
    // Log warnings
    if (warnings.length > 0 && config.logging?.level === 'debug') {
      console.warn('Configuration warnings:', warnings);
    }
    
    // Throw errors
    if (errors.length > 0) {
      throw new ValidationError(`Configuration validation failed:\n${errors.join('\n')}`);
    }
  }
  
  /**
   * Validates a specific configuration path
   */
  private validatePath(path: string, value: _any, config?: Config): void {
    const _rule = this.validationRules.get(path);
    if (!rule) return;
    
    const _currentConfig = config || this.config;
    
    // Required validation
    if (rule.required && (value === undefined || value === null)) {
      throw new ValidationError(`${path} is required`);
    }
    
    if (value === undefined || value === null) return;
    
    // Type validation
    if (rule.type === 'number' && (typeof value !== 'number' || isNaN(value))) {
      throw new ValidationError(`${path} must be a number`);
    }
    
    if (rule.type === 'string' && typeof value !== 'string') {
      throw new ValidationError(`${path} must be a string`);
    }
    
    if (rule.type === 'boolean' && typeof value !== 'boolean') {
      throw new ValidationError(`${path} must be a boolean`);
    }
    
    // Range validation
    if (typeof value === 'number') {
      if (rule.min !== undefined && value < rule.min) {
        throw new ValidationError(`${path} must be at least ${rule.min}`);
      }
      if (rule.max !== undefined && value > rule.max) {
        throw new ValidationError(`${path} must be at most ${rule.max}`);
      }
    }
    
    // Values validation
    if (rule.values && !rule.values.includes(value)) {
      throw new ValidationError(`${path} must be one of: ${rule.values.join(', ')}`);
    }
    
    // Pattern validation
    if (rule.pattern && typeof value === 'string' && !rule.pattern.test(value)) {
      throw new ValidationError(`${path} does not match required pattern`);
    }
    
    // Custom validator
    if (rule.validator) {
      const _result = rule.validator(_value, currentConfig);
      if (result) {
        throw new ValidationError(`${path}: ${result}`);
      }
    }
  }
  
  /**
   * Gets a value from a configuration object by path
   */
  private getValueByPath(obj: Record<string, unknown>, path: string): unknown {
    const _keys = path.split('.');
    let _current = obj;
    
    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        return undefined;
      }
    }
    
    return current;
  }
  
  /**
   * Legacy validate method for backward compatibility
   */
  private validate(config: Config): void {
    this.validateWithDependencies(config);
  }
  /**
   * Masks sensitive values in configuration
   */
  private maskSensitiveValues(config: Config): Config {
    const _maskedConfig = deepClone(config);
    
    // Recursively mask sensitive paths
    const _maskObject = (obj: Record<string, unknown>, path: string = ''): unknown => {
      if (!obj || typeof obj !== 'object') return obj;
      
      const _masked: unknown = { /* empty */ };
      for (const [_key, value] of Object.entries(obj)) {
        const _currentPath = path ? `${path}.${key}` : key;
        
        if (this.isSensitivePath(currentPath)) {
          const _classification = SECURITY_CLASSIFICATIONS[currentPath];
          masked[key] = classification?.maskPattern || '****';
        } else if (typeof value === 'object' && value !== null) {
          masked[key] = maskObject(_value, currentPath);
        } else {
          masked[key] = value;
        }
      }
      return masked;
    };
    
    return maskObject(maskedConfig);
  }
  /**
   * Tracks changes to configuration
   */
  private trackChanges(oldConfig: _Config, updates: Partial<Config>, options: { user?: string, reason?: string, source?: 'cli' | 'api' | 'file' | 'env' }): void {
    // Simple implementation for tracking changes
    for (const [_key, value] of Object.entries(updates)) {
      this.recordChange({
        timestamp: new Date().toISOString(),
        path: key,
        oldValue: (oldConfig as unknown)[key],
        newValue: value,
        user: options.user,
        reason: options.reason,
        source: options.source || 'cli'
      });
    }
  }
  /**
   * Records a configuration change
   */
  private recordChange(change: ConfigChange): void {
    this.changeHistory.push(change);
    
    // Keep only last 1000 changes
    if (this.changeHistory.length > 1000) {
      this.changeHistory.shift();
    }
  }
  /**
   * Checks if a path contains sensitive information
   */
  private isSensitivePath(path: string): boolean {
    return SENSITIVE_PATHS.some(sensitive => 
      path.toLowerCase().includes(sensitive.toLowerCase())
    );
  }
  /**
   * Encrypts a sensitive value
   */
  private encryptValue(value: unknown): string {
    if (!this.encryptionKey) {
      return value; // Return original if encryption not available
    }
    
    try {
      // Simplified encryption - in production use proper encryption
      const _iv = randomBytes(16);
      const _key = createHash('sha256').update(this.encryptionKey).digest();
      const _cipher = createCipheriv('aes-256-cbc', _key, iv);
      let _encrypted = cipher.update(JSON.stringify(value), 'utf8', 'hex');
      encrypted += cipher.final('hex');
      return `encrypted:${iv.toString('hex')}:${encrypted}`;
    } catch (_error) {
      console.warn('Failed to encrypt value:', (error as Error).message);
      return value;
    }
  }
  /**
   * Decrypts a sensitive value
   */
  private decryptValue(encryptedValue: string): unknown {
    if (!this.encryptionKey || !this.isEncryptedValue(encryptedValue)) {
      return encryptedValue;
    }
    
    try {
      const _parts = encryptedValue.replace('encrypted:', '').split(':');
      if (parts.length !== 2) return encryptedValue; // Handle old format
      const _iv = Buffer.from(parts[0], 'hex');
      const _encrypted = parts[1];
      const _key = createHash('sha256').update(this.encryptionKey).digest();
      const _decipher = createDecipheriv('aes-256-cbc', _key, iv);
      let _decrypted = decipher.update(_encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return JSON.parse(decrypted);
    } catch (_error) {
      console.warn('Failed to decrypt value:', (error as Error).message);
      return encryptedValue;
    }
  }
  /**
   * Checks if a value is encrypted
   */
  private isEncryptedValue(value: unknown): boolean {
    return typeof value === 'string' && value.startsWith('encrypted:');
  }
}
// Export singleton instance
export const _configManager = ConfigManager.getInstance();
// Helper function to load configuration
export async function loadConfig(path?: string): Promise<Config> {
  return await configManager.load(path);
}
function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}
// Export types for external use
export type {
  FormatParser,
  ConfigChange,
  SecurityClassification,
  ValidationRule
};
export {
  SENSITIVE_PATHS,
  SECURITY_CLASSIFICATIONS
};
// Custom deepMerge for Config type
function deepMergeConfig(target: _Config, ...sources: Partial<Config>[]): Config {
  const _result = deepClone(target);
  
  for (const source of sources) {
    if (!source) continue;
    
    // Merge each section
    if (source.orchestrator) {
      result.orchestrator = { ...result.orchestrator, ...source.orchestrator };
    }
    if (source.terminal) {
      result.terminal = { ...result.terminal, ...source.terminal };
    }
    if (source.memory) {
      result.memory = { ...result.memory, ...source.memory };
    }
    if (source.coordination) {
      result.coordination = { ...result.coordination, ...source.coordination };
    }
    if (source.mcp) {
      result.mcp = { ...result.mcp, ...source.mcp };
    }
    if (source.logging) {
      result.logging = { ...result.logging, ...source.logging };
    }
    if (source.credentials) {
      result.credentials = { ...result.credentials, ...source.credentials };
    }
    if (source.security) {
      result.security = { ...result.security, ...source.security };
    }
  }
  
  return result;
}