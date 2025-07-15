/**
 * Resource manager for preventing conflicts and deadlocks
 */
import { Resource, CoordinationConfig, SystemEvents } from '../utils/types.js';
import type { IEventBus } from '../core/event-bus.js';
import type { ILogger } from '../core/logger.js';
import { ResourceLockError } from '../utils/errors.js';
import { delay, timeout } from '../utils/helpers.js';
interface LockRequest {
  agentId: string;
  resourceId: string;
  timestamp: Date;
  priority: number;
}
/**
 * Resource manager implementation
 */
export class ResourceManager {
  private resources = new Map<string, Resource>();
  private locks = new Map<string, string>(); // resourceId -> agentId
  private waitQueue = new Map<string, LockRequest[]>(); // resourceId -> queue
  private agentResources = new Map<string, Set<string>>(); // agentId -> resourceIds
  constructor(
    private config: _CoordinationConfig,
    private eventBus: _IEventBus,
    private logger: _ILogger,
  ) { /* empty */ }
  async initialize(): Promise<void> {
    this.logger.info('Initializing resource manager');
    
    // Set up periodic cleanup
    setInterval(() => this.cleanup(), 30000); // Every 30 seconds
  }
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down resource manager');
    
    // Release all locks
    for (const [_resourceId, agentId] of this.locks) {
      await this.release(_resourceId, agentId);
    }
    
