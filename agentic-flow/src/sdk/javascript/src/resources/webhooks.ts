import { AgenticFlowClient } from '../client';
import {
  Webhook,
  CreateWebhookRequest,
  WebhookDelivery,
  RequestOptions,
} from '../types';

export class WebhookResource {
  constructor(private client: AgenticFlowClient) {}
  
  /**
   * Create a webhook subscription
   * 
   * @example
   * ```typescript
   * const webhook = await client.webhooks.create({
   *   url: 'https://example.com/webhook',
   *   events: ['agent.created', 'workflow.completed', 'goal.status_changed'],
   *   secret: 'your-webhook-secret'
   * });
   * ```
   */
  async create(data: CreateWebhookRequest, options?: RequestOptions): Promise<Webhook> {
    return this.client.request<Webhook>({
      method: 'POST',
      url: '/webhooks',
      data,
      ...options,
    });
  }
  
  /**
   * Get a webhook by ID
   * 
   * @example
   * ```typescript
   * const webhook = await client.webhooks.get('webhook-id');
   * ```
   */
  async get(id: string, options?: RequestOptions): Promise<Webhook> {
    return this.client.request<Webhook>({
      method: 'GET',
      url: `/webhooks/${id}`,
      ...options,
    });
  }
  
  /**
   * List all webhooks
   * 
   * @example
   * ```typescript
   * const webhooks = await client.webhooks.list();
   * ```
   */
  async list(options?: RequestOptions): Promise<{
    webhooks: Webhook[];
    totalCount: number;
  }> {
    return this.client.request({
      method: 'GET',
      url: '/webhooks',
      ...options,
    });
  }
  
  /**
   * Update a webhook
   * 
   * @example
   * ```typescript
   * const updated = await client.webhooks.update('webhook-id', {
   *   url: 'https://example.com/new-webhook',
   *   events: ['agent.created', 'agent.stopped']
   * });
   * ```
   */
  async update(id: string, data: Partial<CreateWebhookRequest>, options?: RequestOptions): Promise<Webhook> {
    return this.client.request<Webhook>({
      method: 'PATCH',
      url: `/webhooks/${id}`,
      data,
      ...options,
    });
  }
  
  /**
   * Delete a webhook
   * 
   * @example
   * ```typescript
   * await client.webhooks.delete('webhook-id');
   * ```
   */
  async delete(id: string, options?: RequestOptions): Promise<void> {
    await this.client.request({
      method: 'DELETE',
      url: `/webhooks/${id}`,
      ...options,
    });
  }
  
  /**
   * Enable or disable a webhook
   * 
   * @example
   * ```typescript
   * // Disable webhook
   * const webhook = await client.webhooks.toggle('webhook-id', false);
   * 
   * // Enable webhook
   * const webhook = await client.webhooks.toggle('webhook-id', true);
   * ```
   */
  async toggle(id: string, active: boolean, options?: RequestOptions): Promise<{
    id: string;
    active: boolean;
    updatedAt: string;
  }> {
    return this.client.request({
      method: 'POST',
      url: `/webhooks/${id}/toggle`,
      data: { active },
      ...options,
    });
  }
  
  /**
   * Test a webhook delivery
   * 
   * @example
   * ```typescript
   * const result = await client.webhooks.test('webhook-id');
   * console.log(`Test ${result.success ? 'succeeded' : 'failed'}`);
   * ```
   */
  async test(id: string, options?: RequestOptions): Promise<{
    success: boolean;
    statusCode?: number;
    duration: number;
    response?: any;
    error?: string;
  }> {
    return this.client.request({
      method: 'POST',
      url: `/webhooks/${id}/test`,
      ...options,
    });
  }
  
  /**
   * Get webhook delivery history
   * 
   * @example
   * ```typescript
   * const deliveries = await client.webhooks.getDeliveries('webhook-id', {
   *   limit: 50
   * });
   * ```
   */
  async getDeliveries(id: string, params?: {
    limit?: number;
    offset?: number;
  }, options?: RequestOptions): Promise<{
    deliveries: WebhookDelivery[];
    totalCount: number;
  }> {
    return this.client.request({
      method: 'GET',
      url: `/webhooks/${id}/deliveries`,
      params,
      ...options,
    });
  }
  
  /**
   * Retry a failed webhook delivery
   * 
   * @example
   * ```typescript
   * const result = await client.webhooks.retryDelivery(
   *   'webhook-id',
   *   'delivery-id'
   * );
   * ```
   */
  async retryDelivery(webhookId: string, deliveryId: string, options?: RequestOptions): Promise<{
    success: boolean;
    statusCode?: number;
    duration: number;
    timestamp: string;
  }> {
    return this.client.request({
      method: 'POST',
      url: `/webhooks/${webhookId}/deliveries/${deliveryId}/retry`,
      ...options,
    });
  }
  
  /**
   * Get available webhook events
   * 
   * @example
   * ```typescript
   * const events = await client.webhooks.getAvailableEvents();
   * ```
   */
  async getAvailableEvents(options?: RequestOptions): Promise<{
    events: Array<{
      name: string;
      description: string;
    }>;
    totalCount: number;
  }> {
    return this.client.request({
      method: 'GET',
      url: '/webhooks/events',
      ...options,
    });
  }
  
  /**
   * Validate webhook signature
   * 
   * @example
   * ```typescript
   * // In your webhook handler
   * const isValid = client.webhooks.validateSignature(
   *   requestBody,
   *   signatureHeader,
   *   'your-webhook-secret'
   * );
   * 
   * if (!isValid) {
   *   throw new Error('Invalid webhook signature');
   * }
   * ```
   */
  validateSignature(payload: any, signature: string, secret: string): boolean {
    const crypto = require('crypto');
    const expectedSignature = 'sha256=' + crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(payload))
      .digest('hex');
    
    return signature === expectedSignature;
  }
}