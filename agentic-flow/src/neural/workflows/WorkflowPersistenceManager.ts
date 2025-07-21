import * as fs from 'fs/promises';
import * as path from 'path';
import sqlite3 from 'sqlite3';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../utils/logger';

/**
 * Workflow Persistence Manager with SQLite backend
 * Handles state management, checkpointing, and recovery for neural workflow engines
 */
export class WorkflowPersistenceManager extends EventEmitter {
  private db: sqlite3.Database | null = null;
  private readonly config: PersistenceConfig;
  private transactionQueue: Promise<any> = Promise.resolve();

  constructor(config?: Partial<PersistenceConfig>) {
    super();
    this.config = {
      dbPath: './workflow_state.db',
      enableWAL: true,
      enableBackups: true,
      backupInterval: 3600000, // 1 hour
      maxBackups: 24,
      compressionLevel: 6,
      enableEncryption: false,
      encryptionKey: '',
      enableMetrics: true,
      checkpointInterval: 300000, // 5 minutes
      enableVersioning: true,
      maxVersions: 10,
      enableCaching: true,
      cacheSize: 1000,
      ...config
    };

    this.setupBackupSchedule();
  }

  /**
   * Initialize the persistence manager
   */
  public async initialize(): Promise<void> {
    try {
      logger.info('Initializing Workflow Persistence Manager...');
      
      // Ensure database directory exists
      const dbDir = path.dirname(this.config.dbPath);
      await fs.mkdir(dbDir, { recursive: true });

      // Open database connection
      await this.openDatabase();
      
      // Initialize database schema
      await this.initializeSchema();
      
      // Enable WAL mode if configured
      if (this.config.enableWAL) {
        await this.enableWALMode();
      }

      logger.info('Workflow Persistence Manager initialized successfully');
      this.emit('persistence:initialized');

    } catch (error) {
      logger.error('Error initializing persistence manager:', error);
      throw error;
    }
  }

  /**
   * Save workflow execution state
   */
  public async saveWorkflowState(
    workflowId: string,
    executionId: string,
    state: WorkflowState
  ): Promise<void> {
    return this.enqueueTransaction(async () => {
      try {
        const stateId = uuidv4();
        const serializedState = this.serializeState(state);
        
        await this.runQuery(
          `INSERT INTO workflow_states (
            id, workflow_id, execution_id, state_data, version, 
            created_at, metadata, checksum
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            stateId,
            workflowId,
            executionId,
            serializedState.data,
            state.version || 1,
            Date.now(),
            JSON.stringify(state.metadata || {}),
            serializedState.checksum
          ]
        );

        // Update latest state reference
        await this.updateLatestState(workflowId, executionId, stateId);

        logger.debug(`Workflow state saved: ${workflowId}/${executionId}`);
        this.emit('state:saved', { workflowId, executionId, stateId });

      } catch (error) {
        logger.error('Error saving workflow state:', error);
        throw error;
      }
    });
  }

  /**
   * Load workflow execution state
   */
  public async loadWorkflowState(
    workflowId: string,
    executionId: string,
    version?: number
  ): Promise<WorkflowState | null> {
    try {
      let query: string;
      let params: any[];

      if (version) {
        query = `
          SELECT state_data, version, created_at, metadata, checksum
          FROM workflow_states 
          WHERE workflow_id = ? AND execution_id = ? AND version = ?
          ORDER BY created_at DESC LIMIT 1
        `;
        params = [workflowId, executionId, version];
      } else {
        query = `
          SELECT ws.state_data, ws.version, ws.created_at, ws.metadata, ws.checksum
          FROM workflow_states ws
          JOIN latest_states ls ON ws.id = ls.state_id
          WHERE ls.workflow_id = ? AND ls.execution_id = ?
        `;
        params = [workflowId, executionId];
      }

      const row = await this.getRow(query, params);
      
      if (!row) {
        return null;
      }

      const state = this.deserializeState(row.state_data, row.checksum);
      
      return {
        ...state,
        version: row.version,
        timestamp: row.created_at,
        metadata: JSON.parse(row.metadata || '{}')
      };

    } catch (error) {
      logger.error('Error loading workflow state:', error);
      throw error;
    }
  }

  /**
   * Save workflow checkpoint
   */
  public async saveCheckpoint(
    workflowId: string,
    executionId: string,
    checkpoint: WorkflowCheckpoint
  ): Promise<string> {
    return this.enqueueTransaction(async () => {
      try {
        const checkpointId = uuidv4();
        const serializedData = this.serializeCheckpoint(checkpoint);
        
        await this.runQuery(
          `INSERT INTO workflow_checkpoints (
            id, workflow_id, execution_id, checkpoint_data, step, 
            created_at, metadata, size, checksum
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            checkpointId,
            workflowId,
            executionId,
            serializedData.data,
            checkpoint.step || 0,
            Date.now(),
            JSON.stringify(checkpoint.metadata || {}),
            serializedData.size,
            serializedData.checksum
          ]
        );

        // Cleanup old checkpoints if versioning is enabled
        if (this.config.enableVersioning) {
          await this.cleanupOldCheckpoints(workflowId, executionId);
        }

        logger.debug(`Checkpoint saved: ${workflowId}/${executionId}/${checkpointId}`);
        this.emit('checkpoint:saved', { workflowId, executionId, checkpointId });

        return checkpointId;

      } catch (error) {
        logger.error('Error saving checkpoint:', error);
        throw error;
      }
    });
  }

