import { AgenticFlowClient } from '../client';
import {
  Workflow,
  CreateWorkflowRequest,
  WorkflowExecution,
  PaginationParams,
  PaginatedResponse,
  WorkflowStatus,
  RequestOptions,
} from '../types';

export class WorkflowResource {
  constructor(private client: AgenticFlowClient) {}
  
  /**
   * Create a new workflow
   * 
   * @example
   * ```typescript
   * const workflow = await client.workflows.create({
   *   name: 'Data Processing Pipeline',
   *   description: 'Process and analyze data',
   *   steps: [
   *     {
   *       name: 'Load Data',
   *       type: 'agent',
   *       action: 'load_data',
   *       parameters: { source: 's3://bucket/data.csv' }
   *     },
   *     {
   *       name: 'Process Data',
   *       type: 'agent',
   *       action: 'process',
   *       dependencies: ['Load Data']
   *     }
   *   ]
   * });
   * ```
   */
  async create(data: CreateWorkflowRequest, options?: RequestOptions): Promise<Workflow> {
    return this.client.request<Workflow>({
      method: 'POST',
      url: '/workflows',
      data,
      ...options,
    });
  }
  
  /**
   * Get a workflow by ID
   * 
   * @example
   * ```typescript
   * const workflow = await client.workflows.get('workflow-id');
   * ```
   */
  async get(id: string, options?: RequestOptions): Promise<Workflow> {
    return this.client.request<Workflow>({
      method: 'GET',
      url: `/workflows/${id}`,
      ...options,
    });
  }
  
  /**
   * List workflows with optional filtering
   * 
   * @example
   * ```typescript
   * const workflows = await client.workflows.list({
   *   limit: 10,
   *   status: 'active'
   * });
   * ```
   */
  async list(params?: PaginationParams & {
    status?: WorkflowStatus;
  }, options?: RequestOptions): Promise<PaginatedResponse<Workflow>> {
    const response = await this.client.request<{
      workflows: Workflow[];
      totalCount: number;
      nextOffset?: number;
    }>({
      method: 'GET',
      url: '/workflows',
      params,
      ...options,
    });
    
    return {
      items: response.workflows,
      totalCount: response.totalCount,
      nextOffset: response.nextOffset,
    };
  }
  
  /**
   * Update a workflow
   * 
   * @example
   * ```typescript
   * const updated = await client.workflows.update('workflow-id', {
   *   name: 'Updated Workflow',
   *   steps: [...]
   * });
   * ```
   */
  async update(id: string, data: Partial<CreateWorkflowRequest>, options?: RequestOptions): Promise<Workflow> {
    return this.client.request<Workflow>({
      method: 'PATCH',
      url: `/workflows/${id}`,
      data,
      ...options,
    });
  }
  
  /**
   * Delete a workflow
   * 
   * @example
   * ```typescript
   * await client.workflows.delete('workflow-id');
   * ```
   */
  async delete(id: string, options?: RequestOptions): Promise<void> {
    await this.client.request({
      method: 'DELETE',
      url: `/workflows/${id}`,
      ...options,
    });
  }
  
  /**
   * Execute a workflow
   * 
   * @example
   * ```typescript
   * const execution = await client.workflows.execute('workflow-id', {
   *   parameters: {
   *     inputFile: 'data.csv',
   *     outputFormat: 'json'
   *   }
   * });
   * 
   * // Wait for completion
   * const result = await client.workflows.waitForExecution(
   *   'workflow-id',
   *   execution.id
   * );
   * ```
   */
  async execute(id: string, data?: {
    parameters?: Record<string, any>;
  }, options?: RequestOptions): Promise<WorkflowExecution> {
    return this.client.request<WorkflowExecution>({
      method: 'POST',
      url: `/workflows/${id}/execute`,
      data,
      ...options,
    });
  }
  
  /**
   * Get workflow executions
   * 
   * @example
   * ```typescript
   * const executions = await client.workflows.getExecutions('workflow-id', {
   *   limit: 20
   * });
   * ```
   */
  async getExecutions(workflowId: string, params?: PaginationParams, options?: RequestOptions): Promise<{
    executions: WorkflowExecution[];
    totalCount: number;
  }> {
    return this.client.request({
      method: 'GET',
      url: `/workflows/${workflowId}/executions`,
      params,
      ...options,
    });
  }
  
  /**
   * Get execution details
   * 
   * @example
   * ```typescript
   * const execution = await client.workflows.getExecution(
   *   'workflow-id',
   *   'execution-id'
   * );
   * ```
   */
  async getExecution(workflowId: string, executionId: string, options?: RequestOptions): Promise<WorkflowExecution> {
    return this.client.request<WorkflowExecution>({
      method: 'GET',
      url: `/workflows/${workflowId}/executions/${executionId}`,
      ...options,
    });
  }
  
  /**
   * Cancel a workflow execution
   * 
   * @example
   * ```typescript
   * await client.workflows.cancelExecution('workflow-id', 'execution-id');
   * ```
   */
  async cancelExecution(workflowId: string, executionId: string, options?: RequestOptions): Promise<void> {
    await this.client.request({
      method: 'POST',
      url: `/workflows/${workflowId}/executions/${executionId}/cancel`,
      ...options,
    });
  }
  
  /**
   * Get workflow templates
   * 
   * @example
   * ```typescript
   * const templates = await client.workflows.getTemplates();
   * ```
   */
  async getTemplates(options?: RequestOptions): Promise<{
    templates: any[];
    totalCount: number;
  }> {
    return this.client.request({
      method: 'GET',
      url: '/workflows/templates',
      ...options,
    });
  }
  
  /**
   * Helper method to wait for workflow execution to complete
   * 
   * @example
   * ```typescript
   * const result = await client.workflows.waitForExecution(
   *   'workflow-id',
   *   'execution-id',
   *   {
   *     timeout: 60000,
   *     pollInterval: 2000
   *   }
   * );
   * ```
   */
  async waitForExecution(
    workflowId: string,
    executionId: string,
    options: {
      timeout?: number;
      pollInterval?: number;
    } = {}
  ): Promise<WorkflowExecution> {
    const { timeout = 60000, pollInterval = 2000 } = options;
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const execution = await this.getExecution(workflowId, executionId);
      
      if (execution.status === 'completed' || execution.status === 'failed' || execution.status === 'cancelled') {
        return execution;
      }
      
      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
    
    throw new Error(`Timeout waiting for workflow execution ${executionId} to complete`);
  }
  
  /**
   * Subscribe to workflow events
   * 
   * @example
   * ```typescript
   * // Listen for workflow execution events
   * client.on('workflow:started', (event) => {
   *   console.log(`Workflow ${event.workflowId} started`);
   * });
   * 
   * client.on('workflow:completed', (event) => {
   *   console.log(`Workflow ${event.workflowId} completed`);
   * });
   * ```
   */
  on(event: 'started' | 'completed' | 'failed', listener: (data: any) => void): void {
    this.client.on(`workflow:${event}`, listener);
  }
}