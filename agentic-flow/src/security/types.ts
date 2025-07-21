/**
 * Security Module Types and Interfaces
 * Enterprise-grade security framework for Agentic Flow
 */

import { z } from 'zod';

// Authentication Types
export interface User {
  id: string;
  email: string;
  tenantId: string;
  roles: Role[];
  permissions: Permission[];
  metadata: UserMetadata;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
  mfaEnabled: boolean;
  isActive: boolean;
}

export interface UserMetadata {
  firstName?: string;
  lastName?: string;
  department?: string;
  jobTitle?: string;
  phoneNumber?: string;
  preferences: Record<string, any>;
}

export interface AuthToken {
  accessToken: string;
  refreshToken?: string;
  tokenType: 'Bearer';
  expiresIn: number;
  scope: string[];
  issuedAt: number;
}

export interface JWTPayload {
  sub: string; // user ID
  email: string;
  tenantId: string;
  roles: string[];
  permissions: string[];
  exp: number;
  iat: number;
  iss: string;
  aud: string[];
  jti: string; // JWT ID for revocation
}

// OAuth2/OIDC Types
export interface OAuth2Config {
  clientId: string;
  clientSecret: string;
  authorizationUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  redirectUri: string;
  scope: string[];
  responseType: 'code' | 'token';
  grantType: 'authorization_code' | 'refresh_token' | 'client_credentials';
}

export interface OIDCProvider {
  issuer: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  userInfoEndpoint: string;
  jwksUri: string;
  registrationEndpoint?: string;
  scopesSupported: string[];
  responseTypesSupported: string[];
  grantTypesSupported: string[];
  subjectTypesSupported: string[];
  idTokenSigningAlgValuesSupported: string[];
}

// RBAC Types
export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
  tenantId?: string;
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Permission {
  id: string;
  resource: string;
  action: string;
  effect: 'allow' | 'deny';
  conditions?: PolicyCondition[];
  description?: string;
}

export interface PolicyCondition {
  type: 'ip' | 'time' | 'location' | 'attribute' | 'custom';
  operator: 'equals' | 'not_equals' | 'contains' | 'matches' | 'greater_than' | 'less_than';
  value: any;
}

// Multi-Tenancy Types
export interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: TenantPlan;
  status: TenantStatus;
  settings: TenantSettings;
  metadata: TenantMetadata;
  createdAt: Date;
  updatedAt: Date;
  suspendedAt?: Date;
  deletedAt?: Date;
}

export interface TenantPlan {
  id: string;
  name: string;
  features: string[];
  limits: ResourceLimits;
  pricing: {
    monthly: number;
    yearly: number;
    currency: string;
  };
}

export interface ResourceLimits {
  maxUsers: number;
  maxAgents: number;
  maxWorkflows: number;
  maxApiCalls: number;
  maxStorage: number; // in bytes
  maxComputeTime: number; // in seconds
  rateLimits: {
    requestsPerMinute: number;
    requestsPerHour: number;
    requestsPerDay: number;
  };
}

export interface TenantSettings {
  security: SecuritySettings;
  features: FeatureFlags;
  branding: BrandingSettings;
  integrations: IntegrationSettings;
}

export interface SecuritySettings {
  mfaRequired: boolean;
  passwordPolicy: PasswordPolicy;
  sessionTimeout: number;
  ipWhitelist: string[];
  allowedDomains: string[];
  ssoEnabled: boolean;
  ssoProviders: string[];
}

export interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  expirationDays?: number;
  preventReuse: number;
}

export interface TenantMetadata {
  industry?: string;
  companySize?: string;
  country?: string;
  timezone?: string;
  contactEmail?: string;
  billingEmail?: string;
  technicalContact?: string;
}

export type TenantStatus = 'active' | 'suspended' | 'pending' | 'deleted';

export interface FeatureFlags {
  [key: string]: boolean | string | number;
}

export interface BrandingSettings {
  logoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  customCss?: string;
  emailTemplates?: Record<string, string>;
}

export interface IntegrationSettings {
  slack?: SlackIntegration;
  github?: GithubIntegration;
  jira?: JiraIntegration;
  [key: string]: any;
}

export interface SlackIntegration {
  enabled: boolean;
  webhookUrl?: string;
  channelId?: string;
  botToken?: string;
}

export interface GithubIntegration {
  enabled: boolean;
  organizationName?: string;
  accessToken?: string;
  webhookSecret?: string;
}

export interface JiraIntegration {
  enabled: boolean;
  serverUrl?: string;
  projectKey?: string;
  apiToken?: string;
}

