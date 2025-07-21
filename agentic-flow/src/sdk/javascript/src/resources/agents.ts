import { AgenticFlowClient } from '../client';
import {
  Agent,
  CreateAgentRequest,
  UpdateAgentRequest,
  PaginationParams,
  PaginatedResponse,
  AgentType,
  AgentStatus,
  RequestOptions,
} from '../types';

export class AgentResource {
  constructor(private client: AgenticFlowClient) {}
  
  /**
   * Create a new agent
   * 
   * @example
   * ```typescript
   * const agent = await client.agents.create({
   *   name: 'Data Processor',
   *   type: 'executor',
   *   capabilities: ['data-processing', 'analysis']
   * });
   * ```
   */
  async create(data: CreateAgentRequest, options?: RequestOptions): Promise<Agent> {
    return this.client.request<Agent>({
      method: 'POST',
      url: '/agents',
      data,
      ...options,
    });
  }
  
  /**
   * Get an agent by ID
   * 
   * @example
   * ```typescript
   * const agent = await client.agents.get('agent-id');
   * ```
   */
  async get(id: string, options?: RequestOptions): Promise<Agent> {
    return this.client.request<Agent>({
      method: 'GET',
      url: `/agents/${id}`,
      ...options,
    });
  }
  
  /**
   * List agents with optional filtering
   * 
   * @example
   * ```typescript
   * const agents = await client.agents.list({
   *   limit: 10,
   *   status: 'active',
   *   type: 'executor'
   * });
   * ```
   */
  async list(params?: PaginationParams & {
    status?: AgentStatus;
    type?: AgentType;
  }, options?: RequestOptions): Promise<PaginatedResponse<Agent>> {
    const response = await this.client.request<{
      agents: Agent[];
      totalCount: number;
      nextOffset?: number;
    }>({
      method: 'GET',
      url: '/agents',
      params,
      ...options,
    });
    
    return {
      items: response.agents,
      totalCount: response.totalCount,
      nextOffset: response.nextOffset,
    };
  }
  
  /**
   * Update an agent's configuration
   * 
   * @example
   * ```typescript
   * const updated = await client.agents.update('agent-id', {
   *   name: 'Updated Agent Name',
   *   capabilities: ['new-capability']
   * });
   * ```
   */
  async update(id: string, data: UpdateAgentRequest, options?: RequestOptions): Promise<Agent> {
    return this.client.request<Agent>({
      method: 'PATCH',
      url: `/agents/${id}`,
      data,
      ...options,
    });
  }
  
  /**
   * Delete an agent
   * 
   * @example
   * ```typescript
   * await client.agents.delete('agent-id');
   * ```
   */
  async delete(id: string, options?: RequestOptions): Promise<void> {
    await this.client.request({
      method: 'DELETE',
      url: `/agents/${id}`,
      ...options,
    });
  }
  
  /**
   * Start an agent
   * 
   * @example
   * ```typescript
   * const agent = await client.agents.start('agent-id');
   * ```
   */
  async start(id: string, options?: RequestOptions): Promise<Agent> {
    return this.client.request<Agent>({
      method: 'POST',
      url: `/agents/${id}/start`,
      ...options,
    });
  }
  
  /**
   * Stop an agent
   * 
   * @example
   * ```typescript
   * const agent = await client.agents.stop('agent-id');
   * ```
   */
  async stop(id: string, options?: RequestOptions): Promise<Agent> {
    return this.client.request<Agent>({
      method: 'POST',
      url: `/agents/${id}/stop`,
      ...options,
    });
  }
  
  /**
   * Get agent metrics
   * 
   * @example
   * ```typescript
   * const metrics = await client.agents.getMetrics('agent-id');
   * ```
   */
  async getMetrics(id: string, options?: RequestOptions): Promise<any> {
    return this.client.request({
      method: 'GET',
      url: `/agents/${id}/metrics`,
      ...options,
    });
  }
  
  /**
   * Get agent logs
   * 
   * @example
   * ```typescript
   * const logs = await client.agents.getLogs('agent-id', {
   *   limit: 100,
   *   since: '2024-01-01T00:00:00Z'
   * });
   * ```
   */
  async getLogs(id: string, params?: {
    limit?: number;
    since?: string;
  }, options?: RequestOptions): Promise<any> {
    return this.client.request({
      method: 'GET',
      url: `/agents/${id}/logs`,
      params,
      ...options,
    });
  }
  
  /**
   * Subscribe to real-time agent events
   * 
   * @example
   * ```typescript
   * // Subscribe to agent status changes
   * client.agents.on('status_changed', (event) => {
   *   console.log(`Agent ${event.agentId} status changed to ${event.status}`);
   * });
   * 
   * // Subscribe to specific agent
   * client.agents.subscribe('agent-id');
   * ```
   */
  subscribe(agentId: string): void {
    this.client.subscribeToAgent(agentId);
  }
  
  /**
   * Unsubscribe from agent events
   * 
   * @example
   * ```typescript
   * client.agents.unsubscribe('agent-id');
   * ```
   */
  unsubscribe(agentId: string): void {
    this.client.unsubscribeFromAgent(agentId);
  }
  
  /**
   * Helper method to wait for agent to reach a specific status
   * 
   * @example
   * ```typescript
   * // Wait for agent to become active
   * await client.agents.waitForStatus('agent-id', 'active', {
   *   timeout: 30000,
   *   pollInterval: 1000
   * });
   * ```
   */
  async waitForStatus(
    id: string,
    status: AgentStatus,
    options: {
      timeout?: number;
      pollInterval?: number;
    } = {}
  ): Promise<Agent> {
    const { timeout = 30000, pollInterval = 1000 } = options;
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const agent = await this.get(id);
      
      if (agent.status === status) {
        return agent;
      }
      
      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
    
    throw new Error(`Timeout waiting for agent ${id} to reach status ${status}`);
  }
}