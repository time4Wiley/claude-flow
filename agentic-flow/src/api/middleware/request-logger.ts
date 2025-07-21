import { Request, Response, NextFunction } from 'express';
import { Logger } from '../../utils/logger';
import { v4 as uuidv4 } from 'uuid';

const logger = new Logger('api-request');

// Extend Express Request type to include request ID
declare global {
  namespace Express {
    interface Request {
      id: string;
      startTime: number;
    }
  }
}

// Request logging middleware
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  // Generate unique request ID
  req.id = uuidv4();
  req.startTime = Date.now();
  
  // Log request
  logger.info('Incoming request', {
    requestId: req.id,
    method: req.method,
    path: req.path,
    query: req.query,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('user-agent'),
    apiKey: req.get('x-api-key') ? 'provided' : 'none',
    auth: req.get('authorization') ? 'provided' : 'none',
  });
  
  // Log response
  const originalSend = res.send;
  res.send = function(data: any) {
    const duration = Date.now() - req.startTime;
    
    logger.info('Request completed', {
      requestId: req.id,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      contentType: res.get('content-type'),
      contentLength: res.get('content-length'),
    });
    
    // Add request ID to response headers
    res.set('X-Request-ID', req.id);
    res.set('X-Response-Time', `${duration}ms`);
    
    return originalSend.call(this, data);
  };
  
  next();
}

// Performance monitoring middleware
export function performanceMonitor(req: Request, res: Response, next: NextFunction) {
  const startTime = process.hrtime.bigint();
  
  res.on('finish', () => {
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1e6; // Convert to milliseconds
    
    if (duration > 1000) {
      logger.warn('Slow request detected', {
        requestId: req.id,
        method: req.method,
        path: req.path,
        duration: `${duration.toFixed(2)}ms`,
      });
    }
  });
  
  next();
}

// Request sanitizer middleware
export function requestSanitizer(req: Request, res: Response, next: NextFunction) {
  // Remove sensitive information from logs
  const sanitizedHeaders = { ...req.headers };
  if (sanitizedHeaders.authorization) {
    sanitizedHeaders.authorization = 'Bearer [REDACTED]';
  }
  if (sanitizedHeaders['x-api-key']) {
    sanitizedHeaders['x-api-key'] = '[REDACTED]';
  }
  
  // Store sanitized version for logging
  (req as any).sanitizedHeaders = sanitizedHeaders;
  
  next();
}