// Audit Logging Types
export interface AuditLog {
  id: string;
  timestamp: Date;
  tenantId: string;
  userId?: string;
  action: AuditAction;
  resource: string;
  resourceId?: string;
  result: 'success' | 'failure';
  metadata: AuditMetadata;
  ipAddress?: string;
  userAgent?: string;
  duration?: number;
  errorMessage?: string;
}

export interface AuditAction {
  category: 'auth' | 'data' | 'admin' | 'system' | 'workflow' | 'agent';
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
}

export interface AuditMetadata {
  changes?: Record<string, { old: any; new: any }>;
  request?: {
    method: string;
    path: string;
    query?: Record<string, any>;
    body?: Record<string, any>;
  };
  response?: {
    status: number;
    headers?: Record<string, string>;
  };
  [key: string]: any;
}

// Encryption Types
export interface EncryptionConfig {
  algorithm: 'AES-256-GCM' | 'AES-256-CBC' | 'ChaCha20-Poly1305';
  keyDerivation: 'PBKDF2' | 'scrypt' | 'argon2';
  keyRotationInterval: number; // days
  dataClassification: DataClassification;
}

export interface DataClassification {
  levels: ClassificationLevel[];
  defaultLevel: string;
  rules: ClassificationRule[];
}

export interface ClassificationLevel {
  id: string;
  name: string;
  description: string;
  encryptionRequired: boolean;
  retentionDays: number;
  accessRestrictions: string[];
}

export interface ClassificationRule {
  pattern: RegExp;
  level: string;
  fields: string[];
}

export interface EncryptedData {
  ciphertext: string;
  iv: string;
  tag: string;
  keyId: string;
  algorithm: string;
  timestamp: number;
}

export interface KeyManagement {
  masterKeyId: string;
  dataEncryptionKeys: DataEncryptionKey[];
  keyRotationSchedule: KeyRotationSchedule;
  keyEscrow?: KeyEscrow;
}

export interface DataEncryptionKey {
  id: string;
  encryptedKey: string;
  algorithm: string;
  createdAt: Date;
  rotatedAt?: Date;
  expiresAt?: Date;
  status: 'active' | 'rotating' | 'expired' | 'revoked';
}

export interface KeyRotationSchedule {
  interval: number;
  nextRotation: Date;
  automaticRotation: boolean;
  notificationChannels: string[];
}

export interface KeyEscrow {
  enabled: boolean;
  providers: string[];
  threshold: number; // for split key scenarios
}

// Compliance Types
export interface ComplianceFramework {
  id: string;
  name: 'SOC2' | 'GDPR' | 'HIPAA' | 'PCI-DSS' | 'ISO27001';
  version: string;
  requirements: ComplianceRequirement[];
  controls: ComplianceControl[];
  assessments: ComplianceAssessment[];
}

export interface ComplianceRequirement {
  id: string;
  category: string;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  controls: string[]; // control IDs
  evidenceRequired: string[];
}

export interface ComplianceControl {
  id: string;
  name: string;
  description: string;
  type: 'technical' | 'administrative' | 'physical';
  implementation: ControlImplementation;
  testProcedures: string[];
  frequency: 'continuous' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annually';
}

export interface ControlImplementation {
  status: 'implemented' | 'partial' | 'planned' | 'not_applicable';
  automationLevel: 'full' | 'partial' | 'manual';
  responsibleParty: string;
  lastTested?: Date;
  nextTest?: Date;
  evidence: Evidence[];
}

export interface Evidence {
  id: string;
  type: 'screenshot' | 'log' | 'report' | 'configuration' | 'attestation';
  description: string;
  location: string;
  collectedAt: Date;
  validUntil?: Date;
  approvedBy?: string;
}

export interface ComplianceAssessment {
  id: string;
  frameworkId: string;
  assessmentDate: Date;
  scope: string[];
  findings: AssessmentFinding[];
  overallScore: number;
  status: 'passed' | 'failed' | 'conditional';
  nextAssessment: Date;
}

export interface AssessmentFinding {
  requirementId: string;
  status: 'compliant' | 'non_compliant' | 'partial' | 'not_applicable';
  gaps: string[];
  remediationPlan?: RemediationPlan;
  risk: 'critical' | 'high' | 'medium' | 'low';
}

export interface RemediationPlan {
  actions: RemediationAction[];
  timeline: Date;
  responsibleParty: string;
  estimatedEffort: number; // hours
  status: 'planned' | 'in_progress' | 'completed';
}

export interface RemediationAction {
  description: string;
  priority: number;
  dependencies: string[];
  completed: boolean;
  completedAt?: Date;
  completedBy?: string;
}

