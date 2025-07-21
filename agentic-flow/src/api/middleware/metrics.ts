import { Request, Response, NextFunction } from 'express';
import { register, Counter, Histogram, Gauge } from 'prom-client';

// Create metrics
const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
});

const httpRequestTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});

const httpRequestsInFlight = new Gauge({
  name: 'http_requests_in_flight',
  help: 'Number of HTTP requests currently being processed',
  labelNames: ['method', 'route'],
});

const apiErrors = new Counter({
  name: 'api_errors_total',
  help: 'Total number of API errors',
  labelNames: ['method', 'route', 'error_type'],
});

const apiKeyUsage = new Counter({
  name: 'api_key_usage_total',
  help: 'Total API key usage',
  labelNames: ['key_id', 'method', 'route'],
});

const rateLimitHits = new Counter({
  name: 'rate_limit_hits_total',
  help: 'Total number of rate limit hits',
  labelNames: ['key_id', 'method', 'route'],
});

// Register metrics
register.registerMetric(httpRequestDuration);
register.registerMetric(httpRequestTotal);
register.registerMetric(httpRequestsInFlight);
register.registerMetric(apiErrors);
register.registerMetric(apiKeyUsage);
register.registerMetric(rateLimitHits);

// Metrics collection middleware
export function apiMetrics(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  const route = req.route?.path || req.path;
  const method = req.method;
  
  // Increment in-flight requests
  httpRequestsInFlight.inc({ method, route });
  
  // Track API key usage
  if (req.apiKey) {
    apiKeyUsage.inc({
      key_id: req.apiKey.id,
      method,
      route,
    });
  }
  
  // Hook into response finish event
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const statusCode = res.statusCode.toString();
    
    // Record metrics
    httpRequestDuration.observe({ method, route, status_code: statusCode }, duration);
    httpRequestTotal.inc({ method, route, status_code: statusCode });
    httpRequestsInFlight.dec({ method, route });
    
    // Track errors
    if (res.statusCode >= 400) {
      const errorType = res.statusCode >= 500 ? 'server_error' : 'client_error';
      apiErrors.inc({ method, route, error_type: errorType });
    }
  });
  
  next();
}

// Rate limit metrics middleware
export function rateLimitMetrics(req: Request, res: Response, next: NextFunction) {
  if (res.statusCode === 429) {
    const route = req.route?.path || req.path;
    const method = req.method;
    const keyId = req.apiKey?.id || 'anonymous';
    
    rateLimitHits.inc({
      key_id: keyId,
      method,
      route,
    });
  }
  next();
}

// Metrics endpoint handler
export function metricsHandler(req: Request, res: Response) {
  res.set('Content-Type', register.contentType);
  res.end(register.metrics());
}

// Custom metrics for business logic
export const businessMetrics = {
  agentsCreated: new Counter({
    name: 'agents_created_total',
    help: 'Total number of agents created',
    labelNames: ['type'],
  }),
  
  workflowsExecuted: new Counter({
    name: 'workflows_executed_total',
    help: 'Total number of workflows executed',
    labelNames: ['status'],
  }),
  
  goalsProcessed: new Counter({
    name: 'goals_processed_total',
    help: 'Total number of goals processed',
    labelNames: ['priority', 'status'],
  }),
  
  messagesExchanged: new Counter({
    name: 'messages_exchanged_total',
    help: 'Total number of messages exchanged between agents',
    labelNames: ['type'],
  }),
  
  webhooksDelivered: new Counter({
    name: 'webhooks_delivered_total',
    help: 'Total number of webhooks delivered',
    labelNames: ['event_type', 'status'],
  }),
  
  activeAgents: new Gauge({
    name: 'active_agents',
    help: 'Number of currently active agents',
    labelNames: ['type'],
  }),
  
  queuedTasks: new Gauge({
    name: 'queued_tasks',
    help: 'Number of tasks in queue',
    labelNames: ['priority'],
  }),
};

// Register business metrics
Object.values(businessMetrics).forEach(metric => register.registerMetric(metric));