import { register, collectDefaultMetrics, Counter, Histogram, Gauge } from 'prom-client';

// Collect default metrics (CPU, memory, etc.)
collectDefaultMetrics({ 
  timeout: 10000,
  prefix: 'agentic_flow_'
});

// Custom metrics
const httpRequestDuration = new Histogram({
  name: 'agentic_flow_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10]
});

const httpRequestTotal = new Counter({
  name: 'agentic_flow_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

const activeConnections = new Gauge({
  name: 'agentic_flow_active_connections',
  help: 'Number of active connections',
  labelNames: ['type']
});

const swarmAgents = new Gauge({
  name: 'agentic_flow_swarm_agents',
  help: 'Number of agents in swarm',
  labelNames: ['type', 'status']
});

const taskQueue = new Gauge({
  name: 'agentic_flow_task_queue_size',
  help: 'Number of tasks in queue',
  labelNames: ['priority', 'status']
});

const cacheHitRate = new Counter({
  name: 'agentic_flow_cache_hits_total',
  help: 'Total number of cache hits',
  labelNames: ['cache_type']
});

const cacheMissRate = new Counter({
  name: 'agentic_flow_cache_misses_total',
  help: 'Total number of cache misses',
  labelNames: ['cache_type']
});

const databaseQueryDuration = new Histogram({
  name: 'agentic_flow_database_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['query_type', 'table'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5]
});

const websocketConnections = new Gauge({
  name: 'agentic_flow_websocket_connections',
  help: 'Number of active WebSocket connections',
  labelNames: ['namespace']
});

const mcpToolExecutions = new Counter({
  name: 'agentic_flow_mcp_tool_executions_total',
  help: 'Total number of MCP tool executions',
  labelNames: ['tool_name', 'status']
});

const mcpToolDuration = new Histogram({
  name: 'agentic_flow_mcp_tool_duration_seconds',
  help: 'Duration of MCP tool executions in seconds',
  labelNames: ['tool_name'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60]
});

// Middleware function
export function metricsMiddleware() {
  return (req, res, next) => {
    const start = Date.now();
    
    // Capture route before any modifications
    const route = req.route?.path || req.path || 'unknown';
    
    // Track response
    res.on('finish', () => {
      const duration = (Date.now() - start) / 1000;
      const labels = {
        method: req.method,
        route: route,
        status_code: res.statusCode
      };
      
      httpRequestDuration.observe(labels, duration);
      httpRequestTotal.inc(labels);
    });
    
    next();
  };
}

// Metrics endpoint handler
export function metricsHandler(req, res) {
  res.set('Content-Type', register.contentType);
  register.metrics().then(metrics => {
    res.end(metrics);
  }).catch(err => {
    res.status(500).end(err.message);
  });
}

// Update metrics functions
export const metrics = {
  // Update active connections
  setActiveConnections(type, count) {
    activeConnections.set({ type }, count);
  },
  
  // Update swarm agents
  setSwarmAgents(type, status, count) {
    swarmAgents.set({ type, status }, count);
  },
  
  // Update task queue
  setTaskQueue(priority, status, count) {
    taskQueue.set({ priority, status }, count);
  },
  
  // Track cache hit/miss
  recordCacheHit(cacheType) {
    cacheHitRate.inc({ cache_type: cacheType });
  },
  
  recordCacheMiss(cacheType) {
    cacheMissRate.inc({ cache_type: cacheType });
  },
  
  // Track database query
  recordDatabaseQuery(queryType, table, duration) {
    databaseQueryDuration.observe({ query_type: queryType, table }, duration);
  },
  
  // Update WebSocket connections
  setWebSocketConnections(namespace, count) {
    websocketConnections.set({ namespace }, count);
  },
  
  // Track MCP tool execution
  recordMCPToolExecution(toolName, status, duration) {
    mcpToolExecutions.inc({ tool_name: toolName, status });
    if (duration !== undefined) {
      mcpToolDuration.observe({ tool_name: toolName }, duration);
    }
  }
};

// System metrics collector
export async function collectSystemMetrics(redisClient, dbPool) {
  try {
    // Collect Redis metrics
    const redisInfo = await redisClient.info();
    const redisStats = parseRedisInfo(redisInfo);
    
    // Collect database pool metrics
    const poolStats = dbPool.getPoolStats();
    
    // Update gauges
    metrics.setActiveConnections('redis', redisStats.connected_clients || 0);
    metrics.setActiveConnections('database_write', poolStats.write.total);
    metrics.setActiveConnections('database_read', poolStats.read.total);
    
  } catch (error) {
    console.error('Error collecting system metrics:', error);
  }
}

// Helper to parse Redis INFO output
function parseRedisInfo(info) {
  const stats = {};
  const lines = info.split('\r\n');
  
  for (const line of lines) {
    if (line.includes(':')) {
      const [key, value] = line.split(':');
      stats[key] = value;
    }
  }
  
  return stats;
}

// Graceful shutdown to flush metrics
export async function shutdownMetrics() {
  // Clear all metrics intervals
  clearInterval(metricsInterval);
  
  // Final metrics collection
  await collectSystemMetrics();
  
  console.log('Metrics collection stopped');
}

// Start periodic metrics collection
let metricsInterval;
export function startMetricsCollection(redisClient, dbPool) {
  metricsInterval = setInterval(() => {
    collectSystemMetrics(redisClient, dbPool);
  }, 15000); // Every 15 seconds
}