// Security Monitoring Types
export interface SecurityEvent {
  id: string;
  timestamp: Date;
  type: SecurityEventType;
  severity: 'info' | 'warning' | 'error' | 'critical';
  source: string;
  tenantId?: string;
  userId?: string;
  details: Record<string, any>;
  indicators: SecurityIndicator[];
  response?: SecurityResponse;
}

export type SecurityEventType = 
  | 'authentication_failure'
  | 'authorization_violation'
  | 'suspicious_activity'
  | 'data_breach_attempt'
  | 'rate_limit_exceeded'
  | 'invalid_input'
  | 'system_vulnerability'
  | 'compliance_violation';

export interface SecurityIndicator {
  type: 'ip_reputation' | 'behavior_anomaly' | 'known_attack_pattern' | 'policy_violation';
  confidence: number; // 0-100
  details: Record<string, any>;
}

export interface SecurityResponse {
  action: 'blocked' | 'challenged' | 'logged' | 'alerted' | 'quarantined';
  automated: boolean;
  timestamp: Date;
  details?: string;
}

// API Key Management
export interface ApiKey {
  id: string;
  key: string; // hashed
  prefix: string; // visible prefix for identification
  name: string;
  tenantId: string;
  userId: string;
  permissions: Permission[];
  rateLimit?: RateLimit;
  ipWhitelist?: string[];
  expiresAt?: Date;
  lastUsedAt?: Date;
  createdAt: Date;
  revokedAt?: Date;
  status: 'active' | 'expired' | 'revoked';
}

export interface RateLimit {
  requests: number;
  window: 'second' | 'minute' | 'hour' | 'day';
  burst?: number;
}

// Session Management
export interface Session {
  id: string;
  userId: string;
  tenantId: string;
  token: string;
  ipAddress: string;
  userAgent: string;
  location?: GeoLocation;
  createdAt: Date;
  lastActivity: Date;
  expiresAt: Date;
  isActive: boolean;
  deviceInfo?: DeviceInfo;
}

export interface GeoLocation {
  country: string;
  region: string;
  city: string;
  latitude: number;
  longitude: number;
  timezone: string;
}

export interface DeviceInfo {
  type: 'desktop' | 'mobile' | 'tablet' | 'unknown';
  os: string;
  browser: string;
  fingerprint?: string;
}

// Vulnerability Scanning
export interface VulnerabilityScan {
  id: string;
  timestamp: Date;
  type: 'dependency' | 'code' | 'infrastructure' | 'configuration';
  target: string;
  findings: Vulnerability[];
  summary: ScanSummary;
}

export interface Vulnerability {
  id: string;
  cve?: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  affectedComponent: string;
  fixAvailable: boolean;
  fixVersion?: string;
  exploitAvailable: boolean;
  cvssScore?: number;
  references: string[];
}

export interface ScanSummary {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  fixed: number;
  duration: number;
}

// Zod Schemas for validation
export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  tenantId: z.string().uuid(),
  roles: z.array(z.any()),
  permissions: z.array(z.any()),
  metadata: z.object({
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    department: z.string().optional(),
    jobTitle: z.string().optional(),
    phoneNumber: z.string().optional(),
    preferences: z.record(z.any())
  }),
  mfaEnabled: z.boolean(),
  isActive: z.boolean()
});

export const TenantSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  plan: z.object({
    id: z.string(),
    name: z.string(),
    features: z.array(z.string()),
    limits: z.object({
      maxUsers: z.number().positive(),
      maxAgents: z.number().positive(),
      maxWorkflows: z.number().positive(),
      maxApiCalls: z.number().positive(),
      maxStorage: z.number().positive(),
      maxComputeTime: z.number().positive(),
      rateLimits: z.object({
        requestsPerMinute: z.number().positive(),
        requestsPerHour: z.number().positive(),
        requestsPerDay: z.number().positive()
      })
    })
  }),
  status: z.enum(['active', 'suspended', 'pending', 'deleted'])
});

export const AuditLogSchema = z.object({
  tenantId: z.string().uuid(),
  userId: z.string().uuid().optional(),
  action: z.object({
    category: z.enum(['auth', 'data', 'admin', 'system', 'workflow', 'agent']),
    type: z.string(),
    severity: z.enum(['low', 'medium', 'high', 'critical']),
    description: z.string()
  }),
  resource: z.string(),
  resourceId: z.string().optional(),
  result: z.enum(['success', 'failure']),
  metadata: z.record(z.any()),
  ipAddress: z.string().ip().optional(),
  userAgent: z.string().optional()
});