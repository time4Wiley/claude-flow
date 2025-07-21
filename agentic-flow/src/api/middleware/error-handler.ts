import { Request, Response, NextFunction } from 'express';
import { Logger } from '../../utils/logger';

const logger = new Logger('api-error-handler');

// Custom error class for API errors
export class APIError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'APIError';
  }
}

// Error handler middleware
export function errorHandler(
  err: Error | APIError,
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Log error details
  logger.error('API error occurred', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    body: req.body,
    query: req.query,
    params: req.params,
    headers: req.headers,
  });
  
  // Handle known API errors
  if (err instanceof APIError) {
    return res.status(err.statusCode).json({
      error: err.code,
      message: err.message,
      details: err.details,
    });
  }
  
  // Handle validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'validation_error',
      message: 'Request validation failed',
      details: err.message,
    });
  }
  
  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'invalid_token',
      message: 'Invalid authentication token',
    });
  }
  
  // Handle token expiration
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'token_expired',
      message: 'Authentication token has expired',
    });
  }
  
  // Handle syntax errors in JSON
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({
      error: 'invalid_json',
      message: 'Invalid JSON in request body',
    });
  }
  
  // Default error response
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(500).json({
    error: 'internal_error',
    message: isDevelopment ? err.message : 'An internal error occurred',
    ...(isDevelopment && { stack: err.stack }),
  });
}

// Async error wrapper for route handlers
export function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Not found handler
export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    error: 'not_found',
    message: 'The requested resource was not found',
    path: req.path,
  });
}

// Method not allowed handler
export function methodNotAllowedHandler(req: Request, res: Response) {
  res.status(405).json({
    error: 'method_not_allowed',
    message: `Method ${req.method} is not allowed for this endpoint`,
    path: req.path,
  });
}