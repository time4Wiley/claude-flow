/**
 * Security Module
 * Enterprise-grade security features for Agentic Flow
 */

export * from './types';
export { AuthenticationService } from './auth/auth-service';
export { RBACService } from './auth/rbac-service';
export { TenantService } from './multi-tenancy/tenant-service';
export { AuditService } from './audit/audit-service';
export { EncryptionService } from './encryption/encryption-service';
export { ComplianceService } from './compliance/compliance-service';
export { SecurityMonitor } from './monitoring/security-monitor';

// Re-export configuration interfaces
export type { AuthServiceConfig } from './auth/auth-service';
export type { RBACServiceConfig } from './auth/rbac-service';
export type { TenantServiceConfig } from './multi-tenancy/tenant-service';
export type { AuditServiceConfig } from './audit/audit-service';
export type { EncryptionServiceConfig } from './encryption/encryption-service';
export type { ComplianceServiceConfig } from './compliance/compliance-service';

/**
 * Security Module Configuration
 */
export interface SecurityConfig {
  auth: {
    jwtSecret: string;
    jwtIssuer: string;
    jwtAudience: string[];
    accessTokenExpiry: number;
    refreshTokenExpiry: number;
    sessionTimeout: number;
    bcryptRounds: number;
    mfaRequired: boolean;
    oauth2Providers: Map<string, any>;
    oidcProviders: Map<string, any>;
  };
  rbac: {
    enableDynamicPermissions: boolean;
    enableHierarchicalRoles: boolean;
    maxRolesPerUser: number;
    maxPermissionsPerRole: number;
    cacheEnabled: boolean;
    cacheTTL: number;
  };
  tenant: {
    defaultPlan: any;
    enableAutoSuspension: boolean;
    suspensionGracePeriod: number;
    dataRetentionPeriod: number;
    enableResourceQuotas: boolean;
    isolationLevel: 'strict' | 'shared' | 'hybrid';
  };
  audit: {
    retentionPeriod: number;
    enableEncryption: boolean;
    enableCompression: boolean;
    batchSize: number;
    flushInterval: number;
    storageBackend: 'database' | 'file' | 's3' | 'elasticsearch';
    indexFields: string[];
    sensitiveFields: string[];
    complianceMode: boolean;
  };
  encryption: {
    algorithm: 'AES-256-GCM' | 'AES-256-CBC' | 'ChaCha20-Poly1305';
    keyDerivation: 'PBKDF2' | 'scrypt' | 'argon2';
    keyRotationInterval: number;
    enableHSM: boolean;
    hsmConfig?: any;
    enableFieldLevelEncryption: boolean;
    dataClassification: any;
    keyEscrow?: any;
  };
  compliance: {
    frameworks: any[];
    automatedAssessment: boolean;
    assessmentSchedule: any[];
    evidenceRetention: number;
    notificationChannels: any;
  };
  monitoring: {
    enableRealTimeAlerts: boolean;
    anomalyDetection: boolean;
    threatIntelligence: boolean;
    alertChannels: any;
    metrics: {
      authFailures: { threshold: number; window: number };
      apiRateLimit: { threshold: number; window: number };
      suspiciousActivity: { threshold: number; window: number };
    };
  };
}

/**
 * Default security configuration
 */
export const defaultSecurityConfig: SecurityConfig = {
  auth: {
    jwtSecret: process.env.JWT_SECRET || 'change-this-secret',
    jwtIssuer: 'agentic-flow',
    jwtAudience: ['agentic-flow-api'],
    accessTokenExpiry: 3600, // 1 hour
    refreshTokenExpiry: 2592000, // 30 days
    sessionTimeout: 3600, // 1 hour
    bcryptRounds: 12,
    mfaRequired: false,
    oauth2Providers: new Map(),
    oidcProviders: new Map()
  },
  rbac: {
    enableDynamicPermissions: true,
    enableHierarchicalRoles: true,
    maxRolesPerUser: 10,
    maxPermissionsPerRole: 100,
    cacheEnabled: true,
    cacheTTL: 300 // 5 minutes
  },
  tenant: {
    defaultPlan: {
      id: 'basic',
      name: 'Basic Plan',
      features: ['core'],
      limits: {
        maxUsers: 10,
        maxAgents: 5,
        maxWorkflows: 20,
        maxApiCalls: 10000,
        maxStorage: 1073741824, // 1GB
        maxComputeTime: 3600, // 1 hour
        rateLimits: {
          requestsPerMinute: 60,
          requestsPerHour: 1000,
          requestsPerDay: 10000
        }
      }
    },
    enableAutoSuspension: true,
    suspensionGracePeriod: 7,
    dataRetentionPeriod: 30,
    enableResourceQuotas: true,
    isolationLevel: 'hybrid'
  },
  audit: {
    retentionPeriod: 365, // 1 year
    enableEncryption: true,
    enableCompression: true,
    batchSize: 100,
    flushInterval: 5000, // 5 seconds
    storageBackend: 'database',
    indexFields: ['action.type', 'resource', 'userId', 'tenantId'],
    sensitiveFields: ['password', 'token', 'apiKey', 'secret'],
    complianceMode: true
  },
  encryption: {
    algorithm: 'AES-256-GCM',
    keyDerivation: 'scrypt',
    keyRotationInterval: 90, // days
    enableHSM: false,
    enableFieldLevelEncryption: true,
    dataClassification: {
      levels: [
        {
          id: 'public',
          name: 'Public',
          description: 'Public data',
          encryptionRequired: false,
          retentionDays: 365,
          accessRestrictions: []
        },
        {
          id: 'internal',
          name: 'Internal',
          description: 'Internal use only',
          encryptionRequired: false,
          retentionDays: 730,
          accessRestrictions: ['authenticated']
        },
        {
          id: 'confidential',
          name: 'Confidential',
          description: 'Confidential data',
          encryptionRequired: true,
          retentionDays: 1095,
          accessRestrictions: ['authenticated', 'authorized']
        },
        {
          id: 'sensitive',
          name: 'Sensitive',
          description: 'Sensitive PII data',
          encryptionRequired: true,
          retentionDays: 2555,
          accessRestrictions: ['authenticated', 'authorized', 'need-to-know']
        }
      ],
      defaultLevel: 'internal',
      rules: []
    }
  },
  compliance: {
    frameworks: [],
    automatedAssessment: true,
    assessmentSchedule: [],
    evidenceRetention: 2555, // 7 years
    notificationChannels: {}
  },
  monitoring: {
    enableRealTimeAlerts: true,
    anomalyDetection: true,
    threatIntelligence: false,
    alertChannels: {},
    metrics: {
      authFailures: { threshold: 5, window: 300 }, // 5 failures in 5 minutes
      apiRateLimit: { threshold: 1000, window: 3600 }, // 1000 requests per hour
      suspiciousActivity: { threshold: 10, window: 600 } // 10 events in 10 minutes
    }
  }
};