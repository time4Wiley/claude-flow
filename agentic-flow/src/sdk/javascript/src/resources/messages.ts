import { AgenticFlowClient } from '../client';
import {
  Message,
  SendMessageRequest,
  MessageType,
  PaginationParams,
  PaginatedResponse,
  RequestOptions,
} from '../types';

export class MessageResource {
  constructor(private client: AgenticFlowClient) {}
  
  /**
   * Send a message between agents
   * 
   * @example
   * ```typescript
   * const message = await client.messages.send({
   *   from: 'agent-1',
   *   to: 'agent-2',
   *   type: 'task',
   *   content: {
   *     action: 'process_data',
   *     parameters: {
   *       file: 'data.csv'
   *     }
   *   },
   *   priority: 'high'
   * });
   * ```
   */
  async send(data: SendMessageRequest, options?: RequestOptions): Promise<Message> {
    return this.client.request<Message>({
      method: 'POST',
      url: '/messages',
      data,
      ...options,
    });
  }
  
  /**
   * Broadcast a message to multiple agents
   * 
   * @example
   * ```typescript
   * const broadcast = await client.messages.broadcast({
   *   from: 'coordinator',
   *   recipients: ['agent-1', 'agent-2', 'agent-3'],
   *   type: 'event',
   *   content: {
   *     event: 'system_update',
   *     message: 'System maintenance scheduled'
   *   }
   * });
   * ```
   */
  async broadcast(data: {
    from: string;
    recipients: string[];
    type: MessageType;
    content: Record<string, any>;
    priority?: 'low' | 'medium' | 'high' | 'critical';
  }, options?: RequestOptions): Promise<{
    broadcast: {
      id: string;
      from: string;
      recipients: string[];
      messageCount: number;
      messages: Array<{
        id: string;
        to: string;
        timestamp: string;
      }>;
    };
  }> {
    return this.client.request({
      method: 'POST',
      url: '/messages/broadcast',
      data,
      ...options,
    });
  }
  
  /**
   * Get a message by ID
   * 
   * @example
   * ```typescript
   * const message = await client.messages.get('message-id');
   * ```
   */
  async get(id: string, options?: RequestOptions): Promise<Message> {
    return this.client.request<Message>({
      method: 'GET',
      url: `/messages/${id}`,
      ...options,
    });
  }
  
  /**
   * List messages with optional filtering
   * 
   * @example
   * ```typescript
   * const messages = await client.messages.list({
   *   limit: 20,
   *   agentId: 'agent-id',
   *   type: 'task',
   *   since: '2024-01-01T00:00:00Z'
   * });
   * ```
   */
  async list(params?: PaginationParams & {
    agentId?: string;
    type?: MessageType;
    since?: string;
  }, options?: RequestOptions): Promise<PaginatedResponse<Message>> {
    const response = await this.client.request<{
      messages: Message[];
      totalCount: number;
      nextOffset?: number;
    }>({
      method: 'GET',
      url: '/messages',
      params,
      ...options,
    });
    
    return {
      items: response.messages,
      totalCount: response.totalCount,
      nextOffset: response.nextOffset,
    };
  }
  
  /**
   * Mark a message as read
   * 
   * @example
   * ```typescript
   * const message = await client.messages.markAsRead('message-id');
   * ```
   */
  async markAsRead(id: string, options?: RequestOptions): Promise<{
    id: string;
    readAt: string;
  }> {
    return this.client.request({
      method: 'POST',
      url: `/messages/${id}/read`,
      ...options,
    });
  }
  
  /**
   * Delete a message
   * 
   * @example
   * ```typescript
   * await client.messages.delete('message-id');
   * ```
   */
  async delete(id: string, options?: RequestOptions): Promise<void> {
    await this.client.request({
      method: 'DELETE',
      url: `/messages/${id}`,
      ...options,
    });
  }
  
  /**
   * Get message queue status
   * 
   * @example
   * ```typescript
   * const status = await client.messages.getQueueStatus();
   * console.log(`Queue size: ${status.queueSize}`);
   * ```
   */
  async getQueueStatus(options?: RequestOptions): Promise<{
    queueSize: number;
    processing: number;
    failed: number;
    throughput: number;
    averageLatency: number;
  }> {
    return this.client.request({
      method: 'GET',
      url: '/messages/queue/status',
      ...options,
    });
  }
  
  /**
   * Subscribe to message events
   * 
   * @example
   * ```typescript
   * // Listen for messages received by a specific agent
   * client.on('message:received', (event) => {
   *   console.log(`Agent ${event.to} received message from ${event.from}`);
   * });
   * ```
   */
  on(event: 'sent' | 'received' | 'delivered' | 'read', listener: (data: any) => void): void {
    this.client.on(`message:${event}`, listener);
  }
}