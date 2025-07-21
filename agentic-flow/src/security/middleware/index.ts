/**
 * Security Middleware
 * Express/Koa middleware for integrating security features
 */

import { Request, Response, NextFunction } from 'express';
import { AuthenticationService } from '../auth/auth-service';
import { RBACService } from '../auth/rbac-service';
import { TenantService } from '../multi-tenancy/tenant-service';
import { AuditService } from '../audit/audit-service';
import { SecurityMonitor } from '../monitoring/security-monitor';
import { SecurityEvent, User, JWTPayload } from '../types';
import { v4 as uuidv4 } from 'uuid';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: User;
      tenant?: any;
      tenantId?: string;
      sessionId?: string;
      requestId?: string;
    }
  }
}

export interface SecurityMiddlewareConfig {
  authService: AuthenticationService;
  rbacService: RBACService;
  tenantService: TenantService;
  auditService: AuditService;
  securityMonitor: SecurityMonitor;
  publicPaths?: string[];
  rateLimits?: {
    windowMs: number;
    max: number;
    keyGenerator?: (req: Request) => string;
  };
}

/**
 * Authentication middleware
 */
export function authenticate(config: SecurityMiddlewareConfig) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Skip authentication for public paths
      if (config.publicPaths?.some(path => req.path.startsWith(path))) {
        return next();
      }

      // Extract token from header
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        // Check for API key
        const apiKey = req.headers['x-api-key'] as string;
        if (apiKey) {
          const key = await config.authService.validateApiKey(apiKey);
          if (key) {
            req.user = { id: key.userId, tenantId: key.tenantId } as User;
            req.tenantId = key.tenantId;
            return next();
          }
        }

        return res.status(401).json({ error: 'Authentication required' });
      }

      const token = authHeader.substring(7);

      // Verify token
      const payload = await config.authService.verifyToken(token);
      
      // Get user from payload (would typically fetch from database)
      req.user = {
        id: payload.sub,
        email: payload.email,
        tenantId: payload.tenantId,
        roles: [], // Would be populated from database
        permissions: [] // Would be populated from database
      } as User;
      
      req.tenantId = payload.tenantId;
      req.sessionId = payload.jti;

      // Check session validity
      const session = await config.authService.validateSession(req.sessionId);
      if (!session) {
        return res.status(401).json({ error: 'Session expired' });
      }

      next();
    } catch (error) {
      // Log authentication failure
      const event: SecurityEvent = {
        id: uuidv4(),
        timestamp: new Date(),
        type: 'authentication_failure',
        severity: 'warning',
        source: 'auth_middleware',
        details: {
          error: error.message,
          path: req.path,
          method: req.method,
          ip: req.ip
        },
        indicators: []
      };
      
      await config.securityMonitor.processSecurityEvent(event);
      
      res.status(401).json({ error: 'Invalid authentication' });
    }
  };
}

/**
 * Authorization middleware
 */
export function authorize(resource: string, action: string) {
  return (config: SecurityMiddlewareConfig) => {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.user) {
          return res.status(401).json({ error: 'Authentication required' });
        }

        // Check permission
        const hasPermission = await config.rbacService.hasPermission(
          req.user.id,
          resource,
          action,
          {
            user: req.user,
            resource,
            action,
            tenant: { id: req.tenantId } as any,
            environment: {
              method: req.method,
              path: req.path
            },
            request: {
              ip: req.ip,
              timestamp: new Date()
            }
          }
        );

        if (!hasPermission) {
          // Log authorization failure
          const event: SecurityEvent = {
            id: uuidv4(),
            timestamp: new Date(),
            type: 'authorization_violation',
            severity: 'error',
            source: 'auth_middleware',
            userId: req.user.id,
            tenantId: req.tenantId,
            details: {
              resource,
              action,
              path: req.path,
              method: req.method,
              ip: req.ip
            },
            indicators: []
          };
          
          await config.securityMonitor.processSecurityEvent(event);
          
          return res.status(403).json({ error: 'Insufficient permissions' });
        }

        next();
      } catch (error) {
        res.status(500).json({ error: 'Authorization check failed' });
      }
    };
  };
}

/**
 * Tenant isolation middleware
 */
export function tenantIsolation(config: SecurityMiddlewareConfig) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId || req.headers['x-tenant-id'] as string;
      
      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant ID required' });
      }

      // Get tenant
      const tenant = await config.tenantService.getTenant(tenantId);
      if (!tenant) {
        return res.status(404).json({ error: 'Tenant not found' });
      }

      if (tenant.status !== 'active') {
        return res.status(403).json({ error: `Tenant ${tenant.status}` });
      }

      // Check resource limits
      const resourceType = getResourceType(req.path);
      if (resourceType) {
        const limitCheck = await config.tenantService.checkResourceLimit(
          tenantId,
          resourceType as any,
          1
        );
        
        if (!limitCheck.allowed) {
          return res.status(429).json({ 
            error: 'Resource limit exceeded',
            limit: limitCheck.limit,
            current: limitCheck.current
          });
        }
      }

      // Set tenant context
      req.tenant = tenant;
      
      // Run request in tenant context
      await config.tenantService.runInTenantContext(
        tenantId,
        req.user?.id,
        async () => {
          next();
        }
      );
    } catch (error) {
      res.status(500).json({ error: 'Tenant isolation failed' });
    }
  };
}

