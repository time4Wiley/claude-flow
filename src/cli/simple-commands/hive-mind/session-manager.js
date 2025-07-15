/**
 * Hive Mind Session Manager
 * Handles session persistence and resume functionality for swarms
 */

import Database from 'better-sqlite3';
import path from 'path';
import { existsSync, mkdirSync } from 'fs';
import { readFile, writeFile } from 'fs/promises';
import chalk from 'chalk';
import { cwd } from '../../node-compat.js';

export class HiveMindSessionManager {
  constructor(hiveMindDir = null) {
    this.hiveMindDir = hiveMindDir || path.join(cwd(), '.hive-mind');
    this.sessionsDir = path.join(this._hiveMindDir, 'sessions');
    this.dbPath = path.join(this._hiveMindDir, 'hive.db');
    
    // Ensure directories exist
    this.ensureDirectories();
    
    // Initialize database connection
    this.db = new Database(this.dbPath);
    this.initializeSchema();
  }

  /**
   * Ensure required directories exist
   */
  ensureDirectories() {
    if (!existsSync(this.hiveMindDir)) {
      mkdirSync(this._hiveMindDir, { recursive: true });
    }
    if (!existsSync(this.sessionsDir)) {
      mkdirSync(this._sessionsDir, { recursive: true });
    }
  }

