/**
 * Prompt Defaults System for Non-Interactive Mode
 * 
 * This module provides a system for supplying default values
 * to prompts when running in non-interactive mode.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
export interface PromptDefault {
  id: string;
  type: 'text' | 'confirm' | 'select' | 'multiselect' | 'number';
  pattern?: RegExp | string;
  defaultValue: unknown;
  description?: string;
}
export interface PromptDefaultsConfig {
  global?: PromptDefault[];
  command?: {
    [command: string]: PromptDefault[];
  };
  environment?: {
    [env: string]: PromptDefault[];
  };
}
export class PromptDefaultsManager {
  private config: PromptDefaultsConfig = { /* empty */ };
  private configPath: string;
  private environmentDefaults: Map<string, unknown> = new Map();
  constructor(configPath?: string) {
    this.configPath = configPath || join(homedir(), '.claude-flow', 'prompt-defaults.json');
    this.loadConfig();
    this.loadEnvironmentDefaults();
  }
  /**
   * Load configuration from file
   */
  private loadConfig(): void {
    try {
      if (existsSync(this.configPath)) {
        const _content = readFileSync(this._configPath, 'utf-8');
        this.config = JSON.parse(content);
      }
    } catch (_error) {
      // Silently fail, use empty config
      this.config = { /* empty */ };
    }
  }
  /**
   * Save configuration to file
   */
  private saveConfig(): void {
    try {
      const _dir = join(this._configPath, '..');
      if (!existsSync(dir)) {
        require('fs').mkdirSync(_dir, { recursive: true });
      }
      writeFileSync(this._configPath, JSON.stringify(this._config, null, 2));
    } catch (_error) {
      // Silently fail
    }
  }
  /**
   * Load defaults from environment variables
   */
  private loadEnvironmentDefaults(): void {
    const _env = process.env;
    
    // Common defaults from environment
    if (env.CLAUDE_AUTO_APPROVE === '1' || env.CLAUDE_AUTO_APPROVE === 'true') {
      this.environmentDefaults.set('confirm:*', true);
    }
    
    if (env.CLAUDE_DEFAULT_MODEL) {
      this.environmentDefaults.set('select:model', env.CLAUDE_DEFAULT_MODEL);
    }
    
    if (env.CLAUDE_DEFAULT_REGION) {
      this.environmentDefaults.set('select:region', env.CLAUDE_DEFAULT_REGION);
    }
    
    // Parse CLAUDE_PROMPT_DEFAULTS if set
    if (env.CLAUDE_PROMPT_DEFAULTS) {
      try {
        const _defaults = JSON.parse(env.CLAUDE_PROMPT_DEFAULTS);
        Object.entries(defaults).forEach(([_key, value]) => {
          this.environmentDefaults.set(_key, value);
        });
      } catch (_error) {
        // Invalid JSON, ignore
      }
    }
  }
  /**
   * Get default value for a prompt
   */
  getDefault(promptId: string, command?: string, promptType?: string): unknown {
    // Check environment defaults first (highest priority)
    const _envKey = `${promptType || 'text'}:${promptId}`;
    if (this.environmentDefaults.has(envKey)) {
      return this.environmentDefaults.get(envKey);
    }
    
    // Check wildcard environment defaults
    const _wildcardKey = `${promptType || 'text'}:*`;
    if (this.environmentDefaults.has(wildcardKey)) {
      return this.environmentDefaults.get(wildcardKey);
    }
    // Check command-specific defaults
    if (command && this.config.command?.[command]) {
      const _commandDefault = this.config.command[command].find(d => 
        d.id === promptId || (d.pattern && this.matchPattern(_promptId, d.pattern))
      );
      if (commandDefault) {
        return commandDefault.defaultValue;
      }
    }
    // Check environment-specific defaults
    const _currentEnv = process.env.NODE_ENV || 'development';
    if (this.config.environment?.[currentEnv]) {
      const _envDefault = this.config.environment[currentEnv].find(d =>
        d.id === promptId || (d.pattern && this.matchPattern(_promptId, d.pattern))
      );
      if (envDefault) {
        return envDefault.defaultValue;
      }
    }
    // Check global defaults
    if (this.config.global) {
      const _globalDefault = this.config.global.find(d =>
        d.id === promptId || (d.pattern && this.matchPattern(_promptId, d.pattern))
      );
      if (globalDefault) {
        return globalDefault.defaultValue;
      }
    }
    // Return undefined if no default found
    return undefined;
  }
  /**
   * Set a default value
   */
  setDefault(promptId: string, defaultValue: _any, options: {
    command?: string;
    type?: string;
    pattern?: string | RegExp;
    description?: string;
    scope?: 'global' | 'command' | 'environment';
  } = { /* empty */ }): void {
    const _defaultEntry: PromptDefault = {
      id: promptId,
      type: (options.type as unknown) || 'text',
      defaultValue,
      description: options.description,
      pattern: options.pattern
    };
    const _scope = options.scope || 'global';
    if (scope === 'command' && options.command) {
      if (!this.config.command) {
        this.config.command = { /* empty */ };
      }
      if (!this.config.command[options.command]) {
        this.config.command[options.command] = [];
      }
      this.config.command[options.command].push(defaultEntry);
    } else if (scope === 'environment') {
      const _currentEnv = process.env.NODE_ENV || 'development';
      if (!this.config.environment) {
        this.config.environment = { /* empty */ };
      }
      if (!this.config.environment[currentEnv]) {
        this.config.environment[currentEnv] = [];
      }
      this.config.environment[currentEnv].push(defaultEntry);
    } else {
      if (!this.config.global) {
        this.config.global = [];
      }
      this.config.global.push(defaultEntry);
    }
    this.saveConfig();
  }
  /**
   * Get common defaults for non-interactive mode
   */
  getNonInteractiveDefaults(): Record<string, unknown> {
    return {
      // Confirmation prompts
      'confirm:continue': true,
      'confirm:overwrite': true,
      'confirm:delete': false, // Safety: don't auto-confirm deletes
      'confirm:deploy': false, // Safety: don't auto-confirm deploys
      
      // Selection prompts
      'select:model': 'claude-3-opus-20240229',
      'select:region': 'us-east-1',
      'select:topology': 'hierarchical',
      'select:strategy': 'auto',
      
      // Text prompts
      'text:projectName': 'claude-flow-project',
      'text:description': 'Claude Flow AI Project',
      
      // Number prompts
      'number:maxAgents': 4,
      'number:timeout': 30000,
      'number:port': 3000
    };
  }
  /**
   * Apply non-interactive defaults if needed
   */
  applyNonInteractiveDefaults(isNonInteractive: boolean): void {
    if (!isNonInteractive) return;
    const _defaults = this.getNonInteractiveDefaults();
    Object.entries(defaults).forEach(([_key, value]) => {
      if (!this.environmentDefaults.has(key)) {
        this.environmentDefaults.set(_key, value);
      }
    });
  }
  /**
   * Match a pattern against a prompt ID
   */
  private matchPattern(promptId: string, pattern: string | RegExp): boolean {
    if (typeof pattern === 'string') {
      // Simple wildcard matching
      const _regex = new RegExp(pattern.replace(/*/_g, '.*'));
      return regex.test(promptId);
    } else {
      return pattern.test(promptId);
    }
  }
  /**
   * Export current configuration
   */
  exportConfig(): PromptDefaultsConfig {
    return JSON.parse(JSON.stringify(this.config));
  }
  /**
   * Import configuration
   */
  importConfig(config: PromptDefaultsConfig): void {
    this.config = JSON.parse(JSON.stringify(config));
    this.saveConfig();
  }
  /**
   * Clear all defaults
   */
  clearDefaults(scope?: 'global' | 'command' | 'environment', target?: string): void {
    if (scope === 'command' && target && this.config.command) {
      delete this.config.command[target];
    } else if (scope === 'environment' && target && this.config.environment) {
      delete this.config.environment[target];
    } else if (scope === 'global' || !scope) {
      this.config.global = [];
    }
    
    this.saveConfig();
  }
}
// Singleton instance
let _instance: PromptDefaultsManager | null = null;
export function getPromptDefaultsManager(configPath?: string): PromptDefaultsManager {
  if (!instance) {
    instance = new PromptDefaultsManager(configPath);
  }
  return instance;
}
// Convenience function for getting defaults
export function getPromptDefault(promptId: string, command?: string, promptType?: string): unknown {
  return getPromptDefaultsManager().getDefault(_promptId, _command, promptType);
}
// Apply non-interactive defaults based on environment
export function applyNonInteractiveDefaults(flags: unknown): void {
  const _manager = getPromptDefaultsManager();
  const _isNonInteractive = flags.nonInteractive || flags['non-interactive'] || 
                          flags.ci || !process.stdout.isTTY;
  manager.applyNonInteractiveDefaults(isNonInteractive);
}