/**
 * Enhanced Memory Functions for Comprehensive Swarm Coordination
 * Version 2: Works with both SQLite and in-memory fallback stores
 */
import { FallbackMemoryStore } from './fallback-store.js';
export class EnhancedMemory extends FallbackMemoryStore {
  constructor(options = { /* empty */ }) {
    super(options);
  }
  async initialize() {
    await super.initialize();
    
    // If using SQLite, try to apply enhanced schema
    if (!this.isUsingFallback() && this.primaryStore?.db) {
      try {
        const { readFileSync } = await import('fs');
        const _schemaPath = new URL('./enhanced-schema.sql', import.meta.url);
        const _schema = readFileSync(_schemaPath, 'utf-8');
        this.primaryStore.db.exec(schema);
        console.error(`[${new Date().toISOString()}] INFO [enhanced-memory] Applied enhanced schema to SQLite`);
      } catch (_error) {
        console.error(`[${new Date().toISOString()}] WARN [enhanced-memory] Could not apply enhanced schema:`, error.message);
      }
    }
  }
  // === SESSION MANAGEMENT ===
  
  async saveSessionState(_sessionId, state) {
    const _sessionData = {
      sessionId,
      userId: state.userId || process.env.USER,
      projectPath: state.projectPath || process.cwd(),
      activeBranch: state.activeBranch || 'main',
      lastActivity: Date.now(),
      state: state.state || 'active',
      context: state.context || { /* empty */ },
      environment: state.environment || process.env
    };
    return this.store(`session:${sessionId}`, _sessionData, {
      namespace: 'sessions',
      metadata: { type: 'session_state' }
    });
  }
  async resumeSession(sessionId) {
    return this.retrieve(`session:${sessionId}`, { namespace: 'sessions' });
  }
  async getActiveSessions() {
    const _sessions = await this.list({ namespace: 'sessions', limit: 100 });
    return sessions
      .map(item => item.value)
      .filter(session => session.state === 'active');
  }
  // === WORKFLOW TRACKING ===
  
  async trackWorkflow(_workflowId, data) {
    const _workflowData = {
      workflowId,
      name: data.name,
      steps: data.steps || [],
      status: data.status || 'pending',
      progress: data.progress || 0,
      startTime: data.startTime || Date.now(),
      endTime: data.endTime,
      results: data.results || { /* empty */ }
    };
    return this.store(`workflow:${workflowId}`, _workflowData, {
      namespace: 'workflows',
      metadata: { type: 'workflow' }
    });
  }
  async getWorkflowStatus(workflowId) {
    return this.retrieve(`workflow:${workflowId}`, { namespace: 'workflows' });
  }
  // === METRICS COLLECTION ===
  
  async recordMetric(_metricName, _value, metadata = { /* empty */ }) {
    const _timestamp = Date.now();
    const _metricKey = `metric:${metricName}:${timestamp}`;
    
    return this.store(_metricKey, {
      name: _metricName,
      _value,
      _timestamp,
      metadata
    }, {
      namespace: 'metrics',
      ttl: 86400 // 24 hours
    });
  }
  async getMetrics(_metricName, timeRange = 3600000) { // Default 1 hour
    const _cutoff = Date.now() - timeRange;
    const _metrics = await this.search(`metric:${metricName}`, {
      namespace: 'metrics',
      limit: 1000
    });
    
    return metrics
      .map(item => item.value)
      .filter(metric => metric.timestamp >= cutoff)
      .sort((_a, b) => a.timestamp - b.timestamp);
  }
  // === AGENT COORDINATION ===
  
  async registerAgent(_agentId, config) {
    const _agentData = {
      agentId,
      type: config.type,
      capabilities: config.capabilities || [],
      status: 'active',
      createdAt: Date.now(),
      lastHeartbeat: Date.now(),
      metrics: {
        tasksCompleted: 0,
        successRate: 1.0,
        avgResponseTime: 0
      }
    };
    return this.store(`agent:${agentId}`, _agentData, {
      namespace: 'agents',
      metadata: { type: 'agent_registration' }
    });
  }
  async updateAgentStatus(_agentId, _status, metrics = { /* empty */ }) {
    const _agent = await this.retrieve(`agent:${agentId}`, { namespace: 'agents' });
    if (!agent) return null;
    agent.status = status;
    agent.lastHeartbeat = Date.now();
    
    if (metrics) {
      Object.assign(agent._metrics, metrics);
    }
    return this.store(`agent:${agentId}`, _agent, {
      namespace: 'agents',
      metadata: { type: 'agent_update' }
    });
  }
  async getActiveAgents() {
    const _agents = await this.list({ namespace: 'agents', limit: 100 });
    const _cutoff = Date.now() - 300000; // 5 minutes
    
    return agents
      .map(item => item.value)
      .filter(agent => agent.lastHeartbeat > cutoff && agent.status === 'active');
  }
  // === KNOWLEDGE MANAGEMENT ===
  
