/**
 * Authentication Service
 * Handles OAuth2/OIDC authentication, JWT management, and session handling
 */

import { EventEmitter } from 'events';
import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../../utils/logger';
import {
  User,
  AuthToken,
  JWTPayload,
  OAuth2Config,
  OIDCProvider,
  Session,
  ApiKey,
  UserSchema,
  SecurityEvent,
  AuditLog
} from '../types';
import { AuditService } from '../audit/audit-service';
import { EncryptionService } from '../encryption/encryption-service';

export interface AuthServiceConfig {
  jwtSecret: string;
  jwtIssuer: string;
  jwtAudience: string[];
  accessTokenExpiry: number; // seconds
  refreshTokenExpiry: number; // seconds
  sessionTimeout: number; // seconds
  bcryptRounds: number;
  mfaRequired: boolean;
  oauth2Providers: Map<string, OAuth2Config>;
  oidcProviders: Map<string, OIDCProvider>;
}

export class AuthenticationService extends EventEmitter {
  private logger: Logger;
  private config: AuthServiceConfig;
  private auditService: AuditService;
  private encryptionService: EncryptionService;
  private sessions: Map<string, Session> = new Map();
  private revokedTokens: Set<string> = new Set();
  private apiKeys: Map<string, ApiKey> = new Map();

  constructor(
    config: AuthServiceConfig,
    auditService: AuditService,
    encryptionService: EncryptionService
  ) {
    super();
    this.config = config;
    this.logger = new Logger('AuthenticationService');
    this.auditService = auditService;
    this.encryptionService = encryptionService;
    this.initializeProviders();
  }

  private initializeProviders(): void {
    // Initialize OAuth2/OIDC providers
    this.logger.info('Initializing authentication providers', {
      oauth2Count: this.config.oauth2Providers.size,
      oidcCount: this.config.oidcProviders.size
    });
  }

