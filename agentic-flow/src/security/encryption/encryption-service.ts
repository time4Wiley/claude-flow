/**
 * Encryption Service
 * Handles data encryption at rest and in transit, key management, and cryptographic operations
 */

import * as crypto from 'crypto';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../../utils/logger';
import {
  EncryptionConfig,
  EncryptedData,
  KeyManagement,
  DataEncryptionKey,
  DataClassification,
  ClassificationLevel,
  AuditLog
} from '../types';
import { AuditService } from '../audit/audit-service';

export interface EncryptionServiceConfig {
  algorithm: 'AES-256-GCM' | 'AES-256-CBC' | 'ChaCha20-Poly1305';
  keyDerivation: 'PBKDF2' | 'scrypt' | 'argon2';
  keyRotationInterval: number; // days
  enableHSM: boolean;
  hsmConfig?: {
    provider: string;
    endpoint: string;
    credentials: any;
  };
  enableFieldLevelEncryption: boolean;
  dataClassification: DataClassification;
  keyEscrow?: {
    enabled: boolean;
    providers: string[];
    threshold: number;
  };
}

interface MasterKey {
  id: string;
  key: Buffer;
  createdAt: Date;
  rotatedAt?: Date;
  status: 'active' | 'rotating' | 'retired';
}

interface FieldEncryptionConfig {
  pattern: RegExp;
  classification: string;
  algorithm?: string;
  keyId?: string;
}

export class EncryptionService extends EventEmitter {
  private logger: Logger;
  private config: EncryptionServiceConfig;
  private auditService?: AuditService;
  private masterKeys: Map<string, MasterKey> = new Map();
  private dataEncryptionKeys: Map<string, DataEncryptionKey> = new Map();
  private tenantKeys: Map<string, Map<string, DataEncryptionKey>> = new Map();
  private activeMasterKeyId: string;
  private fieldEncryptionConfigs: FieldEncryptionConfig[] = [];
  private keyRotationTimer?: NodeJS.Timeout;

  constructor(config: EncryptionServiceConfig) {
    super();
    this.config = config;
    this.logger = new Logger('EncryptionService');
    this.activeMasterKeyId = '';
    this.initialize();
  }

  setAuditService(auditService: AuditService): void {
    this.auditService = auditService;
  }

  private async initialize(): Promise<void> {
    try {
      // Initialize master key
      await this.initializeMasterKey();

      // Initialize field encryption patterns
      this.initializeFieldEncryption();

      // Start key rotation scheduler
      this.startKeyRotationScheduler();

      // Initialize HSM if enabled
      if (this.config.enableHSM) {
        await this.initializeHSM();
      }

      this.logger.info('Encryption service initialized', {
        algorithm: this.config.algorithm,
        keyDerivation: this.config.keyDerivation,
        hsmEnabled: this.config.enableHSM
      });
    } catch (error) {
      this.logger.error('Failed to initialize encryption service', error);
      throw error;
    }
  }

  /**
   * Encrypt data
   */
  async encrypt(
    data: string | Buffer,
    classification?: string,
    tenantId?: string
  ): Promise<EncryptedData> {
    try {
      // Determine classification level
      const level = classification || this.config.dataClassification.defaultLevel;
      const classificationConfig = this.getClassificationLevel(level);

      if (!classificationConfig.encryptionRequired) {
        throw new Error(`Encryption not required for classification level: ${level}`);
      }

      // Get appropriate encryption key
      const dek = await this.getDataEncryptionKey(tenantId, level);

      // Prepare data
      const plaintext = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');

      // Encrypt based on algorithm
      let encrypted: EncryptedData;
      switch (this.config.algorithm) {
        case 'AES-256-GCM':
          encrypted = await this.encryptAESGCM(plaintext, dek);
          break;
        case 'AES-256-CBC':
          encrypted = await this.encryptAESCBC(plaintext, dek);
          break;
        case 'ChaCha20-Poly1305':
          encrypted = await this.encryptChaCha20(plaintext, dek);
          break;
        default:
          throw new Error(`Unsupported algorithm: ${this.config.algorithm}`);
      }

      // Audit encryption operation
      if (this.auditService) {
        await this.auditService.log({
          tenantId,
          action: {
            category: 'system',
            type: 'data_encrypted',
            severity: 'low',
            description: 'Data encrypted'
          },
          resource: 'encryption',
          result: 'success',
          metadata: {
            classification: level,
            algorithm: this.config.algorithm,
            keyId: encrypted.keyId,
            dataSize: plaintext.length
          }
        } as AuditLog);
      }

      return encrypted;
    } catch (error) {
      this.logger.error('Encryption failed', error);
      throw error;
    }
  }

