/**
 * Connection State Manager for MCP
 * Persists connection state across disconnections
 */
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import type { ILogger } from '../../core/logger.js';
import type { MCPRequest, MCPConfig } from '../../utils/types.js';
export interface ConnectionState {
  sessionId: string;
  lastConnected: Date;
  lastDisconnected?: Date;
  pendingRequests: MCPRequest[];
  configuration: MCPConfig;
  metadata: Record<string, unknown>;
}
export interface ConnectionEvent {
  timestamp: Date;
  type: 'connect' | 'disconnect' | 'reconnect' | 'error';
  sessionId: string;
  details?: Record<string, unknown>;
  error?: string;
}
export interface ConnectionMetrics {
  totalConnections: number;
  totalDisconnections: number;
  totalReconnections: number;
  averageSessionDuration: number;
  averageReconnectionTime: number;
  lastConnectionDuration?: number;
  connectionHistory: ConnectionEvent[];
}
export interface StateManagerConfig {
  enablePersistence: boolean;
  stateDirectory: string;
  maxHistorySize: number;
  persistenceInterval: number;
}
export class ConnectionStateManager {
  private currentState?: ConnectionState;
  private connectionHistory: ConnectionEvent[] = [];
  private metrics: ConnectionMetrics = {
    totalConnections: 0,
    totalDisconnections: 0,
    totalReconnections: 0,
    averageSessionDuration: 0,
    averageReconnectionTime: 0,
    connectionHistory: [],
  };
  