  /**
   * Load workflow checkpoint
   */
  public async loadCheckpoint(
    workflowId: string,
    executionId: string,
    checkpointId?: string
  ): Promise<WorkflowCheckpoint | null> {
    try {
      let query: string;
      let params: any[];

      if (checkpointId) {
        query = `
          SELECT checkpoint_data, step, created_at, metadata, checksum
          FROM workflow_checkpoints 
          WHERE id = ?
        `;
        params = [checkpointId];
      } else {
        query = `
          SELECT checkpoint_data, step, created_at, metadata, checksum
          FROM workflow_checkpoints 
          WHERE workflow_id = ? AND execution_id = ?
          ORDER BY created_at DESC LIMIT 1
        `;
        params = [workflowId, executionId];
      }

      const row = await this.getRow(query, params);
      
      if (!row) {
        return null;
      }

      const checkpoint = this.deserializeCheckpoint(row.checkpoint_data, row.checksum);
      
      return {
        ...checkpoint,
        step: row.step,
        timestamp: row.created_at,
        metadata: JSON.parse(row.metadata || '{}')
      };

    } catch (error) {
      logger.error('Error loading checkpoint:', error);
      throw error;
    }
  }

  /**
   * Save workflow execution record
   */
  public async saveExecution(execution: WorkflowExecution): Promise<void> {
    return this.enqueueTransaction(async () => {
      try {
        await this.runQuery(
          `INSERT OR REPLACE INTO workflow_executions (
            id, workflow_id, status, started_at, completed_at, 
            duration, context, result, error, metadata
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            execution.id,
            execution.workflowId,
            execution.status,
            execution.startedAt,
            execution.completedAt || null,
            execution.duration || null,
            JSON.stringify(execution.context || {}),
            JSON.stringify(execution.result || null),
            execution.error || null,
            JSON.stringify(execution.metadata || {})
          ]
        );

        logger.debug(`Execution saved: ${execution.id}`);
        this.emit('execution:saved', { executionId: execution.id });

      } catch (error) {
        logger.error('Error saving execution:', error);
        throw error;
      }
    });
  }

  /**
   * Load workflow execution record
   */
  public async loadExecution(executionId: string): Promise<WorkflowExecution | null> {
    try {
      const row = await this.getRow(
        `SELECT * FROM workflow_executions WHERE id = ?`,
        [executionId]
      );
      
      if (!row) {
        return null;
      }

      return {
        id: row.id,
        workflowId: row.workflow_id,
        status: row.status,
        startedAt: row.started_at,
        completedAt: row.completed_at,
        duration: row.duration,
        context: JSON.parse(row.context || '{}'),
        result: JSON.parse(row.result || 'null'),
        error: row.error,
        metadata: JSON.parse(row.metadata || '{}')
      };

    } catch (error) {
      logger.error('Error loading execution:', error);
      throw error;
    }
  }

  /**
   * Query executions with filters
   */
  public async queryExecutions(filters: ExecutionFilters): Promise<WorkflowExecution[]> {
    try {
      let query = 'SELECT * FROM workflow_executions WHERE 1=1';
      const params: any[] = [];

      if (filters.workflowId) {
        query += ' AND workflow_id = ?';
        params.push(filters.workflowId);
      }

      if (filters.status) {
        query += ' AND status = ?';
        params.push(filters.status);
      }

      if (filters.startDateFrom) {
        query += ' AND started_at >= ?';
        params.push(filters.startDateFrom);
      }

      if (filters.startDateTo) {
        query += ' AND started_at <= ?';
        params.push(filters.startDateTo);
      }

      query += ' ORDER BY started_at DESC';

      if (filters.limit) {
        query += ' LIMIT ?';
        params.push(filters.limit);
      }

      const rows = await this.getAllRows(query, params);
      
      return rows.map(row => ({
        id: row.id,
        workflowId: row.workflow_id,
        status: row.status,
        startedAt: row.started_at,
        completedAt: row.completed_at,
        duration: row.duration,
        context: JSON.parse(row.context || '{}'),
        result: JSON.parse(row.result || 'null'),
        error: row.error,
        metadata: JSON.parse(row.metadata || '{}')
      }));

    } catch (error) {
      logger.error('Error querying executions:', error);
      throw error;
    }
  }

  /**
   * Save workflow definition
   */
  public async saveWorkflowDefinition(definition: WorkflowDefinition): Promise<void> {
    return this.enqueueTransaction(async () => {
      try {
        await this.runQuery(
          `INSERT OR REPLACE INTO workflow_definitions (
            id, name, version, definition_data, created_at, 
            updated_at, metadata, checksum
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            definition.id,
            definition.name,
            definition.version,
            JSON.stringify(definition.definition),
            definition.createdAt || Date.now(),
            Date.now(),
            JSON.stringify(definition.metadata || {}),
            this.calculateChecksum(JSON.stringify(definition.definition))
          ]
        );

        logger.debug(`Workflow definition saved: ${definition.id}`);
        this.emit('definition:saved', { workflowId: definition.id });

      } catch (error) {
        logger.error('Error saving workflow definition:', error);
        throw error;
      }
    });
  }

