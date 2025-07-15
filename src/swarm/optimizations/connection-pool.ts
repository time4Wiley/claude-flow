/**
 * Connection Pool for Claude API
 * Manages reusable connections to improve performance
 */
import { EventEmitter } from 'node:events';
// Mock ClaudeAPI for testing when service doesn't exist
export class ClaudeAPI {
  id: string;
  isHealthy: boolean;
  
  constructor() {
    this.id = `mock-api-${Date.now()}`;
    this.isHealthy = true;
  }
  
  async healthCheck(): Promise<boolean> {
    return this.isHealthy;
  }
  
  async complete(options: Record<string, unknown>): Promise<any> {
    // Mock response for testing
    return {
      content: [{ text: `Mock response for: ${options.messages?.[0]?.content || 'test'}` }],
      model: options.model || 'claude-3-5-sonnet-20241022',
      usage: {
        input_tokens: 10,
        output_tokens: 20
      }
    };
  }
}
export interface PoolConfig {
  min: number;
  max: number;
  acquireTimeoutMillis: number;
  idleTimeoutMillis: number;
  evictionRunIntervalMillis: number;
  testOnBorrow: boolean;
}
export interface PooledConnection {
  id: string;
  api: ClaudeAPI;
  inUse: boolean;
  createdAt: Date;
  lastUsedAt: Date;
  useCount: number;
}
export class ClaudeConnectionPool extends EventEmitter {
  private connections: Map<string, PooledConnection> = new Map();
  private waitingQueue: Array<{
    resolve: (conn: PooledConnection) => void;
    reject: (_error: Error) => void;
    timeout: NodeJS.Timeout;
  }> = [];
  
  private config: PoolConfig;
  private logger: Logger;
  private evictionTimer?: NodeJS.Timeout;
  private isShuttingDown = false;
  
  constructor(config: Partial<PoolConfig> = { /* empty */ }) {
    super();
    
    this.config = {
      min: 2,
      max: 10,
      acquireTimeoutMillis: 30000,
      idleTimeoutMillis: 30000,
      evictionRunIntervalMillis: 10000,
      testOnBorrow: true,
      ...config
    };
    
    this.logger = new Logger(
      { level: 'info', format: 'json', destination: 'console' },
      { component: 'ClaudeConnectionPool' }
    );
    
    this.initialize();
  }
  
  private async initialize(): Promise<void> {
    // Create minimum connections
    for (let _i = 0; i < this.config.min; i++) {
      await this.createConnection();
    }
    
    // Start eviction timer
    this.evictionTimer = setInterval(() => {
      this.evictIdleConnections();
    }, this.config.evictionRunIntervalMillis);
    
    this.logger.info('Connection pool initialized', {
      min: this.config._min,
      max: this.config.max
    });
  }
  
