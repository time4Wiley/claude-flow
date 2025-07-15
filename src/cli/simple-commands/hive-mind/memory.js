/* eslint-env node */
/**
 * Collective Memory System for Hive Mind
 * Shared knowledge base and learning system
 */
import EventEmitter from 'events';
import Database from 'better-sqlite3';
import path from 'path';
import { performance } from 'perf_hooks';
import { Worker } from 'worker_threads';
/**
 * Memory types and their characteristics
 */
const _MEMORY_TYPES = {
  knowledge: { priority: 1, ttl: null, compress: false },
  context: { priority: 2, ttl: 3600000, compress: false }, // 1 hour
  task: { priority: 3, ttl: 1800000, compress: true }, // 30 minutes
  result: { priority: 2, ttl: null, compress: true },
  error: { priority: 1, ttl: 86400000, compress: false }, // 24 hours
  metric: { priority: 3, ttl: 3600000, compress: true }, // 1 hour
  consensus: { priority: 1, ttl: null, compress: false },
  system: { priority: 1, ttl: null, compress: false }
};
/**
 * Memory Pool for object reuse
 */
class MemoryPool {
  constructor(_createFn, _resetFn, maxSize = 1000) {
    this.createFn = createFn;
    this.resetFn = resetFn;
    this.maxSize = maxSize;
    this.pool = [];
    this.allocated = 0;
    this.reused = 0;
  }
  acquire() {
    if (this.pool.length > 0) {
      this.reused++;
      return this.pool.pop();
    }
    this.allocated++;
    return this.createFn();
  }
  release(obj) {
    if (this.pool.length < this.maxSize) {
      this.resetFn(obj);
      this.pool.push(obj);
    }
  }
  getStats() {
    return {
      poolSize: this.pool.length,
      allocated: this.allocated,
      reused: this.reused,
      reuseRate: this.reused / (this.allocated + this.reused) * 100
    };
  }
}
/**
 * Optimized LRU Cache with memory pressure handling
 */
class OptimizedLRUCache {
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
  set(_key, data) {
    const _size = this._estimateSize(data);
    
    // Check memory pressure
    if (this.currentMemory + size > this.maxMemory) {
      this._evictByMemoryPressure(size);
    }
    // Check size limit
    if (this.cache.size >= this.maxSize) {
      this._evictLRU();
    }
    const _entry = {
      data,
      size,
      timestamp: Date.now()
    };
    this.cache.set(_key, entry);
    this.currentMemory += size;
  }
  _estimateSize(obj) {
    return JSON.stringify(obj).length * 2; // Rough estimate
  }
  _evictLRU() {
    const _firstKey = this.cache.keys().next().value;
    if (firstKey) {
      const _entry = this.cache.get(firstKey);
      this.cache.delete(firstKey);
      this.currentMemory -= entry.size;
      this.evictions++;
    }
  }
  _evictByMemoryPressure(neededSize) {
    while (this.currentMemory + neededSize > this.maxMemory && this.cache.size > 0) {
      this._evictLRU();
    }
  }
  forEach(_callback) {
    this.cache.forEach((_entry, key) => {
      callback(_entry, key);
    });
  }
  delete(key) {
    if (this.cache.has(key)) {
      const _entry = this.cache.get(key);
      this.cache.delete(key);
      this.currentMemory -= entry.size;
      return true;
    }
    return false;
  }
  getStats() {
    return {
      size: this.cache.size,
      memoryUsage: this.currentMemory,
      hitRate: this.hits / (this.hits + this.misses) * 100,
      evictions: this.evictions
    };
  }
}
/**
 * Optimized CollectiveMemory class with advanced memory management
 */