  /**
   * Load workflow definition
   */
  public async loadWorkflowDefinition(workflowId: string, version?: string): Promise<WorkflowDefinition | null> {
    try {
      let query: string;
      let params: any[];

      if (version) {
        query = 'SELECT * FROM workflow_definitions WHERE id = ? AND version = ?';
        params = [workflowId, version];
      } else {
        query = 'SELECT * FROM workflow_definitions WHERE id = ? ORDER BY updated_at DESC LIMIT 1';
        params = [workflowId];
      }

      const row = await this.getRow(query, params);
      
      if (!row) {
        return null;
      }

      return {
        id: row.id,
        name: row.name,
        version: row.version,
        definition: JSON.parse(row.definition_data),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        metadata: JSON.parse(row.metadata || '{}')
      };

    } catch (error) {
      logger.error('Error loading workflow definition:', error);
      throw error;
    }
  }

  /**
   * Create database backup
   */
  public async createBackup(): Promise<string> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = `${this.config.dbPath}.backup.${timestamp}`;
      
      await fs.copyFile(this.config.dbPath, backupPath);
      
      // Compress backup if enabled
      if (this.config.compressionLevel > 0) {
        const compressedPath = await this.compressBackup(backupPath);
        await fs.unlink(backupPath); // Remove uncompressed backup
        return compressedPath;
      }

