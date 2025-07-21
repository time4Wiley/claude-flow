/**
 * Multi-Tenancy Service
 * Manages tenant isolation, resource segregation, and tenant lifecycle
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../../utils/logger';
import {
  Tenant,
  TenantPlan,
  TenantSettings,
  TenantStatus,
  ResourceLimits,
  User,
  AuditLog,
  TenantSchema
} from '../types';
import { AuditService } from '../audit/audit-service';
import { EncryptionService } from '../encryption/encryption-service';

export interface TenantServiceConfig {
  defaultPlan: TenantPlan;
  enableAutoSuspension: boolean;
  suspensionGracePeriod: number; // days
  dataRetentionPeriod: number; // days after deletion
  enableResourceQuotas: boolean;
  isolationLevel: 'strict' | 'shared' | 'hybrid';
}

interface TenantContext {
  tenantId: string;
  userId?: string;
  requestId: string;
}

interface ResourceUsage {
  users: number;
  agents: number;
  workflows: number;
  apiCalls: number;
  storage: number;
  computeTime: number;
  lastUpdated: Date;
}

export class TenantService extends EventEmitter {
  private logger: Logger;
  private config: TenantServiceConfig;
  private auditService: AuditService;
  private encryptionService: EncryptionService;
  private tenants: Map<string, Tenant> = new Map();
  private tenantsBySlug: Map<string, string> = new Map();
  private resourceUsage: Map<string, ResourceUsage> = new Map();
  private tenantContext: AsyncLocalStorage<TenantContext>;

  constructor(
    config: TenantServiceConfig,
    auditService: AuditService,
    encryptionService: EncryptionService
  ) {
    super();
    this.config = config;
    this.logger = new Logger('TenantService');
    this.auditService = auditService;
    this.encryptionService = encryptionService;
    this.tenantContext = new AsyncLocalStorage();
    this.initializeService();
  }

  private initializeService(): void {
    // Start resource monitoring
    if (this.config.enableResourceQuotas) {
      this.startResourceMonitoring();
    }

    // Start suspension checker
    if (this.config.enableAutoSuspension) {
      this.startSuspensionChecker();
    }

    this.logger.info('Tenant service initialized', {
      isolationLevel: this.config.isolationLevel,
      resourceQuotas: this.config.enableResourceQuotas
    });
  }

  /**
   * Create a new tenant
   */
  async createTenant(
    name: string,
    planId: string,
    createdBy: string,
    metadata?: Partial<TenantMetadata>
  ): Promise<Tenant> {
    try {
      // Validate input
      const slug = this.generateSlug(name);
      
      // Check if slug already exists
      if (this.tenantsBySlug.has(slug)) {
        throw new Error('Tenant with similar name already exists');
      }

      // Get plan
      const plan = await this.getTenantPlan(planId) || this.config.defaultPlan;

      // Create tenant
      const tenant: Tenant = {
        id: uuidv4(),
        name,
        slug,
        plan,
        status: 'pending',
        settings: this.createDefaultSettings(),
        metadata: {
          ...metadata,
          createdBy
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Validate tenant data
      TenantSchema.parse(tenant);

      // Initialize tenant isolation
      await this.initializeTenantIsolation(tenant);

      // Store tenant
      this.tenants.set(tenant.id, tenant);
      this.tenantsBySlug.set(slug, tenant.id);

      // Initialize resource usage tracking
      this.resourceUsage.set(tenant.id, {
        users: 0,
        agents: 0,
        workflows: 0,
        apiCalls: 0,
        storage: 0,
        computeTime: 0,
        lastUpdated: new Date()
      });

      // Activate tenant
      tenant.status = 'active';

      // Audit log
      await this.auditService.log({
        userId: createdBy,
        tenantId: tenant.id,
        action: {
          category: 'admin',
          type: 'tenant_created',
          severity: 'high',
          description: `Created tenant: ${name}`
        },
        resource: 'tenant',
        resourceId: tenant.id,
        result: 'success',
        metadata: { name, plan: plan.name }
      } as AuditLog);

      this.emit('tenant:created', { tenant });

      return tenant;
    } catch (error) {
      this.logger.error('Failed to create tenant', error);
      throw error;
    }
  }

  /**
   * Update tenant
   */
  async updateTenant(
    tenantId: string,
    updates: Partial<{
      name: string;
      plan: TenantPlan;
      settings: Partial<TenantSettings>;
      metadata: Partial<TenantMetadata>;
    }>,
    updatedBy: string
  ): Promise<Tenant> {
    try {
      const tenant = this.tenants.get(tenantId);
      if (!tenant) {
        throw new Error('Tenant not found');
      }

      // Check if tenant is active
      if (tenant.status !== 'active') {
        throw new Error('Cannot update inactive tenant');
      }

      // Apply updates
      const updatedTenant: Tenant = {
        ...tenant,
        name: updates.name || tenant.name,
        plan: updates.plan || tenant.plan,
        settings: updates.settings ? { ...tenant.settings, ...updates.settings } : tenant.settings,
        metadata: updates.metadata ? { ...tenant.metadata, ...updates.metadata } : tenant.metadata,
        updatedAt: new Date()
      };

      // If name changed, update slug
      if (updates.name && updates.name !== tenant.name) {
        const newSlug = this.generateSlug(updates.name);
        if (this.tenantsBySlug.has(newSlug) && this.tenantsBySlug.get(newSlug) !== tenantId) {
          throw new Error('Tenant with similar name already exists');
        }
        this.tenantsBySlug.delete(tenant.slug);
        this.tenantsBySlug.set(newSlug, tenantId);
        updatedTenant.slug = newSlug;
      }

      // Validate updated tenant
      TenantSchema.parse(updatedTenant);

      // Check resource limits if plan changed
      if (updates.plan) {
        await this.validateResourceLimits(tenantId, updates.plan.limits);
      }

      // Store updated tenant
      this.tenants.set(tenantId, updatedTenant);

      // Audit log
      await this.auditService.log({
        userId: updatedBy,
        tenantId,
        action: {
          category: 'admin',
          type: 'tenant_updated',
          severity: 'medium',
          description: `Updated tenant: ${updatedTenant.name}`
        },
        resource: 'tenant',
        resourceId: tenantId,
        result: 'success',
        metadata: { updates }
      } as AuditLog);

      this.emit('tenant:updated', { tenant: updatedTenant });

      return updatedTenant;
    } catch (error) {
      this.logger.error('Failed to update tenant', error);
      throw error;
    }
  }

  /**
   * Suspend tenant
   */
  async suspendTenant(
    tenantId: string,
    reason: string,
    suspendedBy: string
  ): Promise<void> {
    try {
      const tenant = this.tenants.get(tenantId);
      if (!tenant) {
        throw new Error('Tenant not found');
      }

      if (tenant.status === 'suspended') {
        throw new Error('Tenant is already suspended');
      }

      // Update status
      tenant.status = 'suspended';
      tenant.suspendedAt = new Date();

      // Revoke all active sessions
      await this.revokeAllTenantSessions(tenantId);

      // Audit log
      await this.auditService.log({
        userId: suspendedBy,
        tenantId,
        action: {
          category: 'admin',
          type: 'tenant_suspended',
          severity: 'critical',
          description: `Suspended tenant: ${reason}`
        },
        resource: 'tenant',
        resourceId: tenantId,
        result: 'success',
        metadata: { reason }
      } as AuditLog);

      this.emit('tenant:suspended', { tenantId, reason });
    } catch (error) {
      this.logger.error('Failed to suspend tenant', error);
      throw error;
    }
  }

  /**
   * Reactivate tenant
   */
  async reactivateTenant(
    tenantId: string,
    reactivatedBy: string
  ): Promise<void> {
    try {
      const tenant = this.tenants.get(tenantId);
      if (!tenant) {
        throw new Error('Tenant not found');
      }

      if (tenant.status !== 'suspended') {
        throw new Error('Tenant is not suspended');
      }

      // Update status
      tenant.status = 'active';
      tenant.suspendedAt = undefined;

      // Audit log
      await this.auditService.log({
        userId: reactivatedBy,
        tenantId,
        action: {
          category: 'admin',
          type: 'tenant_reactivated',
          severity: 'high',
          description: 'Reactivated tenant'
        },
        resource: 'tenant',
        resourceId: tenantId,
        result: 'success',
        metadata: {}
      } as AuditLog);

      this.emit('tenant:reactivated', { tenantId });
    } catch (error) {
      this.logger.error('Failed to reactivate tenant', error);
      throw error;
    }
  }

  /**
   * Delete tenant (soft delete)
   */
  async deleteTenant(
    tenantId: string,
    deletedBy: string,
    hardDelete: boolean = false
  ): Promise<void> {
    try {
      const tenant = this.tenants.get(tenantId);
      if (!tenant) {
        throw new Error('Tenant not found');
      }

      if (hardDelete) {
        // Permanently delete tenant data
        await this.permanentlyDeleteTenant(tenantId);
        this.tenants.delete(tenantId);
        this.tenantsBySlug.delete(tenant.slug);
        this.resourceUsage.delete(tenantId);
      } else {
        // Soft delete
        tenant.status = 'deleted';
        tenant.deletedAt = new Date();
        
        // Schedule permanent deletion after retention period
        this.schedulePermanentDeletion(tenantId);
      }

      // Revoke all access
      await this.revokeAllTenantAccess(tenantId);

      // Audit log
      await this.auditService.log({
        userId: deletedBy,
        tenantId,
        action: {
          category: 'admin',
          type: hardDelete ? 'tenant_hard_deleted' : 'tenant_soft_deleted',
          severity: 'critical',
          description: `${hardDelete ? 'Permanently deleted' : 'Soft deleted'} tenant`
        },
        resource: 'tenant',
        resourceId: tenantId,
        result: 'success',
        metadata: { hardDelete }
      } as AuditLog);

      this.emit('tenant:deleted', { tenantId, hardDelete });
    } catch (error) {
      this.logger.error('Failed to delete tenant', error);
      throw error;
    }
  }

  /**
   * Get tenant by ID
   */
  async getTenant(tenantId: string): Promise<Tenant | null> {
    const tenant = this.tenants.get(tenantId);
    if (!tenant || tenant.status === 'deleted') {
      return null;
    }
    return tenant;
  }

  /**
   * Get tenant by slug
   */
  async getTenantBySlug(slug: string): Promise<Tenant | null> {
    const tenantId = this.tenantsBySlug.get(slug);
    if (!tenantId) {
      return null;
    }
    return this.getTenant(tenantId);
  }

  /**
   * List tenants
   */
  async listTenants(
    filters?: {
      status?: TenantStatus;
      planId?: string;
      createdAfter?: Date;
      createdBefore?: Date;
    },
    pagination?: {
      limit?: number;
      offset?: number;
    }
  ): Promise<{ tenants: Tenant[]; total: number }> {
    let tenants = Array.from(this.tenants.values());

    // Apply filters
    if (filters) {
      if (filters.status) {
        tenants = tenants.filter(t => t.status === filters.status);
      }
      if (filters.planId) {
        tenants = tenants.filter(t => t.plan.id === filters.planId);
      }
      if (filters.createdAfter) {
        tenants = tenants.filter(t => t.createdAt > filters.createdAfter);
      }
      if (filters.createdBefore) {
        tenants = tenants.filter(t => t.createdAt < filters.createdBefore);
      }
    }

    const total = tenants.length;

    // Apply pagination
    if (pagination) {
      const offset = pagination.offset || 0;
      const limit = pagination.limit || 20;
      tenants = tenants.slice(offset, offset + limit);
    }

    return { tenants, total };
  }

  /**
   * Check resource usage against limits
   */
  async checkResourceLimit(
    tenantId: string,
    resource: keyof ResourceLimits,
    requestedAmount: number = 1
  ): Promise<{ allowed: boolean; current: number; limit: number }> {
    const tenant = await this.getTenant(tenantId);
    if (!tenant) {
      throw new Error('Tenant not found');
    }

    const usage = this.resourceUsage.get(tenantId);
    if (!usage) {
      throw new Error('Resource usage not found');
    }

    const current = usage[resource] || 0;
    const limit = tenant.plan.limits[resource];

    const allowed = current + requestedAmount <= limit;

    if (!allowed) {
      this.emit('tenant:limit_exceeded', {
        tenantId,
        resource,
        current,
        limit,
        requested: requestedAmount
      });
    }

    return { allowed, current, limit };
  }

  /**
   * Update resource usage
   */
  async updateResourceUsage(
    tenantId: string,
    resource: keyof ResourceUsage,
    delta: number
  ): Promise<void> {
    const usage = this.resourceUsage.get(tenantId);
    if (!usage) {
      throw new Error('Resource usage not found');
    }

    usage[resource] += delta;
    usage.lastUpdated = new Date();

    // Check if any limits are exceeded
    const tenant = await this.getTenant(tenantId);
    if (tenant && this.config.enableResourceQuotas) {
      await this.enforceResourceLimits(tenant, usage);
    }
  }

  /**
   * Get resource usage for tenant
   */
  async getResourceUsage(tenantId: string): Promise<ResourceUsage | null> {
    return this.resourceUsage.get(tenantId) || null;
  }

  /**
   * Run operation in tenant context
   */
  async runInTenantContext<T>(
    tenantId: string,
    userId: string | undefined,
    operation: () => Promise<T>
  ): Promise<T> {
    const context: TenantContext = {
      tenantId,
      userId,
      requestId: uuidv4()
    };

    return this.tenantContext.run(context, operation);
  }

  /**
   * Get current tenant context
   */
  getCurrentTenantContext(): TenantContext | undefined {
    return this.tenantContext.getStore();
  }

  /**
   * Initialize tenant isolation
   */
  private async initializeTenantIsolation(tenant: Tenant): Promise<void> {
    switch (this.config.isolationLevel) {
      case 'strict':
        // Create separate database schema
        await this.createTenantSchema(tenant.id);
        // Create separate encryption keys
        await this.encryptionService.createTenantKeys(tenant.id);
        // Create separate storage bucket
        await this.createTenantStorage(tenant.id);
        break;
      
      case 'shared':
        // Use row-level security with tenant ID
        await this.setupRowLevelSecurity(tenant.id);
        break;
      
      case 'hybrid':
        // Sensitive data in separate schema, other data shared
        await this.createTenantSchema(tenant.id, ['users', 'api_keys', 'audit_logs']);
        await this.setupRowLevelSecurity(tenant.id);
        break;
    }
  }

  /**
   * Create default tenant settings
   */
  private createDefaultSettings(): TenantSettings {
    return {
      security: {
        mfaRequired: false,
        passwordPolicy: {
          minLength: 8,
          requireUppercase: true,
          requireLowercase: true,
          requireNumbers: true,
          requireSpecialChars: false,
          preventReuse: 5
        },
        sessionTimeout: 3600, // 1 hour
        ipWhitelist: [],
        allowedDomains: [],
        ssoEnabled: false,
        ssoProviders: []
      },
      features: {},
      branding: {},
      integrations: {}
    };
  }

  /**
   * Generate URL-safe slug from name
   */
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 63);
  }

  /**
   * Validate resource limits
   */
  private async validateResourceLimits(
    tenantId: string,
    newLimits: ResourceLimits
  ): Promise<void> {
    const usage = this.resourceUsage.get(tenantId);
    if (!usage) return;

    const violations: string[] = [];

    if (usage.users > newLimits.maxUsers) {
      violations.push(`Current users (${usage.users}) exceeds new limit (${newLimits.maxUsers})`);
    }
    if (usage.agents > newLimits.maxAgents) {
      violations.push(`Current agents (${usage.agents}) exceeds new limit (${newLimits.maxAgents})`);
    }
    if (usage.workflows > newLimits.maxWorkflows) {
      violations.push(`Current workflows (${usage.workflows}) exceeds new limit (${newLimits.maxWorkflows})`);
    }
    if (usage.storage > newLimits.maxStorage) {
      violations.push(`Current storage (${usage.storage}) exceeds new limit (${newLimits.maxStorage})`);
    }

    if (violations.length > 0) {
      throw new Error(`Resource limit violations: ${violations.join(', ')}`);
    }
  }

  /**
   * Enforce resource limits
   */
  private async enforceResourceLimits(
    tenant: Tenant,
    usage: ResourceUsage
  ): Promise<void> {
    const limits = tenant.plan.limits;
    const violations: string[] = [];

    Object.keys(limits).forEach(resource => {
      if (usage[resource] > limits[resource]) {
        violations.push(`${resource}: ${usage[resource]}/${limits[resource]}`);
      }
    });

    if (violations.length > 0) {
      this.logger.warn('Resource limits exceeded', {
        tenantId: tenant.id,
        violations
      });

      // Emit event for handling
      this.emit('tenant:limits_exceeded', {
        tenant,
        violations,
        usage
      });
    }
  }

  /**
   * Start resource monitoring
   */
  private startResourceMonitoring(): void {
    setInterval(() => {
      this.tenants.forEach((tenant, tenantId) => {
        if (tenant.status === 'active') {
          const usage = this.resourceUsage.get(tenantId);
          if (usage) {
            this.enforceResourceLimits(tenant, usage);
          }
        }
      });
    }, 60000); // Check every minute
  }

  /**
   * Start suspension checker
   */
  private startSuspensionChecker(): void {
    setInterval(() => {
      const now = new Date();
      
      this.tenants.forEach((tenant, tenantId) => {
        if (tenant.status === 'active' && tenant.plan.pricing) {
          // Check for payment issues, trial expiration, etc.
          // This would integrate with billing system
          this.checkTenantSuspensionCriteria(tenant);
        }
      });
    }, 86400000); // Check daily
  }

  /**
   * Check tenant suspension criteria
   */
  private async checkTenantSuspensionCriteria(tenant: Tenant): Promise<void> {
    // TODO: Implement suspension criteria checks
    // - Payment failures
    // - Trial expiration
    // - Policy violations
    // - Excessive resource usage
  }

  /**
   * Schedule permanent deletion
   */
  private schedulePermanentDeletion(tenantId: string): void {
    setTimeout(() => {
      const tenant = this.tenants.get(tenantId);
      if (tenant && tenant.status === 'deleted') {
        this.permanentlyDeleteTenant(tenantId);
      }
    }, this.config.dataRetentionPeriod * 24 * 60 * 60 * 1000);
  }

  // Placeholder methods for full implementation
  private async getTenantPlan(planId: string): Promise<TenantPlan | null> {
    // TODO: Implement plan lookup
    return null;
  }

  private async revokeAllTenantSessions(tenantId: string): Promise<void> {
    // TODO: Implement session revocation
  }

  private async revokeAllTenantAccess(tenantId: string): Promise<void> {
    // TODO: Implement access revocation
  }

  private async permanentlyDeleteTenant(tenantId: string): Promise<void> {
    // TODO: Implement permanent deletion
  }

  private async createTenantSchema(tenantId: string, tables?: string[]): Promise<void> {
    // TODO: Implement database schema creation
  }

  private async setupRowLevelSecurity(tenantId: string): Promise<void> {
    // TODO: Implement row-level security
  }

  private async createTenantStorage(tenantId: string): Promise<void> {
    // TODO: Implement storage bucket creation
  }
}

// AsyncLocalStorage polyfill if not available
class AsyncLocalStorage<T> {
  private store: T | undefined;

  run<R>(store: T, fn: () => R): R {
    const previous = this.store;
    this.store = store;
    try {
      return fn();
    } finally {
      this.store = previous;
    }
  }

  getStore(): T | undefined {
    return this.store;
  }
}