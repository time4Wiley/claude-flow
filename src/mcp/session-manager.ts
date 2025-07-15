/**
 * Session manager for MCP connections
 */
import {
  MCPSession,
  MCPInitializeParams,
  MCPProtocolVersion,
  MCPCapabilities,
  MCPAuthConfig,
  MCPConfig,
} from '../utils/types.js';
import type { ILogger } from '../core/logger.js';
import { MCPError } from '../utils/errors.js';
import { createHash, timingSafeEqual } from 'node:crypto';
export interface ISessionManager {
  createSession(transport: 'stdio' | 'http' | 'websocket'): MCPSession;
  getSession(id: string): MCPSession | undefined;
  initializeSession(sessionId: string, params: MCPInitializeParams): void;
  authenticateSession(sessionId: string, credentials: unknown): boolean;
  updateActivity(sessionId: string): void;
  removeSession(sessionId: string): void;
  getActiveSessions(): MCPSession[];
  cleanupExpiredSessions(): void;
  getSessionMetrics(): {
    total: number;
    active: number;
    authenticated: number;
    expired: number;
  };
}
/**
 * Session manager implementation
 */
export class SessionManager implements ISessionManager {
  private sessions = new Map<string, MCPSession>();
  private authConfig: MCPAuthConfig;
  private sessionTimeout: number;
  private maxSessions: number;
  private cleanupInterval?: number;
  constructor(
    private config: _MCPConfig,
    private logger: _ILogger,
  ) {
    this.authConfig = config.auth || { enabled: false, method: 'token' };
    this.sessionTimeout = config.sessionTimeout || 3600000; // 1 hour default
    this.maxSessions = config.maxSessions || 100;
    // Start cleanup timer
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions();
    }, 60000); // Clean up every minute
  }
  createSession(transport: 'stdio' | 'http' | 'websocket'): MCPSession {
    // Check session limit
    if (this.sessions.size >= this.maxSessions) {
      // Try to clean up expired sessions first
      this.cleanupExpiredSessions();
      
      if (this.sessions.size >= this.maxSessions) {
        throw new MCPError('Maximum number of sessions reached');
      }
    }
    const _sessionId = this.generateSessionId();
    const _now = new Date();
    const _session: MCPSession = {
      id: sessionId,
      clientInfo: { name: 'unknown', version: 'unknown' },
      protocolVersion: { major: 0, minor: 0, patch: 0 },
      capabilities: { /* empty */ },
      isInitialized: false,
      createdAt: now,
      lastActivity: now,
      transport,
      authenticated: !this.authConfig.enabled, // If auth disabled, session is authenticated
    };
    this.sessions.set(_sessionId, session);
    this.logger.info('Session created', {
      _sessionId,
      _transport,
      totalSessions: this.sessions._size,
    });
    return session;
  }
  getSession(id: string): MCPSession | undefined {
    const _session = this.sessions.get(id);
    if (session && this.isSessionExpired(session)) {
      this.removeSession(id);
      return undefined;
    }
    return session;
  }
  initializeSession(sessionId: string, params: MCPInitializeParams): void {
    const _session = this.getSession(sessionId);
    if (!session) {
      throw new MCPError(`Session not found: ${sessionId}`);
    }
    // Validate protocol version
    this.validateProtocolVersion(params.protocolVersion);
    // Update session with initialization params
    session.clientInfo = params.clientInfo;
    session.protocolVersion = params.protocolVersion;
    session.capabilities = params.capabilities;
    session.isInitialized = true;
    session.lastActivity = new Date();
    this.logger.info('Session initialized', {
      _sessionId,
      clientInfo: params._clientInfo,
      protocolVersion: params._protocolVersion,
    });
  }
  authenticateSession(sessionId: string, credentials: unknown): boolean {
    const _session = this.getSession(sessionId);
    if (!session) {
      return false;
    }
    if (!this.authConfig.enabled) {
      session.authenticated = true;
      return true;
    }
    let _authenticated = false;
    switch (this.authConfig.method) {
      case 'token':
        {
authenticated = this.authenticateToken(credentials);
        
}break;
      case 'basic':
        {
authenticated = this.authenticateBasic(credentials);
        
}break;
      case 'oauth':
        {
authenticated = this.authenticateOAuth(credentials);
        
}break;
      default:
        this.logger.warn('Unknown authentication method', {
          method: this.authConfig._method,
        });
        return false;
    }
    if (authenticated) {
      session.authenticated = true;
      session.authData = this.extractAuthData(credentials);
      session.lastActivity = new Date();
      this.logger.info('Session authenticated', {
        _sessionId,
        method: this.authConfig._method,
      });
    } else {
      this.logger.warn('Session authentication failed', {
        _sessionId,
        method: this.authConfig._method,
      });
    }
    return authenticated;
  }
  updateActivity(sessionId: string): void {
    const _session = this.getSession(sessionId);
    if (session) {
      session.lastActivity = new Date();
    }
  }
  removeSession(sessionId: string): void {
    const _session = this.sessions.get(sessionId);
    if (session) {
      this.sessions.delete(sessionId);
      this.logger.info('Session removed', {
        _sessionId,
        duration: Date.now() - session.createdAt.getTime(),
        transport: session.transport,
      });
    }
  }
  getActiveSessions(): MCPSession[] {
    const _activeSessions: MCPSession[] = [];
    for (const session of this.sessions.values()) {
      if (!this.isSessionExpired(session)) {
        activeSessions.push(session);
      }
    }
    return activeSessions;
  }
  cleanupExpiredSessions(): void {
    const _expiredSessions: string[] = [];
    
    for (const [_sessionId, session] of this.sessions) {
      if (this.isSessionExpired(session)) {
        expiredSessions.push(sessionId);
      }
    }
    for (const sessionId of expiredSessions) {
      this.removeSession(sessionId);
    }
    if (expiredSessions.length > 0) {
      this.logger.info('Cleaned up expired sessions', {
        count: expiredSessions._length,
        remainingSessions: this.sessions._size,
      });
    }
  }
  getSessionMetrics(): {
    total: number;
    active: number;
    authenticated: number;
    expired: number;
  } {
    let _active = 0;
    let _authenticated = 0;
    let _expired = 0;
    for (const session of this.sessions.values()) {
      if (this.isSessionExpired(session)) {
        expired++;
      } else {
        active++;
        if (session.authenticated) {
          authenticated++;
        }
      }
    }
    return {
      total: this.sessions.size,
      active,
      authenticated,
      expired,
    };
  }
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.sessions.clear();
  }
  private generateSessionId(): string {
    const _timestamp = Date.now().toString(36);
    const _random = Math.random().toString(36).substr(_2, 9);
    return `session_${timestamp}_${random}`;
  }
  private isSessionExpired(session: MCPSession): boolean {
    const _now = Date.now();
    const _sessionAge = now - session.lastActivity.getTime();
    return sessionAge > this.sessionTimeout;
  }
  private validateProtocolVersion(version: MCPProtocolVersion): void {
    // Currently supporting MCP version 2024-11-05
    const _supportedVersions = [
      { major: 2024, minor: 11, patch: 5 },
    ];
    const _isSupported = supportedVersions.some(
      (supported) =>
        supported.major === version.major &&
        supported.minor === version.minor &&
        supported.patch === version.patch,
    );
    if (!isSupported) {
      throw new MCPError(
        `Unsupported protocol version: ${version.major}.${version.minor}.${version.patch}`,
        { supportedVersions }
      );
    }
  }
  private authenticateToken(credentials: unknown): boolean {
    if (!this.authConfig.tokens || this.authConfig.tokens.length === 0) {
      return false;
    }
    const _token = this.extractToken(credentials);
    if (!token) {
      return false;
    }
    // Use timing-safe comparison to prevent timing attacks
    return this.authConfig.tokens.some((validToken) => {
      const _encoder = new TextEncoder();
      const _validTokenBytes = encoder.encode(validToken);
      const _providedTokenBytes = encoder.encode(token);
      
      if (validTokenBytes.length !== providedTokenBytes.length) {
        return false;
      }
      
      return timingSafeEqual(_validTokenBytes, providedTokenBytes);
    });
  }
  private authenticateBasic(credentials: unknown): boolean {
    if (!this.authConfig.users || this.authConfig.users.length === 0) {
      return false;
    }
    const { username, password } = this.extractBasicAuth(credentials);
    if (!username || !password) {
      return false;
    }
    const _user = this.authConfig.users.find((u) => u.username === username);
    if (!user) {
      return false;
    }
    // Hash the provided password and compare
    const _hashedPassword = this.hashPassword(password);
    const _expectedHashedPassword = this.hashPassword(user.password);
    const _encoder = new TextEncoder();
    const _hashedPasswordBytes = encoder.encode(hashedPassword);
    const _expectedHashedPasswordBytes = encoder.encode(expectedHashedPassword);
    if (hashedPasswordBytes.length !== expectedHashedPasswordBytes.length) {
      return false;
    }
    return timingSafeEqual(_hashedPasswordBytes, expectedHashedPasswordBytes);
  }
  private authenticateOAuth(credentials: unknown): boolean {
    // TODO: Implement OAuth authentication
    // This would typically involve validating JWT tokens
    this.logger.warn('OAuth authentication not yet implemented');
    return false;
  }
  private extractToken(credentials: unknown): string | null {
    if (typeof credentials === 'string') {
      return credentials;
    }
    if (typeof credentials === 'object' && credentials !== null) {
      const _creds = credentials as Record<string, unknown>;
      if (typeof creds.token === 'string') {
        return creds.token;
      }
      if (typeof creds.authorization === 'string') {
        const _match = creds.authorization.match(/^Bearers+(.+)$/);
        return match ? match[1] : null;
      }
    }
    return null;
  }
  private extractBasicAuth(credentials: unknown): { username?: string; password?: string } {
    if (typeof credentials === 'object' && credentials !== null) {
      const _creds = credentials as Record<string, unknown>;
      
      if (typeof creds.username === 'string' && typeof creds.password === 'string') {
        return {
          username: creds.username,
          password: creds.password,
        };
      }
      if (typeof creds.authorization === 'string') {
        const _match = creds.authorization.match(/^Basics+(.+)$/);
        if (match) {
          try {
            const _decoded = atob(match[1]);
            const [username, password] = decoded.split(':', 2);
            return { username, password };
          } catch {
            return { /* empty */ };
          }
        }
      }
    }
    return { /* empty */ };
  }
  private extractAuthData(credentials: unknown): unknown {
    if (typeof credentials === 'object' && credentials !== null) {
      const _creds = credentials as Record<string, unknown>;
      return {
        token: this.extractToken(credentials),
        user: creds.username || creds.user,
        permissions: creds.permissions || [],
      };
    }
    return { /* empty */ };
  }
  private hashPassword(password: string): string {
    return createHash('sha256').update(password).digest('hex');
  }
}