import { createClient } from 'redis';
import { EventEmitter } from 'events';

class RedisManager extends EventEmitter {
  constructor() {
    super();
    this.client = null;
    this.pubClient = null;
    this.subClient = null;
    this.isConnected = false;
  }

  async initialize(config = {}) {
    const redisUrl = config.url || process.env.REDIS_URL || 'redis://localhost:6379';
    
    try {
      // Main client for general operations
      this.client = createClient({
        url: redisUrl,
        socket: {
          connectTimeout: 10000,
          keepAlive: 5000,
          reconnectStrategy: (retries) => {
            if (retries > 10) {
              console.error('Redis: Max reconnection attempts reached');
              return false;
            }
            return Math.min(retries * 100, 3000);
          }
        }
      });

      // Pub/Sub clients for real-time messaging
      this.pubClient = this.client.duplicate();
      this.subClient = this.client.duplicate();

      // Error handling
      this.client.on('error', (err) => {
        console.error('Redis Client Error:', err);
        this.emit('error', err);
      });

      this.client.on('ready', () => {
        console.log('✅ Redis client connected');
        this.isConnected = true;
        this.emit('connected');
      });

      // Connect all clients
      await Promise.all([
        this.client.connect(),
        this.pubClient.connect(),
        this.subClient.connect()
      ]);

      console.log('🔴 Redis initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize Redis:', error);
      throw error;
    }
  }

  // Session Management
  async setSession(sessionId, data, ttl = 3600) {
    try {
      const key = `session:${sessionId}`;
      await this.client.setEx(key, ttl, JSON.stringify(data));
      return true;
    } catch (error) {
      console.error('Redis setSession error:', error);
      return false;
    }
  }

  async getSession(sessionId) {
    try {
      const key = `session:${sessionId}`;
      const data = await this.client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Redis getSession error:', error);
      return null;
    }
  }

  async deleteSession(sessionId) {
    try {
      const key = `session:${sessionId}`;
      await this.client.del(key);
      return true;
    } catch (error) {
      console.error('Redis deleteSession error:', error);
      return false;
    }
  }

  // Cache Management
  async setCache(key, value, ttl = 300) {
    try {
      const cacheKey = `cache:${key}`;
      await this.client.setEx(cacheKey, ttl, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error('Redis setCache error:', error);
      return false;
    }
  }

  async getCache(key) {
    try {
      const cacheKey = `cache:${key}`;
      const data = await this.client.get(cacheKey);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Redis getCache error:', error);
      return null;
    }
  }

  async invalidateCache(pattern) {
    try {
      const keys = await this.client.keys(`cache:${pattern}`);
      if (keys.length > 0) {
        await this.client.del(keys);
      }
      return true;
    } catch (error) {
      console.error('Redis invalidateCache error:', error);
      return false;
    }
  }

  // Distributed Lock
  async acquireLock(resource, ttl = 5000) {
    try {
      const lockKey = `lock:${resource}`;
      const lockId = Math.random().toString(36).substring(7);
      const result = await this.client.set(lockKey, lockId, {
        PX: ttl,
        NX: true
      });
      return result === 'OK' ? lockId : null;
    } catch (error) {
      console.error('Redis acquireLock error:', error);
      return null;
    }
  }

  async releaseLock(resource, lockId) {
    try {
      const lockKey = `lock:${resource}`;
      const currentLockId = await this.client.get(lockKey);
      if (currentLockId === lockId) {
        await this.client.del(lockKey);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Redis releaseLock error:', error);
      return false;
    }
  }

  // Pub/Sub for WebSocket scaling
  async publish(channel, message) {
    try {
      await this.pubClient.publish(channel, JSON.stringify(message));
      return true;
    } catch (error) {
      console.error('Redis publish error:', error);
      return false;
    }
  }

  async subscribe(channel, callback) {
    try {
      await this.subClient.subscribe(channel, (message) => {
        try {
          const data = JSON.parse(message);
          callback(data);
        } catch (error) {
          console.error('Redis message parse error:', error);
        }
      });
      return true;
    } catch (error) {
      console.error('Redis subscribe error:', error);
      return false;
    }
  }

  // Rate Limiting
  async checkRateLimit(identifier, limit = 100, window = 60) {
    try {
      const key = `ratelimit:${identifier}`;
      const current = await this.client.incr(key);
      
      if (current === 1) {
        await this.client.expire(key, window);
      }
      
      return {
        allowed: current <= limit,
        current,
        limit,
        remaining: Math.max(0, limit - current),
        resetIn: await this.client.ttl(key)
      };
    } catch (error) {
      console.error('Redis checkRateLimit error:', error);
      return { allowed: true, current: 0, limit, remaining: limit };
    }
  }

  // Cleanup
  async cleanup() {
    try {
      if (this.client) await this.client.quit();
      if (this.pubClient) await this.pubClient.quit();
      if (this.subClient) await this.subClient.quit();
      console.log('Redis connections closed');
    } catch (error) {
      console.error('Redis cleanup error:', error);
    }
  }
}

// Singleton instance
const redisManager = new RedisManager();

export default redisManager;