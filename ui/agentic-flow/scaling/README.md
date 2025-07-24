# Scaling Implementation Guide

## Overview

This guide provides instructions for implementing the scaling architecture for Agentic Flow, enabling the application to handle high loads and scale horizontally.

## Quick Start

### 1. Install Dependencies

```bash
npm install redis bull pg @socket.io/redis-adapter prom-client
npm install --save-dev pm2
```

### 2. Start Services with Docker Compose

```bash
docker-compose up -d
```

This will start:
- PostgreSQL database
- Redis cache
- 3 Node.js application instances
- Nginx load balancer
- Prometheus monitoring
- Grafana dashboards

### 3. Run with PM2 (Production)

```bash
# Start all services
pm2 start ecosystem.config.js

# Monitor services
pm2 monit

# View logs
pm2 logs
```

## Architecture Components

### 1. Load Balancing

- **Nginx**: Handles HTTP/HTTPS traffic distribution
- **Sticky Sessions**: Ensures WebSocket connections stay on same server
- **Health Checks**: Automatic failover for unhealthy nodes

### 2. Process Management

- **PM2 Cluster Mode**: Utilizes all CPU cores
- **Graceful Reload**: Zero-downtime deployments
- **Auto-restart**: Handles crashes automatically

### 3. State Management

- **Redis**: Sessions, cache, pub/sub
- **PostgreSQL**: Persistent data with connection pooling
- **Job Queues**: Background task processing

### 4. Monitoring

- **Prometheus**: Metrics collection
- **Grafana**: Visualization dashboards
- **Custom Metrics**: Application-specific monitoring

## Performance Optimizations

### Database

```javascript
// Connection pooling configuration
const pool = new Pool({
  max: 20,                    // Maximum connections
  idleTimeoutMillis: 30000,  // Close idle connections
  connectionTimeoutMillis: 2000
});
```

### Redis Caching

```javascript
// Cache API responses
const cached = await redisManager.getCache('api:users');
if (cached) return cached;

const data = await fetchUsers();
await redisManager.setCache('api:users', data, 300); // 5 min TTL
```

### WebSocket Scaling

```javascript
// Redis adapter for Socket.IO
io.adapter(createAdapter(pubClient, subClient));

// Emit to all instances
io.to('room').emit('message', data);
```

## Deployment Options

### Docker Swarm

```bash
# Initialize swarm
docker swarm init

# Deploy stack
docker stack deploy -c docker-compose.yml agentic-flow
```

### Kubernetes

```bash
# Create namespace
kubectl create namespace agentic-flow

# Apply configurations
kubectl apply -f k8s/

# Check deployment
kubectl get pods -n agentic-flow
```

### Manual Deployment

1. Set up PostgreSQL and Redis
2. Configure Nginx load balancer
3. Deploy application nodes
4. Set up monitoring

## Configuration

### Environment Variables

```bash
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=agentic_flow
DB_USER=postgres
DB_PASSWORD=secure_password

# Redis
REDIS_URL=redis://localhost:6379

# Application
NODE_ENV=production
PORT=3001
WS_PORT=3002

# Monitoring
PROMETHEUS_PORT=9090
GRAFANA_PORT=3000
```

### Scaling Parameters

```javascript
// PM2 configuration
instances: 'max',  // Use all CPU cores
max_memory_restart: '1G',

// HPA configuration
minReplicas: 3,
maxReplicas: 20,
targetCPUUtilizationPercentage: 70
```

## Monitoring & Alerts

### Key Metrics

1. **Response Time**: < 100ms p95
2. **Error Rate**: < 0.1%
3. **CPU Usage**: < 70%
4. **Memory Usage**: < 80%
5. **Active Connections**: Monitor trends

### Grafana Dashboards

1. System Overview
2. API Performance
3. WebSocket Connections
4. Database Performance
5. Redis Cache Hit Rate

### Alert Rules

```yaml
- alert: HighResponseTime
  expr: http_request_duration_seconds{quantile="0.95"} > 0.1
  for: 5m
  
- alert: HighErrorRate
  expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.001
  for: 5m
```

## Troubleshooting

### Common Issues

1. **WebSocket Connection Drops**
   - Check sticky session configuration
   - Verify Redis pub/sub is working
   - Check firewall rules

2. **High Memory Usage**
   - Monitor memory leaks with heap dumps
   - Adjust PM2 max_memory_restart
   - Check Redis memory policy

3. **Database Connection Errors**
   - Verify connection pool settings
   - Check max_connections in PostgreSQL
   - Monitor slow queries

### Debug Commands

```bash
# Check PM2 status
pm2 status

# View application logs
pm2 logs api --lines 100

# Monitor in real-time
pm2 monit

# Check Redis
redis-cli ping
redis-cli info stats

# Check PostgreSQL connections
psql -c "SELECT count(*) FROM pg_stat_activity;"
```

## Performance Testing

### Load Testing with k6

```javascript
import http from 'k6/http';
import { check } from 'k6';

export let options = {
  stages: [
    { duration: '2m', target: 100 },
    { duration: '5m', target: 1000 },
    { duration: '2m', target: 0 },
  ],
};

export default function() {
  let res = http.get('https://agentic-flow.example.com/api/health');
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
}
```

### WebSocket Testing

```javascript
import ws from 'k6/ws';

export default function() {
  const url = 'wss://agentic-flow.example.com/socket.io';
  ws.connect(url, {}, function(socket) {
    socket.on('open', () => console.log('connected'));
    socket.on('message', (data) => console.log('Message:', data));
    socket.on('close', () => console.log('disconnected'));
  });
}
```

## Maintenance

### Backup Strategy

```bash
# Database backup
pg_dump agentic_flow > backup_$(date +%Y%m%d).sql

# Redis backup
redis-cli BGSAVE
```

### Rolling Updates

```bash
# PM2 rolling restart
pm2 reload ecosystem.config.js

# Kubernetes rolling update
kubectl set image deployment/agentic-flow-api api=agentic-flow:v2 -n agentic-flow
```

### Health Checks

- `/health` - Application health
- `/metrics` - Prometheus metrics
- `/nginx-status` - Nginx status
- `/api/status` - Detailed system status

## Security Considerations

1. Use HTTPS with valid certificates
2. Implement rate limiting
3. Set up firewall rules
4. Use secrets management
5. Regular security updates
6. Monitor for anomalies

## Support

For issues or questions:
1. Check application logs
2. Review monitoring dashboards
3. Consult troubleshooting guide
4. Submit GitHub issue