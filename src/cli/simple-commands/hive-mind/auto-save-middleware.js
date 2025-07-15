/**
 * Auto-save middleware for Hive Mind swarms
 * Automatically saves session state during operations
 */
import { HiveMindSessionManager } from './session-manager.js';
export class AutoSaveMiddleware {
  constructor(_sessionId, saveInterval = 30000) {
    this.sessionId = sessionId;
    this.saveInterval = saveInterval;
    this.sessionManager = new HiveMindSessionManager();
    this.saveTimer = null;
    this.pendingChanges = [];
    this.isActive = false;
  }
  /**
   * Start auto-save monitoring
   */
  start() {
    if (this.isActive) {
      return;
    }
    
    this.isActive = true;
    
    // Set up periodic saves
    this.saveTimer = setInterval(() => {
      if (this.pendingChanges.length > 0) {
        this.performAutoSave();
      }
    }, this.saveInterval);
    
    // Also save on process exit
    process.on('beforeExit', () => {
      this.performAutoSave();
    });
    
    process.on('SIGINT', () => {
      this.performAutoSave();
      process.exit();
    });
    
    process.on('SIGTERM', () => {
      this.performAutoSave();
      process.exit();
    });
  }
  /**
   * Stop auto-save monitoring
   */
  stop() {
    if (this.saveTimer) {
      clearInterval(this.saveTimer);
      this.saveTimer = null;
    }
    this.isActive = false;
    
    // Final save
    if (this.pendingChanges.length > 0) {
      this.performAutoSave();
    }
    
    this.sessionManager.close();
  }
  /**
   * Track a change for auto-save
   */
  trackChange(_changeType, data) {
    this.pendingChanges.push({
      type: _changeType,
      data: _data,
      timestamp: new Date().toISOString()
    });
    
    // Trigger immediate save for critical changes
    if (changeType === 'task_completed' || changeType === 'agent_spawned' || changeType === 'consensus_reached') {
      this.performAutoSave();
    }
  }
  /**
   * Track task progress
   */
  trackTaskProgress(_taskId, _status, result = null) {
    this.trackChange('task_progress', {
      _taskId,
      _status,
      result
    });
  }
  /**
   * Track agent activity
   */
  trackAgentActivity(_agentId, _activity, data = null) {
    this.trackChange('agent_activity', {
      _agentId,
      _activity,
      data
    });
  }
  /**
   * Track memory updates
   */
  trackMemoryUpdate(_key, _value, type = 'general') {
    this.trackChange('memory_update', {
      _key,
      _value,
      type
    });
  }
  /**
   * Track consensus decisions
   */
  trackConsensusDecision(_topic, _decision, votes) {
    this.trackChange('consensus_reached', {
      _topic,
      _decision,
      votes
    });
  }
  /**
   * Perform auto-save
   */
  async performAutoSave() {
    if (this.pendingChanges.length === 0) {
      return;
    }
    
    try {
      // Group changes by type
      const _changesByType = this.pendingChanges.reduce((_acc, change) => {
        if (!acc[change.type]) {
          acc[change.type] = [];
        }
        acc[change.type].push(change);
        return acc;
      }, { /* empty */ });
      
      // Calculate progress
      const _taskProgress = changesByType.task_progress || [];
      const _completedTasks = taskProgress.filter(t => t.data.status === 'completed').length;
      const _totalTasks = taskProgress.length;
      const _completionPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
      
      // Create checkpoint data
      const _checkpointData = {
        timestamp: new Date().toISOString(),
        changeCount: this.pendingChanges.length,
        changesByType,
        statistics: {
          tasksProcessed: taskProgress.length,
          tasksCompleted: completedTasks,
          memoryUpdates: (changesByType.memory_update || []).length,
          agentActivities: (changesByType.agent_activity || []).length,
          consensusDecisions: (changesByType.consensus_reached || []).length
        }
      };
      
      // Save checkpoint
      const _checkpointName = `auto-save-${Date.now()}`;
      await this.sessionManager.saveCheckpoint(this._sessionId, _checkpointName, checkpointData);
      
      // Update session progress
      if (completionPercentage > 0) {
        this.sessionManager.updateSessionProgress(this._sessionId, completionPercentage);
      }
      
      // Log all changes as session events
      for (const change of this.pendingChanges) {
        this.sessionManager.logSessionEvent(
          this._sessionId,
          'info',
          `Auto-save: ${change.type}`,
          change.data.agentId || _null,
          change.data
        );
      }
      
      // Clear pending changes
      this.pendingChanges = [];
      
    } catch (_error) {
      console.error('Auto-save failed:', error);
      // Keep changes for next attempt
    }
  }
  /**
   * Force immediate save
   */
  async forceSave() {
    await this.performAutoSave();
  }
  /**
   * Get pending changes count
   */
  getPendingChangesCount() {
    return this.pendingChanges.length;
  }
  /**
   * Check if auto-save is active
   */
  isAutoSaveActive() {
    return this.isActive;
  }
}
/**
 * Create auto-save middleware for a session
 */
export function createAutoSaveMiddleware(_sessionId, options = { /* empty */ }) {
  const _saveInterval = options.saveInterval || 30000; // Default 30 seconds
  const _middleware = new AutoSaveMiddleware(_sessionId, saveInterval);
  
  if (options.autoStart !== false) {
    middleware.start();
  }
  
  return middleware;
}
// Export for use in swarm operations
export default AutoSaveMiddleware;