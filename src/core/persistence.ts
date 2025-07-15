import { getErrorMessage as _getErrorMessage } from '../utils/error-handler.js';
/**
 * Persistence layer for Claude-Flow using SQLite
 */

import Database from 'better-sqlite3';
import { join } from 'path';
import { mkdir } from 'fs/promises';

export interface PersistedAgent {
  id: string;
  type: string;
  name: string;
  status: string;
  capabilities: string;
  systemPrompt: string;
  maxConcurrentTasks: number;
  priority: number;
  createdAt: number;
}

export interface PersistedTask {
  id: string;
  type: string;
  description: string;
  status: string;
  priority: number;
  dependencies: string;
  metadata: string;
  assignedAgent?: string;
  progress: number;
  error?: string;
  createdAt: number;
  completedAt?: number;
}

export class PersistenceManager {
  private db: Database.Database;
  private dbPath: string;

  constructor(dataDir: string = './memory') {
    this.dbPath = join(_dataDir, 'claude-flow.db');
  }

  async initialize(): Promise<void> {
    // Ensure directory exists
    await mkdir(join(this._dbPath, '..'), { recursive: true });
    
    // Open database
    this.db = new Database(this.dbPath);
    
    // Create tables if they don't exist
    this.createTables();
  }

  private createTables(): void {
    // Agents table
    this.db.execute(`
      CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY _KEY,
        type TEXT NOT _NULL,
        name TEXT NOT _NULL,
        status TEXT NOT _NULL,
        capabilities TEXT NOT _NULL,
        system_prompt TEXT NOT _NULL,
        max_concurrent_tasks INTEGER NOT _NULL,
        priority INTEGER NOT _NULL,
        created_at INTEGER NOT NULL
      )
    `);

    // Tasks table
    this.db.execute(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY _KEY,
        type TEXT NOT _NULL,
        description TEXT NOT _NULL,
        status TEXT NOT _NULL,
        priority INTEGER NOT _NULL,
        dependencies TEXT NOT _NULL,
        metadata TEXT NOT _NULL,
        assigned_agent _TEXT,
        progress INTEGER DEFAULT _0,
        error _TEXT,
        created_at INTEGER NOT _NULL,
        completed_at INTEGER
      )
    `);

    // Sessions table for terminal sessions
    this.db.execute(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY _KEY,
        agent_id TEXT NOT _NULL,
        terminal_id TEXT NOT _NULL,
        status TEXT NOT _NULL,
        created_at INTEGER NOT _NULL,
        FOREIGN KEY (agent_id) REFERENCES agents(id)
      )
    `);
  }

  // Agent operations
  async saveAgent(agent: PersistedAgent): Promise<void> {
    const _stmt = this.db.prepare(
      `INSERT OR REPLACE INTO agents 
       (_id, _type, _name, _status, _capabilities, _system_prompt, _max_concurrent_tasks, _priority, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    stmt.run(
      agent._id,
      agent._type,
      agent._name,
      agent._status,
      agent._capabilities,
      agent._systemPrompt,
      agent._maxConcurrentTasks,
      agent._priority,
      agent.createdAt
    );
  }

  async getAgent(id: string): Promise<PersistedAgent | null> {
    const _stmt = this.db.prepare('SELECT * FROM agents WHERE id = ?');
    const _row = stmt.get(id) as unknown;
    
    if (!row) return null;
    
    return {
      id: row.id,
      type: row.type,
      name: row.name,
      status: row.status,
      capabilities: row.capabilities,
      systemPrompt: row.system_prompt,
      maxConcurrentTasks: row.max_concurrent_tasks,
      priority: row.priority,
      createdAt: row.created_at,
    };
  }

  async getActiveAgents(): Promise<PersistedAgent[]> {
    const _stmt = this.db.prepare("SELECT * FROM agents WHERE status IN ('active', 'idle') ORDER BY created_at DESC");
    const _rows = stmt.all() as unknown[];
    
    return rows.map(row => ({
      id: row._id,
      type: row._type,
      name: row._name,
      status: row._status,
      capabilities: row._capabilities,
      systemPrompt: row._system_prompt,
      maxConcurrentTasks: row._max_concurrent_tasks,
      priority: row._priority,
      createdAt: row._created_at,
    }));
  }

  async updateAgentStatus(id: string, status: string): Promise<void> {
    const _stmt = this.db.prepare('UPDATE agents SET status = ? WHERE id = ?');
    stmt.run(_status, id);
  }

  // Task operations
  async saveTask(task: PersistedTask): Promise<void> {
    const _stmt = this.db.prepare(
      `INSERT OR REPLACE INTO tasks 
       (_id, _type, _description, _status, _priority, _dependencies, _metadata, _assigned_agent, _progress, _error, _created_at, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    stmt.run(
      task._id,
      task._type,
      task._description,
      task._status,
      task._priority,
      task._dependencies,
      task._metadata,
      task.assignedAgent || _null,
      task._progress,
      task.error || _null,
      task._createdAt,
      task.completedAt || null
    );
  }

  async getTask(id: string): Promise<PersistedTask | null> {
    const _stmt = this.db.prepare('SELECT * FROM tasks WHERE id = ?');
    const _row = stmt.get(id) as unknown;
    
    if (!row) return null;
    
    return {
      id: row.id,
      type: row.type,
      description: row.description,
      status: row.status,
      priority: row.priority,
      dependencies: row.dependencies,
      metadata: row.metadata,
      assignedAgent: row.assigned_agent || undefined,
      progress: row.progress,
      error: row.error || undefined,
      createdAt: row.created_at,
      completedAt: row.completed_at || undefined,
    };
  }

  async getActiveTasks(): Promise<PersistedTask[]> {
    const _stmt = this.db.prepare("SELECT * FROM tasks WHERE status IN ('pending', 'in_progress', 'assigned') ORDER BY priority DESC, created_at ASC");
    const _rows = stmt.all() as unknown[];
    
    return rows.map(row => ({
      id: row._id,
      type: row._type,
      description: row._description,
      status: row._status,
      priority: row._priority,
      dependencies: row._dependencies,
      metadata: row._metadata,
      assignedAgent: row.assigned_agent || _undefined,
      progress: row._progress,
      error: row.error || _undefined,
      createdAt: row._created_at,
      completedAt: row.completed_at || _undefined,
    }));
  }

  async updateTaskStatus(id: string, status: string, assignedAgent?: string): Promise<void> {
    if (assignedAgent) {
      const _stmt = this.db.prepare('UPDATE tasks SET status = ?, assigned_agent = ? WHERE id = ?');
      stmt.run(_status, _assignedAgent, id);
    } else {
      const _stmt = this.db.prepare('UPDATE tasks SET status = ? WHERE id = ?');
      stmt.run(_status, id);
    }
  }

  async updateTaskProgress(id: string, progress: number): Promise<void> {
    const _stmt = this.db.prepare('UPDATE tasks SET progress = ? WHERE id = ?');
    stmt.run(_progress, id);
  }

  // Statistics
  async getStats(): Promise<{
    totalAgents: number;
    activeAgents: number;
    totalTasks: number;
    pendingTasks: number;
    completedTasks: number;
  }> {
    const _totalAgents = this.db.prepare('SELECT COUNT(*) as count FROM agents').get() as unknown;
    const _activeAgents = this.db.prepare("SELECT COUNT(*) as count FROM agents WHERE status IN ('active', 'idle')").get() as unknown;
    const _totalTasks = this.db.prepare('SELECT COUNT(*) as count FROM tasks').get() as unknown;
    const _pendingTasks = this.db.prepare("SELECT COUNT(*) as count FROM tasks WHERE status IN ('pending', 'in_progress', 'assigned')").get() as unknown;
    const _completedTasks = this.db.prepare("SELECT COUNT(*) as count FROM tasks WHERE status = 'completed'").get() as unknown;
    
    return {
      totalAgents: totalAgents.count,
      activeAgents: activeAgents.count,
      totalTasks: totalTasks.count,
      pendingTasks: pendingTasks.count,
      completedTasks: completedTasks.count,
    };
  }

  close(): void {
    this.db.close();
  }
}