  /**
   * Decrypt data
   */
  async decrypt(
    encryptedData: EncryptedData,
    tenantId?: string
  ): Promise<Buffer> {
    try {
      // Get decryption key
      const dek = await this.getDecryptionKey(encryptedData.keyId, tenantId);

      // Decrypt based on algorithm
      let decrypted: Buffer;
      switch (encryptedData.algorithm || this.config.algorithm) {
        case 'AES-256-GCM':
          decrypted = await this.decryptAESGCM(encryptedData, dek);
          break;
        case 'AES-256-CBC':
          decrypted = await this.decryptAESCBC(encryptedData, dek);
          break;
        case 'ChaCha20-Poly1305':
          decrypted = await this.decryptChaCha20(encryptedData, dek);
          break;
        default:
          throw new Error(`Unsupported algorithm: ${encryptedData.algorithm}`);
      }

      // Audit decryption operation
      if (this.auditService) {
        await this.auditService.log({
          tenantId,
          action: {
            category: 'system',
            type: 'data_decrypted',
            severity: 'low',
            description: 'Data decrypted'
          },
          resource: 'encryption',
          result: 'success',
          metadata: {
            algorithm: encryptedData.algorithm,
            keyId: encryptedData.keyId
          }
        } as AuditLog);
      }

      return decrypted;
    } catch (error) {
      this.logger.error('Decryption failed', error);
      throw error;
    }
  }

  /**
   * Encrypt object with field-level encryption
   */
  async encryptObject(
    obj: any,
    classification?: string,
    tenantId?: string
  ): Promise<any> {
    if (!this.config.enableFieldLevelEncryption) {
      // Encrypt entire object
      const encrypted = await this.encrypt(JSON.stringify(obj), classification, tenantId);
      return encrypted;
    }

    // Deep clone object
    const result = JSON.parse(JSON.stringify(obj));

    // Apply field-level encryption
    await this.encryptFields(result, '', classification, tenantId);

    return result;
  }

  /**
   * Decrypt object with field-level encryption
   */
  async decryptObject(
    obj: any,
    tenantId?: string
  ): Promise<any> {
    if (obj.ciphertext && obj.iv && obj.tag && obj.keyId) {
      // Entire object is encrypted
      const decrypted = await this.decrypt(obj as EncryptedData, tenantId);
      return JSON.parse(decrypted.toString('utf8'));
    }

    // Deep clone object
    const result = JSON.parse(JSON.stringify(obj));

    // Apply field-level decryption
    await this.decryptFields(result, tenantId);

    return result;
  }

  /**
   * Generate encryption key
   */
  async generateKey(
    purpose: string,
    tenantId?: string,
    expiresAt?: Date
  ): Promise<string> {
    try {
      const keyId = uuidv4();
      const key = crypto.randomBytes(32); // 256 bits

      // Encrypt key with master key
      const encryptedKey = await this.encryptKeyWithMaster(key);

      const dek: DataEncryptionKey = {
        id: keyId,
        encryptedKey: encryptedKey.toString('base64'),
        algorithm: this.config.algorithm,
        createdAt: new Date(),
        expiresAt,
        status: 'active'
      };

      // Store key
      if (tenantId) {
        if (!this.tenantKeys.has(tenantId)) {
          this.tenantKeys.set(tenantId, new Map());
        }
        this.tenantKeys.get(tenantId)!.set(keyId, dek);
      } else {
        this.dataEncryptionKeys.set(keyId, dek);
      }

      // Audit key generation
      if (this.auditService) {
        await this.auditService.log({
          tenantId,
          action: {
            category: 'system',
            type: 'encryption_key_generated',
            severity: 'medium',
            description: `Generated encryption key for ${purpose}`
          },
          resource: 'encryption_key',
          resourceId: keyId,
          result: 'success',
          metadata: { purpose, expiresAt }
        } as AuditLog);
      }

      return keyId;
    } catch (error) {
      this.logger.error('Key generation failed', error);
      throw error;
    }
  }

