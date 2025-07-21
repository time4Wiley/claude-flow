/**
 * Role-Based Access Control (RBAC) Service
 * Manages roles, permissions, and access control policies
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../../utils/logger';
import {
  User,
  Role,
  Permission,
  PolicyCondition,
  Tenant,
  AuditLog
} from '../types';
import { AuditService } from '../audit/audit-service';

export interface RBACServiceConfig {
  enableDynamicPermissions: boolean;
  enableHierarchicalRoles: boolean;
  maxRolesPerUser: number;
  maxPermissionsPerRole: number;
  cacheEnabled: boolean;
  cacheTTL: number; // seconds
}

interface PermissionCache {
  userId: string;
  permissions: Set<string>;
  timestamp: number;
}

interface PolicyEvaluationContext {
  user: User;
  resource: string;
  action: string;
  tenant: Tenant;
  environment: Record<string, any>;
  request?: {
    ip?: string;
    timestamp?: Date;
    location?: { country: string; region: string };
  };
}

export class RBACService extends EventEmitter {
  private logger: Logger;
  private config: RBACServiceConfig;
  private auditService: AuditService;
  private roles: Map<string, Role> = new Map();
  private systemRoles: Map<string, Role> = new Map();
  private permissionCache: Map<string, PermissionCache> = new Map();
  private roleHierarchy: Map<string, Set<string>> = new Map();

  constructor(config: RBACServiceConfig, auditService: AuditService) {
    super();
    this.config = config;
    this.logger = new Logger('RBACService');
    this.auditService = auditService;
    this.initializeSystemRoles();
  }

  /**
   * Initialize default system roles
   */
  private initializeSystemRoles(): void {
    const systemRoles = [
      {
        id: 'super-admin',
        name: 'Super Administrator',
        description: 'Full system access',
        permissions: [
          { resource: '*', action: '*', effect: 'allow' as const }
        ],
        isSystem: true
      },
      {
        id: 'tenant-admin',
        name: 'Tenant Administrator',
        description: 'Full tenant access',
        permissions: [
          { resource: 'tenant:*', action: '*', effect: 'allow' as const },
          { resource: 'user:*', action: '*', effect: 'allow' as const },
          { resource: 'role:*', action: '*', effect: 'allow' as const },
          { resource: 'workflow:*', action: '*', effect: 'allow' as const },
          { resource: 'agent:*', action: '*', effect: 'allow' as const }
        ],
        isSystem: true
      },
      {
        id: 'user',
        name: 'Standard User',
        description: 'Basic user permissions',
        permissions: [
          { resource: 'profile:self', action: 'read', effect: 'allow' as const },
          { resource: 'profile:self', action: 'update', effect: 'allow' as const },
          { resource: 'workflow:own', action: '*', effect: 'allow' as const },
          { resource: 'agent:own', action: '*', effect: 'allow' as const }
        ],
        isSystem: true
      },
      {
        id: 'readonly',
        name: 'Read Only User',
        description: 'Read-only access',
        permissions: [
          { resource: '*', action: 'read', effect: 'allow' as const },
          { resource: '*', action: 'list', effect: 'allow' as const }
        ],
        isSystem: true
      }
    ];

    systemRoles.forEach(roleData => {
      const role: Role = {
        ...roleData,
        id: roleData.id,
        permissions: roleData.permissions.map(p => ({
          id: uuidv4(),
          ...p
        })),
        createdAt: new Date(),
        updatedAt: new Date()
      };
      this.systemRoles.set(role.id, role);
    });

    this.logger.info('System roles initialized', { count: systemRoles.length });
  }

  /**
   * Create a new role
   */
  async createRole(
    name: string,
    description: string,
    permissions: Omit<Permission, 'id'>[],
    tenantId?: string,
    createdBy?: string
  ): Promise<Role> {
    try {
      // Validate permissions count
      if (permissions.length > this.config.maxPermissionsPerRole) {
        throw new Error(`Role cannot have more than ${this.config.maxPermissionsPerRole} permissions`);
      }

      // Validate permission format
      this.validatePermissions(permissions);

      const role: Role = {
        id: uuidv4(),
        name,
        description,
        permissions: permissions.map(p => ({ id: uuidv4(), ...p })),
        tenantId,
        isSystem: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      this.roles.set(role.id, role);

      // Clear permission cache
      this.clearPermissionCache();

      // Audit log
      await this.auditService.log({
        userId: createdBy,
        tenantId,
        action: {
          category: 'admin',
          type: 'role_created',
          severity: 'medium',
          description: `Created role: ${name}`
        },
        resource: 'role',
        resourceId: role.id,
        result: 'success',
        metadata: { name, permissions: permissions.length }
      } as AuditLog);

      this.emit('role:created', { role });

      return role;
    } catch (error) {
      this.logger.error('Failed to create role', error);
      throw error;
    }
  }

  /**
   * Update existing role
   */
  async updateRole(
    roleId: string,
    updates: Partial<{
      name: string;
      description: string;
      permissions: Omit<Permission, 'id'>[];
    }>,
    updatedBy?: string
  ): Promise<Role> {
    try {
      const role = this.roles.get(roleId) || this.systemRoles.get(roleId);
      if (!role) {
        throw new Error('Role not found');
      }

      if (role.isSystem) {
        throw new Error('System roles cannot be modified');
      }

      // Validate permissions if being updated
      if (updates.permissions) {
        if (updates.permissions.length > this.config.maxPermissionsPerRole) {
          throw new Error(`Role cannot have more than ${this.config.maxPermissionsPerRole} permissions`);
        }
        this.validatePermissions(updates.permissions);
      }

      // Apply updates
      const updatedRole: Role = {
        ...role,
        name: updates.name || role.name,
        description: updates.description || role.description,
        permissions: updates.permissions 
          ? updates.permissions.map(p => ({ id: uuidv4(), ...p }))
          : role.permissions,
        updatedAt: new Date()
      };

      this.roles.set(roleId, updatedRole);

      // Clear permission cache
      this.clearPermissionCache();

      // Audit log
      await this.auditService.log({
        userId: updatedBy,
        tenantId: role.tenantId,
        action: {
          category: 'admin',
          type: 'role_updated',
          severity: 'medium',
          description: `Updated role: ${updatedRole.name}`
        },
        resource: 'role',
        resourceId: roleId,
        result: 'success',
        metadata: { updates }
      } as AuditLog);

      this.emit('role:updated', { role: updatedRole });

      return updatedRole;
    } catch (error) {
      this.logger.error('Failed to update role', error);
      throw error;
    }
  }

  /**
   * Delete role
   */
  async deleteRole(roleId: string, deletedBy?: string): Promise<void> {
    try {
      const role = this.roles.get(roleId);
      if (!role) {
        throw new Error('Role not found');
      }

      if (role.isSystem) {
        throw new Error('System roles cannot be deleted');
      }

      this.roles.delete(roleId);

      // Clear permission cache
      this.clearPermissionCache();

      // Audit log
      await this.auditService.log({
        userId: deletedBy,
        tenantId: role.tenantId,
        action: {
          category: 'admin',
          type: 'role_deleted',
          severity: 'high',
          description: `Deleted role: ${role.name}`
        },
        resource: 'role',
        resourceId: roleId,
        result: 'success',
        metadata: { roleName: role.name }
      } as AuditLog);

      this.emit('role:deleted', { roleId });
    } catch (error) {
      this.logger.error('Failed to delete role', error);
      throw error;
    }
  }

  /**
   * Assign role to user
   */
  async assignRole(userId: string, roleId: string, assignedBy?: string): Promise<void> {
    try {
      const role = this.roles.get(roleId) || this.systemRoles.get(roleId);
      if (!role) {
        throw new Error('Role not found');
      }

      // Get user (placeholder - would come from user service)
      const user = await this.getUserById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Check max roles limit
      if (user.roles.length >= this.config.maxRolesPerUser) {
        throw new Error(`User cannot have more than ${this.config.maxRolesPerUser} roles`);
      }

      // Check if user already has this role
      if (user.roles.some(r => r.id === roleId)) {
        throw new Error('User already has this role');
      }

      // Add role to user
      user.roles.push(role);

      // Clear permission cache for user
      this.permissionCache.delete(userId);

      // Audit log
      await this.auditService.log({
        userId: assignedBy,
        tenantId: user.tenantId,
        action: {
          category: 'admin',
          type: 'role_assigned',
          severity: 'medium',
          description: `Assigned role ${role.name} to user`
        },
        resource: 'user',
        resourceId: userId,
        result: 'success',
        metadata: { roleId, roleName: role.name }
      } as AuditLog);

      this.emit('role:assigned', { userId, roleId });
    } catch (error) {
      this.logger.error('Failed to assign role', error);
      throw error;
    }
  }

  /**
   * Remove role from user
   */
  async removeRole(userId: string, roleId: string, removedBy?: string): Promise<void> {
    try {
      // Get user (placeholder - would come from user service)
      const user = await this.getUserById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const roleIndex = user.roles.findIndex(r => r.id === roleId);
      if (roleIndex === -1) {
        throw new Error('User does not have this role');
      }

      const roleName = user.roles[roleIndex].name;
      user.roles.splice(roleIndex, 1);

      // Clear permission cache for user
      this.permissionCache.delete(userId);

      // Audit log
      await this.auditService.log({
        userId: removedBy,
        tenantId: user.tenantId,
        action: {
          category: 'admin',
          type: 'role_removed',
          severity: 'medium',
          description: `Removed role ${roleName} from user`
        },
        resource: 'user',
        resourceId: userId,
        result: 'success',
        metadata: { roleId, roleName }
      } as AuditLog);

      this.emit('role:removed', { userId, roleId });
    } catch (error) {
      this.logger.error('Failed to remove role', error);
      throw error;
    }
  }

  /**
   * Check if user has permission
   */
  async hasPermission(
    userId: string,
    resource: string,
    action: string,
    context?: Partial<PolicyEvaluationContext>
  ): Promise<boolean> {
    try {
      // Check cache first
      if (this.config.cacheEnabled) {
        const cached = this.getCachedPermissions(userId);
        if (cached) {
          return this.evaluatePermission(cached, resource, action);
        }
      }

      // Get user with roles
      const user = await this.getUserById(userId);
      if (!user || !user.isActive) {
        return false;
      }

      // Build full context
      const fullContext: PolicyEvaluationContext = {
        user,
        resource,
        action,
        tenant: await this.getTenantById(user.tenantId),
        environment: context?.environment || {},
        request: context?.request
      };

      // Collect all permissions
      const permissions = this.collectUserPermissions(user);

      // Cache permissions
      if (this.config.cacheEnabled) {
        this.cachePermissions(userId, permissions);
      }

      // Evaluate permission with conditions
      return this.evaluatePermissionWithConditions(permissions, fullContext);
    } catch (error) {
      this.logger.error('Permission check failed', error);
      return false;
    }
  }

  /**
   * Get all permissions for a user
   */
  async getUserPermissions(userId: string): Promise<Permission[]> {
    try {
      const user = await this.getUserById(userId);
      if (!user) {
        return [];
      }

      const permissions = this.collectUserPermissions(user);
      return Array.from(permissions).map(p => this.parsePermissionString(p));
    } catch (error) {
      this.logger.error('Failed to get user permissions', error);
      return [];
    }
  }

  /**
   * Collect all permissions from user's roles and direct permissions
   */
  private collectUserPermissions(user: User): Set<string> {
    const permissions = new Set<string>();

    // Add permissions from roles
    user.roles.forEach(role => {
      role.permissions.forEach(permission => {
        if (permission.effect === 'allow') {
          permissions.add(`${permission.resource}:${permission.action}`);
        }
      });
    });

    // Add direct user permissions
    user.permissions.forEach(permission => {
      if (permission.effect === 'allow') {
        permissions.add(`${permission.resource}:${permission.action}`);
      }
    });

    // Handle hierarchical roles if enabled
    if (this.config.enableHierarchicalRoles) {
      user.roles.forEach(role => {
        const inheritedRoles = this.roleHierarchy.get(role.id);
        if (inheritedRoles) {
          inheritedRoles.forEach(inheritedRoleId => {
            const inheritedRole = this.roles.get(inheritedRoleId) || this.systemRoles.get(inheritedRoleId);
            if (inheritedRole) {
              inheritedRole.permissions.forEach(permission => {
                if (permission.effect === 'allow') {
                  permissions.add(`${permission.resource}:${permission.action}`);
                }
              });
            }
          });
        }
      });
    }

    return permissions;
  }

  /**
   * Evaluate permission against permission set
   */
  private evaluatePermission(
    permissions: Set<string>,
    resource: string,
    action: string
  ): boolean {
    // Direct match
    if (permissions.has(`${resource}:${action}`)) {
      return true;
    }

    // Wildcard matches
    if (permissions.has(`${resource}:*`)) {
      return true;
    }

    if (permissions.has(`*:${action}`)) {
      return true;
    }

    if (permissions.has('*:*')) {
      return true;
    }

    // Resource hierarchy match (e.g., 'workflow:123' matches 'workflow:*')
    const resourceParts = resource.split(':');
    for (let i = resourceParts.length - 1; i > 0; i--) {
      const parentResource = resourceParts.slice(0, i).join(':');
      if (permissions.has(`${parentResource}:*:${action}`) || 
          permissions.has(`${parentResource}:*`)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Evaluate permission with policy conditions
   */
  private evaluatePermissionWithConditions(
    permissions: Set<string>,
    context: PolicyEvaluationContext
  ): boolean {
    // First check basic permission
    if (!this.evaluatePermission(permissions, context.resource, context.action)) {
      return false;
    }

    // Then evaluate conditions
    // Get all applicable permissions with conditions
    const applicablePermissions = this.getApplicablePermissions(
      context.user,
      context.resource,
      context.action
    );

    for (const permission of applicablePermissions) {
      if (permission.conditions && permission.conditions.length > 0) {
        const conditionsMet = this.evaluateConditions(permission.conditions, context);
        if (!conditionsMet) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Evaluate policy conditions
   */
  private evaluateConditions(
    conditions: PolicyCondition[],
    context: PolicyEvaluationContext
  ): boolean {
    return conditions.every(condition => {
      switch (condition.type) {
        case 'ip':
          return this.evaluateIpCondition(condition, context.request?.ip);
        case 'time':
          return this.evaluateTimeCondition(condition, context.request?.timestamp);
        case 'location':
          return this.evaluateLocationCondition(condition, context.request?.location);
        case 'attribute':
          return this.evaluateAttributeCondition(condition, context);
        case 'custom':
          return this.evaluateCustomCondition(condition, context);
        default:
          return false;
      }
    });
  }

  /**
   * Condition evaluators
   */
  private evaluateIpCondition(condition: PolicyCondition, ip?: string): boolean {
    if (!ip) return false;
    
    switch (condition.operator) {
      case 'equals':
        return ip === condition.value;
      case 'not_equals':
        return ip !== condition.value;
      case 'contains':
        return ip.includes(condition.value);
      case 'matches':
        return new RegExp(condition.value).test(ip);
      default:
        return false;
    }
  }

  private evaluateTimeCondition(condition: PolicyCondition, timestamp?: Date): boolean {
    if (!timestamp) timestamp = new Date();
    
    const time = timestamp.getTime();
    const compareTime = new Date(condition.value).getTime();
    
    switch (condition.operator) {
      case 'greater_than':
        return time > compareTime;
      case 'less_than':
        return time < compareTime;
      default:
        return false;
    }
  }

  private evaluateLocationCondition(
    condition: PolicyCondition,
    location?: { country: string; region: string }
  ): boolean {
    if (!location) return false;
    
    switch (condition.operator) {
      case 'equals':
        return location.country === condition.value || location.region === condition.value;
      case 'not_equals':
        return location.country !== condition.value && location.region !== condition.value;
      default:
        return false;
    }
  }

  private evaluateAttributeCondition(
    condition: PolicyCondition,
    context: PolicyEvaluationContext
  ): boolean {
    // Evaluate user or tenant attributes
    const attributePath = condition.value.path;
    const expectedValue = condition.value.value;
    
    let actualValue: any;
    if (attributePath.startsWith('user.')) {
      actualValue = this.getNestedValue(context.user, attributePath.substring(5));
    } else if (attributePath.startsWith('tenant.')) {
      actualValue = this.getNestedValue(context.tenant, attributePath.substring(7));
    }
    
    switch (condition.operator) {
      case 'equals':
        return actualValue === expectedValue;
      case 'not_equals':
        return actualValue !== expectedValue;
      case 'contains':
        return String(actualValue).includes(String(expectedValue));
      default:
        return false;
    }
  }

  private evaluateCustomCondition(
    condition: PolicyCondition,
    context: PolicyEvaluationContext
  ): boolean {
    // Emit event for custom condition evaluation
    const result = { allowed: false };
    this.emit('permission:custom_condition', { condition, context, result });
    return result.allowed;
  }

  /**
   * Helper methods
   */
  private validatePermissions(permissions: Omit<Permission, 'id'>[]): void {
    const validResourcePattern = /^[a-zA-Z0-9:_*-]+$/;
    const validActionPattern = /^[a-zA-Z0-9:_*-]+$/;

    permissions.forEach(permission => {
      if (!validResourcePattern.test(permission.resource)) {
        throw new Error(`Invalid resource format: ${permission.resource}`);
      }
      if (!validActionPattern.test(permission.action)) {
        throw new Error(`Invalid action format: ${permission.action}`);
      }
      if (!['allow', 'deny'].includes(permission.effect)) {
        throw new Error(`Invalid effect: ${permission.effect}`);
      }
    });
  }

  private getCachedPermissions(userId: string): Set<string> | null {
    const cached = this.permissionCache.get(userId);
    if (!cached) return null;
    
    const now = Date.now();
    if (now - cached.timestamp > this.config.cacheTTL * 1000) {
      this.permissionCache.delete(userId);
      return null;
    }
    
    return cached.permissions;
  }

  private cachePermissions(userId: string, permissions: Set<string>): void {
    this.permissionCache.set(userId, {
      userId,
      permissions,
      timestamp: Date.now()
    });
  }

  private clearPermissionCache(): void {
    this.permissionCache.clear();
  }

  private parsePermissionString(permissionStr: string): Permission {
    const [resource, action] = permissionStr.split(':');
    return {
      id: uuidv4(),
      resource,
      action,
      effect: 'allow'
    };
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private getApplicablePermissions(
    user: User,
    resource: string,
    action: string
  ): Permission[] {
    const permissions: Permission[] = [];
    
    // Collect from roles
    user.roles.forEach(role => {
      role.permissions.forEach(permission => {
        if (this.isPermissionApplicable(permission, resource, action)) {
          permissions.push(permission);
        }
      });
    });
    
    // Collect direct permissions
    user.permissions.forEach(permission => {
      if (this.isPermissionApplicable(permission, resource, action)) {
        permissions.push(permission);
      }
    });
    
    return permissions;
  }

  private isPermissionApplicable(
    permission: Permission,
    resource: string,
    action: string
  ): boolean {
    return (permission.resource === resource || 
            permission.resource === '*' || 
            resource.startsWith(permission.resource.replace('*', ''))) &&
           (permission.action === action || 
            permission.action === '*');
  }

  // Placeholder methods
  private async getUserById(userId: string): Promise<User | null> {
    // TODO: Implement database lookup
    return null;
  }

  private async getTenantById(tenantId: string): Promise<Tenant> {
    // TODO: Implement database lookup
    return {} as Tenant;
  }
}