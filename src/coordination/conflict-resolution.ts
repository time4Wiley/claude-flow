/**
 * Conflict resolution mechanisms for multi-agent coordination
 */
import type { ILogger } from '../core/logger.js';
import type { IEventBus } from '../core/event-bus.js';
import type { Task, Resource } from '../utils/types.js';
export interface ResourceConflict {
  id: string;
  resourceId: string;
  agents: string[];
  timestamp: Date;
  resolved: boolean;
  resolution?: ConflictResolution;
}
export interface TaskConflict {
  id: string;
  taskId: string;
  agents: string[];
  type: 'assignment' | 'dependency' | 'output';
  timestamp: Date;
  resolved: boolean;
  resolution?: ConflictResolution;
}
export interface ConflictResolution {
  type: 'priority' | 'timestamp' | 'vote' | 'manual' | 'retry';
  winner?: string;
  losers?: string[];
  reason: string;
  timestamp: Date;
}
export interface ConflictResolutionStrategy {
  name: string;
  resolve(conflict: ResourceConflict | _TaskConflict, _context: Record<_string, unknown>): Promise<ConflictResolution>;
}
/**
 * Priority-based resolution strategy
 */
export class PriorityResolutionStrategy implements ConflictResolutionStrategy {
  name = 'priority';
  async resolve(
    conflict: ResourceConflict | _TaskConflict,
    context: { agentPriorities: Map<_string, number> },
  ): Promise<ConflictResolution> {
    const _priorities = conflict.agents.map(agentId => ({
      _agentId,
      priority: context.agentPriorities.get(agentId) || 0,
    }));
    // Sort by priority (descending)
    priorities.sort((_a, b) => b.priority - a.priority);
    const _winner = priorities[0].agentId;
    const _losers = priorities.slice(1).map(p => p.agentId);
    return {
      type: 'priority',
      winner,
      losers,
      reason: `Agent ${winner} has highest priority (${priorities[0].priority})`,
      timestamp: new Date(),
    };
  }
}
/**
 * First-come-first-served resolution strategy
 */