  /**
   * Rotate encryption keys
   */
  async rotateKeys(tenantId?: string): Promise<void> {
    try {
      this.logger.info('Starting key rotation', { tenantId });

      // Rotate master key if no tenant specified
      if (!tenantId) {
        await this.rotateMasterKey();
      }

      // Get keys to rotate
      const keys = tenantId
        ? Array.from(this.tenantKeys.get(tenantId)?.values() || [])
        : Array.from(this.dataEncryptionKeys.values());

      // Rotate active keys
      for (const key of keys) {
        if (key.status === 'active') {
          await this.rotateDataEncryptionKey(key, tenantId);
        }
      }

      // Audit key rotation
      if (this.auditService) {
        await this.auditService.log({
          tenantId,
          action: {
            category: 'system',
            type: 'keys_rotated',
            severity: 'high',
            description: 'Encryption keys rotated'
          },
          resource: 'encryption_keys',
          result: 'success',
          metadata: { keyCount: keys.length }
        } as AuditLog);
      }

      this.emit('keys:rotated', { tenantId, keyCount: keys.length });
    } catch (error) {
      this.logger.error('Key rotation failed', error);
      throw error;
    }
  }

  /**
   * Create tenant-specific encryption keys
   */
  async createTenantKeys(tenantId: string): Promise<void> {
    try {
      // Create default keys for different purposes
      const purposes = ['data', 'pii', 'sensitive', 'audit'];

      for (const purpose of purposes) {
        await this.generateKey(purpose, tenantId);
      }

      this.logger.info('Created tenant encryption keys', { tenantId });
    } catch (error) {
      this.logger.error('Failed to create tenant keys', error);
      throw error;
    }
  }

  /**
   * Delete tenant encryption keys
   */
  async deleteTenantKeys(tenantId: string): Promise<void> {
    try {
      const keys = this.tenantKeys.get(tenantId);
      if (!keys) return;

      // Mark keys as revoked
      for (const key of keys.values()) {
        key.status = 'revoked';
      }

      // Schedule deletion after grace period
      setTimeout(() => {
        this.tenantKeys.delete(tenantId);
      }, 30 * 24 * 60 * 60 * 1000); // 30 days

      // Audit key deletion
      if (this.auditService) {
        await this.auditService.log({
          tenantId,
          action: {
            category: 'system',
            type: 'tenant_keys_deleted',
            severity: 'critical',
            description: 'Tenant encryption keys marked for deletion'
          },
          resource: 'encryption_keys',
          result: 'success',
          metadata: { keyCount: keys.size }
        } as AuditLog);
      }
    } catch (error) {
      this.logger.error('Failed to delete tenant keys', error);
      throw error;
    }
  }

  /**
   * Encrypt sensitive configuration
   */
  async encryptConfiguration(
    config: any,
    tenantId?: string
  ): Promise<any> {
    const sensitivePatterns = [
      /password/i,
      /secret/i,
      /key/i,
      /token/i,
      /credential/i,
      /private/i
    ];

    const result = JSON.parse(JSON.stringify(config));

    const encryptSensitive = async (obj: any, path: string) => {
      for (const [key, value] of Object.entries(obj)) {
        const fullPath = path ? `${path}.${key}` : key;

        if (typeof value === 'object' && value !== null) {
          await encryptSensitive(value, fullPath);
        } else if (typeof value === 'string') {
          // Check if field is sensitive
          const isSensitive = sensitivePatterns.some(pattern => 
            pattern.test(key) || pattern.test(fullPath)
          );

          if (isSensitive) {
            const encrypted = await this.encrypt(value, 'sensitive', tenantId);
            obj[key] = {
              __encrypted: true,
              ...encrypted
            };
          }
        }
      }
    };

    await encryptSensitive(result, '');
    return result;
  }

