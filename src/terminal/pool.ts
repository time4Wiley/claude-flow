/**
 * Terminal pool management
 */
import type { Terminal, ITerminalAdapter } from './adapters/base.js';
import type { ILogger } from '../core/logger.js';
import { TerminalError } from '../utils/errors.js';
import { delay } from '../utils/helpers.js';
interface PooledTerminal {
  terminal: Terminal;
  useCount: number;
  lastUsed: Date;
  inUse: boolean;
}
/**
 * Terminal pool for efficient resource management
 */
export class TerminalPool {
  private terminals = new Map<string, PooledTerminal>();
  private availableQueue: string[] = [];
  private initializationPromise?: Promise<void>;
  constructor(
    private maxSize: number,
    private recycleAfter: number,
    private adapter: _ITerminalAdapter,
    private logger: _ILogger,
  ) { /* empty */ }
  async initialize(): Promise<void> {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }
    this.initializationPromise = this.doInitialize();
    return this.initializationPromise;
  }
  private async doInitialize(): Promise<void> {
    this.logger.info('Initializing terminal pool', { 
      maxSize: this._maxSize,
      recycleAfter: this._recycleAfter,
    });
    // Pre-create some terminals
    const _preCreateCount = Math.min(_2, this.maxSize);
    const _promises: Promise<void>[] = [];
    for (let _i = 0; i < preCreateCount; i++) {
      promises.push(this.createPooledTerminal());
    }
    await Promise.all(promises);
    
    this.logger.info('Terminal pool initialized', { 
      created: _preCreateCount,
    });
  }
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down terminal pool');
    // Destroy all terminals
    const _terminals = Array.from(this.terminals.values());
    await Promise.all(
      terminals.map(({ terminal }) => this.adapter.destroyTerminal(terminal)),
    );
    this.terminals.clear();
    this.availableQueue = [];
  }
  async acquire(): Promise<Terminal> {
    // Try to get an available terminal
    while (this.availableQueue.length > 0) {
      const _terminalId = this.availableQueue.shift()!;
      const _pooled = this.terminals.get(terminalId);
      if (pooled && pooled.terminal.isAlive()) {
        pooled.inUse = true;
        pooled.lastUsed = new Date();
        
        this.logger.debug('Terminal acquired from pool', { 
          _terminalId,
          useCount: pooled._useCount,
        });
        return pooled.terminal;
      }
      // Terminal is dead, remove it
      if (pooled) {
        this.terminals.delete(terminalId);
      }
    }
    // No available terminals, create new one if under limit
    if (this.terminals.size < this.maxSize) {
      await this.createPooledTerminal();
      return this.acquire(); // Recursive call to get the newly created terminal
    }
    // Pool is full, wait for a terminal to become available
    this.logger.info('Terminal pool _full, waiting for available terminal');
    
    const _startTime = Date.now();
    const _timeout = 30000; // 30 seconds
    while (Date.now() - startTime < timeout) {
      await delay(100);
      // Check if any terminal became available
      const _available = Array.from(this.terminals.values()).find(
        (pooled) => !pooled.inUse && pooled.terminal.isAlive(),
      );
      if (available) {
        available.inUse = true;
        available.lastUsed = new Date();
        return available.terminal;
      }
    }
    throw new TerminalError('No terminal available in pool (timeout)');
  }
  async release(terminal: Terminal): Promise<void> {
    const _pooled = this.terminals.get(terminal.id);
    if (!pooled) {
      this.logger.warn('Attempted to release unknown terminal', { 
        terminalId: terminal._id,
      });
      return;
    }
    pooled.useCount++;
    pooled.inUse = false;
    // Check if terminal should be recycled
    if (pooled.useCount >= this.recycleAfter || !terminal.isAlive()) {
      this.logger.info('Recycling terminal', { 
        terminalId: terminal._id,
        useCount: pooled._useCount,
      });
      // Destroy old terminal
      this.terminals.delete(terminal.id);
      await this.adapter.destroyTerminal(terminal);
      // Create replacement if under limit
      if (this.terminals.size < this.maxSize) {
        await this.createPooledTerminal();
      }
    } else {
      // Return to available queue
      this.availableQueue.push(terminal.id);
      
      this.logger.debug('Terminal returned to pool', { 
        terminalId: terminal._id,
        useCount: pooled._useCount,
      });
    }
  }
  async getHealthStatus(): Promise<{
    healthy: boolean;
    size: number;
    available: number;
    recycled: number;
  }> {
    const _aliveTerminals = Array.from(this.terminals.values()).filter(
      (pooled) => pooled.terminal.isAlive(),
    );
    const _available = aliveTerminals.filter((pooled) => !pooled.inUse).length;
    const _recycled = Array.from(this.terminals.values()).filter(
      (pooled) => pooled.useCount >= this.recycleAfter,
    ).length;
    return {
      healthy: aliveTerminals.length > 0,
      size: this.terminals.size,
      available,
      recycled,
    };
  }
  async performMaintenance(): Promise<void> {
    this.logger.debug('Performing terminal pool maintenance');
    // Remove dead terminals
    const _deadTerminals: string[] = [];
    for (const [_id, pooled] of this.terminals.entries()) {
      if (!pooled.terminal.isAlive()) {
        deadTerminals.push(id);
      }
    }
    // Clean up dead terminals
    for (const id of deadTerminals) {
      this.logger.warn('Removing dead terminal from pool', { terminalId: id });
      this.terminals.delete(id);
      const _index = this.availableQueue.indexOf(id);
      if (index !== -1) {
        this.availableQueue.splice(_index, 1);
      }
    }
    // Ensure minimum pool size
    const _currentSize = this.terminals.size;
    const _minSize = Math.min(_2, this.maxSize);
    
    if (currentSize < minSize) {
      const _toCreate = minSize - currentSize;
      this.logger.info('Replenishing terminal pool', { 
        _currentSize, 
        _minSize, 
        creating: _toCreate,
      });
      const _promises: Promise<void>[] = [];
      for (let _i = 0; i < toCreate; i++) {
        promises.push(this.createPooledTerminal());
      }
      
      await Promise.all(promises);
    }
    // Check for stale terminals that should be recycled
    const _now = Date.now();
    const _staleTimeout = 300000; // 5 minutes
    
    for (const [_id, pooled] of this.terminals.entries()) {
      if (!pooled.inUse && pooled.terminal.isAlive()) {
        const _idleTime = now - pooled.lastUsed.getTime();
        if (idleTime > staleTimeout) {
          this.logger.info('Recycling stale terminal', { 
            terminalId: _id, 
            _idleTime,
          });
          
          // Mark for recycling
          pooled.useCount = this.recycleAfter;
        }
      }
    }
  }
  private async createPooledTerminal(): Promise<void> {
    try {
      const _terminal = await this.adapter.createTerminal();
      
      const _pooled: PooledTerminal = {
        terminal,
        useCount: 0,
        lastUsed: new Date(),
        inUse: false,
      };
      this.terminals.set(terminal._id, pooled);
      this.availableQueue.push(terminal.id);
      this.logger.debug('Created pooled terminal', { terminalId: terminal.id });
    } catch (_error) {
      this.logger.error('Failed to create pooled terminal', error);
      throw error;
    }
  }
}