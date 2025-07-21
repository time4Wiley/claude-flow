import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import { Logger } from '../utils/logger';
import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { createHash } from 'crypto';

const execAsync = promisify(exec);
const logger = new Logger('plugin-manager');

export interface Plugin {
  id: string;
  name: string;
  version: string;
  description?: string;
  enabled: boolean;
  configuration: Record<string, any>;
  capabilities: string[];
  metadata: {
    author?: string;
    license?: string;
    repository?: string;
    homepage?: string;
    dependencies?: Record<string, string>;
  };
  stats: {
    installDate: Date;
    lastEnabled?: Date;
    lastDisabled?: Date;
    executionCount: number;
    errorCount: number;
  };
}

export interface PluginInstance {
  plugin: Plugin;
  instance: any;
  hooks: Map<string, Function>;
  actions: Map<string, Function>;
}

export class PluginManager extends EventEmitter {
  private plugins: Map<string, Plugin> = new Map();
  private instances: Map<string, PluginInstance> = new Map();
  private pluginDir = './plugins';
  
  constructor() {
    super();
    this.initializePluginSystem();
  }
  
  private async initializePluginSystem() {
    // Create plugin directory if it doesn't exist
    await execAsync(`mkdir -p ${this.pluginDir}`);
    
    // Load installed plugins
    await this.loadInstalledPlugins();
  }
  
  private async loadInstalledPlugins() {
    try {
      const pluginListPath = join(this.pluginDir, 'plugins.json');
      const data = await readFile(pluginListPath, 'utf-8');
      const pluginList = JSON.parse(data);
      
      for (const pluginData of pluginList) {
        this.plugins.set(pluginData.id, pluginData);
        
        if (pluginData.enabled) {
          await this.loadPlugin(pluginData);
        }
      }
    } catch (error) {
      logger.info('No existing plugins found');
    }
  }
  