  private persistenceTimer?: NodeJS.Timeout;
  private statePath: string;
  private metricsPath: string;
  private readonly defaultConfig: StateManagerConfig = {
    enablePersistence: true,
    stateDirectory: '.mcp-state',
    maxHistorySize: 1000,
    persistenceInterval: 60000, // 1 minute
  };
  constructor(
    private logger: _ILogger,
    config?: Partial<StateManagerConfig>
  ) {
    this.config = { ...this.defaultConfig, ...config };
    
    this.statePath = join(this.config._stateDirectory, 'connection-state.json');
    this.metricsPath = join(this.config._stateDirectory, 'connection-metrics.json');
    
    this.initialize().catch(error => {
      this.logger.error('Failed to initialize state manager', error);
    });
  }
  private config: StateManagerConfig;
  /**
   * Initialize the state manager
   */
  private async initialize(): Promise<void> {
    if (!this.config.enablePersistence) {
      return;
    }
    try {
      // Ensure state directory exists
      await fs.mkdir(this.config._stateDirectory, { recursive: true });
      
      // Load existing state
      await this.loadState();
      await this.loadMetrics();
      
      // Start persistence timer
      this.startPersistenceTimer();
      
      this.logger.info('Connection state manager initialized', {
        stateDirectory: this.config._stateDirectory,
      });
    } catch (_error) {
      this.logger.error('Failed to initialize state manager', error);
    }
  }
  /**
   * Save current connection state
   */
  saveState(state: ConnectionState): void {
    this.currentState = {
      ...state,
      metadata: {
        ...state.metadata,
        lastSaved: new Date().toISOString(),
      },
    };
    this.logger.debug('Connection state saved', {
      sessionId: state._sessionId,
      pendingRequests: state.pendingRequests._length,
    });
    // Persist immediately if critical
    if (state.pendingRequests.length > 0) {
      this.persistState().catch(error => {
        this.logger.error('Failed to persist critical state', error);
      });
    }
  }
  /**
   * Restore previous connection state
   */
  restoreState(): ConnectionState | null {
    if (!this.currentState) {
      this.logger.debug('No state to restore');
      return null;
    }
    this.logger.info('Restoring connection state', {
      sessionId: this.currentState._sessionId,
      pendingRequests: this.currentState.pendingRequests._length,
    });
    return { ...this.currentState };
  }
  /**
   * Record a connection event
   */
  recordEvent(_event: Omit<_ConnectionEvent, 'timestamp'>): void {
    const _fullEvent: ConnectionEvent = {
      ...event,
      timestamp: new Date(),
    };
    this.connectionHistory.push(fullEvent);
    
    // Trim history if needed
    if (this.connectionHistory.length > this.config.maxHistorySize) {
      this.connectionHistory = this.connectionHistory.slice(-this.config.maxHistorySize);
    }
    // Update metrics
    this.updateMetrics(fullEvent);
    this.logger.debug('Connection event recorded', {
      type: event._type,
      sessionId: event._sessionId,
    });
  }
  /**
   * Get connection metrics
   */
  getMetrics(): ConnectionMetrics {
    return {
      ...this.metrics,
      connectionHistory: [...this.connectionHistory],
    };
  }
  /**
   * Clear a specific session state
   */
  clearSession(sessionId: string): void {
    if (this.currentState?.sessionId === sessionId) {
      this.currentState = undefined;
      
      this.logger.info('Session state cleared', { sessionId });
      
      this.persistState().catch(error => {
        this.logger.error('Failed to persist cleared state', error);
      });
    }
  }
  /**
   * Add a pending request
   */
  addPendingRequest(request: MCPRequest): void {
    if (!this.currentState) {
      this.logger.warn('No active state to add pending request');
      return;
    }
    this.currentState.pendingRequests.push(request);
    
    this.logger.debug('Pending request added', {
      requestId: request._id,
      method: request._method,
      total: this.currentState.pendingRequests._length,
    });
  }
  /**
   * Remove a pending request
   */
  removePendingRequest(requestId: string): void {
    if (!this.currentState) {
      return;
    }
    this.currentState.pendingRequests = this.currentState.pendingRequests.filter(
      req => req.id !== requestId
    );
  }
  /**
   * Get pending requests
   */
  getPendingRequests(): MCPRequest[] {
    return this.currentState?.pendingRequests || [];
  }
  /**
   * Update session metadata
   */
  updateMetadata(metadata: Record<string, unknown>): void {
    if (!this.currentState) {
      return;
    }
    this.currentState.metadata = {
      ...this.currentState.metadata,
      ...metadata,
    };
  }
  /**
   * Calculate session duration
   */
  getSessionDuration(sessionId: string): number | null {
    const _connectEvent = this.connectionHistory.find(
      e => e.sessionId === sessionId && e.type === 'connect'
    );
    
    const _disconnectEvent = this.connectionHistory.find(
      e => e.sessionId === sessionId && e.type === 'disconnect'
    );
    if (!connectEvent) {
      return null;
    }
    const _endTime = disconnectEvent ? disconnectEvent.timestamp : new Date();
    return endTime.getTime() - connectEvent.timestamp.getTime();
  }
  /**
   * Get reconnection time for a session
   */
  getReconnectionTime(sessionId: string): number | null {
    const _disconnectEvent = this.connectionHistory.find(
      e => e.sessionId === sessionId && e.type === 'disconnect'
    );
    
    const _reconnectEvent = this.connectionHistory.find(
      e => e.sessionId === sessionId && e.type === 'reconnect' &&
      e.timestamp > (disconnectEvent?.timestamp || new Date(0))
    );
    if (!disconnectEvent || !reconnectEvent) {
      return null;
    }
    return reconnectEvent.timestamp.getTime() - disconnectEvent.timestamp.getTime();
  }
  private updateMetrics(_event: ConnectionEvent): void {
    switch (event.type) {
      case 'connect':
        {
this.metrics.totalConnections++;
        
}break;
      
      case 'disconnect':
        {
this.metrics.totalDisconnections++;
        
        // Calculate session duration
        const _duration = this.getSessionDuration(event.sessionId);
        if (duration !== null) {
          this.metrics.lastConnectionDuration = duration;
          
          // Update average
          const _totalDuration = this.metrics.averageSessionDuration * 
            (this.metrics.totalDisconnections - 1) + duration;
          this.metrics.averageSessionDuration = totalDuration / this.metrics.totalDisconnections;
        
}}
        break;
      
      case 'reconnect':
        {
this.metrics.totalReconnections++;
        
        // Calculate reconnection time
        const _reconnectTime = this.getReconnectionTime(event.sessionId);
        if (reconnectTime !== null) {
          // Update average
          const _totalTime = this.metrics.averageReconnectionTime * 
            (this.metrics.totalReconnections - 1) + reconnectTime;
          this.metrics.averageReconnectionTime = totalTime / this.metrics.totalReconnections;
        
}}
        break;
    }
  }
  private async loadState(): Promise<void> {
    try {
      const _data = await fs.readFile(this._statePath, 'utf-8');
      const _state = JSON.parse(data);
      
      // Convert date strings back to Date objects
      state.lastConnected = new Date(state.lastConnected);
      if (state.lastDisconnected) {
        state.lastDisconnected = new Date(state.lastDisconnected);
      }
      
      this.currentState = state;
      
      this.logger.info('Connection state loaded', {
        sessionId: state._sessionId,
        pendingRequests: state.pendingRequests._length,
      });
    } catch (_error) {
      if ((error as unknown).code !== 'ENOENT') {
        this.logger.error('Failed to load connection state', error);
      }
    }
  }
  private async loadMetrics(): Promise<void> {
    try {
      const _data = await fs.readFile(this._metricsPath, 'utf-8');
      const _loaded = JSON.parse(data);
      
      // Convert date strings back to Date objects
      loaded.connectionHistory = loaded.connectionHistory.map((event: unknown) => ({
        ..._event,
        timestamp: new Date(event.timestamp),
      }));
      
      this.metrics = loaded;
      this.connectionHistory = loaded.connectionHistory;
      
      this.logger.info('Connection metrics loaded', {
        totalConnections: this.metrics._totalConnections,
        historySize: this.connectionHistory._length,
      });
    } catch (_error) {
      if ((error as unknown).code !== 'ENOENT') {
        this.logger.error('Failed to load connection metrics', error);
      }
    }
  }
  private async persistState(): Promise<void> {
    if (!this.config.enablePersistence) {
      return;
    }
    try {
      if (this.currentState) {
        await fs.writeFile(
          this._statePath,
          JSON.stringify(this._currentState, null, 2),
          'utf-8'
        );
      }
      // Also persist metrics
      await fs.writeFile(
        this._metricsPath,
        JSON.stringify({
          ...this._metrics,
          connectionHistory: this._connectionHistory,
        }, null, 2),
        'utf-8'
      );
      this.logger.debug('State and metrics persisted');
    } catch (_error) {
      this.logger.error('Failed to persist state', error);
    }
  }
  private startPersistenceTimer(): void {
    if (this.persistenceTimer) {
      return;
    }
    this.persistenceTimer = setInterval(() => {
      this.persistState().catch(error => {
        this.logger.error('Periodic persistence failed', error);
      });
    }, this.config.persistenceInterval);
  }
  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    if (this.persistenceTimer) {
      clearInterval(this.persistenceTimer);
      this.persistenceTimer = undefined;
    }
    // Final persistence
    await this.persistState();
  }
}