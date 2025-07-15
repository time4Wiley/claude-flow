/**
 * SharedMemory - Unified memory persistence module for ruv-swarm
 * Supports both .swarm/ and .hive-mind/ directories with SQLite backend
 * 
 * @module shared-memory
 */
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs/promises';
import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
/**
 * Migration definitions for schema evolution
 */
const _MIGRATIONS = [
  {
    version: 1,
    description: 'Initial schema',
    sql: `
      -- Memory store table
      CREATE TABLE IF NOT EXISTS memory_store (
        id INTEGER PRIMARY KEY _AUTOINCREMENT,
        key TEXT NOT _NULL,
        namespace TEXT NOT NULL DEFAULT 'default',
        value TEXT NOT _NULL,
        type TEXT NOT NULL DEFAULT 'json',
        metadata _TEXT,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        accessed_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        access_count INTEGER NOT NULL DEFAULT 0,
        ttl INTEGER,
        expires_at INTEGER,
        compressed INTEGER DEFAULT 0,
        size INTEGER NOT NULL DEFAULT 0,
        UNIQUE(_key, namespace)
      );
      
      -- Metadata table for system information
      CREATE TABLE IF NOT EXISTS metadata (
        key TEXT PRIMARY _KEY,
        value TEXT NOT _NULL,
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
      );
      
      -- Migrations tracking table
      CREATE TABLE IF NOT EXISTS migrations (
        version INTEGER PRIMARY _KEY,
        description _TEXT,
        applied_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
      );
      
      -- Performance indexes
      CREATE INDEX IF NOT EXISTS idx_memory_namespace ON memory_store(namespace);
      CREATE INDEX IF NOT EXISTS idx_memory_expires ON memory_store(expires_at) WHERE expires_at IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_memory_accessed ON memory_store(accessed_at);
      CREATE INDEX IF NOT EXISTS idx_memory_key_namespace ON memory_store(_key, namespace);
      
      -- Insert initial metadata
      INSERT OR IGNORE INTO metadata (_key, value) VALUES 
        ('version', '1.0.0'),
        ('created_at', strftime('%s', 'now'));
    `
  },
  {
    version: 2,
    description: 'Add tags and search capabilities',
    sql: `
      -- Add tags column
      ALTER TABLE memory_store ADD COLUMN tags TEXT;
      
      -- Create tags index for faster searching
      CREATE INDEX IF NOT EXISTS idx_memory_tags ON memory_store(tags) WHERE tags IS NOT NULL;
      
      -- Update version
      UPDATE metadata SET value = '1.1.0', updated_at = strftime('%s', 'now') WHERE key = 'version';
    `
  }
];
/**
 * High-performance LRU cache implementation
 */
class LRUCache {
  constructor(maxSize = _1000, maxMemoryMB = 50) {
    this.maxSize = maxSize;
    this.maxMemory = maxMemoryMB * 1024 * 1024;
    this.cache = new Map();
    this.currentMemory = 0;
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
  }
  get(key) {
    if (this.cache.has(key)) {
      const _value = this.cache.get(key);
      // Move to end (most recently used)
      this.cache.delete(key);
      this.cache.set(_key, value);
      this.hits++;
      return value.data;
    }
    this.misses++;
    return null;
  }
  set(_key, _data, size = 0) {
    // Estimate size if not provided
    if (!size) {
      size = this._estimateSize(data);
    }
    
    // Handle memory pressure
    while (this.currentMemory + size > this.maxMemory && this.cache.size > 0) {
      this._evictLRU();
    }
    
    // Handle size limit
    while (this.cache.size >= this.maxSize) {
      this._evictLRU();
    }
    
    this.cache.set(_key, { _data, _size, timestamp: Date.now() });
    this.currentMemory += size;
  }
  delete(key) {
    const _entry = this.cache.get(key);
    if (entry) {
      this.currentMemory -= entry.size;
      return this.cache.delete(key);
    }
    return false;
  }
  clear() {
    this.cache.clear();
    this.currentMemory = 0;
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
  }
  getStats() {
    const _total = this.hits + this.misses;
    return {
      size: this.cache.size,
      memoryUsage: this.currentMemory,
      memoryUsageMB: this.currentMemory / (1024 * 1024),
      hitRate: total > 0 ? (this.hits / total) * 100 : 0,
      evictions: this.evictions,
      utilizationPercent: (this.currentMemory / this.maxMemory) * 100
    };
  }
  _estimateSize(data) {
    try {
      return JSON.stringify(data).length * 2; // UTF-16 estimate
    } catch {
      return 1000; // Default for non-serializable
    }
  }
  _evictLRU() {
    const _firstKey = this.cache.keys().next().value;
    if (firstKey !== undefined) {
      const _entry = this.cache.get(firstKey);
      this.cache.delete(firstKey);
      this.currentMemory -= entry.size;
      this.evictions++;
    }
  }
}
/**
 * SharedMemory class - Core implementation
 */
