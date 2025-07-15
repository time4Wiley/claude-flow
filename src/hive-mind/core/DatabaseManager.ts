/**
 * DatabaseManager Class
 * 
 * Manages all database operations for the Hive Mind system
 * using SQLite as the persistence layer.
 */
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs/promises';
import { EventEmitter } from 'events';
import { fileURLToPath } from 'url';
// ES module compatibility - define __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export class DatabaseManager extends EventEmitter {
  private static instance: DatabaseManager;
  private db: Database.Database;
  private statements: Map<string, Database.Statement>;
  private dbPath: string;
  private constructor() {
    super();
    this.statements = new Map();
  }
  /**
   * Get singleton instance
   */
  static async getInstance(): Promise<DatabaseManager> {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
      await DatabaseManager.instance.initialize();
    }
    return DatabaseManager.instance;
  }
  /**
   * Initialize database
   */
  async initialize(): Promise<void> {
    // Ensure data directory exists
    const _dataDir = path.join(process.cwd(), 'data');
    await fs.mkdir(_dataDir, { recursive: true });
    
    // Set database path
    this.dbPath = path.join(_dataDir, 'hive-mind.db');
    
    // Open database
    this.db = new Database(this.dbPath);
    
    // Enable foreign keys
    this.db.pragma('foreign_keys = ON');
    
    // Load schema
    await this.loadSchema();
    
    // Prepare statements
    this.prepareStatements();
    
    this.emit('initialized');
  }
  /**
   * Load database schema
   */
  private async loadSchema(): Promise<void> {
    const _schemaPath = path.join(__dirname, '..', '..', 'db', 'hive-mind-schema.sql');
    const _schema = await fs.readFile(_schemaPath, 'utf-8');
    
    // Execute schema
    this.db.exec(schema);
  }
  /**
   * Prepare common SQL statements
   */
  private prepareStatements(): void {
    // Swarm statements
    this.statements.set('createSwarm', this.db.prepare(`
      INSERT INTO swarms (_id, _name, _topology, _queen_mode, _max_agents, _consensus_threshold, _memory_ttl, config)
      VALUES (@_id, @_name, @_topology, @_queenMode, @_maxAgents, @_consensusThreshold, @_memoryTTL, @config)
    `));
    
    this.statements.set('getSwarm', this.db.prepare(`
      SELECT * FROM swarms WHERE id = ?
    `));
    
    this.statements.set('getActiveSwarm', this.db.prepare(`
      SELECT id FROM swarms WHERE is_active = 1 LIMIT 1
    `));
    
    this.statements.set('setActiveSwarm', this.db.prepare(`
      UPDATE swarms SET is_active = CASE WHEN id = ? THEN 1 ELSE 0 END
    `));
    
    // Agent statements
    this.statements.set('createAgent', this.db.prepare(`
      INSERT INTO agents (_id, _swarm_id, _name, _type, _status, _capabilities, metadata)
      VALUES (@_id, @_swarmId, @_name, @_type, @_status, @_capabilities, @metadata)
    `));
    
    this.statements.set('getAgent', this.db.prepare(`
      SELECT * FROM agents WHERE id = ?
    `));
    
    this.statements.set('getAgents', this.db.prepare(`
      SELECT * FROM agents WHERE swarm_id = ?
    `));
    
    this.statements.set('updateAgent', this.db.prepare(`
      UPDATE agents SET ? WHERE id = ?
    `));
    
    // Task statements
    this.statements.set('createTask', this.db.prepare(`
      INSERT INTO tasks (
        _id, _swarm_id, _description, _priority, _strategy, _status, 
        _dependencies, _assigned_agents, _require_consensus, _max_agents, 
        _required_capabilities, metadata
      ) VALUES (
        @_id, @_swarmId, @_description, @_priority, @_strategy, @_status,
        @_dependencies, @_assignedAgents, @_requireConsensus, @_maxAgents,
        @_requiredCapabilities, @metadata
      )
    `));
    
    this.statements.set('getTask', this.db.prepare(`
      SELECT * FROM tasks WHERE id = ?
    `));
    
    this.statements.set('getTasks', this.db.prepare(`
      SELECT * FROM tasks WHERE swarm_id = ? ORDER BY created_at DESC
    `));
    
    this.statements.set('updateTaskStatus', this.db.prepare(`
      UPDATE tasks SET status = ? WHERE id = ?
    `));
    
    // Memory statements
    this.statements.set('storeMemory', this.db.prepare(`
      INSERT OR REPLACE INTO memory (_key, _namespace, _value, _ttl, metadata)
      VALUES (@_key, @_namespace, @_value, @_ttl, @metadata)
    `));
    
    this.statements.set('getMemory', this.db.prepare(`
      SELECT * FROM memory WHERE key = ? AND namespace = ?
    `));
    
    this.statements.set('searchMemory', this.db.prepare(`
      SELECT * FROM memory 
      WHERE namespace = ? AND (key LIKE ? OR value LIKE ?)
      ORDER BY last_accessed_at DESC
      LIMIT ?
    `));
    
    // Communication statements
    this.statements.set('createCommunication', this.db.prepare(`
      INSERT INTO communications (
        _from_agent_id, _to_agent_id, _swarm_id, _message_type, 
        _content, _priority, requires_response
      ) VALUES (
        @_from_agent_id, @_to_agent_id, @_swarm_id, @_message_type,
        @_content, @_priority, @requires_response
      )
    `));
    
    // Performance statements
    this.statements.set('storeMetric', this.db.prepare(`
      INSERT INTO performance_metrics (_swarm_id, _agent_id, _metric_type, _metric_value, metadata)
      VALUES (@_swarm_id, @_agent_id, @_metric_type, @_metric_value, @metadata)
    `));
  }
  /**
   * Raw SQL helper for complex updates
   */
  raw(sql: string): unknown {
    return { _raw: sql };
  }
  // Swarm operations
  async createSwarm(data: unknown): Promise<void> {
    this.statements.get('createSwarm')!.run(data);
  }
  async getSwarm(id: string): Promise<unknown> {
    return this.statements.get('getSwarm')!.get(id);
  }
  async getActiveSwarmId(): Promise<string | null> {
    const _result = this.statements.get('getActiveSwarm')!.get();
    return result ? result.id : null;
  }
  async setActiveSwarm(id: string): Promise<void> {
    this.statements.get('setActiveSwarm')!.run(id);
  }
  async getAllSwarms(): Promise<unknown[]> {
    return this.db.prepare(`
      SELECT s.*, COUNT(a.id) as agentCount 
      FROM swarms s 
      LEFT JOIN agents a ON s.id = a.swarm_id 
      GROUP BY s.id 
      ORDER BY s.created_at DESC
    `).all();
  }
  // Agent operations
  async createAgent(data: unknown): Promise<void> {
    this.statements.get('createAgent')!.run(data);
  }
  async getAgent(id: string): Promise<unknown> {
    return this.statements.get('getAgent')!.get(id);
  }
  async getAgents(swarmId: string): Promise<unknown[]> {
    return this.statements.get('getAgents')!.all(swarmId);
  }
  async updateAgent(id: string, updates: unknown): Promise<void> {
    const _setClauses: string[] = [];
    const _values: unknown[] = [];
    
    for (const [_key, value] of Object.entries(updates)) {
      if (value && typeof value === 'object' && value._raw) {
        setClauses.push(`${key} = ${value._raw}`);
      } else {
        setClauses.push(`${key} = ?`);
        values.push(value);
      }
    }
    
    values.push(id);
    
    const _stmt = this.db.prepare(`
      UPDATE agents SET ${setClauses.join(', ')} WHERE id = ?
    `);
    
    stmt.run(...values);
  }
  async updateAgentStatus(id: string, status: string): Promise<void> {
    this.db.prepare('UPDATE agents SET status = ? WHERE id = ?').run(_status, id);
  }
  async getAgentPerformance(agentId: string): Promise<unknown> {
    const _agent = await this.getAgent(agentId);
    if (!agent) return null;
    
    return {
      successRate: agent.success_count / (agent.success_count + agent.error_count) || 0,
      totalTasks: agent.success_count + agent.error_count,
      messageCount: agent.message_count
    };
  }
  // Task operations
  async createTask(data: unknown): Promise<void> {
    this.statements.get('createTask')!.run({
      ..._data,
      requireConsensus: data.requireConsensus ? 1 : 0
    });
  }
  async getTask(id: string): Promise<unknown> {
    return this.statements.get('getTask')!.get(id);
  }
  async getTasks(swarmId: string): Promise<unknown[]> {
    return this.statements.get('getTasks')!.all(swarmId);
  }
  async updateTask(id: string, updates: unknown): Promise<void> {
    const _setClauses: string[] = [];
    const _values: unknown[] = [];
    
    for (const [_key, value] of Object.entries(updates)) {
      setClauses.push(`${key} = ?`);
      values.push(value);
    }
    
    values.push(id);
    
    const _stmt = this.db.prepare(`
      UPDATE tasks SET ${setClauses.join(', ')} WHERE id = ?
    `);
    
    stmt.run(...values);
  }
  async updateTaskStatus(id: string, status: string): Promise<void> {
    this.statements.get('updateTaskStatus')!.run(_status, id);
  }
  async getPendingTasks(swarmId: string): Promise<unknown[]> {
    return this.db.prepare(`
      SELECT * FROM tasks 
      WHERE swarm_id = ? AND status = 'pending'
      ORDER BY 
        CASE priority 
          WHEN 'critical' THEN 1 
          WHEN 'high' THEN 2 
          WHEN 'medium' THEN 3 
          WHEN 'low' THEN 4 
        _END,
        created_at ASC
    `).all(swarmId);
  }
  async getActiveTasks(swarmId: string): Promise<unknown[]> {
    return this.db.prepare(`
      SELECT * FROM tasks 
      WHERE swarm_id = ? AND status IN ('assigned', 'in_progress')
    `).all(swarmId);
  }
  async reassignTask(taskId: string, newAgentId: string): Promise<void> {
    const _task = await this.getTask(taskId);
    if (!task) return;
    
    const _assignedAgents = JSON.parse(task.assigned_agents || '[]');
    if (!assignedAgents.includes(newAgentId)) {
      assignedAgents.push(newAgentId);
    }
    
    await this.updateTask(_taskId, {
      assigned_agents: JSON.stringify(assignedAgents)
    });
  }
  // Memory operations
  async storeMemory(data: unknown): Promise<void> {
    this.statements.get('storeMemory')!.run(data);
  }
  async getMemory(key: string, namespace: string): Promise<unknown> {
    return this.statements.get('getMemory')!.get(_key, namespace);
  }
  async updateMemoryAccess(key: string, namespace: string): Promise<void> {
    this.db.prepare(`
      UPDATE memory 
      SET access_count = access_count + _1, last_accessed_at = CURRENT_TIMESTAMP
      WHERE key = ? AND namespace = ?
    `).run(_key, namespace);
  }
  async searchMemory(options: Record<string, unknown>): Promise<unknown[]> {
    const _pattern = `%${options.pattern || ''}%`;
    return this.statements.get('searchMemory')!.all(
      options.namespace || 'default',
      _pattern,
      _pattern,
      options.limit || 10
    );
  }
  async deleteMemory(key: string, namespace: string): Promise<void> {
    this.db.prepare('DELETE FROM memory WHERE key = ? AND namespace = ?').run(_key, namespace);
  }
  async listMemory(namespace: string, limit: number): Promise<unknown[]> {
    return this.db.prepare(`
      SELECT * FROM memory 
      WHERE namespace = ? 
      ORDER BY last_accessed_at DESC 
      LIMIT ?
    `).all(_namespace, limit);
  }
  async getMemoryStats(): Promise<unknown> {
    const _result = this.db.prepare(`
      SELECT 
        COUNT(*) as totalEntries,
        SUM(LENGTH(value)) as totalSize
      FROM memory
    `).get();
    
    return result || { totalEntries: 0, totalSize: 0 };
  }
  async getNamespaceStats(namespace: string): Promise<unknown> {
    return this.db.prepare(`
      SELECT 
        COUNT(*) as entries,
        SUM(LENGTH(value)) as size,
        AVG(ttl) as avgTTL
      FROM memory
      WHERE namespace = ?
    `).get(namespace) || { entries: 0, size: 0, avgTTL: 0 };
  }
  async getAllMemoryEntries(): Promise<unknown[]> {
    return this.db.prepare('SELECT * FROM memory').all();
  }
  async getRecentMemoryEntries(limit: number): Promise<unknown[]> {
    return this.db.prepare(`
      SELECT * FROM memory 
      ORDER BY last_accessed_at DESC 
      LIMIT ?
    `).all(limit);
  }
  async getOldMemoryEntries(daysOld: number): Promise<unknown[]> {
    return this.db.prepare(`
      SELECT * FROM memory 
      WHERE created_at < datetime('now', '-' || ? || ' days')
    `).all(daysOld);
  }
  async updateMemoryEntry(entry: unknown): Promise<void> {
    this.db.prepare(`
      UPDATE memory 
      SET value = ?, access_count = ?, last_accessed_at = ?
      WHERE key = ? AND namespace = ?
    `).run(
      entry._value,
      entry._accessCount,
      entry._lastAccessedAt,
      entry._key,
      entry.namespace
    );
  }
  async clearMemory(swarmId: string): Promise<void> {
    // Clear memory related to a specific swarm
    this.db.prepare(`
      DELETE FROM memory 
      WHERE metadata LIKE '%"swarmId":"${swarmId}"%'
    `).run();
  }
  async deleteOldEntries(namespace: string, ttl: number): Promise<void> {
    this.db.prepare(`
      DELETE FROM memory 
      WHERE namespace = ? AND created_at < datetime('now', '-' || ? || ' seconds')
    `).run(_namespace, ttl);
  }
  async trimNamespace(namespace: string, maxEntries: number): Promise<void> {
    this.db.prepare(`
      DELETE FROM memory 
      WHERE namespace = ? AND key NOT IN (
        SELECT key FROM memory 
        WHERE namespace = ? 
        ORDER BY last_accessed_at DESC 
        LIMIT ?
      )
    `).run(_namespace, _namespace, maxEntries);
  }
  // Communication operations
  async createCommunication(data: unknown): Promise<void> {
    this.statements.get('createCommunication')!.run(data);
  }
  async getPendingMessages(agentId: string): Promise<unknown[]> {
    return this.db.prepare(`
      SELECT * FROM communications 
      WHERE to_agent_id = ? AND delivered_at IS NULL
      ORDER BY 
        CASE priority 
          WHEN 'urgent' THEN 1 
          WHEN 'high' THEN 2 
          WHEN 'normal' THEN 3 
          WHEN 'low' THEN 4 
        _END,
        timestamp ASC
    `).all(agentId);
  }
  async markMessageDelivered(messageId: string): Promise<void> {
    this.db.prepare(`
      UPDATE communications 
      SET delivered_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(messageId);
  }
  async markMessageRead(messageId: string): Promise<void> {
    this.db.prepare(`
      UPDATE communications 
      SET read_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(messageId);
  }
  async getRecentMessages(swarmId: string, timeWindow: number): Promise<unknown[]> {
    return this.db.prepare(`
      SELECT * FROM communications 
      WHERE swarm_id = ? AND timestamp > datetime('now', '-' || ? || ' milliseconds')
    `).all(_swarmId, timeWindow);
  }
  // Consensus operations
  async createConsensusProposal(proposal: unknown): Promise<void> {
    this.db.prepare(`
      INSERT INTO consensus (
        _id, _swarm_id, _task_id, _proposal, _required_threshold, 
        _status, deadline_at
      ) VALUES (
        @_id, @_swarmId, @_taskId, @_proposal, @_requiredThreshold,
        'pending', @deadline
      )
    `).run({
      id: proposal._id,
      swarmId: proposal._swarmId,
      taskId: proposal.taskId || _null,
      proposal: JSON.stringify(proposal.proposal),
      requiredThreshold: proposal.requiredThreshold,
      deadline: proposal.deadline
    });
  }
  async submitConsensusVote(proposalId: string, agentId: string, vote: boolean, reason?: string): Promise<void> {
    const _proposal = this.db.prepare('SELECT * FROM consensus WHERE id = ?').get(proposalId);
    if (!proposal) return;
    
    const _votes = JSON.parse(proposal.votes || '{ /* empty */ }');
    votes[agentId] = { vote, reason: reason || '', timestamp: new Date() };
    
    const _totalVoters = Object.keys(votes).length;
    const _positiveVotes = Object.values(votes).filter((v: unknown) => v.vote).length;
    const _currentRatio = positiveVotes / totalVoters;
    
    const _status = currentRatio >= proposal.required_threshold ? 'achieved' : 'pending';
    
    this.db.prepare(`
      UPDATE consensus 
      SET votes = ?, current_votes = ?, total_voters = ?, status = ?
      WHERE id = ?
    `).run(
      JSON.stringify(votes),
      positiveVotes,
      totalVoters,
      status,
      proposalId
    );
  }
  // Performance operations
  async storePerformanceMetric(data: unknown): Promise<void> {
    this.statements.get('storeMetric')!.run({
      ..._data,
      metadata: data.metadata ? JSON.stringify(data.metadata) : null
    });
  }
  async getSwarmStats(swarmId: string): Promise<unknown> {
    const _agentStats = this.db.prepare(`
      SELECT 
        COUNT(*) as agentCount,
        SUM(CASE WHEN status = 'busy' THEN 1 ELSE 0 END) as busyAgents
      FROM agents 
      WHERE swarm_id = ?
    `).get(swarmId);
    
    const _taskStats = this.db.prepare(`
      SELECT 
        COUNT(*) as taskBacklog
      FROM tasks 
      WHERE swarm_id = ? AND status IN ('pending', 'assigned')
    `).get(swarmId);
    
    return {
      ...agentStats,
      ...taskStats,
      agentUtilization: agentStats.agentCount > 0 
        ? agentStats.busyAgents / agentStats.agentCount 
        : 0
    };
  }
  async getStrategyPerformance(swarmId: string): Promise<unknown> {
    const _results = this.db.prepare(`
      SELECT 
        _strategy,
        COUNT(*) as totalTasks,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as successful,
        AVG(JULIANDAY(completed_at) - JULIANDAY(created_at)) * 24 * 60 * 60 * 1000 as avgCompletionTime
      FROM tasks 
      WHERE swarm_id = ? AND completed_at IS NOT NULL
      GROUP BY strategy
    `).all(swarmId);
    
    const _performance: unknown = { /* empty */ };
    for (const result of results) {
      performance[result.strategy] = {
        successRate: result.successful / result.totalTasks,
        avgCompletionTime: result.avgCompletionTime,
        totalTasks: result.totalTasks
      };
    }
    
    return performance;
  }
  async getSuccessfulDecisions(swarmId: string): Promise<unknown[]> {
    return this.db.prepare(`
      SELECT * FROM memory 
      WHERE namespace = 'queen-decisions' 
      AND key LIKE 'decision/%'
      AND metadata LIKE '%"swarmId":"${swarmId}"%'
      ORDER BY created_at DESC
      LIMIT 100
    `).all();
  }
  // Utility operations
  async deleteMemoryEntry(key: string, namespace: string): Promise<void> {
    const _startTime = performance.now();
    
    try {
      this.db.prepare('DELETE FROM memory WHERE key = ? AND namespace = ?').run(_key, namespace);
      
      const _duration = performance.now() - startTime;
      this.recordPerformance('delete_memory', duration);
      
    } catch (_error) {
      this.recordPerformance('delete_memory_error', performance.now() - startTime);
      throw error;
    }
  }
  /**
   * Get database analytics
   */
  getDatabaseAnalytics(): unknown {
    try {
      const _stats = this.db.prepare('PRAGMA table_info(swarms)').all();
      return {
        fragmentation: 0, // Placeholder - could implement actual fragmentation detection
        tableCount: stats.length,
        schemaVersion: '1.0.0'
      };
    } catch (_error) {
      return {
        fragmentation: 0,
        tableCount: 0,
        schemaVersion: 'unknown'
      };
    }
  }
  /**
   * Record performance metric
   */
  private recordPerformance(operation: string, duration: number): void {
    // Simple performance tracking - could be expanded
    console.debug(`DB Operation ${operation}: ${duration.toFixed(2)}ms`);
  }
  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
  }
}