      logger.info(`Database backup created: ${backupPath}`);
      this.emit('backup:created', { backupPath });

      return backupPath;

    } catch (error) {
      logger.error('Error creating backup:', error);
      throw error;
    }
  }

  /**
   * Restore from backup
   */
  public async restoreFromBackup(backupPath: string): Promise<void> {
    try {
      // Close current database connection
      if (this.db) {
        await this.closeDatabase();
      }

      // Decompress backup if needed
      let restorePath = backupPath;
      if (backupPath.endsWith('.gz')) {
        restorePath = await this.decompressBackup(backupPath);
      }

      // Restore database file
      await fs.copyFile(restorePath, this.config.dbPath);

      // Reopen database connection
      await this.openDatabase();

      logger.info(`Database restored from backup: ${backupPath}`);
      this.emit('backup:restored', { backupPath });

    } catch (error) {
      logger.error('Error restoring from backup:', error);
      throw error;
    }
  }

  /**
   * Get database metrics
   */
  public async getMetrics(): Promise<PersistenceMetrics> {
    try {
      const [
        stateCount,
        checkpointCount,
        executionCount,
        definitionCount
      ] = await Promise.all([
        this.getCount('workflow_states'),
        this.getCount('workflow_checkpoints'),
        this.getCount('workflow_executions'),
        this.getCount('workflow_definitions')
      ]);

      const dbStats = await this.getDatabaseStats();

      return {
        totalStates: stateCount,
        totalCheckpoints: checkpointCount,
        totalExecutions: executionCount,
        totalDefinitions: definitionCount,
        databaseSize: dbStats.size,
        diskUsage: dbStats.diskUsage,
        indexSize: dbStats.indexSize,
        cacheHitRatio: dbStats.cacheHitRatio
      };

    } catch (error) {
      logger.error('Error getting metrics:', error);
      throw error;
    }
  }

  /**
   * Cleanup old data
   */
  public async cleanup(options: CleanupOptions): Promise<CleanupResult> {
    return this.enqueueTransaction(async () => {
      try {
        const result: CleanupResult = {
          deletedStates: 0,
          deletedCheckpoints: 0,
          deletedExecutions: 0,
          freedSpace: 0
        };

        const cutoffTime = Date.now() - (options.retentionDays * 24 * 60 * 60 * 1000);

        // Cleanup old states
        if (options.cleanupStates) {
          const deletedStates = await this.runQuery(
            'DELETE FROM workflow_states WHERE created_at < ?',
            [cutoffTime]
          );
          result.deletedStates = deletedStates.changes || 0;
        }

        // Cleanup old checkpoints
        if (options.cleanupCheckpoints) {
          const deletedCheckpoints = await this.runQuery(
            'DELETE FROM workflow_checkpoints WHERE created_at < ?',
            [cutoffTime]
          );
          result.deletedCheckpoints = deletedCheckpoints.changes || 0;
        }

        // Cleanup old executions
        if (options.cleanupExecutions) {
          const deletedExecutions = await this.runQuery(
            'DELETE FROM workflow_executions WHERE started_at < ?',
            [cutoffTime]
          );
          result.deletedExecutions = deletedExecutions.changes || 0;
        }

        // Vacuum database to reclaim space
        await this.runQuery('VACUUM');

        logger.info('Database cleanup completed', result);
        this.emit('cleanup:completed', result);

        return result;

      } catch (error) {
        logger.error('Error during cleanup:', error);
        throw error;
      }
    });
  }

  /**
   * Private helper methods
   */
  private async openDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.config.dbPath, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  private async closeDatabase(): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      this.db!.close((err) => {
        if (err) {
          reject(err);
        } else {
          this.db = null;
          resolve();
        }
      });
    });
  }

  private async initializeSchema(): Promise<void> {
    const schema = `
      -- Workflow states table
      CREATE TABLE IF NOT EXISTS workflow_states (
        id TEXT PRIMARY KEY,
        workflow_id TEXT NOT NULL,
        execution_id TEXT NOT NULL,
        state_data BLOB NOT NULL,
        version INTEGER DEFAULT 1,
        created_at INTEGER NOT NULL,
        metadata TEXT,
        checksum TEXT NOT NULL,
        INDEX idx_workflow_execution (workflow_id, execution_id),
        INDEX idx_created_at (created_at)
      );

      -- Latest states reference table
      CREATE TABLE IF NOT EXISTS latest_states (
        workflow_id TEXT NOT NULL,
        execution_id TEXT NOT NULL,
        state_id TEXT NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (workflow_id, execution_id),
        FOREIGN KEY (state_id) REFERENCES workflow_states(id)
      );

      -- Workflow checkpoints table
      CREATE TABLE IF NOT EXISTS workflow_checkpoints (
        id TEXT PRIMARY KEY,
        workflow_id TEXT NOT NULL,
        execution_id TEXT NOT NULL,
        checkpoint_data BLOB NOT NULL,
        step INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL,
        metadata TEXT,
        size INTEGER DEFAULT 0,
        checksum TEXT NOT NULL,
        INDEX idx_workflow_execution_checkpoint (workflow_id, execution_id),
        INDEX idx_created_at_checkpoint (created_at)
      );

      -- Workflow executions table
      CREATE TABLE IF NOT EXISTS workflow_executions (
        id TEXT PRIMARY KEY,
        workflow_id TEXT NOT NULL,
        status TEXT NOT NULL,
        started_at INTEGER NOT NULL,
        completed_at INTEGER,
        duration INTEGER,
        context TEXT,
        result TEXT,
        error TEXT,
        metadata TEXT,
        INDEX idx_workflow_id (workflow_id),
        INDEX idx_status (status),
        INDEX idx_started_at (started_at)
      );

      -- Workflow definitions table
      CREATE TABLE IF NOT EXISTS workflow_definitions (
        id TEXT NOT NULL,
        name TEXT NOT NULL,
        version TEXT NOT NULL,
        definition_data TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        metadata TEXT,
        checksum TEXT NOT NULL,
        PRIMARY KEY (id, version),
        INDEX idx_name (name),
        INDEX idx_updated_at (updated_at)
      );

      -- Persistence metrics table
      CREATE TABLE IF NOT EXISTS persistence_metrics (
        id TEXT PRIMARY KEY,
        metric_name TEXT NOT NULL,
        metric_value REAL NOT NULL,
        recorded_at INTEGER NOT NULL,
        metadata TEXT,
        INDEX idx_metric_name (metric_name),
        INDEX idx_recorded_at (recorded_at)
      );
    `;

    const statements = schema.split(';').filter(stmt => stmt.trim());
    
    for (const statement of statements) {
      if (statement.trim()) {
        await this.runQuery(statement);
      }
    }
  }

  private async enableWALMode(): Promise<void> {
    await this.runQuery('PRAGMA journal_mode=WAL');
    await this.runQuery('PRAGMA synchronous=NORMAL');
    await this.runQuery('PRAGMA cache_size=10000');
    await this.runQuery('PRAGMA temp_store=memory');
    await this.runQuery('PRAGMA mmap_size=268435456'); // 256MB
  }

  private enqueueTransaction<T>(operation: () => Promise<T>): Promise<T> {
    this.transactionQueue = this.transactionQueue.then(async () => {
      try {
        await this.runQuery('BEGIN TRANSACTION');
        const result = await operation();
        await this.runQuery('COMMIT');
        return result;
      } catch (error) {
        await this.runQuery('ROLLBACK');
        throw error;
      }
    });

    return this.transactionQueue;
  }

  private async runQuery(sql: string, params: any[] = []): Promise<any> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    return new Promise((resolve, reject) => {
      this.db!.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this);
        }
      });
    });
  }

  private async getRow(sql: string, params: any[] = []): Promise<any> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    return new Promise((resolve, reject) => {
      this.db!.get(sql, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  private async getAllRows(sql: string, params: any[] = []): Promise<any[]> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    return new Promise((resolve, reject) => {
      this.db!.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  private serializeState(state: WorkflowState): SerializedData {
    const json = JSON.stringify(state);
    const buffer = Buffer.from(json, 'utf8');
    
    return {
      data: buffer,
      size: buffer.length,
      checksum: this.calculateChecksum(json)
    };
  }

  private deserializeState(data: Buffer, expectedChecksum: string): WorkflowState {
    const json = data.toString('utf8');
    const actualChecksum = this.calculateChecksum(json);
    
    if (actualChecksum !== expectedChecksum) {
      throw new Error('State checksum mismatch - data may be corrupted');
    }
    
    return JSON.parse(json);
  }

  private serializeCheckpoint(checkpoint: WorkflowCheckpoint): SerializedData {
    const json = JSON.stringify(checkpoint);
    const buffer = Buffer.from(json, 'utf8');
    
    return {
      data: buffer,
      size: buffer.length,
      checksum: this.calculateChecksum(json)
    };
  }

  private deserializeCheckpoint(data: Buffer, expectedChecksum: string): WorkflowCheckpoint {
    const json = data.toString('utf8');
    const actualChecksum = this.calculateChecksum(json);
    
    if (actualChecksum !== expectedChecksum) {
      throw new Error('Checkpoint checksum mismatch - data may be corrupted');
    }
    
    return JSON.parse(json);
  }

  private calculateChecksum(data: string): string {
    // Simple checksum - in production use crypto.createHash
    return Buffer.from(data).toString('base64').slice(0, 16);
  }

  private async updateLatestState(workflowId: string, executionId: string, stateId: string): Promise<void> {
    await this.runQuery(
      `INSERT OR REPLACE INTO latest_states (workflow_id, execution_id, state_id, updated_at)
       VALUES (?, ?, ?, ?)`,
      [workflowId, executionId, stateId, Date.now()]
    );
  }

  private async cleanupOldCheckpoints(workflowId: string, executionId: string): Promise<void> {
    const maxVersions = this.config.maxVersions;
    
    await this.runQuery(
      `DELETE FROM workflow_checkpoints 
       WHERE workflow_id = ? AND execution_id = ? 
       AND id NOT IN (
         SELECT id FROM workflow_checkpoints 
         WHERE workflow_id = ? AND execution_id = ?
         ORDER BY created_at DESC LIMIT ?
       )`,
      [workflowId, executionId, workflowId, executionId, maxVersions]
    );
  }

  private async getCount(tableName: string): Promise<number> {
    const row = await this.getRow(`SELECT COUNT(*) as count FROM ${tableName}`);
    return row.count;
  }

  private async getDatabaseStats(): Promise<DatabaseStats> {
    const [sizeRow, cacheRow] = await Promise.all([
      this.getRow('PRAGMA page_count'),
      this.getRow('PRAGMA cache_size')
    ]);

    return {
      size: sizeRow.page_count * 4096, // Assuming 4KB pages
      diskUsage: sizeRow.page_count * 4096,
      indexSize: 0, // Simplified
      cacheHitRatio: 0.95 // Simplified
    };
  }

  private async compressBackup(backupPath: string): Promise<string> {
    // Simplified compression - in practice use zlib or similar
    const compressedPath = `${backupPath}.gz`;
    await fs.copyFile(backupPath, compressedPath);
    return compressedPath;
  }

  private async decompressBackup(compressedPath: string): Promise<string> {
    // Simplified decompression
    const decompressedPath = compressedPath.replace('.gz', '');
    await fs.copyFile(compressedPath, decompressedPath);
    return decompressedPath;
  }

  private setupBackupSchedule(): void {
    if (this.config.enableBackups && this.config.backupInterval > 0) {
      setInterval(async () => {
        try {
          await this.createBackup();
          await this.cleanupOldBackups();
        } catch (error) {
          logger.error('Scheduled backup failed:', error);
        }
      }, this.config.backupInterval);
    }
  }

  private async cleanupOldBackups(): Promise<void> {
    try {
      const backupDir = path.dirname(this.config.dbPath);
      const files = await fs.readdir(backupDir);
      
      const backupFiles = files
        .filter(file => file.includes('.backup.'))
        .map(file => ({
          name: file,
          path: path.join(backupDir, file),
          stat: null as any
        }));

      // Get file stats
      for (const backup of backupFiles) {
        backup.stat = await fs.stat(backup.path);
      }

      // Sort by creation time, newest first
      backupFiles.sort((a, b) => b.stat.ctime.getTime() - a.stat.ctime.getTime());

      // Remove old backups
      const backupsToDelete = backupFiles.slice(this.config.maxBackups);
      for (const backup of backupsToDelete) {
        await fs.unlink(backup.path);
        logger.debug(`Deleted old backup: ${backup.name}`);
      }

    } catch (error) {
      logger.error('Error cleaning up old backups:', error);
    }
  }

  /**
   * Public API methods
   */
  public async dispose(): Promise<void> {
    try {
      if (this.db) {
        await this.closeDatabase();
      }
      
      this.removeAllListeners();
      logger.info('Workflow Persistence Manager disposed');

    } catch (error) {
      logger.error('Error disposing persistence manager:', error);
      throw error;
    }
  }
}

// Type definitions
export interface PersistenceConfig {
  dbPath: string;
  enableWAL: boolean;
  enableBackups: boolean;
  backupInterval: number;
  maxBackups: number;
  compressionLevel: number;
  enableEncryption: boolean;
  encryptionKey: string;
  enableMetrics: boolean;
  checkpointInterval: number;
  enableVersioning: boolean;
  maxVersions: number;
  enableCaching: boolean;
  cacheSize: number;
}

export interface WorkflowState {
  executionContext: any;
  currentStep: string;
  stepData: any;
  variables: any;
  version?: number;
  timestamp?: number;
  metadata?: any;
}

export interface WorkflowCheckpoint {
  executionState: any;
  stepResults: any;
  variables: any;
  step?: number;
  timestamp?: number;
  metadata?: any;
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt: number;
  completedAt?: number;
  duration?: number;
  context?: any;
  result?: any;
  error?: string;
  metadata?: any;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  version: string;
  definition: any;
  createdAt?: number;
  updatedAt?: number;
  metadata?: any;
}

export interface ExecutionFilters {
  workflowId?: string;
  status?: string;
  startDateFrom?: number;
  startDateTo?: number;
  limit?: number;
}

export interface PersistenceMetrics {
  totalStates: number;
  totalCheckpoints: number;
  totalExecutions: number;
  totalDefinitions: number;
  databaseSize: number;
  diskUsage: number;
  indexSize: number;
  cacheHitRatio: number;
}

export interface CleanupOptions {
  retentionDays: number;
  cleanupStates: boolean;
  cleanupCheckpoints: boolean;
  cleanupExecutions: boolean;
}

export interface CleanupResult {
  deletedStates: number;
  deletedCheckpoints: number;
  deletedExecutions: number;
  freedSpace: number;
}

interface SerializedData {
  data: Buffer;
  size: number;
  checksum: string;
}

interface DatabaseStats {
  size: number;
  diskUsage: number;
  indexSize: number;
  cacheHitRatio: number;
}

/**
 * Factory function to create persistence manager
 */
export function createWorkflowPersistenceManager(
  config?: Partial<PersistenceConfig>
): WorkflowPersistenceManager {
  return new WorkflowPersistenceManager(config);
}