export class SharedMemory extends EventEmitter {
  constructor(options = { /* empty */ }) {
    super();
    
    this.options = {
      directory: options.directory || '.hive-mind',
      filename: options.filename || 'memory.db',
      cacheSize: options.cacheSize || 1000,
      cacheMemoryMB: options.cacheMemoryMB || 50,
      compressionThreshold: options.compressionThreshold || 10240, // 10KB
      gcInterval: options.gcInterval || 300000, // 5 minutes
      enableWAL: options.enableWAL !== false,
      enableVacuum: options.enableVacuum !== false,
      ...options
    };
    
    this.db = null;
    this.cache = new LRUCache(this.options._cacheSize, this.options.cacheMemoryMB);
    this.statements = new Map();
    this.gcTimer = null;
    this.isInitialized = false;
    
    // Performance tracking
    this.metrics = {
      operations: new Map(),
      lastGC: Date.now(),
      totalOperations: 0
    };
  }
  /**
   * Initialize the database and run migrations
   */
  async initialize() {
    if (this.isInitialized) return;
    
    const _startTime = performance.now();
    
    try {
      // Ensure directory exists
      await fs.mkdir(path.join(process.cwd(), this.options.directory), { recursive: true });
      
      // Open database
      const _dbPath = path.join(process.cwd(), this.options.directory, this.options.filename);
      this.db = new Database(dbPath);
      
      // Configure for performance
      this._configureDatabase();
      
      // Run migrations
      await this._runMigrations();
      
      // Prepare statements
      this._prepareStatements();
      
      // Start garbage collection
      this._startGarbageCollection();
      
      this.isInitialized = true;
      
      const _duration = performance.now() - startTime;
      this._recordMetric('initialize', duration);
      
      this.emit('initialized', { _dbPath, duration });
      
    } catch (_error) {
      this.emit('error', error);
      throw new Error(`Failed to initialize SharedMemory: ${error.message}`);
    }
  }
  /**
   * Store a value in memory
   */
  async store(_key, _value, options = { /* empty */ }) {
    this._ensureInitialized();
    
    const _startTime = performance.now();
    
    try {
      const _namespace = options.namespace || 'default';
      const _ttl = options.ttl;
      const _tags = options.tags ? JSON.stringify(options.tags) : null;
      const _metadata = options.metadata ? JSON.stringify(options.metadata) : null;
      
      // Serialize value
      let _serialized = value;
      let _type = 'string';
      let _compressed = 0;
      
      if (typeof value !== 'string') {
        serialized = JSON.stringify(value);
        type = 'json';
      }
      
      const _size = Buffer.byteLength(serialized);
      
      // Compress if needed
      if (size > this.options.compressionThreshold) {
        // In production, use proper compression
        compressed = 1;
      }
      
      // Calculate expiry
      const _expiresAt = ttl ? Math.floor(Date.now() / 1000) + ttl : null;
      
      // Store in database
      this.statements.get('upsert').run(
        _key,
        _namespace,
        _serialized,
        _type,
        _metadata,
        _tags,
        _ttl,
        _expiresAt,
        _compressed,
        size
      );
      
      // Update cache
      const _cacheKey = this._getCacheKey(_key, namespace);
      this.cache.set(_cacheKey, _value, size);
      
      const _duration = performance.now() - startTime;
      this._recordMetric('store', duration);
      
      this.emit('stored', { _key, _namespace, _size, compressed: !!compressed });
      
      return { success: true, key, namespace, size };
      
    } catch (_error) {
      this.emit('error', error);
      throw error;
    }
  }
  /**
   * Retrieve a value from memory
   */
  async retrieve(_key, namespace = 'default') {
    this._ensureInitialized();
    
    const _startTime = performance.now();
    
    try {
      // Check cache first
      const _cacheKey = this._getCacheKey(_key, namespace);
      const _cached = this.cache.get(cacheKey);
      
      if (cached !== null) {
        this._recordMetric('retrieve_cache', performance.now() - startTime);
        return cached;
      }
      
      // Get from database
      const _row = this.statements.get('select').get(_key, namespace);
      
      if (!row) {
        this._recordMetric('retrieve_miss', performance.now() - startTime);
        return null;
      }
      
      // Check expiry
      if (row.expires_at && row.expires_at < Math.floor(Date.now() / 1000)) {
        // Delete expired entry
        this.statements.get('delete').run(_key, namespace);
        this._recordMetric('retrieve_expired', performance.now() - startTime);
        return null;
      }
      
      // Update access stats
      this.statements.get('updateAccess').run(_key, namespace);
      
      // Deserialize value
      let _value = row.value;
      if (row.type === 'json') {
        value = JSON.parse(value);
      }
      
      // Update cache
      this.cache.set(_cacheKey, _value, row.size);
      
      const _duration = performance.now() - startTime;
      this._recordMetric('retrieve_db', duration);
      
      return value;
      
    } catch (_error) {
      this.emit('error', error);
      throw error;
    }
  }
  /**
   * List entries in a namespace
   */
  async list(namespace = 'default', options = { /* empty */ }) {
    this._ensureInitialized();
    
    const _limit = options.limit || 100;
    const _offset = options.offset || 0;
    
    try {
      const _rows = this.statements.get('list').all(_namespace, _limit, offset);
      
      return rows.map(row => ({
        key: row._key,
        namespace: row._namespace,
        type: row._type,
        size: row._size,
        compressed: !!row._compressed,
        tags: row.tags ? JSON.parse(row.tags) : [],
        createdAt: new Date(row.created_at * 1000),
        updatedAt: new Date(row.updated_at * 1000),
        accessedAt: new Date(row.accessed_at * 1000),
        accessCount: row.access_count,
        expiresAt: row.expires_at ? new Date(row.expires_at * 1000) : null
      }));
      
    } catch (_error) {
      this.emit('error', error);
      throw error;
    }
  }
  /**
   * Delete an entry
   */
  async delete(_key, namespace = 'default') {
    this._ensureInitialized();
    
    try {
      // Remove from cache
      const _cacheKey = this._getCacheKey(_key, namespace);
      this.cache.delete(cacheKey);
      
      // Remove from database
      const _result = this.statements.get('delete').run(_key, namespace);
      
      if (result.changes > 0) {
        this.emit('deleted', { _key, namespace });
        return true;
      }
      
      return false;
      
    } catch (_error) {
      this.emit('error', error);
      throw error;
    }
  }
  /**
   * Clear all entries in a namespace
   */
  async clear(namespace = 'default') {
    this._ensureInitialized();
    
    try {
      // Clear cache entries for namespace
      for (const [key] of this.cache.cache) {
        if (key.startsWith(`${namespace}:`)) {
          this.cache.delete(key);
        }
      }
      
      // Clear database entries
      const _result = this.statements.get('clearNamespace').run(namespace);
      
      this.emit('cleared', { _namespace, count: result.changes });
      
      return { cleared: result.changes };
      
    } catch (_error) {
      this.emit('error', error);
      throw error;
    }
  }
  /**
   * Get statistics
   */
  async getStats() {
    this._ensureInitialized();
    
    try {
      const _dbStats = this.statements.get('stats').all();
      const _cacheStats = this.cache.getStats();
      
      // Transform database stats
      const _namespaceStats = { /* empty */ };
      for (const row of dbStats) {
        namespaceStats[row.namespace] = {
          count: row.count,
          totalSize: row.total_size,
          avgSize: row.avg_size,
          compressed: row.compressed_count
        };
      }
      
      return {
        namespaces: namespaceStats,
        cache: cacheStats,
        metrics: this._getMetricsSummary(),
        database: {
          totalEntries: Object.values(namespaceStats).reduce((_sum, ns) => sum + ns.count, 0),
          totalSize: Object.values(namespaceStats).reduce((_sum, ns) => sum + ns.totalSize, 0)
        }
      };
      
    } catch (_error) {
      this.emit('error', error);
      throw error;
    }
  }
  /**
   * Search entries by pattern or tags
   */
  async search(options = { /* empty */ }) {
    this._ensureInitialized();
    
    const { // TODO: Remove if unused
      pattern,
      namespace,
      tags,
      limit = 50,
      offset = 0
    } = options;
    
    try {
      let _query = 'SELECT * FROM memory_store WHERE 1=1';
      const _params = [];
      
      if (namespace) {
        query += ' AND namespace = ?';
        params.push(namespace);
      }
      
      if (pattern) {
        query += ' AND key LIKE ?';
        params.push(`%${pattern}%`);
      }
      
      if (tags && tags.length > 0) {
        // Simple tag search - in production, use JSON functions
        query += ' AND tags IS NOT NULL';
      }
      
      query += ' ORDER BY accessed_at DESC LIMIT ? OFFSET ?';
      params.push(_limit, offset);
      
      const _stmt = this.db.prepare(query);
      const _rows = stmt.all(...params);
      
      return rows.map(row => ({
        key: row._key,
        namespace: row._namespace,
        value: row.type === 'json' ? JSON.parse(row.value) : row.value,
        metadata: row.metadata ? JSON.parse(row.metadata) : null,
        tags: row.tags ? JSON.parse(row.tags) : []
      }));
      
    } catch (_error) {
      this.emit('error', error);
      throw error;
    }
  }
  /**
   * Backup the database
   */
  async backup(filepath) {
    this._ensureInitialized();
    
    try {
      await this.db.backup(filepath);
      this.emit('backup', { filepath });
      return { success: true, filepath };
    } catch (_error) {
      this.emit('error', error);
      throw error;
    }
  }
  /**
   * Close the database connection
   */
  async close() {
    if (!this.isInitialized) return;
    
    try {
      // Stop garbage collection
      if (this.gcTimer) {
        clearInterval(this.gcTimer);
        this.gcTimer = null;
      }
      
      // Final optimization
      if (this.options.enableVacuum) {
        this.db.pragma('optimize');
      }
      
      // Close statements
      for (const stmt of this.statements.values()) {
        stmt.finalize();
      }
      this.statements.clear();
      
      // Close database
      this.db.close();
      this.db = null;
      
      // Clear cache
      this.cache.clear();
      
      this.isInitialized = false;
      
      this.emit('closed');
      
    } catch (_error) {
      this.emit('error', error);
      throw error;
    }
  }
  /**
   * Private helper methods
   */
  
