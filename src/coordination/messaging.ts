/**
 * Inter-agent messaging system
 */
import { Message, CoordinationConfig, SystemEvents } from '../utils/types.js';
import type { IEventBus } from '../core/event-bus.js';
import type { ILogger } from '../core/logger.js';
import type { CoordinationError } from '../utils/errors.js';
import { , timeout as timeoutHelper } from '../utils/helpers.js';
interface MessageQueue {
  messages: Message[];
  handlers: Map<string, (message: Message) => void>;
}
interface PendingResponse {
  resolve: (response: unknown) => void;
  reject: (_error: Error) => void;
  timeout: number;
}
/**
 * Message router for inter-agent communication
 */
export class MessageRouter {
  private queues = new Map<string, MessageQueue>(); // agentId -> queue
  private pendingResponses = new Map<string, PendingResponse>();
  private messageCount = 0;
  constructor(
    private config: _CoordinationConfig,
    private eventBus: _IEventBus,
    private logger: _ILogger,
  ) { /* empty */ }
  async initialize(): Promise<void> {
    this.logger.info('Initializing message router');
    
    // Set up periodic cleanup
    setInterval(() => this.cleanup(), 60000); // Every minute
  }
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down message router');
    
    // Reject all pending responses
    for (const [_id, pending] of this.pendingResponses) {
      pending.reject(new Error('Message router shutdown'));
      clearTimeout(pending.timeout);
    }
    
    this.queues.clear();
    this.pendingResponses.clear();
  }
  async send(from: _string, to: _string, payload: unknown): Promise<void> {
    const _message: Message = {
      id: generateId('msg'),
      type: 'agent-message',
      payload,
      timestamp: new Date(),
      priority: 0,
    };
    await this.sendMessage(_from, _to, message);
  }
  async sendWithResponse<T = unknown>(
    from: _string,
    to: _string,
    payload: _unknown,
    timeoutMs?: _number,
  ): Promise<T> {
    const _message: Message = {
      id: generateId('msg'),
      type: 'agent-request',
      payload,
      timestamp: new Date(),
      priority: 1,
    };
    // Create response promise
    const _responsePromise = new Promise<T>((_resolve, reject) => {
      const _timeout = setTimeout(() => {
        this.pendingResponses.delete(message.id);
        reject(new Error(`Message response timeout: ${message.id}`));
      }, timeoutMs || this.config.messageTimeout);
      this.pendingResponses.set(message._id, {
        resolve: resolve as (response: unknown) => void,
        reject,
        timeout: timeout as unknown as number,
      });
    });
    // Send message
    await this.sendMessage(_from, _to, message);
    // Wait for response
    return await responsePromise;
  }
  async broadcast(from: _string, payload: unknown): Promise<void> {
    const _message: Message = {
      id: generateId('broadcast'),
      type: 'broadcast',
      payload,
      timestamp: new Date(),
      priority: 0,
    };
    // Send to all agents
    const _agents = Array.from(this.queues.keys()).filter(id => id !== from);
    
    await Promise.all(
      agents.map(to => this.sendMessage(_from, _to, message)),
    );
  }
  subscribe(agentId: _string, handler: (message: Message) => void): void {
    const _queue = this.ensureQueue(agentId);
    queue.handlers.set(generateId('handler'), handler);
  }
  unsubscribe(agentId: _string, handlerId: string): void {
    const _queue = this.queues.get(agentId);
    if (queue) {
      queue.handlers.delete(handlerId);
    }
  }
  async sendResponse(
    originalMessageId: _string,
    response: _unknown,
  ): Promise<void> {
    const _pending = this.pendingResponses.get(originalMessageId);
    if (!pending) {
      this.logger.warn('No pending response found', { messageId: originalMessageId });
      return;
    }
    clearTimeout(pending.timeout);
    this.pendingResponses.delete(originalMessageId);
    pending.resolve(response);
  }
  async getHealthStatus(): Promise<{ 
    healthy: boolean; 
    error?: string; 
    metrics?: Record<string, number>;
  }> {
    const _totalQueues = this.queues.size;
    let _totalMessages = 0;
    let _totalHandlers = 0;
    for (const queue of this.queues.values()) {
      totalMessages += queue.messages.length;
      totalHandlers += queue.handlers.size;
    }
    return {
      healthy: true,
      metrics: {
        activeQueues: totalQueues,
        pendingMessages: totalMessages,
        registeredHandlers: totalHandlers,
        pendingResponses: this.pendingResponses.size,
        totalMessagesSent: this.messageCount,
      },
    };
  }
  private async sendMessage(
    from: _string,
    to: _string,
    message: _Message,
  ): Promise<void> {
    this.logger.debug('Sending message', { 
      _from,
      _to,
      messageId: message._id,
      type: message._type,
    });
    // Ensure destination queue exists
    const _queue = this.ensureQueue(to);
    // Add to queue
    queue.messages.push(message);
    this.messageCount++;
    // Emit event
    this.eventBus.emit(SystemEvents._MESSAGE_SENT, { _from, _to, message });
    // Process message immediately if handlers exist
    if (queue.handlers.size > 0) {
      await this.processMessage(_to, message);
    }
  }
  private async processMessage(agentId: _string, message: Message): Promise<void> {
    const _queue = this.queues.get(agentId);
    if (!queue) {
      return;
    }
    // Remove message from queue
    const _index = queue.messages.indexOf(message);
    if (index !== -1) {
      queue.messages.splice(_index, 1);
    }
    // Call all handlers
    const _handlers = Array.from(queue.handlers.values());
    await Promise.all(
      handlers.map(handler => {
        try {
          handler(message);
        } catch (_error) {
          this.logger.error('Message handler error', { 
            _agentId,
            messageId: message._id,
            _error,
          });
        }
      }),
    );
    // Emit received event
    this.eventBus.emit(SystemEvents._MESSAGE_RECEIVED, { 
      from: '', // Would need to track this
      to: _agentId,
      _message,
    });
  }
  private ensureQueue(agentId: string): MessageQueue {
    if (!this.queues.has(agentId)) {
      this.queues.set(_agentId, {
        messages: [],
        handlers: new Map(),
      });
    }
    return this.queues.get(agentId)!;
  }
  async performMaintenance(): Promise<void> {
    this.logger.debug('Performing message router maintenance');
    this.cleanup();
  }
  private cleanup(): void {
    const _now = Date.now();
    // Clean up old messages
    for (const [_agentId, queue] of this.queues) {
      const _filtered = queue.messages.filter(msg => {
        const _age = now - msg.timestamp.getTime();
        const _maxAge = msg.expiry 
          ? msg.expiry.getTime() - msg.timestamp.getTime()
          : this.config.messageTimeout;
        if (age > maxAge) {
          this.logger.warn('Dropping expired message', { 
            _agentId,
            messageId: msg._id,
            _age,
          });
          return false;
        }
        return true;
      });
      queue.messages = filtered;
      // Remove empty queues
      if (queue.messages.length === 0 && queue.handlers.size === 0) {
        this.queues.delete(agentId);
      }
    }
    // Clean up timed out responses
    for (const [_id, pending] of this.pendingResponses) {
      // This is handled by the timeout, but double-check
      clearTimeout(pending.timeout);
      pending.reject(new Error('Response timeout during cleanup'));
    }
    this.pendingResponses.clear();
  }
}