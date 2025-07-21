import { AgenticFlowClient } from '../client';
import {
  Plugin,
  InstallPluginRequest,
  RequestOptions,
} from '../types';

export class PluginResource {
  constructor(private client: AgenticFlowClient) {}
  
  /**
   * Install a plugin
   * 
   * @example
   * ```typescript
   * // Install from npm
   * const plugin = await client.plugins.install({
   *   source: 'npm:agentic-flow-slack',
   *   configuration: {
   *     webhookUrl: 'https://hooks.slack.com/...'
   *   }
   * });
   * 
   * // Install from git
   * const plugin = await client.plugins.install({
   *   source: 'git:https://github.com/user/agentic-plugin.git'
   * });
   * ```
   */
  async install(data: InstallPluginRequest, options?: RequestOptions): Promise<Plugin> {
    return this.client.request<Plugin>({
      method: 'POST',
      url: '/plugins',
      data,
      ...options,
    });
  }
  
  /**
   * Get a plugin by ID
   * 
   * @example
   * ```typescript
   * const plugin = await client.plugins.get('plugin-id');
   * ```
   */
  async get(id: string, options?: RequestOptions): Promise<Plugin> {
    return this.client.request<Plugin>({
      method: 'GET',
      url: `/plugins/${id}`,
      ...options,
    });
  }
  
  /**
   * List installed plugins
   * 
   * @example
   * ```typescript
   * // List all plugins
   * const plugins = await client.plugins.list();
   * 
   * // List only enabled plugins
   * const enabledPlugins = await client.plugins.list({ enabled: true });
   * ```
   */
  async list(params?: {
    enabled?: boolean;
  }, options?: RequestOptions): Promise<{
    plugins: Plugin[];
    totalCount: number;
  }> {
    return this.client.request({
      method: 'GET',
      url: '/plugins',
      params,
      ...options,
    });
  }
  
  /**
   * Uninstall a plugin
   * 
   * @example
   * ```typescript
   * await client.plugins.uninstall('plugin-id');
   * ```
   */
  async uninstall(id: string, options?: RequestOptions): Promise<void> {
    await this.client.request({
      method: 'DELETE',
      url: `/plugins/${id}`,
      ...options,
    });
  }
  
  /**
   * Enable a plugin
   * 
   * @example
   * ```typescript
   * const plugin = await client.plugins.enable('plugin-id');
   * ```
   */
  async enable(id: string, options?: RequestOptions): Promise<{
    id: string;
    enabled: boolean;
    message: string;
  }> {
    return this.client.request({
      method: 'POST',
      url: `/plugins/${id}/enable`,
      ...options,
    });
  }
  
  /**
   * Disable a plugin
   * 
   * @example
   * ```typescript
   * const plugin = await client.plugins.disable('plugin-id');
   * ```
   */
  async disable(id: string, options?: RequestOptions): Promise<{
    id: string;
    enabled: boolean;
    message: string;
  }> {
    return this.client.request({
      method: 'POST',
      url: `/plugins/${id}/disable`,
      ...options,
    });
  }
  
  /**
   * Update plugin configuration
   * 
   * @example
   * ```typescript
   * const plugin = await client.plugins.updateConfig('plugin-id', {
   *   apiKey: 'new-api-key',
   *   endpoint: 'https://new-endpoint.com'
   * });
   * ```
   */
  async updateConfig(id: string, configuration: Record<string, any>, options?: RequestOptions): Promise<{
    id: string;
    configuration: Record<string, any>;
    message: string;
  }> {
    return this.client.request({
      method: 'PATCH',
      url: `/plugins/${id}/config`,
      data: { configuration },
      ...options,
    });
  }
  
  /**
   * Execute a plugin action
   * 
   * @example
   * ```typescript
   * const result = await client.plugins.execute('plugin-id', {
   *   action: 'send_notification',
   *   parameters: {
   *     channel: '#general',
   *     message: 'Hello from Agentic Flow!'
   *   }
   * });
   * ```
   */
  async execute(id: string, data: {
    action: string;
    parameters?: Record<string, any>;
  }, options?: RequestOptions): Promise<{
    pluginId: string;
    action: string;
    result: any;
    executedAt: string;
  }> {
    return this.client.request({
      method: 'POST',
      url: `/plugins/${id}/execute`,
      data,
      ...options,
    });
  }
  
  /**
   * Search available plugins in the registry
   * 
   * @example
   * ```typescript
   * const available = await client.plugins.searchAvailable({
   *   category: 'communication',
   *   search: 'slack'
   * });
   * ```
   */
  async searchAvailable(params?: {
    category?: string;
    search?: string;
  }, options?: RequestOptions): Promise<{
    plugins: Array<{
      name: string;
      version: string;
      description?: string;
      category?: string;
      author?: string;
    }>;
    totalCount: number;
  }> {
    return this.client.request({
      method: 'GET',
      url: '/plugins/available',
      params,
      ...options,
    });
  }
  
  /**
   * Verify plugin integrity
   * 
   * @example
   * ```typescript
   * const verification = await client.plugins.verify('plugin-id');
   * if (!verification.valid) {
   *   console.error('Plugin verification failed');
   * }
   * ```
   */
  async verify(id: string, options?: RequestOptions): Promise<{
    pluginId: string;
    valid: boolean;
    signature?: string;
    checksums?: Record<string, string>;
    verifiedAt: string;
  }> {
    return this.client.request({
      method: 'POST',
      url: `/plugins/${id}/verify`,
      ...options,
    });
  }
}