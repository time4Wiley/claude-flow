import { AgenticFlowClient } from '../client';
import {
  Goal,
  CreateGoalRequest,
  Priority,
  GoalStatus,
  RequestOptions,
} from '../types';

export class GoalResource {
  constructor(private client: AgenticFlowClient) {}
  
  /**
   * Create and parse a goal from natural language
   * 
   * @example
   * ```typescript
   * const goal = await client.goals.create({
   *   description: 'Analyze sales data from Q4 2023 and generate a comprehensive report',
   *   priority: 'high',
   *   constraints: {
   *     deadline: '2024-01-15',
   *     format: 'PDF'
   *   }
   * });
   * ```
   */
  async create(data: CreateGoalRequest, options?: RequestOptions): Promise<Goal> {
    return this.client.request<Goal>({
      method: 'POST',
      url: '/goals',
      data,
      ...options,
    });
  }
  
  /**
   * Get a goal by ID
   * 
   * @example
   * ```typescript
   * const goal = await client.goals.get('goal-id');
   * ```
   */
  async get(id: string, options?: RequestOptions): Promise<Goal> {
    return this.client.request<Goal>({
      method: 'GET',
      url: `/goals/${id}`,
      ...options,
    });
  }
  
  /**
   * List goals with optional filtering
   * 
   * @example
   * ```typescript
   * const goals = await client.goals.list({
   *   limit: 10,
   *   status: 'executing',
   *   priority: 'high',
   *   agentId: 'agent-id'
   * });
   * ```
   */
  async list(params?: {
    limit?: number;
    offset?: number;
    status?: GoalStatus;
    priority?: Priority;
    agentId?: string;
  }, options?: RequestOptions): Promise<{
    goals: Goal[];
    totalCount: number;
  }> {
    return this.client.request({
      method: 'GET',
      url: '/goals',
      params,
      ...options,
    });
  }
  
  /**
   * Assign a goal to an agent
   * 
   * @example
   * ```typescript
   * const goal = await client.goals.assign('goal-id', 'agent-id');
   * ```
   */
  async assign(goalId: string, agentId: string, options?: RequestOptions): Promise<Goal> {
    return this.client.request<Goal>({
      method: 'POST',
      url: `/goals/${goalId}/assign`,
      data: { agentId },
      ...options,
    });
  }
  
  /**
   * Update goal status
   * 
   * @example
   * ```typescript
   * const goal = await client.goals.updateStatus('goal-id', 'completed');
   * ```
   */
  async updateStatus(id: string, status: GoalStatus, options?: RequestOptions): Promise<Goal> {
    return this.client.request<Goal>({
      method: 'PATCH',
      url: `/goals/${id}/status`,
      data: { status },
      ...options,
    });
  }
  
  /**
   * Cancel/delete a goal
   * 
   * @example
   * ```typescript
   * await client.goals.cancel('goal-id');
   * ```
   */
  async cancel(id: string, options?: RequestOptions): Promise<void> {
    await this.client.request({
      method: 'DELETE',
      url: `/goals/${id}`,
      ...options,
    });
  }
  
  /**
   * Get goal progress
   * 
   * @example
   * ```typescript
   * const progress = await client.goals.getProgress('goal-id');
   * console.log(`Goal is ${progress.overall}% complete`);
   * ```
   */
  async getProgress(id: string, options?: RequestOptions): Promise<{
    goalId: string;
    overall: number;
    subtasks: Array<{
      id: string;
      description: string;
      status: string;
      progress: number;
    }>;
    timeline: any;
    estimatedCompletion?: string;
  }> {
    return this.client.request({
      method: 'GET',
      url: `/goals/${id}/progress`,
      ...options,
    });
  }
  
  /**
   * Get goal analytics
   * 
   * @example
   * ```typescript
   * const analytics = await client.goals.getAnalytics();
   * console.log(`Success rate: ${analytics.successRate}%`);
   * ```
   */
  async getAnalytics(options?: RequestOptions): Promise<{
    totalGoals: number;
    byStatus: Record<string, number>;
    byPriority: Record<string, number>;
    averageCompletionTime: number;
    successRate: number;
    trendsLastWeek: any;
  }> {
    return this.client.request({
      method: 'GET',
      url: '/goals/analytics',
      ...options,
    });
  }
  
  /**
   * Subscribe to goal events
   * 
   * @example
   * ```typescript
   * // Listen for goal creation
   * client.on('goal:created', (event) => {
   *   console.log(`New goal created: ${event.goal.description}`);
   * });
   * 
   * // Listen for goal status changes
   * client.on('goal:status_changed', (event) => {
   *   console.log(`Goal ${event.goalId} status changed to ${event.status}`);
   * });
   * ```
   */
  on(event: 'created' | 'status_changed' | 'completed', listener: (data: any) => void): void {
    this.client.on(`goal:${event}`, listener);
  }
  
  /**
   * Helper method to wait for goal completion
   * 
   * @example
   * ```typescript
   * const completedGoal = await client.goals.waitForCompletion('goal-id', {
   *   timeout: 300000, // 5 minutes
   *   pollInterval: 5000
   * });
   * ```
   */
  async waitForCompletion(
    id: string,
    options: {
      timeout?: number;
      pollInterval?: number;
    } = {}
  ): Promise<Goal> {
    const { timeout = 300000, pollInterval = 5000 } = options;
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const goal = await this.get(id);
      
      if (goal.status === 'completed' || goal.status === 'failed') {
        return goal;
      }
      
      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
    
    throw new Error(`Timeout waiting for goal ${id} to complete`);
  }
}