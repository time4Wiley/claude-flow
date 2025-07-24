import pg from 'pg';
import { EventEmitter } from 'events';

const { Pool } = pg;

class DatabaseManager extends EventEmitter {
  constructor() {
    super();
    this.pool = null;
    this.readPool = null;
    this.isConnected = false;
  }

  async initialize(config = {}) {
    const defaultConfig = {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'agentic_flow',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      max: 20, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
      connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
      maxUses: 7500, // Close and replace a connection after it has been used 7500 times
    };

    try {
      // Main pool for writes
      this.pool = new Pool({
        ...defaultConfig,
        ...config,
        application_name: 'agentic_flow_write'
      });

      // Read replica pool (can point to same DB in development)
      this.readPool = new Pool({
        ...defaultConfig,
        ...config,
        host: process.env.DB_READ_HOST || config.host || defaultConfig.host,
        application_name: 'agentic_flow_read'
      });

      // Test connections
      await this.pool.query('SELECT NOW()');
      await this.readPool.query('SELECT NOW()');

      // Pool error handling
      this.pool.on('error', (err, client) => {
        console.error('Unexpected error on idle client', err);
        this.emit('error', err);
      });

      this.readPool.on('error', (err, client) => {
        console.error('Unexpected error on idle read client', err);
        this.emit('error', err);
      });

      // Connection event tracking
      this.pool.on('connect', (client) => {
        console.log('New client connected to write pool');
      });

      this.pool.on('acquire', (client) => {
        console.log('Client acquired from write pool');
      });

      this.pool.on('remove', (client) => {
        console.log('Client removed from write pool');
      });

      this.isConnected = true;
      console.log('✅ Database pools initialized successfully');
      
      // Create tables if they don't exist
      await this.initializeTables();
      
      return true;
    } catch (error) {
      console.error('Failed to initialize database:', error);
      throw error;
    }
  }

  async initializeTables() {
    const createTablesSQL = `
      -- Swarms table
      CREATE TABLE IF NOT EXISTS swarms (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        topology VARCHAR(50) NOT NULL,
        max_agents INTEGER DEFAULT 5,
        strategy VARCHAR(50) DEFAULT 'balanced',
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Agents table
      CREATE TABLE IF NOT EXISTS agents (
        id VARCHAR(255) PRIMARY KEY,
        swarm_id VARCHAR(255) REFERENCES swarms(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL,
        status VARCHAR(50) DEFAULT 'idle',
        capabilities JSONB DEFAULT '[]',
        metrics JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Tasks table
      CREATE TABLE IF NOT EXISTS tasks (
        id VARCHAR(255) PRIMARY KEY,
        swarm_id VARCHAR(255) REFERENCES swarms(id) ON DELETE CASCADE,
        agent_id VARCHAR(255) REFERENCES agents(id) ON DELETE SET NULL,
        description TEXT NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        priority VARCHAR(50) DEFAULT 'medium',
        strategy VARCHAR(50) DEFAULT 'parallel',
        progress INTEGER DEFAULT 0,
        result JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP
      );

      -- Memory entries table
      CREATE TABLE IF NOT EXISTS memory_entries (
        key VARCHAR(255) PRIMARY KEY,
        value JSONB NOT NULL,
        namespace VARCHAR(100) DEFAULT 'default',
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP
      );

      -- Performance metrics table
      CREATE TABLE IF NOT EXISTS performance_metrics (
        id SERIAL PRIMARY KEY,
        metric_type VARCHAR(50) NOT NULL,
        metric_name VARCHAR(100) NOT NULL,
        value NUMERIC NOT NULL,
        tags JSONB DEFAULT '{}',
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Create indexes for better performance
      CREATE INDEX IF NOT EXISTS idx_agents_swarm_id ON agents(swarm_id);
      CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
      CREATE INDEX IF NOT EXISTS idx_tasks_swarm_id ON tasks(swarm_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_agent_id ON tasks(agent_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
      CREATE INDEX IF NOT EXISTS idx_memory_namespace ON memory_entries(namespace);
      CREATE INDEX IF NOT EXISTS idx_memory_expires ON memory_entries(expires_at);
      CREATE INDEX IF NOT EXISTS idx_metrics_timestamp ON performance_metrics(timestamp);
      CREATE INDEX IF NOT EXISTS idx_metrics_type ON performance_metrics(metric_type);
    `;

    try {
      await this.pool.query(createTablesSQL);
      console.log('✅ Database tables initialized');
    } catch (error) {
      console.error('Failed to create tables:', error);
      throw error;
    }
  }

  // Query execution with automatic read/write routing
  async query(text, params, options = {}) {
    const isReadQuery = text.trim().toUpperCase().startsWith('SELECT');
    const pool = options.forceWrite || !isReadQuery ? this.pool : this.readPool;
    
    try {
      const start = Date.now();
      const result = await pool.query(text, params);
      const duration = Date.now() - start;
      
      if (duration > 1000) {
        console.warn(`Slow query detected (${duration}ms):`, text);
      }
      
      return result;
    } catch (error) {
      console.error('Query error:', error);
      throw error;
    }
  }

  // Transaction support
  async transaction(callback) {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Prepared statements for better performance
  async prepare(name, text, values) {
    try {
      const result = await this.pool.query({
        name,
        text,
        values
      });
      return result;
    } catch (error) {
      console.error('Prepared statement error:', error);
      throw error;
    }
  }

  // Bulk insert optimization
  async bulkInsert(table, columns, values) {
    if (!values || values.length === 0) return;

    const placeholders = values.map((_, rowIndex) => 
      `(${columns.map((_, colIndex) => `$${rowIndex * columns.length + colIndex + 1}`).join(', ')})`
    ).join(', ');

    const flatValues = values.flat();
    const query = `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${placeholders}`;
    
    return this.query(query, flatValues);
  }

  // Connection pool stats
  getPoolStats() {
    return {
      write: {
        total: this.pool.totalCount,
        idle: this.pool.idleCount,
        waiting: this.pool.waitingCount
      },
      read: {
        total: this.readPool.totalCount,
        idle: this.readPool.idleCount,
        waiting: this.readPool.waitingCount
      }
    };
  }

  // Cleanup
  async cleanup() {
    try {
      await this.pool.end();
      await this.readPool.end();
      console.log('Database pools closed');
    } catch (error) {
      console.error('Database cleanup error:', error);
    }
  }
}

// Singleton instance
const databaseManager = new DatabaseManager();

export default databaseManager;