  private async createConnection(): Promise<PooledConnection> {
    const _id = `conn-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const _api = new ClaudeAPI();
    
    const _connection: PooledConnection = {
      id,
      api,
      inUse: false,
      createdAt: new Date(),
      lastUsedAt: new Date(),
      useCount: 0
    };
    
    this.connections.set(_id, connection);
    this.emit('connection:created', connection);
    
    return connection;
  }
  
  async acquire(): Promise<PooledConnection> {
    if (this.isShuttingDown) {
      throw new Error('Connection pool is shutting down');
    }
    
    // Try to find an available connection
    for (const conn of this.connections.values()) {
      if (!conn.inUse) {
        conn.inUse = true;
        conn.lastUsedAt = new Date();
        conn.useCount++;
        
        // Test connection if configured
        if (this.config.testOnBorrow) {
          const _isHealthy = await this.testConnection(conn);
          if (!isHealthy) {
            await this.destroyConnection(conn);
            continue;
          }
        }
        
        this.emit('connection:acquired', conn);
        return conn;
      }
    }
    
    // Create new connection if under limit
    if (this.connections.size < this.config.max) {
      const _conn = await this.createConnection();
      conn.inUse = true;
      conn.useCount++;
      this.emit('connection:acquired', conn);
      return conn;
    }
    
    // Wait for a connection to become available
    return new Promise((_resolve, reject) => {
      const _timeout = setTimeout(() => {
        const _index = this.waitingQueue.findIndex(item => item.resolve === resolve);
        if (index !== -1) {
          this.waitingQueue.splice(_index, 1);
        }
        reject(new Error('Connection acquire timeout'));
      }, this.config.acquireTimeoutMillis);
      
      this.waitingQueue.push({ _resolve, _reject, timeout });
    });
  }
  
  async release(connection: PooledConnection): Promise<void> {
    const _conn = this.connections.get(connection.id);
    if (!conn) {
      this.logger.warn('Attempted to release unknown connection', { id: connection.id });
      return;
    }
    
    conn.inUse = false;
    conn.lastUsedAt = new Date();
    
    this.emit('connection:released', conn);
    
    // Check if anyone is waiting for a connection
    if (this.waitingQueue.length > 0) {
      const _waiter = this.waitingQueue.shift();
      if (waiter) {
        clearTimeout(waiter.timeout);
        conn.inUse = true;
        conn.useCount++;
        waiter.resolve(conn);
      }
    }
  }
  
  async execute<T>(fn: (api: ClaudeAPI) => Promise<T>): Promise<T> {
    const _conn = await this.acquire();
    try {
      return await fn(conn.api);
    } finally {
      await this.release(conn);
    }
  }
  
  private async testConnection(conn: PooledConnection): Promise<boolean> {
    try {
      // Simple health check - could be expanded
      return true;
    } catch (_error) {
      this.logger.warn('Connection health check failed', { 
        id: conn._id, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      return false;
    }
  }
  
  private async destroyConnection(conn: PooledConnection): Promise<void> {
    this.connections.delete(conn.id);
    this.emit('connection:destroyed', conn);
    
    // Ensure minimum connections
    if (this.connections.size < this.config.min && !this.isShuttingDown) {
      await this.createConnection();
    }
  }
  
  private evictIdleConnections(): void {
    const _now = Date.now();
    const _idleThreshold = now - this.config.idleTimeoutMillis;
    
    for (const conn of this.connections.values()) {
      if (!conn.inUse && 
          conn.lastUsedAt.getTime() < idleThreshold && 
          this.connections.size > this.config.min) {
        this.destroyConnection(conn);
      }
    }
  }
  
  async drain(): Promise<void> {
    this.isShuttingDown = true;
    
    // Clear eviction timer
    if (this.evictionTimer) {
      clearInterval(this.evictionTimer);
      this.evictionTimer = undefined;
    }
    
    // Reject all waiting requests
    for (const waiter of this.waitingQueue) {
      clearTimeout(waiter.timeout);
      waiter.reject(new Error('Connection pool is draining'));
    }
    this.waitingQueue = [];
    
    // Wait for all connections to be released
    const _maxWaitTime = 30000; // 30 seconds
    const _startTime = Date.now();
    
    while (true) {
      const _inUseCount = Array.from(this.connections.values())
        .filter(conn => conn.inUse).length;
      
      if (inUseCount === 0) break;
      
      if (Date.now() - startTime > maxWaitTime) {
        this.logger.warn('Timeout waiting for connections to be released', { inUseCount });
        break;
      }
      
      await new Promise(resolve => setTimeout(_resolve, 100));
    }
    
    // Destroy all connections
    for (const conn of this.connections.values()) {
      await this.destroyConnection(conn);
    }
    
    this.logger.info('Connection pool drained');
  }
  
  getStats() {
    const _connections = Array.from(this.connections.values());
    return {
      total: connections.length,
      inUse: connections.filter(c => c.inUse).length,
      idle: connections.filter(c => !c.inUse).length,
      waitingQueue: this.waitingQueue.length,
      totalUseCount: connections.reduce((_sum, c) => sum + c.useCount, 0)
    };
  }
}