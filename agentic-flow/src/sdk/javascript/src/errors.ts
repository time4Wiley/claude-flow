/**
 * Base error class for all Agentic Flow SDK errors
 */
export class AgenticFlowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AgenticFlowError';
    Object.setPrototypeOf(this, AgenticFlowError.prototype);
  }
}

/**
 * API error with status code and error details
 */
export class APIError extends AgenticFlowError {
  constructor(
    message: string,
    public statusCode: number,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'APIError';
    Object.setPrototypeOf(this, APIError.prototype);
  }
}

/**
 * Authentication error
 */
export class AuthenticationError extends AgenticFlowError {
  constructor(message: string = 'Authentication failed') {
    super(message);
    this.name = 'AuthenticationError';
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

/**
 * Rate limit error with retry information
 */
export class RateLimitError extends AgenticFlowError {
  constructor(
    message: string = 'Rate limit exceeded',
    public retryAfter?: number
  ) {
    super(message);
    this.name = 'RateLimitError';
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }
}

/**
 * Validation error for invalid request parameters
 */
export class ValidationError extends AgenticFlowError {
  constructor(
    message: string,
    public errors?: Array<{ field: string; message: string }>
  ) {
    super(message);
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * Resource not found error
 */
export class NotFoundError extends AgenticFlowError {
  constructor(
    resource: string,
    id?: string
  ) {
    super(id ? `${resource} with ID '${id}' not found` : `${resource} not found`);
    this.name = 'NotFoundError';
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

/**
 * WebSocket connection error
 */
export class WebSocketError extends AgenticFlowError {
  constructor(message: string) {
    super(message);
    this.name = 'WebSocketError';
    Object.setPrototypeOf(this, WebSocketError.prototype);
  }
}

/**
 * Timeout error for requests that exceed the timeout limit
 */
export class TimeoutError extends AgenticFlowError {
  constructor(message: string = 'Request timed out') {
    super(message);
    this.name = 'TimeoutError';
    Object.setPrototypeOf(this, TimeoutError.prototype);
  }
}