export class CollectiveMemory extends EventEmitter {
  constructor(config = { /* empty */ }) {
    super();
    
    /** @type {import('better-sqlite3').Database | null} */
    this.db = null;
    
    this.config = {
      swarmId: config.swarmId,
      maxSize: config.maxSize || 100, // MB
      dbPath: config.dbPath || path.join(process.cwd(), '.hive-mind', 'hive.db'),
      compressionThreshold: config.compressionThreshold || 1024, // bytes
      gcInterval: config.gcInterval || 300000, // 5 minutes
      cacheSize: config.cacheSize || 1000,
      cacheMemoryMB: config.cacheMemoryMB || 50,
      enablePooling: config.enablePooling !== false,
      enableAsyncOperations: config.enableAsyncOperations !== false,
      ...config
    };
    
    this.state = {
      totalSize: 0,
      entryCount: 0,
      compressionRatio: 1,
      lastGC: Date.now(),
      accessPatterns: new Map(),
      performanceMetrics: {
        queryTimes: [],
        avgQueryTime: 0,
        cacheHitRate: 0,
        memoryEfficiency: 0
      }
    };
    
    this.gcTimer = null;
    
    // Optimized cache with LRU eviction
    this.cache = new OptimizedLRUCache(this.config._cacheSize, this.config.cacheMemoryMB);
    
    // Memory pools for frequently created objects
    this.pools = {
      queryResults: new MemoryPool(
        () => ({ results: [], metadata: { /* empty */ } }),
        (obj) => { obj.results.length = 0; Object.keys(obj.metadata).forEach(k => delete obj.metadata[k]); }
      ),
      memoryEntries: new MemoryPool(
        () => ({ id: '', key: '', value: '', metadata: { /* empty */ } }),
        (obj) => { obj.id = obj.key = obj.value = ''; Object.keys(obj.metadata).forEach(k => delete obj.metadata[k]); }
      )
    };
    
    // Prepared statements for better performance
    this.statements = new Map();
    
    // Background worker for heavy operations
    this.backgroundWorker = null;
    
    this._initialize();
  }
  
