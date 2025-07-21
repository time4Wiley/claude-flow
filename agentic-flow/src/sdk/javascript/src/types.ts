/**
 * Client configuration options
 */
export interface ClientOptions {
  /**
   * API key for authentication
   */
  apiKey?: string;
  
  /**
   * Access token for JWT authentication
   */
  accessToken?: string;
  
  /**
   * Base URL for the API (defaults to https://api.agenticflow.dev/v1)
   */
  baseUrl?: string;
  
  /**
   * Request timeout in milliseconds (defaults to 30000)
   */
  timeout?: number;
  
  /**
   * Maximum number of retries for failed requests (defaults to 3)
   */
  maxRetries?: number;
  
  /**
   * Initial delay between retries in milliseconds (defaults to 1000)
   */
  retryDelay?: number;
  
  /**
   * Additional headers to include in requests
   */
  headers?: Record<string, string>;
  
  /**
   * Enable WebSocket connection for real-time events (defaults to true)
   */
  enableWebSocket?: boolean;
}

/**
 * Request options for individual API calls
 */
export interface RequestOptions {
  /**
   * Override the default timeout for this request
   */
  timeout?: number;
  
  /**
   * Override the default retry count for this request
   */
  maxRetries?: number;
  
  /**
   * Override the default retry delay for this request
   */
  retryDelay?: number;
  
  /**
   * Additional headers for this request
   */
  headers?: Record<string, string>;
}

/**
 * Pagination parameters
 */
export interface PaginationParams {
  limit?: number;
  offset?: number;
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  items: T[];
  totalCount: number;
  nextOffset?: number;
}

/**
 * Agent types
 */
export type AgentType = 'coordinator' | 'executor' | 'specialized';
export type AgentStatus = 'active' | 'inactive' | 'initializing' | 'error';

export interface Agent {
  id: string;
  name: string;
  type: AgentType;
  status: AgentStatus;
  capabilities: string[];
  configuration?: Record<string, any>;
  metrics: AgentMetrics;
  createdAt: string;
  updatedAt: string;
}

export interface AgentMetrics {
  tasksCompleted: number;
  successRate: number;
  averageResponseTime: number;
  lastActivity?: string;
}

export interface CreateAgentRequest {
  name: string;
  type: AgentType;
  capabilities?: string[];
  configuration?: Record<string, any>;
}

export interface UpdateAgentRequest {
  name?: string;
  capabilities?: string[];
  configuration?: Record<string, any>;
}

/**
 * Workflow types
 */
export type WorkflowStatus = 'draft' | 'active' | 'completed' | 'failed';
export type WorkflowStepType = 'agent' | 'condition' | 'parallel' | 'sequential';

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  status: WorkflowStatus;
  steps: WorkflowStep[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowStep {
  name: string;
  type: WorkflowStepType;
  action: string;
  parameters?: Record<string, any>;
  dependencies?: string[];
}

export interface CreateWorkflowRequest {
  name: string;
  description?: string;
  steps: WorkflowStep[];
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: string;
  startedAt: string;
  completedAt?: string;
  results?: Record<string, any>;
}

/**
 * Goal types
 */
export type Priority = 'low' | 'medium' | 'high' | 'critical';
export type GoalStatus = 'pending' | 'analyzing' | 'executing' | 'completed' | 'failed';

export interface Goal {
  id: string;
  description: string;
  priority: Priority;
  status: GoalStatus;
  parsedIntent: ParsedIntent;
  subtasks: Subtask[];
  createdAt: string;
  updatedAt?: string;
  completedAt?: string;
}

export interface ParsedIntent {
  action: string;
  entities: Entity[];
  constraints?: Record<string, any>;
}

export interface Entity {
  type: string;
  value: string;
}

export interface Subtask {
  id: string;
  description: string;
  status: string;
  assignedAgent?: string;
}

export interface CreateGoalRequest {
  description: string;
  priority?: Priority;
  constraints?: Record<string, any>;
}

/**
 * Message types
 */
export type MessageType = 'task' | 'result' | 'query' | 'response' | 'event';

export interface Message {
  id: string;
  from: string;
  to: string;
  type: MessageType;
  content: Record<string, any>;
  priority: Priority;
  timestamp: string;
  deliveredAt?: string;
  readAt?: string;
}

export interface SendMessageRequest {
  from: string;
  to: string;
  type: MessageType;
  content: Record<string, any>;
  priority?: Priority;
}

/**
 * Webhook types
 */
export interface Webhook {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  secret?: string;
  createdAt: string;
  lastTriggered?: string;
  deliveryStats: WebhookStats;
}

export interface WebhookStats {
  totalDeliveries: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  averageResponseTime: number;
}

export interface CreateWebhookRequest {
  url: string;
  events: string[];
  secret?: string;
}

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  event: any;
  success: boolean;
  statusCode?: number;
  duration: number;
  timestamp: string;
}

/**
 * Plugin types
 */
export interface Plugin {
  id: string;
  name: string;
  version: string;
  description?: string;
  enabled: boolean;
  configuration?: Record<string, any>;
  capabilities: string[];
}

export interface InstallPluginRequest {
  source: string;
  configuration?: Record<string, any>;
}

/**
 * System types
 */
export interface SystemHealth {
  status: string;
  uptime: number;
  version: string;
  checks: HealthCheck[];
}

export interface HealthCheck {
  name: string;
  status: string;
  message?: string;
}

export interface SystemMetrics {
  activeAgents: number;
  totalWorkflows: number;
  executingWorkflows: number;
  pendingGoals: number;
  messageQueueSize: number;
  averageResponseTime: number;
  requestsPerMinute: number;
}