  /**
   * Decrypt sensitive configuration
   */
  async decryptConfiguration(
    config: any,
    tenantId?: string
  ): Promise<any> {
    const result = JSON.parse(JSON.stringify(config));

    const decryptSensitive = async (obj: any) => {
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'object' && value !== null) {
          if (value.__encrypted) {
            const decrypted = await this.decrypt(value, tenantId);
            obj[key] = decrypted.toString('utf8');
          } else {
            await decryptSensitive(value);
          }
        }
      }
    };

    await decryptSensitive(result);
    return result;
  }

  /**
   * Sign data for integrity verification
   */
  async sign(data: string | Buffer): Promise<string> {
    try {
      const key = await this.getCurrentSigningKey();
      const sign = crypto.createSign('SHA256');
      sign.update(data);
      sign.end();
      
      const signature = sign.sign(key, 'base64');
      
      return signature;
    } catch (error) {
      this.logger.error('Signing failed', error);
      throw error;
    }
  }

  /**
   * Verify signature
   */
  async verify(data: string | Buffer, signature: string): Promise<boolean> {
    try {
      const key = await this.getCurrentVerificationKey();
      const verify = crypto.createVerify('SHA256');
      verify.update(data);
      verify.end();
      
      return verify.verify(key, signature, 'base64');
    } catch (error) {
      this.logger.error('Signature verification failed', error);
      return false;
    }
  }

  /**
   * Generate secure hash
   */
  hash(data: string | Buffer, algorithm: string = 'sha256'): string {
    return crypto
      .createHash(algorithm)
      .update(data)
      .digest('hex');
  }

  /**
   * Compare hashes securely (timing-safe)
   */
  compareHashes(hash1: string, hash2: string): boolean {
    const buffer1 = Buffer.from(hash1);
    const buffer2 = Buffer.from(hash2);
    
    if (buffer1.length !== buffer2.length) {
      return false;
    }
    
    return crypto.timingSafeEqual(buffer1, buffer2);
  }

  /**
   * Private encryption methods
   */
  private async encryptAESGCM(
    plaintext: Buffer,
    dek: DataEncryptionKey
  ): Promise<EncryptedData> {
    const iv = crypto.randomBytes(16);
    const key = await this.decryptKeyWithMaster(Buffer.from(dek.encryptedKey, 'base64'));
    
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();

    return {
      ciphertext: encrypted.toString('base64'),
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
      keyId: dek.id,
      algorithm: 'AES-256-GCM',
      timestamp: Date.now()
    };
  }

  private async decryptAESGCM(
    encryptedData: EncryptedData,
    dek: DataEncryptionKey
  ): Promise<Buffer> {
    const key = await this.decryptKeyWithMaster(Buffer.from(dek.encryptedKey, 'base64'));
    const iv = Buffer.from(encryptedData.iv, 'base64');
    const tag = Buffer.from(encryptedData.tag, 'base64');
    const ciphertext = Buffer.from(encryptedData.ciphertext, 'base64');

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  }

  private async encryptAESCBC(
    plaintext: Buffer,
    dek: DataEncryptionKey
  ): Promise<EncryptedData> {
    const iv = crypto.randomBytes(16);
    const key = await this.decryptKeyWithMaster(Buffer.from(dek.encryptedKey, 'base64'));
    
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);

    // HMAC for authentication
    const hmac = crypto.createHmac('sha256', key);
    hmac.update(encrypted);
    hmac.update(iv);
    const tag = hmac.digest();

    return {
      ciphertext: encrypted.toString('base64'),
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
      keyId: dek.id,
      algorithm: 'AES-256-CBC',
      timestamp: Date.now()
    };
  }

  private async decryptAESCBC(
    encryptedData: EncryptedData,
    dek: DataEncryptionKey
  ): Promise<Buffer> {
    const key = await this.decryptKeyWithMaster(Buffer.from(dek.encryptedKey, 'base64'));
    const iv = Buffer.from(encryptedData.iv, 'base64');
    const ciphertext = Buffer.from(encryptedData.ciphertext, 'base64');
    const tag = Buffer.from(encryptedData.tag, 'base64');

    // Verify HMAC
    const hmac = crypto.createHmac('sha256', key);
    hmac.update(ciphertext);
    hmac.update(iv);
    const computedTag = hmac.digest();

    if (!crypto.timingSafeEqual(tag, computedTag)) {
      throw new Error('Authentication tag verification failed');
    }

    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  }

  private async encryptChaCha20(
    plaintext: Buffer,
    dek: DataEncryptionKey
  ): Promise<EncryptedData> {
    // ChaCha20-Poly1305 implementation
    // Note: Requires Node.js 11.2.0+ or external library
    const nonce = crypto.randomBytes(12);
    const key = await this.decryptKeyWithMaster(Buffer.from(dek.encryptedKey, 'base64'));
    
    const cipher = crypto.createCipheriv('chacha20-poly1305', key, nonce, {
      authTagLength: 16
    });
    
    const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();

    return {
      ciphertext: encrypted.toString('base64'),
      iv: nonce.toString('base64'),
      tag: tag.toString('base64'),
      keyId: dek.id,
      algorithm: 'ChaCha20-Poly1305',
      timestamp: Date.now()
    };
  }

  private async decryptChaCha20(
    encryptedData: EncryptedData,
    dek: DataEncryptionKey
  ): Promise<Buffer> {
    const key = await this.decryptKeyWithMaster(Buffer.from(dek.encryptedKey, 'base64'));
    const nonce = Buffer.from(encryptedData.iv, 'base64');
    const tag = Buffer.from(encryptedData.tag, 'base64');
    const ciphertext = Buffer.from(encryptedData.ciphertext, 'base64');

    const decipher = crypto.createDecipheriv('chacha20-poly1305', key, nonce, {
      authTagLength: 16
    });
    decipher.setAuthTag(tag);
    
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  }

  /**
   * Key management methods
   */
  private async initializeMasterKey(): Promise<void> {
    // In production, this would retrieve from HSM or secure key store
    const masterKeyId = uuidv4();
    const masterKey = crypto.randomBytes(32);

    this.masterKeys.set(masterKeyId, {
      id: masterKeyId,
      key: masterKey,
      createdAt: new Date(),
      status: 'active'
    });

    this.activeMasterKeyId = masterKeyId;
  }

  private async encryptKeyWithMaster(key: Buffer): Promise<Buffer> {
    const masterKey = this.masterKeys.get(this.activeMasterKeyId);
    if (!masterKey) {
      throw new Error('Master key not found');
    }

    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', masterKey.key, iv);
    const encrypted = Buffer.concat([cipher.update(key), cipher.final()]);
    const tag = cipher.getAuthTag();

    // Combine IV, tag, and ciphertext
    return Buffer.concat([iv, tag, encrypted]);
  }

  private async decryptKeyWithMaster(encryptedKey: Buffer): Promise<Buffer> {
    // Try active master key first
    let masterKey = this.masterKeys.get(this.activeMasterKeyId);
    
    if (!masterKey) {
      throw new Error('Master key not found');
    }

    // Extract IV, tag, and ciphertext
    const iv = encryptedKey.slice(0, 16);
    const tag = encryptedKey.slice(16, 32);
    const ciphertext = encryptedKey.slice(32);

    try {
      const decipher = crypto.createDecipheriv('aes-256-gcm', masterKey.key, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    } catch (error) {
      // Try other master keys if decryption fails
      for (const [id, key] of this.masterKeys.entries()) {
        if (id !== this.activeMasterKeyId) {
          try {
            const decipher = crypto.createDecipheriv('aes-256-gcm', key.key, iv);
            decipher.setAuthTag(tag);
            return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
          } catch {
            // Continue to next key
          }
        }
      }
      throw error;
    }
  }

  private async rotateMasterKey(): Promise<void> {
    const newMasterKeyId = uuidv4();
    const newMasterKey = crypto.randomBytes(32);

    // Mark current key as rotating
    const currentMasterKey = this.masterKeys.get(this.activeMasterKeyId);
    if (currentMasterKey) {
      currentMasterKey.status = 'rotating';
    }

    // Add new master key
    this.masterKeys.set(newMasterKeyId, {
      id: newMasterKeyId,
      key: newMasterKey,
      createdAt: new Date(),
      status: 'active'
    });

    // Re-encrypt all DEKs with new master key
    for (const [id, dek] of this.dataEncryptionKeys.entries()) {
      const decryptedKey = await this.decryptKeyWithMaster(
        Buffer.from(dek.encryptedKey, 'base64')
      );
      
      this.activeMasterKeyId = newMasterKeyId;
      const reencryptedKey = await this.encryptKeyWithMaster(decryptedKey);
      dek.encryptedKey = reencryptedKey.toString('base64');
    }

    // Update active master key
    this.activeMasterKeyId = newMasterKeyId;

    // Mark old key as retired
    if (currentMasterKey) {
      currentMasterKey.status = 'retired';
      currentMasterKey.rotatedAt = new Date();
    }
  }

  private async rotateDataEncryptionKey(
    oldKey: DataEncryptionKey,
    tenantId?: string
  ): Promise<void> {
    // Generate new key
    const newKeyId = await this.generateKey('rotation', tenantId, oldKey.expiresAt);

    // Mark old key as rotating
    oldKey.status = 'rotating';
    oldKey.rotatedAt = new Date();

    // Update key status after grace period
    setTimeout(() => {
      oldKey.status = 'expired';
    }, 24 * 60 * 60 * 1000); // 24 hours
  }

  private async getDataEncryptionKey(
    tenantId?: string,
    classification?: string
  ): Promise<DataEncryptionKey> {
    let keys: Map<string, DataEncryptionKey>;
    
    if (tenantId) {
      keys = this.tenantKeys.get(tenantId) || new Map();
      if (keys.size === 0) {
        await this.createTenantKeys(tenantId);
        keys = this.tenantKeys.get(tenantId)!;
      }
    } else {
      keys = this.dataEncryptionKeys;
    }

    // Find active key for classification
    for (const key of keys.values()) {
      if (key.status === 'active') {
        return key;
      }
    }

    // No active key found, generate new one
    const newKeyId = await this.generateKey(classification || 'data', tenantId);
    return keys.get(newKeyId)!;
  }

  private async getDecryptionKey(
    keyId: string,
    tenantId?: string
  ): Promise<DataEncryptionKey> {
    let key: DataEncryptionKey | undefined;

    if (tenantId) {
      key = this.tenantKeys.get(tenantId)?.get(keyId);
    }
    
    if (!key) {
      key = this.dataEncryptionKeys.get(keyId);
    }

    if (!key) {
      throw new Error(`Decryption key not found: ${keyId}`);
    }

    if (key.status === 'revoked') {
      throw new Error(`Key has been revoked: ${keyId}`);
    }

    if (key.expiresAt && key.expiresAt < new Date()) {
      throw new Error(`Key has expired: ${keyId}`);
    }

    return key;
  }

  private getClassificationLevel(level: string): ClassificationLevel {
    const classificationLevel = this.config.dataClassification.levels.find(
      l => l.id === level
    );

    if (!classificationLevel) {
      throw new Error(`Unknown classification level: ${level}`);
    }

    return classificationLevel;
  }

  private initializeFieldEncryption(): void {
    // Convert classification rules to field encryption configs
    this.config.dataClassification.rules.forEach(rule => {
      this.fieldEncryptionConfigs.push({
        pattern: rule.pattern,
        classification: rule.level
      });
    });
  }

  private async encryptFields(
    obj: any,
    path: string,
    classification?: string,
    tenantId?: string
  ): Promise<void> {
    for (const [key, value] of Object.entries(obj)) {
      const fullPath = path ? `${path}.${key}` : key;

      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        await this.encryptFields(value, fullPath, classification, tenantId);
      } else if (typeof value === 'string' || Buffer.isBuffer(value)) {
        // Check if field should be encrypted
        const fieldConfig = this.fieldEncryptionConfigs.find(config =>
          config.pattern.test(fullPath) || config.pattern.test(key)
        );

        if (fieldConfig) {
          const encrypted = await this.encrypt(
            value,
            fieldConfig.classification || classification,
            tenantId
          );
          obj[key] = {
            __encrypted: true,
            ...encrypted
          };
        }
      }
    }
  }

  private async decryptFields(obj: any, tenantId?: string): Promise<void> {
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'object' && value !== null) {
        if (value.__encrypted) {
          const decrypted = await this.decrypt(value, tenantId);
          obj[key] = decrypted.toString('utf8');
        } else if (!Array.isArray(value)) {
          await this.decryptFields(value, tenantId);
        }
      }
    }
  }

  private startKeyRotationScheduler(): void {
    this.keyRotationTimer = setInterval(async () => {
      try {
        // Check for keys that need rotation
        const now = new Date();
        const rotationThreshold = new Date(
          now.getTime() - this.config.keyRotationInterval * 24 * 60 * 60 * 1000
        );

        // Rotate system keys
        for (const key of this.dataEncryptionKeys.values()) {
          if (key.status === 'active' && key.createdAt < rotationThreshold) {
            await this.rotateDataEncryptionKey(key);
          }
        }

        // Rotate tenant keys
        for (const [tenantId, keys] of this.tenantKeys.entries()) {
          for (const key of keys.values()) {
            if (key.status === 'active' && key.createdAt < rotationThreshold) {
              await this.rotateDataEncryptionKey(key, tenantId);
            }
          }
        }
      } catch (error) {
        this.logger.error('Key rotation scheduler error', error);
      }
    }, 24 * 60 * 60 * 1000); // Run daily
  }

  private async initializeHSM(): Promise<void> {
    // TODO: Initialize HSM connection
    this.logger.info('HSM initialization placeholder');
  }

  private async getCurrentSigningKey(): Promise<any> {
    // TODO: Implement signing key retrieval
    return crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    }).privateKey;
  }

  private async getCurrentVerificationKey(): Promise<any> {
    // TODO: Implement verification key retrieval
    return crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      }
    }).publicKey;
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.keyRotationTimer) {
      clearInterval(this.keyRotationTimer);
    }
    
    // Clear sensitive data
    this.masterKeys.clear();
    this.dataEncryptionKeys.clear();
    this.tenantKeys.clear();
  }
}