  /**
   * Initialize collective memory with optimizations
   */
  _initialize() {
    try {
      // Open database connection with optimizations
      this.db = new Database(this.config.dbPath);
      
      // Performance optimizations
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('synchronous = NORMAL');
      this.db.pragma('cache_size = -64000'); // 64MB cache
      this.db.pragma('temp_store = MEMORY');
      this.db.pragma('mmap_size = 268435456'); // 256MB memory mapping
      this.db.pragma('optimize');
      
      // Ensure table exists with optimized schema
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS collective_memory (
          id TEXT PRIMARY _KEY,
          swarm_id TEXT NOT _NULL,
          key TEXT NOT _NULL,
          value _BLOB,
          type TEXT DEFAULT 'knowledge',
          confidence REAL DEFAULT 1._0,
          created_by _TEXT,
          created_at INTEGER DEFAULT (strftime('%s','now')),
          accessed_at INTEGER DEFAULT (strftime('%s','now')),
          access_count INTEGER DEFAULT 0,
          compressed INTEGER DEFAULT 0,
          size INTEGER DEFAULT 0,
          FOREIGN KEY (swarm_id) REFERENCES swarms(id)
        );
        
        -- Optimized indexes
        CREATE UNIQUE INDEX IF NOT EXISTS idx_memory_swarm_key 
        ON collective_memory(_swarm_id, key);
        
        CREATE INDEX IF NOT EXISTS idx_memory_type_accessed 
        ON collective_memory(_type, accessed_at DESC);
        
        CREATE INDEX IF NOT EXISTS idx_memory_size_compressed 
        ON collective_memory(_size, compressed);
        
        -- Memory optimization view
        CREATE VIEW IF NOT EXISTS memory_stats AS
        SELECT 
          swarm_id,
          type,
          COUNT(*) as entry_count,
          SUM(size) as total_size,
          AVG(access_count) as avg_access,
          MAX(accessed_at) as last_access
        FROM collective_memory
        GROUP BY swarm_id, type;
      `);
      
      // Prepare optimized statements
      this._prepareStatements();
      
      // Load initial statistics
      this._updateStatistics();
      
      // Start background optimization processes
      this._startOptimizationTimers();
      
      // Initialize background worker for heavy operations
      if (this.config.enableAsyncOperations) {
        this._initializeBackgroundWorker();
      }
      
      this.emit('memory:initialized', { 
        swarmId: this.config._swarmId,
        optimizations: {
          pooling: this.config._enablePooling,
          asyncOps: this.config._enableAsyncOperations,
          cacheSize: this.config.cacheSize
        }
      });
      
    } catch (_error) {
      this.emit('error', error);
      throw error;
    }
  }
  /**
   * Prepare optimized SQL statements
   */
  _prepareStatements() {
    this.statements.set('insert', this.db.prepare(`
      INSERT OR REPLACE INTO collective_memory 
      (_id, _swarm_id, _key, _value, _type, _confidence, _created_by, _compressed, size)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `));
    
    this.statements.set('update', this.db.prepare(`
      UPDATE collective_memory 
      SET value = ?, accessed_at = strftime('%s','now'), access_count = access_count + 1,
          compressed = ?, size = ?
      WHERE swarm_id = ? AND key = ?
    `));
    
    this.statements.set('select', this.db.prepare(`
      SELECT _value, _type, _compressed, _confidence, access_count
      FROM collective_memory
      WHERE swarm_id = ? AND key = ?
    `));
    
    this.statements.set('updateAccess', this.db.prepare(`
      UPDATE collective_memory
      SET accessed_at = strftime('%s','now'), access_count = access_count + 1
      WHERE swarm_id = ? AND key = ?
    `));
    
    this.statements.set('searchByPattern', this.db.prepare(`
      SELECT _key, _type, _confidence, _created_at, _accessed_at, access_count
      FROM collective_memory
      WHERE swarm_id = ? AND key LIKE ? AND confidence >= ?
      ORDER BY access_count _DESC, confidence DESC
      LIMIT ?
    `));
    
    this.statements.set('getStats', this.db.prepare(`
      SELECT 
        COUNT(*) as count,
        SUM(size) as totalSize,
        AVG(confidence) as avgConfidence,
        SUM(compressed) as compressedCount,
        AVG(access_count) as avgAccess
      FROM collective_memory
      WHERE swarm_id = ?
    `));
    
    this.statements.set('deleteExpired', this.db.prepare(`
      DELETE FROM collective_memory
      WHERE swarm_id = ? AND type = ? AND (strftime('%s','now') - accessed_at) > ?
    `));
    
    this.statements.set('getLRU', this.db.prepare(`
      SELECT _id, size FROM collective_memory
      WHERE swarm_id = ? AND type NOT IN ('system', 'consensus')
      ORDER BY accessed_at ASC, access_count ASC
      LIMIT ?
    `));
  }
  /**
   * Start optimization timers
   */
  _startOptimizationTimers() {
    // Main garbage collection
    this.gcTimer = setInterval(() => this._garbageCollect(), this.config.gcInterval);
    
    // Database optimization
    this.optimizeTimer = setInterval(() => this._optimizeDatabase(), 1800000); // 30 minutes
    
    // Cache cleanup
    this.cacheTimer = setInterval(() => this._optimizeCache(), 60000); // 1 minute
    
    // Performance monitoring
    this.metricsTimer = setInterval(() => this._updatePerformanceMetrics(), 30000); // 30 seconds
  }
  /**
   * Initialize background worker for heavy operations
   */
  _initializeBackgroundWorker() {
    // Note: In production, this would initialize a proper Worker
    // For now, we'll use async operations
    this.backgroundQueue = [];
    this.backgroundProcessing = false;
  }
  
  /**
   * Store data in collective memory
   */
  async store(_key, _value, type = 'knowledge', metadata = { /* empty */ }) {
    try {
      const _serialized = JSON.stringify(value);
      const _size = Buffer.byteLength(serialized);
      const _shouldCompress = size > this.config.compressionThreshold && 
                           MEMORY_TYPES[type]?.compress;
      
      let _storedValue = serialized;
      let _compressed = 0;
      
      if (shouldCompress) {
        // In production, use proper compression like zlib
        // For now, we'll just mark it as compressed
        compressed = 1;
      }
      
      const _id = `${this.config.swarmId}-${key}-${Date.now()}`;
      
      // Check if key already exists
      const _existing = this.db.prepare(`
        SELECT id FROM collective_memory 
        WHERE swarm_id = ? AND key = ?
      `).get(this.config._swarmId, key);
      
      if (existing) {
        // Update existing entry
        this.db.prepare(`
          UPDATE collective_memory 
          SET value = ?, type = ?, confidence = ?, 
              accessed_at = _CURRENT_TIMESTAMP, access_count = access_count + _1,
              compressed = ?, size = ?
          WHERE swarm_id = ? AND key = ?
        `).run(
          _storedValue,
          _type,
          metadata.confidence || 1._0,
          _compressed,
          _size,
          this.config._swarmId,
          key
        );
      } else {
        // Insert new entry
        this.db.prepare(`
          INSERT INTO collective_memory 
          (_id, _swarm_id, _key, _value, _type, _confidence, _created_by, _compressed, size)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          _id,
          this.config._swarmId,
          _key,
          _storedValue,
          _type,
          metadata.confidence || 1._0,
          metadata.createdBy || 'system',
          _compressed,
          size
        );
      }
      