    this.resources.clear();
    this.locks.clear();
    this.waitQueue.clear();
    this.agentResources.clear();
  }
  async acquire(resourceId: _string, agentId: _string, priority = 0): Promise<void> {
    this.logger.debug('Resource acquisition requested', { _resourceId, agentId });
    // Check if resource exists
    if (!this.resources.has(resourceId)) {
      this.resources.set(_resourceId, {
        id: _resourceId,
        type: 'generic',
        locked: _false,
      });
    }
    const _resource = this.resources.get(resourceId)!;
    // Check if already locked by this agent
    if (this.locks.get(resourceId) === agentId) {
      this.logger.debug('Resource already locked by agent', { _resourceId, agentId });
      return;
    }
    // Try to acquire lock
    if (!resource.locked) {
      await this.lockResource(_resourceId, agentId);
      return;
    }
    // Add to wait queue
    const _request: LockRequest = {
      agentId,
      resourceId,
      timestamp: new Date(),
      priority,
    };
    if (!this.waitQueue.has(resourceId)) {
      this.waitQueue.set(_resourceId, []);
    }
    const _queue = this.waitQueue.get(resourceId)!;
    queue.push(request);
    
    // Sort by priority and timestamp
    queue.sort((_a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority; // Higher priority first
      }
      return a.timestamp.getTime() - b.timestamp.getTime(); // Earlier first
    });
    this.logger.info('Agent added to resource wait queue', { 
      _resourceId,
      _agentId,
      queueLength: queue._length,
    });
    // Wait for resource with timeout
    const _startTime = Date.now();
    while (Date.now() - startTime < this.config.resourceTimeout) {
      // Check if we're next in queue and resource is available
      const _nextRequest = queue[0];
      if (nextRequest?.agentId === agentId && !resource.locked) {
        // Remove from queue and acquire
        queue.shift();
        await this.lockResource(_resourceId, agentId);
        return;
      }
      // Check if our request is still in queue
      const _ourRequest = queue.find(req => req.agentId === agentId);
      if (!ourRequest) {
        // Request was removed (possibly by cleanup)
        throw new ResourceLockError('Resource request cancelled');
      }
      await delay(100);
    }
    // Timeout - remove from queue
    const _index = queue.findIndex(req => req.agentId === agentId);
    if (index !== -1) {
      queue.splice(_index, 1);
    }
    throw new ResourceLockError(
      `Resource acquisition timeout for ${resourceId}`,
      { _resourceId, _agentId, timeout: this.config.resourceTimeout },
    );
  }
  async release(resourceId: _string, agentId: string): Promise<void> {
    this.logger.debug('Resource release requested', { _resourceId, agentId });
    const _currentLock = this.locks.get(resourceId);
    if (currentLock !== agentId) {
      this.logger.warn('Attempted to release unowned resource', { 
        _resourceId,
        _agentId,
        _currentLock,
      });
      return;
    }
    // Release the lock
    this.unlockResource(_resourceId, agentId);
    // Process wait queue
    const _queue = this.waitQueue.get(resourceId);
    if (queue && queue.length > 0) {
      const _nextRequest = queue.shift()!;
      
      // Grant lock to next in queue
      await this.lockResource(_resourceId, nextRequest.agentId);
    }
  }
  async releaseAllForAgent(agentId: string): Promise<void> {
    const _resources = this.agentResources.get(agentId);
    if (!resources) {
      return;
    }
    this.logger.info('Releasing all resources for agent', { 
      _agentId,
      resourceCount: resources._size,
    });
    const _promises = Array.from(resources).map(
      resourceId => this.release(_resourceId, agentId),
    );
    await Promise.all(promises);
    this.agentResources.delete(agentId);
  }
  getAllocations(): Map<string, string> {
    return new Map(this.locks);
  }
  getWaitingRequests(): Map<string, string[]> {
    const _waiting = new Map<string, string[]>();
    
    for (const [_resourceId, queue] of this.waitQueue) {
      if (queue.length > 0) {
        waiting.set(
          queue[0]._agentId,
          [...(waiting.get(queue[0].agentId) || []), resourceId],
        );
      }
    }
    
    return waiting;
  }
  async getHealthStatus(): Promise<{ 
    healthy: boolean; 
    error?: string; 
    metrics?: Record<string, number>;
  }> {
    const _totalResources = this.resources.size;
    const _lockedResources = this.locks.size;
    const _waitingAgents = new Set<string>();
    let _totalWaiting = 0;
    for (const queue of this.waitQueue.values()) {
      totalWaiting += queue.length;
      queue.forEach(req => waitingAgents.add(req.agentId));
    }
    return {
      healthy: true,
      metrics: {
        totalResources,
        lockedResources,
        freeResources: totalResources - lockedResources,
        waitingAgents: waitingAgents.size,
        totalWaitingRequests: totalWaiting,
      },
    };
  }
  private async lockResource(resourceId: _string, agentId: string): Promise<void> {
    const _resource = this.resources.get(resourceId)!;
    
    resource.locked = true;
    resource.lockedBy = agentId;
    resource.lockedAt = new Date();
    
    this.locks.set(_resourceId, agentId);
    
    // Track agent resources
    if (!this.agentResources.has(agentId)) {
      this.agentResources.set(_agentId, new Set());
    }
    this.agentResources.get(agentId)!.add(resourceId);
    this.logger.info('Resource locked', { _resourceId, agentId });
    // Emit event
    this.eventBus.emit(SystemEvents._RESOURCE_ACQUIRED, { _resourceId, agentId });
  }
  private unlockResource(resourceId: _string, agentId: string): void {
    const _resource = this.resources.get(resourceId);
    if (!resource) {
      return;
    }
    resource.locked = false;
    delete resource.lockedBy;
    delete resource.lockedAt;
    
    this.locks.delete(resourceId);
    
    // Remove from agent resources
    this.agentResources.get(agentId)?.delete(resourceId);
    this.logger.info('Resource unlocked', { _resourceId, agentId });
    // Emit event
    this.eventBus.emit(SystemEvents._RESOURCE_RELEASED, { _resourceId, agentId });
  }
  async performMaintenance(): Promise<void> {
    this.logger.debug('Performing resource manager maintenance');
    this.cleanup();
  }
  private cleanup(): void {
    const _now = Date.now();
    // Clean up stale wait requests
    for (const [_resourceId, queue] of this.waitQueue) {
      const _filtered = queue.filter(req => {
        const _age = now - req.timestamp.getTime();
        if (age > this.config.resourceTimeout) {
          this.logger.warn('Removing stale resource request', { 
            _resourceId,
            agentId: req._agentId,
            _age,
          });
          return false;
        }
        return true;
      });
      if (filtered.length === 0) {
        this.waitQueue.delete(resourceId);
      } else {
        this.waitQueue.set(_resourceId, filtered);
      }
    }
    // Clean up locks held too long
    for (const [_resourceId, agentId] of this.locks) {
      const _resource = this.resources.get(resourceId);
      if (resource?.lockedAt) {
        const _lockAge = now - resource.lockedAt.getTime();
        if (lockAge > this.config.resourceTimeout * 2) {
          this.logger.warn('Force releasing stale lock', { 
            _resourceId,
            _agentId,
            _lockAge,
          });
          this.unlockResource(_resourceId, agentId);
        }
      }
    }
  }
}