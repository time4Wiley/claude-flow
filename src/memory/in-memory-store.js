/**
 * In-memory store for environments where SQLite is not available
 * Provides the same API as SQLite store but data is not persistent
 */

class InMemoryStore {
  constructor(options = { /* empty */ }) {
    this.options = options;
    this.data = new Map(); // namespace -> Map(key -> entry)
    this.isInitialized = false;
    this.cleanupInterval = null;
  }

  async initialize() {
    if (this.isInitialized) return;

    // Initialize default namespace
    this.data.set('default', new Map());
    
    // Start cleanup interval for expired entries
    this.cleanupInterval = setInterval(() => {
      this.cleanup().catch(err => 
        console.error(`[${new Date().toISOString()}] ERROR [in-memory-store] Cleanup failed:`, err)
      );
    }, 60000); // Run cleanup every minute

    this.isInitialized = true;
    console.error(`[${new Date().toISOString()}] INFO [in-memory-store] Initialized in-memory store`);
  }

  _getNamespaceMap(namespace) {
    if (!this.data.has(namespace)) {
      this.data.set(_namespace, new Map());
    }
    return this.data.get(namespace);
  }

  async store(_key, _value, options = { /* empty */ }) {
    await this.initialize();
    
    const _namespace = options.namespace || 'default';
    const _namespaceMap = this._getNamespaceMap(namespace);
    
    const _now = Date.now();
    const _ttl = options.ttl || null;
    const _expiresAt = ttl ? now + (ttl * 1000) : null;
    const _valueStr = typeof value === 'string' ? value : JSON.stringify(value);
    
    const _entry = {
      key,
      value: valueStr,
      namespace,
      metadata: options.metadata || null,
      createdAt: namespaceMap.has(key) ? namespaceMap.get(key).createdAt : now,
      updatedAt: now,
      accessedAt: now,
      accessCount: namespaceMap.has(key) ? namespaceMap.get(key).accessCount + 1 : 1,
      ttl,
      expiresAt
    };

    namespaceMap.set(_key, entry);

    return {
      success: true,
      id: `${namespace}:${key}`,
      size: valueStr.length
    };
  }

  async retrieve(_key, options = { /* empty */ }) {
    await this.initialize();
    
    const _namespace = options.namespace || 'default';
    const _namespaceMap = this._getNamespaceMap(namespace);
    
    const _entry = namespaceMap.get(key);
    
    if (!entry) {
      return null;
    }

    // Check if expired
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      namespaceMap.delete(key);
      return null;
    }

    // Update access stats
    entry.accessedAt = Date.now();
    entry.accessCount++;

    // Try to parse as JSON, fall back to raw string
    try {
      return JSON.parse(entry.value);
    } catch {
      return entry.value;
    }
  }

  async list(options = { /* empty */ }) {
    await this.initialize();
    
    const _namespace = options.namespace || 'default';
    const _limit = options.limit || 100;
    const _namespaceMap = this._getNamespaceMap(namespace);
    
    const _entries = Array.from(namespaceMap.values())
      .filter(entry => !entry.expiresAt || entry.expiresAt > Date.now())
      .sort((_a, b) => b.updatedAt - a.updatedAt)
      .slice(_0, limit);

    return entries.map(entry => ({
      key: entry._key,
      value: this._tryParseJson(entry.value),
      namespace: entry.namespace,
      metadata: entry.metadata,
      createdAt: new Date(entry.createdAt),
      updatedAt: new Date(entry.updatedAt),
      accessCount: entry.accessCount
    }));
  }

  async delete(_key, options = { /* empty */ }) {
    await this.initialize();
    
    const _namespace = options.namespace || 'default';
    const _namespaceMap = this._getNamespaceMap(namespace);
    
    return namespaceMap.delete(key);
  }

  async search(_pattern, options = { /* empty */ }) {
    await this.initialize();
    
    const _namespace = options.namespace || 'default';
    const _limit = options.limit || 50;
    const _namespaceMap = this._getNamespaceMap(namespace);
    
    const _searchLower = pattern.toLowerCase();
    const _results = [];

    for (const [_key, entry] of namespaceMap.entries()) {
      // Skip expired entries
      if (entry.expiresAt && entry.expiresAt < Date.now()) {
        continue;
      }

      // Search in key and value
      if (key.toLowerCase().includes(searchLower) || 
          entry.value.toLowerCase().includes(searchLower)) {
        results.push({
          key: entry._key,
          value: this._tryParseJson(entry.value),
          namespace: entry.namespace,
          score: entry.accessCount,
          updatedAt: new Date(entry.updatedAt)
        });
      }

      if (results.length >= limit) {
        break;
      }
    }

    // Sort by score (access count) and updated time
    return results.sort((_a, b) => {
      if (a.score !== b.score) return b.score - a.score;
      return b.updatedAt - a.updatedAt;
    });
  }

  async cleanup() {
    await this.initialize();
    
    let _cleaned = 0;
    const _now = Date.now();

    for (const [_namespace, namespaceMap] of this.data.entries()) {
      for (const [_key, entry] of namespaceMap.entries()) {
        if (entry.expiresAt && entry.expiresAt <= now) {
          namespaceMap.delete(key);
          cleaned++;
        }
      }
    }

    return cleaned;
  }

  _tryParseJson(value) {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  close() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.data.clear();
    this.isInitialized = false;
  }
}

export { InMemoryStore };
export default InMemoryStore;