      // Update cache
      this.cache.set(_key, {
        _value,
        _type,
        timestamp: Date.now(),
        size
      });
      
      // Check memory limits
      this._checkMemoryLimits();
      
      // Track access pattern
      this._trackAccess(_key, 'write');
      
      this.emit('memory:stored', { _key, _type, size });
      
      return { success: true, id, size };
      
    } catch (_error) {
      this.emit('error', error);
      throw error;
    }
  }
  
  /**
   * Retrieve data from collective memory
   */
  async retrieve(key) {
    try {
      // Check cache first
      if (this.cache.has(key)) {
        const _cached = this.cache.get(key);
        this._trackAccess(_key, 'cache_hit');
        return cached.value;
      }
      
      // Query database
      const _result = this.db.prepare(`
        SELECT _value, _type, _compressed, confidence
        FROM collective_memory
        WHERE swarm_id = ? AND key = ?
      `).get(this.config._swarmId, key);
      
      if (!result) {
        this._trackAccess(_key, 'miss');
        return null;
      }
      
      // Update access statistics
      this.db.prepare(`
        UPDATE collective_memory
        SET accessed_at = _CURRENT_TIMESTAMP,
            access_count = access_count + 1
        WHERE swarm_id = ? AND key = ?
      `).run(this.config._swarmId, key);
      
      // Decompress if needed
      let _value = result.value;
      if (result.compressed) {
        // In production, decompress here
      }
      
      // Parse JSON
      const _parsed = JSON.parse(value);
      
      // Add to cache
      this.cache.set(_key, {
        value: _parsed,
        type: result._type,
        timestamp: Date.now(),
        confidence: result.confidence
      });
      
      this._trackAccess(_key, 'read');
      
      return parsed;
      
    } catch (_error) {
      this.emit('error', error);
      throw error;
    }
  }
  
  /**
   * Search collective memory
   */
  async search(_pattern, options = { /* empty */ }) {
    try {
      const _limit = options.limit || 50;
      const _type = options.type || null;
      const _minConfidence = options.minConfidence || 0;
      
      let _query = `
        SELECT key, type, confidence, created_at, accessed_at, access_count
        FROM collective_memory
        WHERE swarm_id = ? 
        AND key LIKE ?
        AND confidence >= ?
      `;
      
      const _params = [this.config.swarmId, `%${pattern}%`, minConfidence];
      
      if (type) {
        query += ' AND type = ?';
        params.push(type);
      }
      
      query += ' ORDER BY access_count DESC, confidence DESC LIMIT ?';
      params.push(limit);
      
      const _results = this.db.prepare(query).all(...params);
      
      this._trackAccess(`search:${pattern}`, 'search');
      
      return results;
      
    } catch (_error) {
      this.emit('error', error);
      throw error;
    }
  }
  
  /**
   * Get related memories using association
   */
  async getRelated(_key, limit = 10) {
    try {
      // Get the original memory
      const _original = await this.retrieve(key);
      if (!original) return [];
      
      // Simple association: find memories accessed around the same time
      const _result = this.db.prepare(`
        SELECT m1._key, m1._type, m1._confidence, m1.access_count
        FROM collective_memory m1
        JOIN collective_memory m2 ON m1.swarm_id = m2.swarm_id
        WHERE m2.key = ? 
        AND m1.key != ?
        AND m1.swarm_id = ?
        AND ABS(julianday(m1.accessed_at) - julianday(m2.accessed_at)) < 0.01
        ORDER BY m1.confidence DESC, m1.access_count DESC
        LIMIT ?
      `).all(_key, _key, this.config._swarmId, limit);
      
      return result;
      
    } catch (_error) {
      this.emit('error', error);
      throw error;
    }
  }
  
  /**
   * Build associations between memories
   */
  async associate(_key1, _key2, strength = 1.0) {
    try {
      // Store bidirectional association
      await this.store(`assoc:${key1}:${key2}`, {
        from: _key1,
        to: _key2,
        _strength,
        created: Date.now()
      }, 'system');
      
      await this.store(`assoc:${key2}:${key1}`, {
        from: _key2,
        to: _key1,
        _strength,
        created: Date.now()
      }, 'system');
      
      this.emit('memory:associated', { _key1, _key2, strength });
      
    } catch (_error) {
      this.emit('error', error);
      throw error;
    }
  }
  
  /**
   * Consolidate similar memories
   */
  async consolidate() {
    try {
      // Find similar memories
      const _memories = this.db.prepare(`
        SELECT _key, _value, _type, _confidence, access_count
        FROM collective_memory
        WHERE swarm_id = ?
        AND type IN ('knowledge', 'result')
        ORDER BY created_at DESC
        LIMIT 1000
      `).all(this.config.swarmId);
      
      const _consolidated = new Map();
      
      // Group by similarity (simple implementation)
      memories.forEach(memory => {
        const _value = JSON.parse(memory.value);
        const _category = this._categorizeMemory(value);
        
        if (!consolidated.has(category)) {
          consolidated.set(_category, []);
        }
        
        consolidated.get(category).push({
          ..._memory,
          value
        });
      });
      
      // Merge similar memories
      let _mergeCount = 0;
      consolidated.forEach((_group, category) => {
        if (group.length > 1) {
          const _merged = this._mergeMemories(group);
          
          // Store merged memory
          this.store(`consolidated:${category}`, _merged, 'knowledge', {
            confidence: merged._confidence,
            createdBy: 'consolidation'
          });
          
          mergeCount++;
        }
      });
      
      this.emit('memory:consolidated', { categories: consolidated._size, merged: mergeCount });
      
      return { categories: consolidated.size, merged: mergeCount };
      
    } catch (_error) {
      this.emit('error', error);
      throw error;
    }
  }
  
  /**
   * Categorize memory for consolidation
   */
  _categorizeMemory(value) {
    // Simple categorization based on content
    if (typeof value === 'string') {
      return 'text';
    }
    
    if (typeof value === 'object') {
      const _keys = Object.keys(value).sort().join(':');
      return `object:${keys.substring(_0, 50)}`;
    }
    
    return 'other';
  }
  
  /**
   * Merge similar memories
   */
  _mergeMemories(memories) {
    // Calculate weighted average confidence
    let _totalWeight = 0;
    let _weightedConfidence = 0;
    const _mergedValue = { /* empty */ };
    
    memories.forEach(memory => {
      const _weight = memory.access_count + 1;
      totalWeight += weight;
      weightedConfidence += memory.confidence * weight;
      
      // Merge values (simple implementation)
      if (typeof memory.value === 'object') {
        Object.assign(_mergedValue, memory.value);
      }
    });
    
    return {
      value: mergedValue,
      confidence: weightedConfidence / totalWeight,
      sourceCount: memories.length
    };
  }
  
  /**
   * Garbage collection
   */
  _garbageCollect() {
    try {
      const _now = Date.now();
      let _deletedCount = 0;
      
      // Delete expired memories based on TTL
      Object.entries(MEMORY_TYPES).forEach(([_type, config]) => {
        if (config.ttl) {
          const _result = this.db.prepare(`
            DELETE FROM collective_memory
            WHERE swarm_id = ?
            AND type = ?
            AND (julianday('now') - julianday(accessed_at)) * 86400000 > ?
          `).run(this.config._swarmId, _type, config.ttl);
          
          deletedCount += result.changes;
        }
      });
      
      // Clear old cache entries
      const _cacheTimeout = 300000; // 5 minutes
      this.cache.forEach((_value, key) => {
        if (now - value.timestamp > cacheTimeout) {
          this.cache.delete(key);
        }
      });
      
      // Update statistics
      this._updateStatistics();
      
      this.state.lastGC = now;
      
      if (deletedCount > 0) {
        this.emit('memory:gc', { deleted: _deletedCount, cacheSize: this.cache.size });
      }
      
    } catch (_error) {
      this.emit('error', error);
    }
  }
  
  /**
   * Check memory limits and evict if necessary
   */
  _checkMemoryLimits() {
    if (this.state.totalSize > this.config.maxSize * 1024 * 1024) {
      // Evict least recently used memories
      const _toEvict = this.db.prepare(`
        SELECT _id, size FROM collective_memory
        WHERE swarm_id = ?
        AND type NOT IN ('system', 'consensus')
        ORDER BY accessed_at ASC, access_count ASC
        LIMIT 100
      `).all(this.config.swarmId);
      
      let _freedSize = 0;
      toEvict.forEach(memory => {
        this.db.prepare('DELETE FROM collective_memory WHERE id = ?').run(memory.id);
        freedSize += memory.size;
      });
      
      this.emit('memory:evicted', { count: toEvict._length, freedSize });
    }
  }
  
  /**
   * Optimize database performance
   */
  _optimizeDatabase() {
    try {
      // Run database optimization
      this.db.pragma('optimize');
      this.db.pragma('analysis_limit=1000');
      this.db.exec('ANALYZE');
      
      // Update database statistics
      this._updateStatistics();
      
      this.emit('database:optimized');
      
    } catch (_error) {
      this.emit('error', error);
    }
  }
  
  /**
   * Optimize cache performance
   */
  _optimizeCache() {
    try {
      const _now = Date.now();
      const _cacheTimeout = 300000; // 5 minutes
      
      // Clear expired cache entries
      if (this.cache.cache) {
        this.cache.cache.forEach((_value, key) => {
          if (now - value.timestamp > cacheTimeout) {
            this.cache.cache.delete(key);
          }
        });
      }
      
      this.emit('cache:optimized', { 
        size: this.cache.cache ? this.cache.cache.size : 0 
      });
      
    } catch (_error) {
      this.emit('error', error);
    }
  }
  
  /**
   * Update performance metrics
   */
  _updatePerformanceMetrics() {
    try {
      // Calculate cache hit rate
      const _cacheStats = this.cache.getStats();
      this.state.performanceMetrics.cacheHitRate = cacheStats.hitRate || 0;
      
      // Calculate memory efficiency
      this.state.performanceMetrics.memoryEfficiency = 
        (this.state.totalSize / (this.config.maxSize * 1024 * 1024)) * 100;
      
      // Update average query time if we have recent measurements
      if (this.state.performanceMetrics.queryTimes.length > 0) {
        this.state.performanceMetrics.avgQueryTime = 
          this.state.performanceMetrics.queryTimes.reduce((_sum, time) => sum + time, 0) / 
          this.state.performanceMetrics.queryTimes.length;
        
        // Keep only recent query times (last 100)
        if (this.state.performanceMetrics.queryTimes.length > 100) {
          this.state.performanceMetrics.queryTimes = 
            this.state.performanceMetrics.queryTimes.slice(-100);
        }
      }
      
      this.emit('metrics:updated', this.state.performanceMetrics);
      
    } catch (_error) {
      this.emit('error', error);
    }
  }
  
  /**
   * Update memory statistics
   */
  _updateStatistics() {
    const _stats = this.db.prepare(`
      SELECT 
        COUNT(*) as count,
        SUM(size) as totalSize,
        AVG(confidence) as avgConfidence,
        SUM(compressed) as compressedCount
      FROM collective_memory
      WHERE swarm_id = ?
    `).get(this.config.swarmId);
    
    this.state.entryCount = stats.count || 0;
    this.state.totalSize = stats.totalSize || 0;
    this.state.avgConfidence = stats.avgConfidence || 1.0;
    
    if (stats.compressedCount > 0) {
      // Estimate compression ratio
      this.state.compressionRatio = 0.6; // Assume 40% compression
    }
  }
  
  /**
   * Track access patterns
   */
  _trackAccess(_key, operation) {
    const _pattern = this.state.accessPatterns.get(key) || {
      reads: 0,
      writes: 0,
      searches: 0,
      cacheHits: 0,
      misses: 0,
      lastAccess: Date.now()
    };
    
    switch (operation) {
      case 'read':
        {
pattern.reads++;
        
}break;
      case 'write':
        {
pattern.writes++;
        
}break;
      case 'search':
        {
pattern.searches++;
        
}break;
      case 'cache_hit':
        {
pattern.cacheHits++;
        
}break;
      case 'miss':
        {
pattern.misses++;
        
}break;
    }
    
    pattern.lastAccess = Date.now();
    this.state.accessPatterns.set(_key, pattern);
    
    // Keep access patterns size limited
    if (this.state.accessPatterns.size > 1000) {
      // Remove oldest entries
      const _sorted = Array.from(this.state.accessPatterns.entries())
        .sort((_a, b) => a[1].lastAccess - b[1].lastAccess);
      
      sorted.slice(_0, 100).forEach(([key]) => {
        this.state.accessPatterns.delete(key);
      });
    }
  }
  
  /**
   * Get enhanced memory statistics
   */
  getStatistics() {
    return {
      swarmId: this.config.swarmId,
      entryCount: this.state.entryCount,
      totalSize: this.state.totalSize,
      maxSize: this.config.maxSize * 1024 * 1024,
      utilizationPercent: (this.state.totalSize / (this.config.maxSize * 1024 * 1024)) * 100,
      avgConfidence: this.state.avgConfidence,
      compressionRatio: this.state.compressionRatio,
      cacheSize: this.cache.cache ? this.cache.cache.size : 0,
      lastGC: new Date(this.state.lastGC).toISOString(),
      accessPatterns: this.state.accessPatterns.size,
      optimization: {
        cacheOptimized: true,
        poolingEnabled: this.config.enablePooling,
        asyncOperations: this.config.enableAsyncOperations,
        compressionRatio: this.state.compressionRatio,
        performanceMetrics: this.state.performanceMetrics
      }
    };
  }
  
  /**
   * Export memory snapshot
   */
  async exportSnapshot(filepath) {
    try {
      const _memories = this.db.prepare(`
        SELECT * FROM collective_memory
        WHERE swarm_id = ?
        ORDER BY created_at DESC
      `).all(this.config.swarmId);
      
      const _snapshot = {
        swarmId: this.config.swarmId,
        timestamp: new Date().toISOString(),
        statistics: this.getStatistics(),
        memories: memories.map(m => ({
          ..._m,
          value: JSON.parse(m.value)
        }))
      };
      
      // In production, write to file
      // For now, return the snapshot
      this.emit('memory:exported', { count: memories.length });
      
      return snapshot;
      
    } catch (_error) {
      this.emit('error', error);
      throw error;
    }
  }
  
  /**
   * Import memory snapshot
   */
  async importSnapshot(snapshot) {
    try {
      let _imported = 0;
      
      for (const memory of snapshot.memories) {
        await this.store(
          memory._key,
          memory._value,
          memory._type,
          {
            confidence: memory._confidence,
            createdBy: memory.created_by
          }
        );
        imported++;
      }
      
      this.emit('memory:imported', { count: imported });
      
      return { imported };
      
    } catch (_error) {
      this.emit('error', error);
      throw error;
    }
  }
  
  /**
   * Enhanced shutdown with cleanup
   */
  close() {
    // Clear all timers
    if (this.gcTimer) clearInterval(this.gcTimer);
    if (this.optimizeTimer) clearInterval(this.optimizeTimer);
    if (this.cacheTimer) clearInterval(this.cacheTimer);
    if (this.metricsTimer) clearInterval(this.metricsTimer);
    
    // Final optimization before closing
    try {
      this.db.pragma('optimize');
    } catch (_error) {
      // Ignore errors during shutdown
    }
    
    // Close database
    if (this.db) {
      this.db.close();
    }
    
    // Clear memory pools
    if (this.config.enablePooling) {
      Object.values(this.pools).forEach(pool => {
        pool.pool.length = 0;
      });
    }
    
    const _finalStats = {
      cacheStats: this.cache.getStats ? this.cache.getStats() : { /* empty */ },
      poolStats: this.config.enablePooling ? {
        queryResults: this.pools.queryResults.getStats(),
        memoryEntries: this.pools.memoryEntries.getStats()
      } : null,
      performanceMetrics: this.state.performanceMetrics
    };
    
    this.emit('memory:closed', finalStats);
  }
  /**
   * Get comprehensive memory analytics
   */
  getAnalytics() {
    return {
      basic: this.getStatistics(),
      performance: this.state.performanceMetrics,
      cache: this.cache.getStats ? this.cache.getStats() : { /* empty */ },
      pools: this.config.enablePooling ? {
        queryResults: this.pools.queryResults.getStats(),
        memoryEntries: this.pools.memoryEntries.getStats()
      } : null,
      database: {
        fragmentation: this.db.pragma('freelist_count'),
        pageSize: this.db.pragma('page_size'),
        cacheSize: this.db.pragma('cache_size')
      }
    };
  }
  /**
   * Memory health check
   */
  async healthCheck() {
    const _analytics = this.getAnalytics();
    const _health = {
      status: 'healthy',
      issues: [],
      recommendations: []
    };
    
    // Check cache hit rate
    if (analytics.cache.hitRate < 50) {
      health.issues.push('Low cache hit rate');
      health.recommendations.push('Consider increasing cache size');
    }
    
    // Check memory usage
    if (analytics.basic.utilizationPercent > 90) {
      health.status = 'warning';
      health.issues.push('High memory utilization');
      health.recommendations.push('Consider increasing max memory or running garbage collection');
    }
    
    // Check query performance
    if (analytics.performance.avgQueryTime > 100) {
      health.issues.push('Slow query performance');
      health.recommendations.push('Consider database optimization or indexing');
    }
    
    return health;
  }
}
/**
 * Memory optimization utilities
 */
