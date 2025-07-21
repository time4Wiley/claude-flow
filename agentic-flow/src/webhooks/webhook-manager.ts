import axios from 'axios';
import { createHmac } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import { Logger } from '../utils/logger';

const logger = new Logger('webhook-manager');

export interface Webhook {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  secret: string;
  createdAt: Date;
  updatedAt?: Date;
  lastTriggered?: Date;
  deliveryStats: {
    totalDeliveries: number;
    successfulDeliveries: number;
    failedDeliveries: number;
    averageResponseTime: number;
  };
}

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  event: any;
  success: boolean;
  statusCode?: number;
  duration: number;
  response?: any;
  error?: string;
  timestamp: Date;
  retryCount: number;
}

export class WebhookManager extends EventEmitter {
  private webhooks: Map<string, Webhook> = new Map();
  private deliveries: Map<string, WebhookDelivery[]> = new Map();
  private retryQueue: Map<string, NodeJS.Timeout> = new Map();
  
  constructor() {
    super();
    this.initializeEventHandlers();
  }
  
  private initializeEventHandlers() {
    // Subscribe to system events
    this.on('agent.created', (data) => this.triggerWebhooks('agent.created', data));
    this.on('agent.status_changed', (data) => this.triggerWebhooks('agent.status_changed', data));
    this.on('workflow.started', (data) => this.triggerWebhooks('workflow.started', data));
    this.on('workflow.completed', (data) => this.triggerWebhooks('workflow.completed', data));
    this.on('goal.created', (data) => this.triggerWebhooks('goal.created', data));
    this.on('goal.completed', (data) => this.triggerWebhooks('goal.completed', data));
    this.on('message.sent', (data) => this.triggerWebhooks('message.sent', data));
  }
  
  async createWebhook(data: {
    url: string;
    events: string[];
    secret?: string;
  }): Promise<Webhook> {
    const webhook: Webhook = {
      id: uuidv4(),
      url: data.url,
      events: data.events,
      active: true,
      secret: data.secret || this.generateSecret(),
      createdAt: new Date(),
      deliveryStats: {
        totalDeliveries: 0,
        successfulDeliveries: 0,
        failedDeliveries: 0,
        averageResponseTime: 0,
      },
    };
    
    this.webhooks.set(webhook.id, webhook);
    this.deliveries.set(webhook.id, []);
    
    logger.info('Webhook created', { webhookId: webhook.id, url: webhook.url });
    
    return webhook;
  }
  
  async getWebhook(id: string): Promise<Webhook | null> {
    return this.webhooks.get(id) || null;
  }
  
  async listWebhooks(): Promise<Webhook[]> {
    return Array.from(this.webhooks.values());
  }
  
  async updateWebhook(id: string, data: Partial<{
    url: string;
    events: string[];
    secret: string;
  }>): Promise<Webhook | null> {
    const webhook = this.webhooks.get(id);
    if (!webhook) return null;
    
    Object.assign(webhook, data, { updatedAt: new Date() });
    this.webhooks.set(id, webhook);
    
    return webhook;
  }
  
  async deleteWebhook(id: string): Promise<boolean> {
    const webhook = this.webhooks.get(id);
    if (!webhook) return false;
    
    // Cancel any pending retries
    const retryTimer = this.retryQueue.get(id);
    if (retryTimer) {
      clearTimeout(retryTimer);
      this.retryQueue.delete(id);
    }
    
    this.webhooks.delete(id);
    this.deliveries.delete(id);
    
    logger.info('Webhook deleted', { webhookId: id });
    
    return true;
  }
  
  async toggleWebhook(id: string, active: boolean): Promise<Webhook | null> {
    const webhook = this.webhooks.get(id);
    if (!webhook) return null;
    
    webhook.active = active;
    webhook.updatedAt = new Date();
    this.webhooks.set(id, webhook);
    
    return webhook;
  }
  
  generateSecret(): string {
    return `whsec_${Buffer.from(uuidv4()).toString('base64').replace(/[^a-zA-Z0-9]/g, '')}`;
  }
  
  private async triggerWebhooks(eventType: string, data: any) {
    const webhooks = Array.from(this.webhooks.values()).filter(
      webhook => webhook.active && webhook.events.includes(eventType)
    );
    
    for (const webhook of webhooks) {
      const event = {
        id: uuidv4(),
        type: eventType,
        timestamp: new Date().toISOString(),
        data,
      };
      
      // Deliver asynchronously
      this.deliverWebhook(webhook, event).catch(error => {
        logger.error('Failed to deliver webhook', {
          webhookId: webhook.id,
          eventType,
          error: error.message,
        });
      });
    }
  }
  
