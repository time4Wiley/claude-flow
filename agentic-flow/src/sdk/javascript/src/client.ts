import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { EventEmitter } from 'eventemitter3';
import { AgentResource } from './resources/agents';
import { WorkflowResource } from './resources/workflows';
import { GoalResource } from './resources/goals';
import { MessageResource } from './resources/messages';
import { WebhookResource } from './resources/webhooks';
import { PluginResource } from './resources/plugins';
import { WebSocketClient } from './utils/websocket';
import { AgenticFlowError, APIError, AuthenticationError, RateLimitError } from './errors';
import { ClientOptions, RequestOptions } from './types';

export class AgenticFlowClient extends EventEmitter {
  private axios: AxiosInstance;
  private wsClient?: WebSocketClient;
  private options: Required<ClientOptions>;
  
  // Resources
  public agents: AgentResource;
  public workflows: WorkflowResource;
  public goals: GoalResource;
  public messages: MessageResource;
  public webhooks: WebhookResource;
  public plugins: PluginResource;
  
  constructor(options: ClientOptions) {
    super();
    
    // Set default options
    this.options = {
      baseUrl: options.baseUrl || 'https://api.agenticflow.dev/v1',
      apiKey: options.apiKey,
      timeout: options.timeout || 30000,
      maxRetries: options.maxRetries || 3,
      retryDelay: options.retryDelay || 1000,
      headers: options.headers || {},
      enableWebSocket: options.enableWebSocket ?? true,
    };
    
    // Validate required options
    if (!this.options.apiKey && !options.accessToken) {
      throw new AuthenticationError('API key or access token is required');
    }
    
    // Create axios instance
    this.axios = axios.create({
      baseURL: this.options.baseUrl,
      timeout: this.options.timeout,
      headers: {
        'Content-Type': 'application/json',
        'X-SDK-Version': '1.0.0',
        'X-SDK-Language': 'JavaScript',
        ...this.options.headers,
      },
    });
    
    // Set authentication header
    if (this.options.apiKey) {
      this.axios.defaults.headers.common['X-API-Key'] = this.options.apiKey;
    } else if (options.accessToken) {
      this.axios.defaults.headers.common['Authorization'] = `Bearer ${options.accessToken}`;
    }
    
    // Add request interceptor
    this.axios.interceptors.request.use(
      (config) => {
        // Add request ID
        config.headers['X-Request-ID'] = this.generateRequestId();
        return config;
      },
      (error) => Promise.reject(error)
    );
    
    // Add response interceptor
    this.axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response) {
          const { status, data } = error.response;
          
          // Handle specific error types
          if (status === 401) {
            throw new AuthenticationError(data.message || 'Authentication failed');
          } else if (status === 429) {
            const retryAfter = error.response.headers['retry-after'];
            throw new RateLimitError(
              data.message || 'Rate limit exceeded',
              retryAfter ? parseInt(retryAfter) : undefined
            );
          } else {
            throw new APIError(
              data.message || 'API request failed',
              status,
              data.error,
              data.details
            );
          }
        } else if (error.request) {
          throw new AgenticFlowError('No response received from server');
        } else {
          throw new AgenticFlowError(error.message);
        }
      }
    );
    
    // Initialize resources
    this.agents = new AgentResource(this);
    this.workflows = new WorkflowResource(this);
    this.goals = new GoalResource(this);
    this.messages = new MessageResource(this);
    this.webhooks = new WebhookResource(this);
    this.plugins = new PluginResource(this);
    
    // Initialize WebSocket if enabled
    if (this.options.enableWebSocket) {
      this.initializeWebSocket();
    }
  }
  
  /**
   * Make an HTTP request
   */
  async request<T = any>(config: AxiosRequestConfig & RequestOptions): Promise<T> {
    const { maxRetries = this.options.maxRetries, retryDelay = this.options.retryDelay } = config;
    
    let lastError: any;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.axios.request<T>(config);
        return response.data;
      } catch (error) {
        lastError = error;
        
        // Don't retry on client errors (4xx)
        if (error instanceof APIError && error.statusCode >= 400 && error.statusCode < 500) {
          throw error;
        }
        
        // Wait before retrying
        if (attempt < maxRetries) {
          await this.delay(retryDelay * Math.pow(2, attempt)); // Exponential backoff
        }
      }
    }
    
    throw lastError;
  }
  
  /**
   * Initialize WebSocket connection for real-time events
   */
  private initializeWebSocket() {
    const wsUrl = this.options.baseUrl.replace(/^http/, 'ws') + '/ws';
    
    this.wsClient = new WebSocketClient(wsUrl, {
      headers: {
        'X-API-Key': this.options.apiKey,
      },
    });
    
    // Forward WebSocket events
    this.wsClient.on('agent.status_changed', (data) => {
      this.emit('agent:status_changed', data);
    });
    
    this.wsClient.on('workflow.execution_started', (data) => {
      this.emit('workflow:started', data);
    });
    
    this.wsClient.on('workflow.execution_completed', (data) => {
      this.emit('workflow:completed', data);
    });
    
    this.wsClient.on('goal.created', (data) => {
      this.emit('goal:created', data);
    });
    
    this.wsClient.on('goal.status_changed', (data) => {
      this.emit('goal:status_changed', data);
    });
    
    this.wsClient.on('message.received', (data) => {
      this.emit('message:received', data);
    });
    
    // Connect WebSocket
    this.wsClient.connect();
  }
  
  /**
   * Subscribe to specific agent events
   */
  subscribeToAgent(agentId: string) {
    if (this.wsClient) {
      this.wsClient.send('subscribe', { type: 'agent', id: agentId });
    }
  }
  
  /**
   * Unsubscribe from agent events
   */
  unsubscribeFromAgent(agentId: string) {
    if (this.wsClient) {
      this.wsClient.send('unsubscribe', { type: 'agent', id: agentId });
    }
  }
  
  /**
   * Get system health status
   */
  async getHealth(): Promise<any> {
    const response = await axios.get(`${this.options.baseUrl.replace('/v1', '')}/health`);
    return response.data;
  }
  
  /**
   * Get API metrics (requires appropriate permissions)
   */
  async getMetrics(): Promise<any> {
    return this.request({
      method: 'GET',
      url: '/metrics',
    });
  }
  
  /**
   * Close the client and cleanup resources
   */
  close() {
    if (this.wsClient) {
      this.wsClient.close();
    }
    this.removeAllListeners();
  }
  
  /**
   * Generate a unique request ID
   */
  private generateRequestId(): string {
    return `sdk-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Delay helper for retries
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}