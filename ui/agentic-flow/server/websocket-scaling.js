import { createAdapter } from '@socket.io/redis-adapter';
import { Cluster } from '@socket.io/cluster-adapter';
import { setupWorker } from '@socket.io/sticky';
import redisManager from './redis-client.js';

export class ScalableWebSocketServer {
  constructor(io) {
    this.io = io;
    this.isInitialized = false;
  }

  async initialize() {
    try {
      // Set up Redis adapter for Socket.IO
      await this.setupRedisAdapter();
      
      // Configure sticky sessions for WebSocket
      this.setupStickySessions();
      
      // Set up cluster coordination
      this.setupClusterCoordination();
      
      this.isInitialized = true;
      console.log('✅ WebSocket scaling initialized');
    } catch (error) {
      console.error('Failed to initialize WebSocket scaling:', error);
      throw error;
    }
  }

  async setupRedisAdapter() {
    // Create Redis adapter for Socket.IO
    const pubClient = redisManager.pubClient;
    const subClient = redisManager.subClient;
    
    this.io.adapter(createAdapter(pubClient, subClient));
    
    // Handle adapter errors
    this.io.of('/').adapter.on('error', (error) => {
      console.error('Redis adapter error:', error);
    });
    
    console.log('✅ Redis adapter configured for Socket.IO');
  }

  setupStickySessions() {
    // This ensures WebSocket connections from the same client
    // always go to the same worker process
    if (process.env.NODE_APP_INSTANCE) {
      setupWorker(this.io);
      console.log(`Worker ${process.env.NODE_APP_INSTANCE} setup for sticky sessions`);
    }
  }

  setupClusterCoordination() {
    // Custom events for cross-instance communication
    this.io.on('connection', (socket) => {
      // Track socket connections in Redis
      this.trackConnection(socket);
      
      // Handle cross-instance messaging
      socket.on('broadcast-to-cluster', async (data) => {
        await this.broadcastToCluster(data);
      });
      
      // Clean up on disconnect
      socket.on('disconnect', () => {
        this.untrackConnection(socket);
      });
    });
  }

  async trackConnection(socket) {
    const connectionInfo = {
      socketId: socket.id,
      workerId: process.env.NODE_APP_INSTANCE || '0',
      connectedAt: new Date().toISOString(),
      userId: socket.data.userId || null
    };
    
    await redisManager.setCache(
      `socket:${socket.id}`,
      connectionInfo,
      3600 // 1 hour TTL
    );
    
    // Track active connections count
    await redisManager.client.incr('stats:active_connections');
  }

  async untrackConnection(socket) {
    await redisManager.client.del(`socket:${socket.id}`);
    await redisManager.client.decr('stats:active_connections');
  }

  async broadcastToCluster(data) {
    // Publish message to all instances via Redis
    await redisManager.publish('cluster:broadcast', data);
  }

  // Get connection stats across all instances
  async getClusterStats() {
    const activeConnections = await redisManager.client.get('stats:active_connections') || 0;
    const workers = await this.getActiveWorkers();
    
    return {
      totalConnections: parseInt(activeConnections),
      activeWorkers: workers.length,
      workers: workers,
      timestamp: new Date().toISOString()
    };
  }

  async getActiveWorkers() {
    const pattern = 'worker:heartbeat:*';
    const keys = await redisManager.client.keys(pattern);
    const workers = [];
    
    for (const key of keys) {
      const data = await redisManager.client.get(key);
      if (data) {
        const workerInfo = JSON.parse(data);
        const lastHeartbeat = new Date(workerInfo.timestamp);
        const now = new Date();
        
        // Consider worker active if heartbeat within last 30 seconds
        if (now - lastHeartbeat < 30000) {
          workers.push(workerInfo);
        }
      }
    }
    
    return workers;
  }

  // Worker heartbeat for health monitoring
  async startHeartbeat() {
    const workerId = process.env.NODE_APP_INSTANCE || '0';
    const heartbeatKey = `worker:heartbeat:${workerId}`;
    
    const sendHeartbeat = async () => {
      const heartbeatData = {
        workerId,
        pid: process.pid,
        connections: this.io.sockets.sockets.size,
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString()
      };
      
      await redisManager.client.setEx(
        heartbeatKey,
        60, // 60 second TTL
        JSON.stringify(heartbeatData)
      );
    };
    
    // Send initial heartbeat
    await sendHeartbeat();
    
    // Send heartbeat every 20 seconds
    setInterval(sendHeartbeat, 20000);
  }

  // Room management across instances
  async getRoomMembers(roomName) {
    const sockets = await this.io.in(roomName).fetchSockets();
    return sockets.map(socket => ({
      id: socket.id,
      data: socket.data
    }));
  }

  // Emit to specific room across all instances
  async emitToRoom(roomName, event, data) {
    this.io.to(roomName).emit(event, data);
  }

  // Disconnect specific socket across cluster
  async disconnectSocket(socketId) {
    const sockets = await this.io.fetchSockets();
    const socket = sockets.find(s => s.id === socketId);
    if (socket) {
      socket.disconnect(true);
    }
  }
}

// Middleware for rate limiting WebSocket connections
export function createRateLimitMiddleware(options = {}) {
  const {
    windowMs = 60000, // 1 minute
    maxConnections = 100,
    keyGenerator = (socket) => socket.handshake.address
  } = options;

  return async (socket, next) => {
    const key = keyGenerator(socket);
    const rateLimitKey = `ws_ratelimit:${key}`;
    
    const { allowed, remaining } = await redisManager.checkRateLimit(
      rateLimitKey,
      maxConnections,
      Math.floor(windowMs / 1000)
    );
    
    if (!allowed) {
      return next(new Error('Too many connections'));
    }
    
    socket.data.rateLimit = { remaining };
    next();
  };
}

// Middleware for session validation
export function createSessionMiddleware() {
  return async (socket, next) => {
    const sessionId = socket.handshake.auth.sessionId;
    
    if (!sessionId) {
      return next(new Error('No session ID provided'));
    }
    
    const session = await redisManager.getSession(sessionId);
    
    if (!session) {
      return next(new Error('Invalid session'));
    }
    
    socket.data.session = session;
    socket.data.userId = session.userId;
    next();
  };
}