  async deliverWebhook(webhook: Webhook, event: any): Promise<WebhookDelivery> {
    const startTime = Date.now();
    const delivery: WebhookDelivery = {
      id: uuidv4(),
      webhookId: webhook.id,
      event,
      success: false,
      duration: 0,
      timestamp: new Date(),
      retryCount: 0,
    };
    
    try {
      // Generate signature
      const signature = this.generateSignature(webhook.secret, event);
      
      // Make HTTP request
      const response = await axios.post(webhook.url, event, {
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-ID': webhook.id,
          'X-Webhook-Timestamp': new Date().toISOString(),
        },
        timeout: 30000, // 30 second timeout
        validateStatus: () => true, // Don't throw on any status
      });
      
      delivery.duration = Date.now() - startTime;
      delivery.statusCode = response.status;
      delivery.success = response.status >= 200 && response.status < 300;
      delivery.response = response.data;
      
      // Update webhook stats
      webhook.lastTriggered = new Date();
      webhook.deliveryStats.totalDeliveries++;
      if (delivery.success) {
        webhook.deliveryStats.successfulDeliveries++;
      } else {
        webhook.deliveryStats.failedDeliveries++;
      }
      
      // Update average response time
      const stats = webhook.deliveryStats;
      stats.averageResponseTime = (
        (stats.averageResponseTime * (stats.totalDeliveries - 1) + delivery.duration) /
        stats.totalDeliveries
      );
      
    } catch (error: any) {
      delivery.duration = Date.now() - startTime;
      delivery.error = error.message;
      webhook.deliveryStats.totalDeliveries++;
      webhook.deliveryStats.failedDeliveries++;
      
      // Schedule retry if appropriate
      if (delivery.retryCount < 3) {
        this.scheduleRetry(webhook, event, delivery.retryCount + 1);
      }
    }
    
    // Store delivery record
    const deliveries = this.deliveries.get(webhook.id) || [];
    deliveries.push(delivery);
    
    // Keep only last 100 deliveries
    if (deliveries.length > 100) {
      deliveries.shift();
    }
    
    this.deliveries.set(webhook.id, deliveries);
    
    return delivery;
  }
  
  private generateSignature(secret: string, payload: any): string {
    const hmac = createHmac('sha256', secret);
    hmac.update(JSON.stringify(payload));
    return `sha256=${hmac.digest('hex')}`;
  }
  
  private scheduleRetry(webhook: Webhook, event: any, retryCount: number) {
    const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff
    
    const timer = setTimeout(async () => {
      try {
        await this.deliverWebhook(webhook, event);
      } catch (error) {
        logger.error('Retry delivery failed', {
          webhookId: webhook.id,
          retryCount,
          error,
        });
      }
      
      this.retryQueue.delete(webhook.id);
    }, delay);
    
    this.retryQueue.set(webhook.id, timer);
  }
  
  async getWebhookDeliveries(webhookId: string, options: {
    limit?: number;
    offset?: number;
  } = {}): Promise<WebhookDelivery[]> {
    const deliveries = this.deliveries.get(webhookId) || [];
    const { limit = 20, offset = 0 } = options;
    
    return deliveries.slice(offset, offset + limit);
  }
  
  async retryDelivery(webhookId: string, deliveryId: string): Promise<WebhookDelivery | null> {
    const webhook = this.webhooks.get(webhookId);
    if (!webhook) return null;
    
    const deliveries = this.deliveries.get(webhookId) || [];
    const delivery = deliveries.find(d => d.id === deliveryId);
    if (!delivery) return null;
    
    return this.deliverWebhook(webhook, delivery.event);
  }
  
  getAvailableEvents(): Array<{ name: string; description: string }> {
    return [
      { name: 'agent.created', description: 'Agent created' },
      { name: 'agent.started', description: 'Agent started' },
      { name: 'agent.stopped', description: 'Agent stopped' },
      { name: 'agent.status_changed', description: 'Agent status changed' },
      { name: 'workflow.created', description: 'Workflow created' },
      { name: 'workflow.started', description: 'Workflow execution started' },
      { name: 'workflow.completed', description: 'Workflow execution completed' },
      { name: 'workflow.failed', description: 'Workflow execution failed' },
      { name: 'goal.created', description: 'Goal created' },
      { name: 'goal.assigned', description: 'Goal assigned to agent' },
      { name: 'goal.completed', description: 'Goal completed' },
      { name: 'goal.failed', description: 'Goal failed' },
      { name: 'message.sent', description: 'Message sent between agents' },
      { name: 'message.received', description: 'Message received by agent' },
      { name: 'plugin.installed', description: 'Plugin installed' },
      { name: 'plugin.enabled', description: 'Plugin enabled' },
      { name: 'plugin.disabled', description: 'Plugin disabled' },
      { name: 'webhook.test', description: 'Test webhook delivery' },
    ];
  }
}