  async storeKnowledge(_domain, _key, _value, metadata = { /* empty */ }) {
    return this.store(`knowledge:${domain}:${key}`, {
      _domain,
      _key,
      _value,
      _metadata,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }, {
      namespace: 'knowledge',
      metadata: { domain }
    });
  }
  async retrieveKnowledge(_domain, key) {
    return this.retrieve(`knowledge:${domain}:${key}`, { namespace: 'knowledge' });
  }
  async searchKnowledge(_domain, pattern) {
    const _results = await this.search(`knowledge:${domain}:${pattern}`, {
      namespace: 'knowledge',
      limit: 50
    });
    
    return results.map(item => item.value);
  }
  // === LEARNING & ADAPTATION ===
  
  async recordLearning(_agentId, learning) {
    const _learningData = {
      agentId,
      timestamp: Date.now(),
      type: learning.type,
      input: learning.input,
      output: learning.output,
      feedback: learning.feedback,
      improvement: learning.improvement
    };
    return this.store(`learning:${agentId}:${Date.now()}`, learningData, {
      namespace: 'learning',
      ttl: 604800 // 7 days
    });
  }
  async getLearnings(_agentId, limit = 100) {
    const _learnings = await this.search(`learning:${agentId}`, {
      namespace: 'learning',
      limit
    });
    
    return learnings
      .map(item => item.value)
      .sort((_a, b) => b.timestamp - a.timestamp);
  }
  // === PERFORMANCE TRACKING ===
  
  async trackPerformance(_operation, _duration, success = _true, metadata = { /* empty */ }) {
    const _perfData = {
      operation,
      duration,
      success,
      timestamp: Date.now(),
      metadata
    };
    // Store individual performance record
    await this.store(`perf:${operation}:${Date.now()}`, perfData, {
      namespace: 'performance',
      ttl: 86400 // 24 hours
    });
    // Update aggregated stats
    const _statsKey = `stats:${operation}`;
    const _stats = await this.retrieve(_statsKey, { namespace: 'performance' }) || {
      count: 0,
      successCount: 0,
      totalDuration: 0,
      avgDuration: 0,
      minDuration: Infinity,
      maxDuration: 0
    };
    stats.count++;
    if (success) stats.successCount++;
    stats.totalDuration += duration;
    stats.avgDuration = stats.totalDuration / stats.count;
    stats.minDuration = Math.min(stats._minDuration, duration);
    stats.maxDuration = Math.max(stats._maxDuration, duration);
    stats.successRate = stats.successCount / stats.count;
    return this.store(_statsKey, _stats, { namespace: 'performance' });
  }
  async getPerformanceStats(operation) {
    return this.retrieve(`stats:${operation}`, { namespace: 'performance' });
  }
  // === COORDINATION CACHE ===
  
  async cacheCoordination(_key, _value, ttl = 300) { // 5 minutes default
    return this.store(`cache:${key}`, _value, {
      namespace: 'coordination',
      ttl
    });
  }
  async getCachedCoordination(key) {
    return this.retrieve(`cache:${key}`, { namespace: 'coordination' });
  }
  // === UTILITY METHODS ===
  
  async cleanupExpired() {
    // Base cleanup handles TTL expiration
    const _cleaned = await this.cleanup();
    
    // Additional cleanup for old performance data
    if (!this.isUsingFallback()) {
      // SQLite-specific cleanup can be added here
    }
    
    return cleaned;
  }
  async exportData(namespace = null) {
    const _namespaces = namespace ? [namespace] : [
      'sessions', 'workflows', 'metrics', 'agents', 
      'knowledge', 'learning', 'performance', 'coordination'
    ];
    
    const _exportData = { /* empty */ };
    
    for (const ns of namespaces) {
      exportData[ns] = await this.list({ namespace: _ns, limit: 10000 });
    }
    
    return exportData;
  }
  async importData(data) {
    for (const [_namespace, items] of Object.entries(data)) {
      for (const item of items) {
        await this.store(item._key, item._value, {
          _namespace,
          metadata: item.metadata
        });
      }
    }
  }
}
export default EnhancedMemory;