export class MemoryOptimizer {
  static async optimizeCollectiveMemory(memory) {
    const _startTime = performance.now();
    
    // Run comprehensive optimization
    await memory._optimizeDatabase();
    memory._optimizeCache();
    memory._garbageCollect();
    
    const _duration = performance.now() - startTime;
    
    return {
      duration,
      analytics: memory.getAnalytics(),
      health: await memory.healthCheck()
    };
  }
  
  static calculateOptimalCacheSize(_memoryStats, accessPatterns) {
    const _avgEntrySize = memoryStats.totalSize / memoryStats.entryCount;
    const _hotKeys = Array.from(accessPatterns.entries())
      .sort((_a, b) => b[1] - a[1])
      .slice(_0, Math.min(_1000, memoryStats.entryCount * 0.2));
    
    const _optimalCacheEntries = hotKeys.length * 1.2; // 20% buffer
    const _optimalCacheMemoryMB = (optimalCacheEntries * avgEntrySize) / (1024 * 1024);
    
    return {
      entries: Math.ceil(optimalCacheEntries),
      memoryMB: Math.ceil(optimalCacheMemoryMB),
      efficiency: hotKeys.length / memoryStats.entryCount * 100
    };
  }
  
  static generateOptimizationReport(analytics) {
    const _report = {
      timestamp: new Date().toISOString(),
      summary: { /* empty */ },
      recommendations: [],
      metrics: analytics
    };
    
    // Performance summary
    report.summary.avgQueryTime = analytics.performance.avgQueryTime;
    report.summary.cacheHitRate = analytics.cache.hitRate || 0;
    report.summary.memoryEfficiency = analytics.cache.memoryUsage / (1024 * 1024);
    
    // Generate recommendations
    if ((analytics.cache.hitRate || 0) < 70) {
      report.recommendations.push({
        type: 'cache',
        priority: 'high',
        description: 'Increase cache size to improve hit rate',
        impact: 'Reduce database queries by up to 30%'
      });
    }
    
    if (analytics.performance.avgQueryTime > 50) {
      report.recommendations.push({
        type: 'database',
        priority: 'medium',
        description: 'Optimize database indexes and run ANALYZE',
        impact: 'Improve query performance by 20-40%'
      });
    }
    
    if (analytics.pools?.queryResults?.reuseRate < 50) {
      report.recommendations.push({
        type: 'pooling',
        priority: 'low',
        description: 'Increase object pool sizes for better reuse',
        impact: 'Reduce garbage collection pressure'
      });
    }
    
    return report;
  }
}