/**
 * Audit logging middleware
 */
export function auditLog(config: SecurityMiddlewareConfig) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    req.requestId = uuidv4();

    // Capture response
    const originalSend = res.send;
    res.send = function(data: any) {
      res.send = originalSend;
      
      // Log request
      config.auditService.log({
        tenantId: req.tenantId,
        userId: req.user?.id,
        action: {
          category: 'data',
          type: 'api_request',
          severity: 'low',
          description: `${req.method} ${req.path}`
        },
        resource: 'api',
        resourceId: req.path,
        result: res.statusCode < 400 ? 'success' : 'failure',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        duration: Date.now() - startTime,
        metadata: {
          method: req.method,
          path: req.path,
          query: req.query,
          statusCode: res.statusCode,
          requestId: req.requestId
        }
      }).catch(error => {
        console.error('Audit logging failed:', error);
      });

      return res.send(data);
    };

    next();
  };
}

/**
 * Rate limiting middleware
 */
export function rateLimit(config: SecurityMiddlewareConfig) {
  const requests = new Map<string, number[]>();
  
  return async (req: Request, res: Response, next: NextFunction) => {
    const key = config.rateLimits?.keyGenerator?.(req) || 
                req.user?.id || 
                req.ip;
    
    const now = Date.now();
    const windowMs = config.rateLimits?.windowMs || 60000;
    const max = config.rateLimits?.max || 100;

    // Get requests for key
    let timestamps = requests.get(key) || [];
    
    // Remove old timestamps
    timestamps = timestamps.filter(t => now - t < windowMs);
    
    if (timestamps.length >= max) {
      // Rate limit exceeded
      const event: SecurityEvent = {
        id: uuidv4(),
        timestamp: new Date(),
        type: 'rate_limit_exceeded',
        severity: 'warning',
        source: 'rate_limit_middleware',
        userId: req.user?.id,
        tenantId: req.tenantId,
        details: {
          key,
          limit: max,
          window: windowMs,
          requests: timestamps.length,
          path: req.path,
          method: req.method,
          ip: req.ip
        },
        indicators: []
      };
      
      await config.securityMonitor.processSecurityEvent(event);
      
      return res.status(429).json({ 
        error: 'Rate limit exceeded',
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }

    // Add current request
    timestamps.push(now);
    requests.set(key, timestamps);

    // Update tenant API usage
    if (req.tenantId) {
      await config.tenantService.updateResourceUsage(
        req.tenantId,
        'apiCalls',
        1
      );
    }

    next();
  };
}

/**
 * Security headers middleware
 */
export function securityHeaders() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('Content-Security-Policy', "default-src 'self'");
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    
    // Remove sensitive headers
    res.removeHeader('X-Powered-By');
    
    next();
  };
}

/**
 * Input validation middleware
 */
export function validateInput(schema: any) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate request body, query, and params
      const data = {
        body: req.body,
        query: req.query,
        params: req.params
      };

      const validated = await schema.parseAsync(data);
      
      // Replace with validated data
      req.body = validated.body || req.body;
      req.query = validated.query || req.query;
      req.params = validated.params || req.params;
      
      next();
    } catch (error) {
      // Log validation failure
      const event: SecurityEvent = {
        id: uuidv4(),
        timestamp: new Date(),
        type: 'invalid_input',
        severity: 'warning',
        source: 'validation_middleware',
        userId: req.user?.id,
        tenantId: req.tenantId,
        details: {
          error: error.message,
          path: req.path,
          method: req.method,
          ip: req.ip
        },
        indicators: []
      };
      
      // Don't await to avoid blocking
      config.securityMonitor.processSecurityEvent(event).catch(() => {});
      
      res.status(400).json({ 
        error: 'Validation failed',
        details: error.errors || error.message
      });
    }
  };
}

/**
 * CORS middleware with security
 */
export function secureCors(options?: {
  origins?: string[];
  credentials?: boolean;
}) {
  return (req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;
    
    if (origin && options?.origins?.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', String(options.credentials || false));
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Authorization,Content-Type,X-Tenant-ID,X-API-Key');
      res.setHeader('Access-Control-Max-Age', '86400');
    }
    
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    
    next();
  };
}

/**
 * Error handling middleware
 */
export function errorHandler(config: SecurityMiddlewareConfig) {
  return async (err: any, req: Request, res: Response, next: NextFunction) => {
    // Log error
    await config.auditService.log({
      tenantId: req.tenantId,
      userId: req.user?.id,
      action: {
        category: 'system',
        type: 'error',
        severity: 'error',
        description: 'Request error'
      },
      resource: 'api',
      resourceId: req.path,
      result: 'failure',
      errorMessage: err.message,
      metadata: {
        stack: err.stack,
        requestId: req.requestId
      }
    }).catch(() => {});

    // Send error response
    const statusCode = err.statusCode || 500;
    const message = statusCode === 500 ? 'Internal server error' : err.message;
    
    res.status(statusCode).json({
      error: message,
      requestId: req.requestId
    });
  };
}

/**
 * Helper functions
 */
function getResourceType(path: string): string | null {
  if (path.includes('/users')) return 'users';
  if (path.includes('/agents')) return 'agents';
  if (path.includes('/workflows')) return 'workflows';
  if (path.includes('/api')) return 'apiCalls';
  return null;
}

// Re-export for convenience
export { SecurityMiddlewareConfig };