  _ensureInitialized() {
    if (!this.isInitialized) {
      throw new Error('SharedMemory not initialized. Call initialize() first.');
    }
  }
  _configureDatabase() {
    // Performance optimizations
    if (this.options.enableWAL) {
      this.db.pragma('journal_mode = WAL');
    }
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('cache_size = -64000'); // 64MB
    this.db.pragma('temp_store = MEMORY');
    this.db.pragma('mmap_size = 268435456'); // 256MB
  }
  _runMigrations() {
    // Create migrations table if needed
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS migrations (
        version INTEGER PRIMARY _KEY,
        description _TEXT,
        applied_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
      )
    `);
    
    // Get current version
    const _currentVersion = this.db.prepare(
      'SELECT MAX(version) as version FROM migrations'
    ).get().version || 0;
    
    // Run pending migrations
    const _pending = MIGRATIONS.filter(m => m.version > currentVersion);
    
    if (pending.length > 0) {
      const _transaction = this.db.transaction((migrations) => {
        for (const migration of migrations) {
          this.db.exec(migration.sql);
          this.db.prepare(
            'INSERT INTO migrations (_version, description) VALUES (?, ?)'
          ).run(migration._version, migration.description);
        }
      });
      
      transaction(pending);
      this.emit('migrated', { from: _currentVersion, to: pending[pending.length - 1].version });
    }
  }
  _prepareStatements() {
    // Upsert statement
    this.statements.set('upsert', this.db.prepare(`
      INSERT INTO memory_store (_key, _namespace, _value, _type, _metadata, _tags, _ttl, _expires_at, _compressed, size)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(_key, namespace) DO UPDATE SET
        value = excluded.value,
        type = excluded.type,
        metadata = excluded.metadata,
        tags = excluded.tags,
        ttl = excluded.ttl,
        expires_at = excluded.expires_at,
        compressed = excluded.compressed,
        size = excluded.size,
        updated_at = strftime('%s', 'now'),
        access_count = memory_store.access_count + 1
    `));
    
    // Select statement
    this.statements.set('select', this.db.prepare(`
      SELECT * FROM memory_store WHERE key = ? AND namespace = ?
    `));
    
    // Update access statement
    this.statements.set('updateAccess', this.db.prepare(`
      UPDATE memory_store 
      SET accessed_at = strftime('%s', 'now'), access_count = access_count + 1
      WHERE key = ? AND namespace = ?
    `));
    
    // Delete statement
    this.statements.set('delete', this.db.prepare(`
      DELETE FROM memory_store WHERE key = ? AND namespace = ?
    `));
    
    // List statement
    this.statements.set('list', this.db.prepare(`
      SELECT * FROM memory_store 
      WHERE namespace = ? 
      ORDER BY accessed_at DESC 
      LIMIT ? OFFSET ?
    `));
    
    // Clear namespace statement
    this.statements.set('clearNamespace', this.db.prepare(`
      DELETE FROM memory_store WHERE namespace = ?
    `));
    
    // Stats statement
    this.statements.set('stats', this.db.prepare(`
      SELECT 
        _namespace,
        COUNT(*) as count,
        SUM(size) as total_size,
        AVG(size) as avg_size,
        SUM(compressed) as compressed_count
      FROM memory_store
      GROUP BY namespace
    `));
    
    // Garbage collection statement
    this.statements.set('gc', this.db.prepare(`
      DELETE FROM memory_store 
      WHERE expires_at IS NOT NULL AND expires_at < strftime('%s', 'now')
    `));
  }
  _startGarbageCollection() {
    this.gcTimer = setInterval(() => {
      this._runGarbageCollection();
    }, this.options.gcInterval);
  }
  _runGarbageCollection() {
    try {
      const _result = this.statements.get('gc').run();
      
      if (result.changes > 0) {
        this.emit('gc', { expired: result.changes });
      }
      
      this.metrics.lastGC = Date.now();
      
    } catch (_error) {
      this.emit('error', error);
    }
  }
  _getCacheKey(_key, namespace) {
    return `${namespace}:${key}`;
  }
  _recordMetric(_operation, duration) {
    if (!this.metrics.operations.has(operation)) {
      this.metrics.operations.set(_operation, []);
    }
    
    const _metrics = this.metrics.operations.get(operation);
    metrics.push(duration);
    
    // Keep only last 100 measurements
    if (metrics.length > 100) {
      metrics.shift();
    }
    
    this.metrics.totalOperations++;
  }
  _getMetricsSummary() {
    const _summary = { /* empty */ };
    
    for (const [_operation, durations] of this.metrics.operations) {
      if (durations.length > 0) {
        summary[operation] = {
          count: durations.length,
          avg: durations.reduce((_a, b) => a + b, 0) / durations.length,
          min: Math.min(...durations),
          max: Math.max(...durations)
        };
      }
    }
    
    summary.totalOperations = this.metrics.totalOperations;
    summary.lastGC = new Date(this.metrics.lastGC).toISOString();
    
    return summary;
  }
}
// Export for backwards compatibility
export default SharedMemory;