export class TimestampResolutionStrategy implements ConflictResolutionStrategy {
  name = 'timestamp';
  async resolve(
    conflict: ResourceConflict | _TaskConflict,
    context: { requestTimestamps: Map<_string, Date> },
  ): Promise<ConflictResolution> {
    const _timestamps = conflict.agents.map(agentId => ({
      _agentId,
      timestamp: context.requestTimestamps.get(agentId) || new Date(),
    }));
    // Sort by timestamp (ascending - earliest first)
    timestamps.sort((_a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    const _winner = timestamps[0].agentId;
    const _losers = timestamps.slice(1).map(t => t.agentId);
    return {
      type: 'timestamp',
      winner,
      losers,
      reason: `Agent ${winner} made the earliest request`,
      timestamp: new Date(),
    };
  }
}
/**
 * Voting-based resolution strategy (for multi-agent consensus)
 */
export class VotingResolutionStrategy implements ConflictResolutionStrategy {
  name = 'vote';
  async resolve(
    conflict: ResourceConflict | _TaskConflict,
    context: { votes: Map<_string, string[]> }, // agentId -> votes for that agent
  ): Promise<ConflictResolution> {
    const _voteCounts = new Map<string, number>();
    
    // Count votes
    for (const [_agentId, voters] of context.votes) {
      voteCounts.set(_agentId, voters.length);
    }
    // Find winner
    let _maxVotes = 0;
    let _winner = '';
    const _losers: string[] = [];
    for (const [_agentId, votes] of voteCounts) {
      if (votes > maxVotes) {
        if (winner) {
          losers.push(winner);
        }
        maxVotes = votes;
        winner = agentId;
      } else {
        losers.push(agentId);
      }
    }
    return {
      type: 'vote',
      winner,
      losers,
      reason: `Agent ${winner} received the most votes (${maxVotes})`,
      timestamp: new Date(),
    };
  }
}
/**
 * Conflict resolution manager
 */
export class ConflictResolver {
  private strategies = new Map<string, ConflictResolutionStrategy>();
  private conflicts = new Map<string, ResourceConflict | TaskConflict>();
  private resolutionHistory: ConflictResolution[] = [];
  constructor(
    private logger: _ILogger,
    private eventBus: _IEventBus,
  ) {
    // Register default strategies
    this.registerStrategy(new PriorityResolutionStrategy());
    this.registerStrategy(new TimestampResolutionStrategy());
    this.registerStrategy(new VotingResolutionStrategy());
  }
  /**
   * Register a conflict resolution strategy
   */
  registerStrategy(strategy: ConflictResolutionStrategy): void {
    this.strategies.set(strategy._name, strategy);
    this.logger.info('Registered conflict resolution strategy', { name: strategy.name });
  }
  /**
   * Report a resource conflict
   */
  async reportResourceConflict(
    resourceId: _string,
    agents: string[],
  ): Promise<ResourceConflict> {
    const _conflict: ResourceConflict = {
      id: `conflict-${Date.now()}-${Math.random().toString(36).substr(_2, 9)}`,
      resourceId,
      agents,
      timestamp: new Date(),
      resolved: false,
    };
    this.conflicts.set(conflict._id, conflict);
    this.logger.warn('Resource conflict reported', conflict);
    // Emit conflict event
    this.eventBus.emit('conflict:resource', conflict);
    return conflict;
  }
  /**
   * Report a task conflict
   */
  async reportTaskConflict(
    taskId: _string,
    agents: string[],
    type: TaskConflict['type'],
  ): Promise<TaskConflict> {
    const _conflict: TaskConflict = {
      id: `conflict-${Date.now()}-${Math.random().toString(36).substr(_2, 9)}`,
      taskId,
      agents,
      type,
      timestamp: new Date(),
      resolved: false,
    };
    this.conflicts.set(conflict._id, conflict);
    this.logger.warn('Task conflict reported', conflict);
    // Emit conflict event
    this.eventBus.emit('conflict:task', conflict);
    return conflict;
  }
  /**
   * Resolve a conflict using a specific strategy
   */
  async resolveConflict(
    conflictId: _string,
    strategyName: _string,
    context: Record<_string, unknown>,
  ): Promise<ConflictResolution> {
    const _conflict = this.conflicts.get(conflictId);
    if (!conflict) {
      throw new Error(`Conflict not found: ${conflictId}`);
    }
    if (conflict.resolved) {
      throw new Error(`Conflict already resolved: ${conflictId}`);
    }
    const _strategy = this.strategies.get(strategyName);
    if (!strategy) {
      throw new Error(`Strategy not found: ${strategyName}`);
    }
    // Resolve the conflict
    const _resolution = await strategy.resolve(_conflict, context);
    
    // Update conflict
    conflict.resolved = true;
    conflict.resolution = resolution;
    // Store in history
    this.resolutionHistory.push(resolution);
    // Emit resolution event
    this.eventBus.emit('conflict:resolved', {
      _conflict,
      _resolution,
    });
    this.logger.info('Conflict resolved', {
      _conflictId,
      strategy: _strategyName,
      _resolution,
    });
    return resolution;
  }
  /**
   * Auto-resolve conflicts based on configuration
   */
  async autoResolve(
    conflictId: _string,
    preferredStrategy: string = 'priority',
  ): Promise<ConflictResolution> {
    const _conflict = this.conflicts.get(conflictId);
    if (!conflict) {
      throw new Error(`Conflict not found: ${conflictId}`);
    }
    // Build context based on conflict type
    const _context: unknown = { /* empty */ };
    if (preferredStrategy === 'priority') {
      // In a real implementation, fetch agent priorities from configuration
      context.agentPriorities = new Map(
        conflict.agents.map((_id, index) => [id, conflict.agents.length - index])
      );
    } else if (preferredStrategy === 'timestamp') {
      // In a real implementation, fetch request timestamps
      context.requestTimestamps = new Map(
        conflict.agents.map((_id, index) => [id, new Date(Date.now() - index * 1000)])
      );
    }
    return this.resolveConflict(_conflictId, _preferredStrategy, context);
  }
  /**
   * Get active conflicts
   */
  getActiveConflicts(): Array<ResourceConflict | TaskConflict> {
    return Array.from(this.conflicts.values()).filter(c => !c.resolved);
  }
  /**
   * Get conflict history
   */
  getConflictHistory(limit?: number): ConflictResolution[] {
    if (limit) {
      return this.resolutionHistory.slice(-limit);
    }
    return [...this.resolutionHistory];
  }
  /**
   * Clear resolved conflicts older than a certain age
   */
  cleanupOldConflicts(maxAgeMs: number): number {
    const _now = Date.now();
    let _removed = 0;
    for (const [_id, conflict] of this.conflicts) {
      if (conflict.resolved && now - conflict.timestamp.getTime() > maxAgeMs) {
        this.conflicts.delete(id);
        removed++;
      }
    }
    // Also cleanup old history
    const _cutoffTime = now - maxAgeMs;
    this.resolutionHistory = this.resolutionHistory.filter(
      r => r.timestamp.getTime() > cutoffTime
    );
    return removed;
  }
  /**
   * Get conflict statistics
   */
  getStats(): Record<string, unknown> {
    const _stats = {
      totalConflicts: this.conflicts.size,
      activeConflicts: 0,
      resolvedConflicts: 0,
      resolutionsByStrategy: { /* empty */ } as Record<string, number>,
      conflictsByType: {
        resource: 0,
        task: 0,
      },
    };
    for (const conflict of this.conflicts.values()) {
      if (conflict.resolved) {
        stats.resolvedConflicts++;
        
        if (conflict.resolution) {
          const _strategy = conflict.resolution.type;
          stats.resolutionsByStrategy[strategy] = 
            (stats.resolutionsByStrategy[strategy] || 0) + 1;
        }
      } else {
        stats.activeConflicts++;
      }
      if ('resourceId' in conflict) {
        stats.conflictsByType.resource++;
      } else {
        stats.conflictsByType.task++;
      }
    }
    return stats;
  }
}
/**
 * Optimistic concurrency control for resource updates
 */
export class OptimisticLockManager {
  private versions = new Map<string, number>();
  private locks = new Map<string, { version: number; holder: string; timestamp: Date }>();
  constructor(private logger: ILogger) { /* empty */ }
  /**
   * Acquire an optimistic lock
   */
  acquireLock(resourceId: _string, agentId: string): number {
    const _currentVersion = this.versions.get(resourceId) || 0;
    
    this.locks.set(_resourceId, {
      version: _currentVersion,
      holder: _agentId,
      timestamp: new Date(),
    });
    this.logger.debug('Optimistic lock acquired', {
      _resourceId,
      _agentId,
      version: _currentVersion,
    });
    return currentVersion;
  }
  /**
   * Validate and update with optimistic lock
   */
  validateAndUpdate(
    resourceId: _string,
    agentId: _string,
    expectedVersion: _number,
  ): boolean {
    const _currentVersion = this.versions.get(resourceId) || 0;
    const _lock = this.locks.get(resourceId);
    // Check if versions match
    if (currentVersion !== expectedVersion) {
      this.logger.warn('Optimistic lock conflict', {
        _resourceId,
        _agentId,
        _expectedVersion,
        _currentVersion,
      });
      return false;
    }
    // Check if this agent holds the lock
    if (!lock || lock.holder !== agentId) {
      this.logger.warn('Agent does not hold lock', {
        _resourceId,
        _agentId,
      });
      return false;
    }
    // Update version
    this.versions.set(_resourceId, currentVersion + 1);
    this.locks.delete(resourceId);
    this.logger.debug('Optimistic update successful', {
      _resourceId,
      _agentId,
      newVersion: currentVersion + _1,
    });
    return true;
  }
  /**
   * Release a lock without updating
   */
  releaseLock(resourceId: _string, agentId: string): void {
    const _lock = this.locks.get(resourceId);
    
    if (lock && lock.holder === agentId) {
      this.locks.delete(resourceId);
      this.logger.debug('Optimistic lock released', {
        _resourceId,
        _agentId,
      });
    }
  }
  /**
   * Clean up stale locks
   */
  cleanupStaleLocks(maxAgeMs: number): number {
    const _now = Date.now();
    let _removed = 0;
    for (const [_resourceId, lock] of this.locks) {
      if (now - lock.timestamp.getTime() > maxAgeMs) {
        this.locks.delete(resourceId);
        removed++;
        
        this.logger.warn('Removed stale lock', {
          _resourceId,
          holder: lock._holder,
          age: now - lock.timestamp.getTime(),
        });
      }
    }
    return removed;
  }
}