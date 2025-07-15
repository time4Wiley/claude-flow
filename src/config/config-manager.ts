/**
 * Node.js-compatible Configuration management for Claude-Flow
 */
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
export interface Config {
  orchestrator: {
    maxConcurrentAgents: number;
    taskQueueSize: number;
    healthCheckInterval: number;
    shutdownTimeout: number;
  };
  terminal: {
    type: 'auto' | 'vscode' | 'native';
    poolSize: number;
    recycleAfter: number;
    healthCheckInterval: number;
    commandTimeout: number;
  };
  memory: {
    backend: 'sqlite' | 'markdown' | 'hybrid';
    cacheSizeMB: number;
    syncInterval: number;
    conflictResolution: 'crdt' | 'timestamp' | 'manual';
    retentionDays: number;
  };
  coordination: {
    maxRetries: number;
    retryDelay: number;
    deadlockDetection: boolean;
    resourceTimeout: number;
    messageTimeout: number;
  };
  mcp: {
    transport: 'stdio' | 'http' | 'websocket';
    port: number;
    tlsEnabled: boolean;
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    format: 'json' | 'text';
    destination: 'console' | 'file';
  };
  ruvSwarm: {
    enabled: boolean;
    defaultTopology: 'mesh' | 'hierarchical' | 'ring' | 'star';
    maxAgents: number;
    defaultStrategy: 'balanced' | 'specialized' | 'adaptive';
    autoInit: boolean;
    enableHooks: boolean;
    enablePersistence: boolean;
    enableNeuralTraining: boolean;
    configPath?: string;
  };
}
/**
 * Default configuration values
 */
const _DEFAULT_CONFIG: Config = {
  orchestrator: {
    maxConcurrentAgents: 10,
    taskQueueSize: 100,
    healthCheckInterval: 30000,
    shutdownTimeout: 30000,
  },
  terminal: {
    type: 'auto',
    poolSize: 5,
    recycleAfter: 10,
    healthCheckInterval: 60000,
    commandTimeout: 300000,
  },
  memory: {
    backend: 'hybrid',
    cacheSizeMB: 100,
    syncInterval: 5000,
    conflictResolution: 'crdt',
    retentionDays: 30,
  },
  coordination: {
    maxRetries: 3,
    retryDelay: 1000,
    deadlockDetection: true,
    resourceTimeout: 60000,
    messageTimeout: 30000,
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
  ruvSwarm: {
    enabled: true,
    defaultTopology: 'mesh',
    maxAgents: 8,
    defaultStrategy: 'adaptive',
    autoInit: true,
    enableHooks: true,
    enablePersistence: true,
    enableNeuralTraining: true,
    configPath: '.claude/ruv-swarm-config.json',
  },
};
/**
 * Configuration validation error
 */
export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}
/**
 * Configuration manager for Node.js
 */