  /**
   * Authenticate user with email and password
   */
  async authenticateWithPassword(
    email: string,
    password: string,
    tenantId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<AuthToken> {
    try {
      // Validate input
      const user = await this.getUserByEmail(email, tenantId);
      if (!user || !user.isActive) {
        await this.logFailedAuth(email, tenantId, 'user_not_found', ipAddress);
        throw new Error('Invalid credentials');
      }

      // Verify password
      const passwordValid = await this.verifyPassword(password, user.passwordHash);
      if (!passwordValid) {
        await this.logFailedAuth(email, tenantId, 'invalid_password', ipAddress);
        throw new Error('Invalid credentials');
      }

      // Check MFA if required
      if (this.config.mfaRequired || user.mfaEnabled) {
        // Return partial token that requires MFA verification
        return this.generateMFAToken(user);
      }

      // Generate tokens
      const token = await this.generateAuthToken(user);
      
      // Create session
      await this.createSession(user, token, ipAddress, userAgent);

      // Log successful authentication
      await this.auditService.log({
        tenantId,
        userId: user.id,
        action: {
          category: 'auth',
          type: 'login',
          severity: 'low',
          description: 'User authenticated successfully'
        },
        resource: 'authentication',
        result: 'success',
        metadata: { method: 'password' },
        ipAddress,
        userAgent
      } as AuditLog);

      return token;
    } catch (error) {
      this.logger.error('Authentication failed', error);
      throw error;
    }
  }

  /**
   * Authenticate with OAuth2 provider
   */
  async authenticateWithOAuth2(
    provider: string,
    code: string,
    tenantId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<AuthToken> {
    try {
      const oauth2Config = this.config.oauth2Providers.get(provider);
      if (!oauth2Config) {
        throw new Error(`OAuth2 provider ${provider} not configured`);
      }

      // Exchange code for tokens
      const providerTokens = await this.exchangeOAuth2Code(oauth2Config, code);
      
      // Get user info from provider
      const userInfo = await this.fetchOAuth2UserInfo(oauth2Config, providerTokens.accessToken);
      
      // Find or create user
      let user = await this.getUserByEmail(userInfo.email, tenantId);
      if (!user) {
        user = await this.createUserFromOAuth(userInfo, tenantId, provider);
      }

      // Generate our tokens
      const token = await this.generateAuthToken(user);
      
      // Create session
      await this.createSession(user, token, ipAddress, userAgent);

      // Audit log
      await this.auditService.log({
        tenantId,
        userId: user.id,
        action: {
          category: 'auth',
          type: 'oauth_login',
          severity: 'low',
          description: `User authenticated via ${provider}`
        },
        resource: 'authentication',
        result: 'success',
        metadata: { provider },
        ipAddress,
        userAgent
      } as AuditLog);

      return token;
    } catch (error) {
      this.logger.error('OAuth2 authentication failed', error);
      throw error;
    }
  }

  /**
   * Generate JWT access token
   */
  private async generateAccessToken(user: User): Promise<string> {
    const payload: JWTPayload = {
      sub: user.id,
      email: user.email,
      tenantId: user.tenantId,
      roles: user.roles.map(r => r.name),
      permissions: user.permissions.map(p => `${p.resource}:${p.action}`),
      exp: Math.floor(Date.now() / 1000) + this.config.accessTokenExpiry,
      iat: Math.floor(Date.now() / 1000),
      iss: this.config.jwtIssuer,
      aud: this.config.jwtAudience,
      jti: uuidv4()
    };

    return jwt.sign(payload, this.config.jwtSecret, {
      algorithm: 'HS256'
    });
  }

  /**
   * Generate refresh token
   */
  private async generateRefreshToken(user: User): Promise<string> {
    const payload = {
      sub: user.id,
      type: 'refresh',
      exp: Math.floor(Date.now() / 1000) + this.config.refreshTokenExpiry,
      iat: Math.floor(Date.now() / 1000),
      jti: uuidv4()
    };

    return jwt.sign(payload, this.config.jwtSecret, {
      algorithm: 'HS256'
    });
  }

  /**
   * Generate complete auth token response
   */
  private async generateAuthToken(user: User): Promise<AuthToken> {
    const accessToken = await this.generateAccessToken(user);
    const refreshToken = await this.generateRefreshToken(user);

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: this.config.accessTokenExpiry,
      scope: user.permissions.map(p => `${p.resource}:${p.action}`),
      issuedAt: Date.now()
    };
  }

  /**
   * Verify JWT token
   */
  async verifyToken(token: string): Promise<JWTPayload> {
    try {
      // Check if token is revoked
      const decoded = jwt.decode(token) as any;
      if (decoded?.jti && this.revokedTokens.has(decoded.jti)) {
        throw new Error('Token has been revoked');
      }

      // Verify token
      const payload = jwt.verify(token, this.config.jwtSecret, {
        issuer: this.config.jwtIssuer,
        audience: this.config.jwtAudience
      }) as JWTPayload;

      return payload;
    } catch (error) {
      this.logger.error('Token verification failed', error);
      throw new Error('Invalid token');
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<AuthToken> {
    try {
      const payload = jwt.verify(refreshToken, this.config.jwtSecret) as any;
      
      if (payload.type !== 'refresh') {
        throw new Error('Invalid refresh token');
      }

      // Get user
      const user = await this.getUserById(payload.sub);
      if (!user || !user.isActive) {
        throw new Error('User not found or inactive');
      }

      // Generate new tokens
      return this.generateAuthToken(user);
    } catch (error) {
      this.logger.error('Token refresh failed', error);
      throw error;
    }
  }

  /**
   * Revoke token
   */
  async revokeToken(token: string, userId: string, reason: string): Promise<void> {
    try {
      const decoded = jwt.decode(token) as any;
      if (decoded?.jti) {
        this.revokedTokens.add(decoded.jti);
        
        // Audit log
        await this.auditService.log({
          userId,
          action: {
            category: 'auth',
            type: 'token_revoked',
            severity: 'medium',
            description: `Token revoked: ${reason}`
          },
          resource: 'token',
          resourceId: decoded.jti,
          result: 'success',
          metadata: { reason }
        } as AuditLog);
      }
    } catch (error) {
      this.logger.error('Token revocation failed', error);
      throw error;
    }
  }

  /**
   * Create user session
   */
  private async createSession(
    user: User,
    token: AuthToken,
    ipAddress?: string,
    userAgent?: string
  ): Promise<Session> {
    const session: Session = {
      id: uuidv4(),
      userId: user.id,
      tenantId: user.tenantId,
      token: token.accessToken,
      ipAddress: ipAddress || 'unknown',
      userAgent: userAgent || 'unknown',
      createdAt: new Date(),
      lastActivity: new Date(),
      expiresAt: new Date(Date.now() + this.config.sessionTimeout * 1000),
      isActive: true
    };

    this.sessions.set(session.id, session);
    
    // Emit session created event
    this.emit('session:created', { session, user });

    return session;
  }

  /**
   * Validate session
   */
  async validateSession(sessionId: string): Promise<Session | null> {
    const session = this.sessions.get(sessionId);
    
    if (!session || !session.isActive) {
      return null;
    }

    if (session.expiresAt < new Date()) {
      session.isActive = false;
      this.emit('session:expired', { sessionId });
      return null;
    }

    // Update last activity
    session.lastActivity = new Date();
    
    return session;
  }

  /**
   * Terminate session
   */
  async terminateSession(sessionId: string, reason: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.isActive = false;
      
      // Revoke associated token
      if (session.token) {
        await this.revokeToken(session.token, session.userId, reason);
      }

      // Audit log
      await this.auditService.log({
        userId: session.userId,
        tenantId: session.tenantId,
        action: {
          category: 'auth',
          type: 'session_terminated',
          severity: 'low',
          description: `Session terminated: ${reason}`
        },
        resource: 'session',
        resourceId: sessionId,
        result: 'success',
        metadata: { reason }
      } as AuditLog);

      this.emit('session:terminated', { sessionId, reason });
    }
  }

  /**
   * Generate API key
   */
  async generateApiKey(
    name: string,
    userId: string,
    tenantId: string,
    permissions: string[],
    expiresAt?: Date
  ): Promise<ApiKey> {
    const keyValue = this.generateSecureKey();
    const hashedKey = await this.hashApiKey(keyValue);
    const prefix = keyValue.substring(0, 8);

    const apiKey: ApiKey = {
      id: uuidv4(),
      key: hashedKey,
      prefix,
      name,
      tenantId,
      userId,
      permissions: this.parsePermissions(permissions),
      expiresAt,
      createdAt: new Date(),
      status: 'active'
    };

    this.apiKeys.set(apiKey.id, apiKey);

    // Audit log
    await this.auditService.log({
      userId,
      tenantId,
      action: {
        category: 'auth',
        type: 'api_key_created',
        severity: 'medium',
        description: `API key created: ${name}`
      },
      resource: 'api_key',
      resourceId: apiKey.id,
      result: 'success',
      metadata: { name, permissions }
    } as AuditLog);

    // Return the actual key value only on creation
    return { ...apiKey, key: keyValue };
  }

  /**
   * Validate API key
   */
  async validateApiKey(keyValue: string): Promise<ApiKey | null> {
    const hashedKey = await this.hashApiKey(keyValue);
    
    for (const apiKey of this.apiKeys.values()) {
      if (apiKey.key === hashedKey && apiKey.status === 'active') {
        if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
          apiKey.status = 'expired';
          return null;
        }
        
        apiKey.lastUsedAt = new Date();
        return apiKey;
      }
    }
    
    return null;
  }

  /**
   * Revoke API key
   */
  async revokeApiKey(keyId: string, userId: string, reason: string): Promise<void> {
    const apiKey = this.apiKeys.get(keyId);
    if (apiKey) {
      apiKey.status = 'revoked';
      apiKey.revokedAt = new Date();
      
      // Audit log
      await this.auditService.log({
        userId,
        tenantId: apiKey.tenantId,
        action: {
          category: 'auth',
          type: 'api_key_revoked',
          severity: 'medium',
          description: `API key revoked: ${reason}`
        },
        resource: 'api_key',
        resourceId: keyId,
        result: 'success',
        metadata: { reason }
      } as AuditLog);
    }
  }

  /**
   * Helper methods
   */
  private async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  private async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.config.bcryptRounds);
  }

  private generateSecureKey(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let key = '';
    for (let i = 0; i < 32; i++) {
      key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return key;
  }

  private async hashApiKey(key: string): Promise<string> {
    return bcrypt.hash(key, this.config.bcryptRounds);
  }

  private parsePermissions(permissions: string[]): any[] {
    return permissions.map(p => {
      const [resource, action] = p.split(':');
      return { resource, action, effect: 'allow' };
    });
  }

  private async logFailedAuth(
    email: string,
    tenantId: string,
    reason: string,
    ipAddress?: string
  ): Promise<void> {
    await this.auditService.log({
      tenantId,
      action: {
        category: 'auth',
        type: 'login_failed',
        severity: 'medium',
        description: `Failed login attempt: ${reason}`
      },
      resource: 'authentication',
      result: 'failure',
      metadata: { email, reason },
      ipAddress
    } as AuditLog);

    // Emit security event
    const event: SecurityEvent = {
      id: uuidv4(),
      timestamp: new Date(),
      type: 'authentication_failure',
      severity: 'warning',
      source: 'AuthenticationService',
      tenantId,
      details: { email, reason },
      indicators: []
    };

    this.emit('security:event', event);
  }

  // Placeholder methods for full implementation
  private async getUserByEmail(email: string, tenantId: string): Promise<any> {
    // TODO: Implement database lookup
    return null;
  }

  private async getUserById(id: string): Promise<any> {
    // TODO: Implement database lookup
    return null;
  }

  private async createUserFromOAuth(userInfo: any, tenantId: string, provider: string): Promise<any> {
    // TODO: Implement user creation
    return null;
  }

  private async exchangeOAuth2Code(config: OAuth2Config, code: string): Promise<any> {
    // TODO: Implement OAuth2 code exchange
    return null;
  }

  private async fetchOAuth2UserInfo(config: OAuth2Config, accessToken: string): Promise<any> {
    // TODO: Implement user info fetch
    return null;
  }

  private generateMFAToken(user: User): AuthToken {
    // TODO: Implement MFA token generation
    return {} as AuthToken;
  }
}