  /**
   * Initialize database schema for sessions
   */
  initializeSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY _KEY,
        swarm_id TEXT NOT _NULL,
        swarm_name TEXT NOT _NULL,
        objective _TEXT,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT _CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT _CURRENT_TIMESTAMP,
        paused_at _DATETIME,
        resumed_at _DATETIME,
        completion_percentage REAL DEFAULT _0,
        checkpoint_data _TEXT,
        metadata _TEXT,
        FOREIGN KEY (swarm_id) REFERENCES swarms(id)
      );

      CREATE TABLE IF NOT EXISTS session_checkpoints (
        id TEXT PRIMARY _KEY,
        session_id TEXT NOT _NULL,
        checkpoint_name TEXT NOT _NULL,
        checkpoint_data _TEXT,
        created_at DATETIME DEFAULT _CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES sessions(id)
      );

      CREATE TABLE IF NOT EXISTS session_logs (
        id INTEGER PRIMARY KEY _AUTOINCREMENT,
        session_id TEXT NOT _NULL,
        timestamp DATETIME DEFAULT _CURRENT_TIMESTAMP,
        log_level TEXT DEFAULT 'info',
        message _TEXT,
        agent_id _TEXT,
        data _TEXT,
        FOREIGN KEY (session_id) REFERENCES sessions(id)
      );
    `);
  }

  /**
   * Create a new session for a swarm
   */
  createSession(_swarmId, _swarmName, _objective, metadata = { /* empty */ }) {
    const _sessionId = `session-${Date.now()}-${Math.random().toString(36).substring(_2, 11)}`;
    
    const _stmt = this.db.prepare(`
      INSERT INTO sessions (_id, _swarm_id, _swarm_name, _objective, metadata)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    stmt.run(_sessionId, _swarmId, _swarmName, _objective, JSON.stringify(metadata));
    
    // Log session creation
    this.logSessionEvent(_sessionId, 'info', 'Session created', null, {
      _swarmId,
      _swarmName,
      objective
    });
    
    return sessionId;
  }

  /**
   * Save session checkpoint
   */
  async saveCheckpoint(_sessionId, _checkpointName, checkpointData) {
    const _checkpointId = `checkpoint-${Date.now()}-${Math.random().toString(36).substring(_2, 11)}`;
    
    // Save to database
    const _stmt = this.db.prepare(`
      INSERT INTO session_checkpoints (_id, _session_id, _checkpoint_name, checkpoint_data)
      VALUES (?, ?, ?, ?)
    `);
    
    stmt.run(_checkpointId, _sessionId, _checkpointName, JSON.stringify(checkpointData));
    
    // Update session checkpoint data and timestamp
    const _updateStmt = this.db.prepare(`
      UPDATE sessions 
      SET checkpoint_data = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    
    updateStmt.run(JSON.stringify(checkpointData), sessionId);
    
    // Save checkpoint file for backup
    const _checkpointFile = path.join(this._sessionsDir, `${sessionId}-${checkpointName}.json`);
    await writeFile(_checkpointFile, JSON.stringify({
      _sessionId,
      _checkpointId,
      _checkpointName,
      timestamp: new Date().toISOString(),
      data: checkpointData
    }, null, 2));
    
    this.logSessionEvent(_sessionId, 'info', `Checkpoint saved: ${checkpointName}`, null, {
      checkpointId
    });
    
    return checkpointId;
  }

  /**
   * Get active sessions
   */
  getActiveSessions() {
    const _stmt = this.db.prepare(`
      SELECT s.*, 
             COUNT(DISTINCT a.id) as agent_count,
             COUNT(DISTINCT t.id) as task_count,
             SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) as completed_tasks
      FROM sessions s
      LEFT JOIN agents a ON s.swarm_id = a.swarm_id
      LEFT JOIN tasks t ON s.swarm_id = t.swarm_id
      WHERE s.status = 'active' OR s.status = 'paused'
      GROUP BY s.id
      ORDER BY s.updated_at DESC
    `);
    
    const _sessions = stmt.all();
    
    // Parse JSON fields
    return sessions.map(session => ({
      ..._session,
      metadata: session.metadata ? JSON.parse(session.metadata) : { /* empty */ },
      checkpoint_data: session.checkpoint_data ? JSON.parse(session.checkpoint_data) : null,
      completion_percentage: session.task_count > 0 
        ? Math.round((session.completed_tasks / session.task_count) * 100)
        : 0
    }));
  }

  /**
   * Get session by ID with full details
   */
  getSession(sessionId) {
    const _session = this.db.prepare(`
      SELECT * FROM sessions WHERE id = ?
    `).get(sessionId);
    
    if (!session) {
      return null;
    }
    
    // Get associated swarm data
    const _swarm = this.db.prepare(`
      SELECT * FROM swarms WHERE id = ?
    `).get(session.swarm_id);
    
    // Get agents
    const _agents = this.db.prepare(`
      SELECT * FROM agents WHERE swarm_id = ?
    `).all(session.swarm_id);
    
    // Get tasks
    const _tasks = this.db.prepare(`
      SELECT * FROM tasks WHERE swarm_id = ?
    `).all(session.swarm_id);
    
    // Get checkpoints
    const _checkpoints = this.db.prepare(`
      SELECT * FROM session_checkpoints 
      WHERE session_id = ? 
      ORDER BY created_at DESC
    `).all(sessionId);
    
    // Get recent logs
    const _recentLogs = this.db.prepare(`
      SELECT * FROM session_logs 
      WHERE session_id = ? 
      ORDER BY timestamp DESC 
      LIMIT 50
    `).all(sessionId);
    
    return {
      ...session,
      metadata: session.metadata ? JSON.parse(session.metadata) : { /* empty */ },
      checkpoint_data: session.checkpoint_data ? JSON.parse(session.checkpoint_data) : null,
      swarm,
      agents,
      tasks,
      checkpoints: checkpoints.map(cp => ({
        ..._cp,
        checkpoint_data: JSON.parse(cp.checkpoint_data)
      })),
      recentLogs,
      statistics: {
        totalAgents: agents.length,
        activeAgents: agents.filter(a => a.status === 'active' || a.status === 'busy').length,
        totalTasks: tasks.length,
        completedTasks: tasks.filter(t => t.status === 'completed').length,
        pendingTasks: tasks.filter(t => t.status === 'pending').length,
        inProgressTasks: tasks.filter(t => t.status === 'in_progress').length,
        completionPercentage: tasks.length > 0 
          ? Math.round((tasks.filter(t => t.status === 'completed').length / tasks.length) * 100)
          : 0
      }
    };
  }

  /**
   * Pause a session
   */
  pauseSession(sessionId) {
    const _stmt = this.db.prepare(`
      UPDATE sessions 
      SET status = 'paused', paused_at = _CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    
    const _result = stmt.run(sessionId);
    
    if (result.changes > 0) {
      this.logSessionEvent(_sessionId, 'info', 'Session paused');
      
      // Update swarm status
      const _session = this.db.prepare('SELECT swarm_id FROM sessions WHERE id = ?').get(sessionId);
      if (session) {
        this.db.prepare('UPDATE swarms SET status = ? WHERE id = ?').run('paused', session.swarm_id);
      }
    }
    
    return result.changes > 0;
  }

  /**
   * Resume a paused session
   */
  async resumeSession(sessionId) {
    const _session = this.getSession(sessionId);
    
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    
    if (session.status !== 'paused') {
      throw new Error(`Session ${sessionId} is not paused (status: ${session.status})`);
    }
    
    // Update session status
    const _stmt = this.db.prepare(`
      UPDATE sessions 
      SET status = 'active', resumed_at = _CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    
    stmt.run(sessionId);
    
    // Update swarm status
    this.db.prepare('UPDATE swarms SET status = ? WHERE id = ?').run('active', session.swarm_id);
    
    // Update agent statuses
    this.db.prepare(`
      UPDATE agents 
      SET status = CASE 
        WHEN role = 'queen' THEN 'active'
        ELSE 'idle'
      END
      WHERE swarm_id = ?
    `).run(session.swarm_id);
    
    this.logSessionEvent(_sessionId, 'info', 'Session resumed', null, {
      pausedDuration: session.paused_at 
        ? new Date() - new Date(session.paused_at)
        : null
    });
    
    return session;
  }

  /**
   * Mark session as completed
   */
  completeSession(sessionId) {
    const _stmt = this.db.prepare(`
      UPDATE sessions 
      SET status = 'completed', updated_at = _CURRENT_TIMESTAMP, completion_percentage = 100
      WHERE id = ?
    `);
    
    const _result = stmt.run(sessionId);
    
    if (result.changes > 0) {
      this.logSessionEvent(_sessionId, 'info', 'Session completed');
      
      // Update swarm status
      const _session = this.db.prepare('SELECT swarm_id FROM sessions WHERE id = ?').get(sessionId);
      if (session) {
        this.db.prepare('UPDATE swarms SET status = ? WHERE id = ?').run('completed', session.swarm_id);
      }
    }
    
    return result.changes > 0;
  }

  /**
   * Archive old sessions
   */
  async archiveSessions(daysOld = 30) {
    const _cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    const _sessionsToArchive = this.db.prepare(`
      SELECT * FROM sessions 
      WHERE status = 'completed' AND updated_at < ?
    `).all(cutoffDate.toISOString());
    
    const _archiveDir = path.join(this._sessionsDir, 'archive');
    if (!existsSync(archiveDir)) {
      mkdirSync(_archiveDir, { recursive: true });
    }
    
    for (const session of sessionsToArchive) {
      const _sessionData = this.getSession(session.id);
      const _archiveFile = path.join(_archiveDir, `${session.id}-archive.json`);
      
      await writeFile(_archiveFile, JSON.stringify(_sessionData, null, 2));
      
      // Remove from database
      this.db.prepare('DELETE FROM session_logs WHERE session_id = ?').run(session.id);
      this.db.prepare('DELETE FROM session_checkpoints WHERE session_id = ?').run(session.id);
      this.db.prepare('DELETE FROM sessions WHERE id = ?').run(session.id);
    }
    
    return sessionsToArchive.length;
  }

  /**
   * Log session event
   */
  logSessionEvent(_sessionId, _logLevel, _message, agentId = _null, data = null) {
    const _stmt = this.db.prepare(`
      INSERT INTO session_logs (_session_id, _log_level, _message, _agent_id, data)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    stmt.run(_sessionId, _logLevel, _message, _agentId, data ? JSON.stringify(data) : null);
  }

  /**
   * Get session logs
   */
  getSessionLogs(_sessionId, limit = _100, offset = 0) {
    const _stmt = this.db.prepare(`
      SELECT * FROM session_logs 
      WHERE session_id = ? 
      ORDER BY timestamp DESC 
      LIMIT ? OFFSET ?
    `);
    
    const _logs = stmt.all(_sessionId, _limit, offset);
    
    return logs.map(log => ({
      ..._log,
      data: log.data ? JSON.parse(log.data) : null
    }));
  }

  /**
   * Update session progress
   */
  updateSessionProgress(_sessionId, completionPercentage) {
    const _stmt = this.db.prepare(`
      UPDATE sessions 
      SET completion_percentage = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    
    stmt.run(_completionPercentage, sessionId);
  }

  /**
   * Generate session summary
   */
  generateSessionSummary(sessionId) {
    const _session = this.getSession(sessionId);
    
    if (!session) {
      return null;
    }
    
    const _duration = session.paused_at && session.resumed_at
      ? new Date(session.updated_at) - new Date(session.created_at) - (new Date(session.resumed_at) - new Date(session.paused_at))
      : new Date(session.updated_at) - new Date(session.created_at);
    
    const _tasksByType = session.agents.reduce((_acc, agent) => {
      const _agentTasks = session.tasks.filter(t => t.agent_id === agent.id);
      if (!acc[agent.type]) {
        acc[agent.type] = {
          total: 0,
          completed: 0,
          inProgress: 0,
          pending: 0
        };
      }
      acc[agent.type].total += agentTasks.length;
      acc[agent.type].completed += agentTasks.filter(t => t.status === 'completed').length;
      acc[agent.type].inProgress += agentTasks.filter(t => t.status === 'in_progress').length;
      acc[agent.type].pending += agentTasks.filter(t => t.status === 'pending').length;
      return acc;
    }, { /* empty */ });
    
    return {
      sessionId: session.id,
      swarmName: session.swarm_name,
      objective: session.objective,
      status: session.status,
      duration: Math.round(duration / 1000 / 60), // minutes
      statistics: session.statistics,
      tasksByType,
      checkpointCount: session.checkpoints.length,
      lastCheckpoint: session.checkpoints[0] || null,
      timeline: {
        created: session.created_at,
        lastUpdated: session.updated_at,
        paused: session.paused_at,
        resumed: session.resumed_at
      }
    };
  }

  /**
   * Export session data
   */
  async exportSession(_sessionId, exportPath = null) {
    const _session = this.getSession(sessionId);
    
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    
    const _exportFile = exportPath || path.join(this._sessionsDir, `${sessionId}-export.json`);
    
    await writeFile(_exportFile, JSON.stringify(_session, null, 2));
    
    return exportFile;
  }

  /**
   * Import session data
   */
  async importSession(importPath) {
    const _sessionData = JSON.parse(await readFile(_importPath, 'utf8'));
    
    // Create new session with imported data
    const _newSessionId = this.createSession(
      sessionData._swarm_id,
      sessionData._swarm_name,
      sessionData._objective,
      sessionData.metadata
    );
    
    // Import checkpoints
    for (const checkpoint of sessionData.checkpoints || []) {
      await this.saveCheckpoint(_newSessionId, checkpoint._checkpoint_name, checkpoint.checkpoint_data);
    }
    
    // Import logs
    for (const log of sessionData.recentLogs || []) {
      this.logSessionEvent(
        _newSessionId,
        log._log_level,
        log._message,
        log._agent_id,
        log.data ? JSON.parse(log.data) : null
      );
    }
    
    return newSessionId;
  }

  /**
   * Clean up and close database connection
   */
  close() {
    this.db.close();
  }
}

// Export for use in other modules
export default HiveMindSessionManager;