export class ConfigManager {
  private static instance: ConfigManager;
  private config: Config;
  private configPath?: string;
  private userConfigDir: string;
  private constructor() {
    this.config = this.deepClone(DEFAULT_CONFIG);
    this.userConfigDir = path.join(os.homedir(), '.claude-flow');
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
   * Initialize configuration from file or create default
   */
  async init(configPath = 'claude-flow.config.json'): Promise<void> {
    try {
      await this.load(configPath);
      console.log(`✅ Configuration loaded from: ${configPath}`);
    } catch (_error) {
      // Create default config file if it doesn't exist
      await this.createDefaultConfig(configPath);
      console.log(`✅ Default configuration created: ${configPath}`);
    }
  }
  /**
   * Creates a default configuration file
   */
  async createDefaultConfig(configPath: string): Promise<void> {
    const _config = this.deepClone(DEFAULT_CONFIG);
    const _content = JSON.stringify(_config, null, 2);
    await fs.writeFile(_configPath, _content, 'utf8');
    this.configPath = configPath;
  }
  /**
   * Loads configuration from file
   */
  async load(configPath?: string): Promise<Config> {
    if (configPath) {
      this.configPath = configPath;
    }
    if (!this.configPath) {
      throw new ConfigError('No configuration file path specified');
    }
    try {
      const _content = await fs.readFile(this._configPath, 'utf8');
      const _fileConfig = JSON.parse(content) as Partial<Config>;
      
      // Merge with defaults
      this.config = this.deepMerge(_DEFAULT_CONFIG, fileConfig);
      
      // Load environment variables
      this.loadFromEnv();
      
      // Validate
      this.validate(this.config);
      
      return this.config;
    } catch (_error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new ConfigError(`Configuration file not found: ${this.configPath}`);
      }
      throw new ConfigError(`Failed to load configuration: ${(error as Error).message}`);
    }
  }
  /**
   * Shows current configuration
   */
  show(): Config {
    return this.deepClone(this.config);
  }
  /**
   * Gets a configuration value by path
   */
  get(path: string): unknown {
    const _keys = path.split('.');
    let _current: unknown = this.config;
    
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
   * Sets a configuration value by path
   */
  set(path: string, value: unknown): void {
    const _keys = path.split('.');
    let _current: unknown = this.config;
    
    for (let _i = 0; i < keys.length - 1; i++) {
      const _key = keys[i];
      if (!(key in current)) {
        current[key] = { /* empty */ };
      }
      current = current[key];
    }
    
    const _lastKey = keys[keys.length - 1];
    current[lastKey] = value;
    
    // Validate after setting
    this.validate(this.config);
  }
  /**
   * Saves current configuration to file
   */
  async save(configPath?: string): Promise<void> {
    const _savePath = configPath || this.configPath;
    if (!savePath) {
      throw new ConfigError('No configuration file path specified');
    }
    const _content = JSON.stringify(this._config, null, 2);
    await fs.writeFile(_savePath, _content, 'utf8');
  }
  /**
   * Validates the configuration
   */
  validate(config: Config): void {
    // Orchestrator validation
    if (config.orchestrator.maxConcurrentAgents < 1 || config.orchestrator.maxConcurrentAgents > 100) {
      throw new ConfigError('orchestrator.maxConcurrentAgents must be between 1 and 100');
    }
    if (config.orchestrator.taskQueueSize < 1 || config.orchestrator.taskQueueSize > 10000) {
      throw new ConfigError('orchestrator.taskQueueSize must be between 1 and 10000');
    }
    // Terminal validation
    if (!['auto', 'vscode', 'native'].includes(config.terminal.type)) {
      throw new ConfigError('terminal.type must be one of: _auto, _vscode, native');
    }
    if (config.terminal.poolSize < 1 || config.terminal.poolSize > 50) {
      throw new ConfigError('terminal.poolSize must be between 1 and 50');
    }
    // Memory validation
    if (!['sqlite', 'markdown', 'hybrid'].includes(config.memory.backend)) {
      throw new ConfigError('memory.backend must be one of: _sqlite, _markdown, hybrid');
    }
    if (config.memory.cacheSizeMB < 1 || config.memory.cacheSizeMB > 10000) {
      throw new ConfigError('memory.cacheSizeMB must be between 1 and 10000');
    }
    // Coordination validation
    if (config.coordination.maxRetries < 0 || config.coordination.maxRetries > 100) {
      throw new ConfigError('coordination.maxRetries must be between 0 and 100');
    }
    // MCP validation
    if (!['stdio', 'http', 'websocket'].includes(config.mcp.transport)) {
      throw new ConfigError('mcp.transport must be one of: _stdio, _http, websocket');
    }
    if (config.mcp.port < 1 || config.mcp.port > 65535) {
      throw new ConfigError('mcp.port must be between 1 and 65535');
    }
    // Logging validation
    if (!['debug', 'info', 'warn', 'error'].includes(config.logging.level)) {
      throw new ConfigError('logging.level must be one of: _debug, _info, _warn, error');
    }
    if (!['json', 'text'].includes(config.logging.format)) {
      throw new ConfigError('logging.format must be one of: _json, text');
    }
    if (!['console', 'file'].includes(config.logging.destination)) {
      throw new ConfigError('logging.destination must be one of: _console, file');
    }
    // ruv-swarm validation
    if (!['mesh', 'hierarchical', 'ring', 'star'].includes(config.ruvSwarm.defaultTopology)) {
      throw new ConfigError('ruvSwarm.defaultTopology must be one of: _mesh, _hierarchical, _ring, star');
    }
    if (config.ruvSwarm.maxAgents < 1 || config.ruvSwarm.maxAgents > 100) {
      throw new ConfigError('ruvSwarm.maxAgents must be between 1 and 100');
    }
    if (!['balanced', 'specialized', 'adaptive'].includes(config.ruvSwarm.defaultStrategy)) {
      throw new ConfigError('ruvSwarm.defaultStrategy must be one of: _balanced, _specialized, adaptive');
    }
  }
  /**
   * Loads configuration from environment variables
   */
  private loadFromEnv(): void {
    // Orchestrator settings
    const _maxAgents = process.env.CLAUDE_FLOW_MAX_AGENTS;
    if (maxAgents) {
      this.config.orchestrator.maxConcurrentAgents = parseInt(_maxAgents, 10);
    }
    // Terminal settings
    const _terminalType = process.env.CLAUDE_FLOW_TERMINAL_TYPE;
    if (terminalType === 'vscode' || terminalType === 'native' || terminalType === 'auto') {
      this.config.terminal.type = terminalType;
    }
    // Memory settings
    const _memoryBackend = process.env.CLAUDE_FLOW_MEMORY_BACKEND;
    if (memoryBackend === 'sqlite' || memoryBackend === 'markdown' || memoryBackend === 'hybrid') {
      this.config.memory.backend = memoryBackend;
    }
    // MCP settings
    const _mcpTransport = process.env.CLAUDE_FLOW_MCP_TRANSPORT;
    if (mcpTransport === 'stdio' || mcpTransport === 'http' || mcpTransport === 'websocket') {
      this.config.mcp.transport = mcpTransport;
    }
    const _mcpPort = process.env.CLAUDE_FLOW_MCP_PORT;
    if (mcpPort) {
      this.config.mcp.port = parseInt(_mcpPort, 10);
    }
    // Logging settings
    const _logLevel = process.env.CLAUDE_FLOW_LOG_LEVEL;
    if (logLevel === 'debug' || logLevel === 'info' || logLevel === 'warn' || logLevel === 'error') {
      this.config.logging.level = logLevel;
    }
    // ruv-swarm settings
    const _ruvSwarmEnabled = process.env.CLAUDE_FLOW_RUV_SWARM_ENABLED;
    if (ruvSwarmEnabled === 'true' || ruvSwarmEnabled === 'false') {
      this.config.ruvSwarm.enabled = ruvSwarmEnabled === 'true';
    }
    const _ruvSwarmTopology = process.env.CLAUDE_FLOW_RUV_SWARM_TOPOLOGY;
    if (ruvSwarmTopology === 'mesh' || ruvSwarmTopology === 'hierarchical' || 
        ruvSwarmTopology === 'ring' || ruvSwarmTopology === 'star') {
      this.config.ruvSwarm.defaultTopology = ruvSwarmTopology;
    }
    const _ruvSwarmMaxAgents = process.env.CLAUDE_FLOW_RUV_SWARM_MAX_AGENTS;
    if (ruvSwarmMaxAgents) {
      this.config.ruvSwarm.maxAgents = parseInt(_ruvSwarmMaxAgents, 10);
    }
  }
  /**
   * Deep clone helper
   */
  private deepClone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
  }
  /**
   * Get ruv-swarm specific configuration
   */
  getRuvSwarmConfig() {
    return this.deepClone(this.config.ruvSwarm);
  }
  /**
   * Get available configuration templates
   */
  getAvailableTemplates(): string[] {
    return ['default', 'development', 'production', 'testing'];
  }
  /**
   * Create a configuration template
   */
  createTemplate(name: string, config: unknown): void {
    // Implementation for creating templates
    console.log(`Creating template: ${name}`, config);
  }
  /**
   * Get format parsers
   */
  getFormatParsers(): Record<string, unknown> {
    return {
      json: { extension: '.json', parse: JSON.parse, stringify: JSON.stringify },
      yaml: { extension: '.yaml', parse: (content: string) => content, stringify: (obj: Record<string, unknown>) => JSON.stringify(obj) }
    };
  }
  /**
   * Validate configuration file
   */
  validateFile(path: string): boolean {
    try {
      // Basic validation - file exists and is valid JSON
      require('fs').readFileSync(_path, 'utf8');
      return true;
    } catch {
      return false;
    }
  }
  /**
   * Get path history
   */
  getPathHistory(): unknown[] {
    return []; // Mock implementation
  }
  /**
   * Get change history
   */
  getChangeHistory(): unknown[] {
    return []; // Mock implementation
  }
  /**
   * Backup configuration
   */
  async backup(path: string): Promise<void> {
    const _backupPath = `${path}.backup.${Date.now()}`;
    const _content = JSON.stringify(this._config, null, 2);
    await fs.writeFile(_backupPath, _content, 'utf8');
    console.log(`Configuration backed up to: ${backupPath}`);
  }
  /**
   * Restore configuration from backup
   */
  async restore(path: string): Promise<void> {
    const _content = await fs.readFile(_path, 'utf8');
    this.config = JSON.parse(content);
    console.log(`Configuration restored from: ${path}`);
  }
  /**
   * Update ruv-swarm configuration
   */
  setRuvSwarmConfig(updates: Partial<Config['ruvSwarm']>): void {
    this.config.ruvSwarm = { ...this.config.ruvSwarm, ...updates };
    this.validate(this.config);
  }
  /**
   * Check if ruv-swarm is enabled
   */
  isRuvSwarmEnabled(): boolean {
    return this.config.ruvSwarm.enabled;
  }
  /**
   * Generate ruv-swarm command arguments from configuration
   */
  getRuvSwarmArgs(): string[] {
    const _args: string[] = [];
    const _config = this.config.ruvSwarm;
    
    if (!config.enabled) {
      return args;
    }
    
    args.push('--topology', config.defaultTopology);
    args.push('--max-agents', String(config.maxAgents));
    args.push('--strategy', config.defaultStrategy);
    
    if (config.enableHooks) {
      args.push('--enable-hooks');
    }
    
    if (config.enablePersistence) {
      args.push('--enable-persistence');
    }
    
    if (config.enableNeuralTraining) {
      args.push('--enable-training');
    }
    
    if (config.configPath) {
      args.push('--config-path', config.configPath);
    }
    
    return args;
  }
  /**
   * Deep merge helper
   */
  private deepMerge(target: _Config, source: Partial<Config>): Config {
    const _result = this.deepClone(target);
    
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
    if (source.ruvSwarm) {
      result.ruvSwarm = { ...result.ruvSwarm, ...source.ruvSwarm };
    }
    
    return result;
  }
}
// Export singleton instance
export const _configManager = ConfigManager.getInstance();