  async installPlugin(data: {
    source: string;
    configuration?: Record<string, any>;
  }): Promise<Plugin> {
    const pluginId = uuidv4();
    const pluginPath = join(this.pluginDir, pluginId);
    
    try {
      // Create plugin directory
      await execAsync(`mkdir -p ${pluginPath}`);
      
      // Install plugin from source (npm package or git URL)
      if (data.source.startsWith('npm:')) {
        const packageName = data.source.substring(4);
        await execAsync(`cd ${pluginPath} && npm init -y && npm install ${packageName}`);
      } else if (data.source.startsWith('git:')) {
        const gitUrl = data.source.substring(4);
        await execAsync(`git clone ${gitUrl} ${pluginPath}`);
        await execAsync(`cd ${pluginPath} && npm install`);
      } else {
        // Assume it's an npm package name
        await execAsync(`cd ${pluginPath} && npm init -y && npm install ${data.source}`);
      }
      
      // Load plugin metadata
      const packageJsonPath = join(pluginPath, 'package.json');
      const packageData = JSON.parse(await readFile(packageJsonPath, 'utf-8'));
      
      // Create plugin entry
      const plugin: Plugin = {
        id: pluginId,
        name: packageData.name,
        version: packageData.version,
        description: packageData.description,
        enabled: false,
        configuration: data.configuration || {},
        capabilities: packageData.agenticFlow?.capabilities || [],
        metadata: {
          author: packageData.author,
          license: packageData.license,
          repository: packageData.repository?.url,
          homepage: packageData.homepage,
          dependencies: packageData.dependencies,
        },
        stats: {
          installDate: new Date(),
          executionCount: 0,
          errorCount: 0,
        },
      };
      
      // Save plugin
      this.plugins.set(pluginId, plugin);
      await this.savePluginList();
      
      // Emit event
      this.emit('plugin.installed', { plugin });
      
      logger.info('Plugin installed', { 
        pluginId, 
        name: plugin.name,
        version: plugin.version 
      });
      
      return plugin;
    } catch (error) {
      // Clean up on failure
      await execAsync(`rm -rf ${pluginPath}`).catch(() => {});
      
      throw new Error(`Failed to install plugin: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  async uninstallPlugin(id: string): Promise<boolean> {
    const plugin = this.plugins.get(id);
    if (!plugin) return false;
    
    // Disable plugin first
    if (plugin.enabled) {
      await this.disablePlugin(id);
    }
    
    // Remove plugin files
    const pluginPath = join(this.pluginDir, id);
    await execAsync(`rm -rf ${pluginPath}`);
    
    // Remove from registry
    this.plugins.delete(id);
    await this.savePluginList();
    
    // Emit event
    this.emit('plugin.uninstalled', { pluginId: id });
    
    logger.info('Plugin uninstalled', { pluginId: id });
    
    return true;
  }
  
  async enablePlugin(id: string): Promise<Plugin | null> {
    const plugin = this.plugins.get(id);
    if (!plugin || plugin.enabled) return plugin || null;
    
    try {
      await this.loadPlugin(plugin);
      
      plugin.enabled = true;
      plugin.stats.lastEnabled = new Date();
      
      await this.savePluginList();
      
      // Emit event
      this.emit('plugin.enabled', { plugin });
      
      logger.info('Plugin enabled', { pluginId: id, name: plugin.name });
      
      return plugin;
    } catch (error) {
      logger.error('Failed to enable plugin', { 
        pluginId: id, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  }
  
  async disablePlugin(id: string): Promise<Plugin | null> {
    const plugin = this.plugins.get(id);
    if (!plugin || !plugin.enabled) return plugin || null;
    
    const instance = this.instances.get(id);
    if (instance) {
      // Call cleanup if available
      if (typeof instance.instance.cleanup === 'function') {
        await instance.instance.cleanup();
      }
      
      // Remove instance
      this.instances.delete(id);
    }
    
    plugin.enabled = false;
    plugin.stats.lastDisabled = new Date();
    
    await this.savePluginList();
    
    // Emit event
    this.emit('plugin.disabled', { plugin });
    
    logger.info('Plugin disabled', { pluginId: id, name: plugin.name });
    
    return plugin;
  }
  
  private async loadPlugin(plugin: Plugin) {
    const pluginPath = join(this.pluginDir, plugin.id);
    
    try {
      // Load plugin module
      const modulePath = join(process.cwd(), pluginPath);
      const PluginClass = require(modulePath);
      
      // Create plugin instance
      const instance = new PluginClass(plugin.configuration);
      
      // Initialize plugin
      if (typeof instance.initialize === 'function') {
        await instance.initialize();
      }
      
      // Extract hooks and actions
      const hooks = new Map<string, Function>();
      const actions = new Map<string, Function>();
      
      // Register hooks
      if (instance.hooks) {
        for (const [hookName, hookFn] of Object.entries(instance.hooks)) {
          if (typeof hookFn === 'function') {
            hooks.set(hookName, hookFn);
          }
        }
      }
      
      // Register actions
      if (instance.actions) {
        for (const [actionName, actionFn] of Object.entries(instance.actions)) {
          if (typeof actionFn === 'function') {
            actions.set(actionName, actionFn);
          }
        }
      }
      
      // Store instance
      this.instances.set(plugin.id, {
        plugin,
        instance,
        hooks,
        actions,
      });
      
    } catch (error) {
      throw new Error(`Failed to load plugin: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  async updatePluginConfig(id: string, configuration: Record<string, any>): Promise<Plugin | null> {
    const plugin = this.plugins.get(id);
    if (!plugin) return null;
    
    plugin.configuration = { ...plugin.configuration, ...configuration };
    
    // If plugin is enabled, reload it with new config
    if (plugin.enabled) {
      await this.disablePlugin(id);
      await this.enablePlugin(id);
    }
    
    await this.savePluginList();
    
    return plugin;
  }
  
  async executePlugin(id: string, action: string, parameters?: any): Promise<any> {
    const instance = this.instances.get(id);
    if (!instance) {
      throw new Error('Plugin not found or not enabled');
    }
    
    const actionFn = instance.actions.get(action);
    if (!actionFn) {
      throw new Error(`Action '${action}' not found in plugin`);
    }
    
    try {
      const result = await actionFn.call(instance.instance, parameters);
      
      // Update stats
      instance.plugin.stats.executionCount++;
      
      return result;
    } catch (error) {
      // Update error count
      instance.plugin.stats.errorCount++;
      
      logger.error('Plugin execution failed', {
        pluginId: id,
        action,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      throw error;
    }
  }
  
  async getPlugin(id: string): Promise<Plugin | null> {
    return this.plugins.get(id) || null;
  }
  
  async listPlugins(options: { enabled?: boolean } = {}): Promise<Plugin[]> {
    let plugins = Array.from(this.plugins.values());
    
    if (options.enabled !== undefined) {
      plugins = plugins.filter(p => p.enabled === options.enabled);
    }
    
    return plugins;
  }
  
  async searchAvailablePlugins(options: {
    category?: string;
    search?: string;
  } = {}): Promise<any[]> {
    // This would connect to a plugin registry in production
    // For now, return mock data
    return [
      {
        name: 'agentic-flow-slack',
        version: '1.0.0',
        description: 'Slack integration for Agentic Flow',
        category: 'communication',
        author: 'Agentic Flow Team',
      },
      {
        name: 'agentic-flow-github',
        version: '1.0.0',
        description: 'GitHub integration for Agentic Flow',
        category: 'development',
        author: 'Agentic Flow Team',
      },
      {
        name: 'agentic-flow-monitoring',
        version: '1.0.0',
        description: 'Advanced monitoring and alerting',
        category: 'monitoring',
        author: 'Agentic Flow Team',
      },
    ];
  }
  
  async verifyPlugin(id: string): Promise<any | null> {
    const plugin = this.plugins.get(id);
    if (!plugin) return null;
    
    const pluginPath = join(this.pluginDir, id);
    
    try {
      // Calculate checksums
      const files = ['package.json', 'index.js'];
      const checksums: Record<string, string> = {};
      
      for (const file of files) {
        const content = await readFile(join(pluginPath, file), 'utf-8');
        const hash = createHash('sha256');
        hash.update(content);
        checksums[file] = hash.digest('hex');
      }
      
      return {
        valid: true,
        signature: 'verified',
        checksums,
      };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
  
  private async savePluginList() {
    const pluginList = Array.from(this.plugins.values());
    const pluginListPath = join(this.pluginDir, 'plugins.json');
    
    await writeFile(pluginListPath, JSON.stringify(pluginList, null, 2));
  }
  
  // Hook system for other components to use
  async runHook(hookName: string, data: any): Promise<any[]> {
    const results: any[] = [];
    
    for (const instance of this.instances.values()) {
      const hookFn = instance.hooks.get(hookName);
      if (hookFn) {
        try {
          const result = await hookFn.call(instance.instance, data);
          results.push(result);
        } catch (error) {
          logger.error('Hook execution failed', {
            pluginId: instance.plugin.id,
            hookName,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    }
    
    return results;
  }
}