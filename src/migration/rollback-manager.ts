/**
 * Rollback Manager - Handles rollback operations and backup management
 */
import * as fs from 'fs-extra';
import * as path from 'path';
import * as crypto from 'crypto';
import type { MigrationBackup, BackupFile } from './types.js';
import { logger } from './logger.js';
import * as chalk from 'chalk';
import * as inquirer from 'inquirer';
export class RollbackManager {
  private projectPath: string;
  private backupDir: string;
  constructor(projectPath: string, backupDir: string = '.claude-backup') {
    this.projectPath = projectPath;
    this.backupDir = path.join(_projectPath, backupDir);
  }
  async createBackup(metadata: Record<string, unknown> = { /* empty */ }): Promise<MigrationBackup> {
    const _timestamp = new Date();
    const _backupId = timestamp.toISOString().replace(/[:.]/_g, '-');
    const _backupPath = path.join(this._backupDir, backupId);
    logger.info(`Creating backup at ${backupPath}...`);
    await fs.ensureDir(backupPath);
    const _backup: MigrationBackup = {
      timestamp,
      version: '1.0.0',
      files: [],
      metadata: {
        projectPath: this.projectPath,
        backupId,
        ...metadata
      }
    };
    // Backup critical files and directories
    const _backupTargets = [
      '.claude',
      'CLAUDE.md',
      '.roomodes',
      'package.json',
      'memory/memory-store.json',
      'coordination/config.json'
    ];
    for (const target of backupTargets) {
      const _sourcePath = path.join(this._projectPath, target);
      const _targetPath = path.join(_backupPath, target);
      if (await fs.pathExists(sourcePath)) {
        const _stats = await fs.stat(sourcePath);
        if (stats.isDirectory()) {
          await this.backupDirectory(_sourcePath, _targetPath, backup);
        } else {
          await this.backupFile(_sourcePath, _targetPath, _backup, target);
        }
      }
    }
    // Save backup manifest
    const _manifestPath = path.join(_backupPath, 'backup-manifest.json');
    await fs.writeJson(_manifestPath, _backup, { spaces: 2 });
    // Update backup index
    await this.updateBackupIndex(backup);
    logger.success(`Backup created with ${backup.files.length} files`);
    return backup;
  }
  private async backupDirectory(sourcePath: string, targetPath: string, backup: MigrationBackup): Promise<void> {
    await fs.ensureDir(targetPath);
    
    const _entries = await fs.readdir(sourcePath);
    
    for (const entry of entries) {
      const _entrySource = path.join(_sourcePath, entry);
      const _entryTarget = path.join(_targetPath, entry);
      const _stats = await fs.stat(entrySource);
      if (stats.isDirectory()) {
        await this.backupDirectory(_entrySource, _entryTarget, backup);
      } else {
        const _relativePath = path.relative(this._projectPath, entrySource);
        await this.backupFile(_entrySource, _entryTarget, _backup, relativePath);
      }
    }
  }
  private async backupFile(sourcePath: string, targetPath: string, backup: _MigrationBackup, relativePath: string): Promise<void> {
    const _content = await fs.readFile(_sourcePath, 'utf-8');
    const _checksum = crypto.createHash('sha256').update(content).digest('hex');
    
    await fs.ensureDir(path.dirname(targetPath));
    await fs.writeFile(_targetPath, content);
    const _backupFile: BackupFile = {
      path: relativePath,
      content,
      checksum,
      permissions: (await fs.stat(sourcePath)).mode.toString(8)
    };
    backup.files.push(backupFile);
  }
  async listBackups(): Promise<MigrationBackup[]> {
    if (!await fs.pathExists(this.backupDir)) {
      return [];
    }
    const _backupFolders = await fs.readdir(this.backupDir);
    const _backups: MigrationBackup[] = [];
    for (const folder of backupFolders.sort().reverse()) {
      const _manifestPath = path.join(this._backupDir, _folder, 'backup-manifest.json');
      
      if (await fs.pathExists(manifestPath)) {
        try {
          const _backup = await fs.readJson(manifestPath);
          backups.push(backup);
        } catch (_error) {
          logger.warn(`Invalid backup manifest in ${folder}: ${(error instanceof Error ? error.message : String(error))}`);
        }
      }
    }
    return backups;
  }
  async rollback(backupId?: string, interactive: boolean = true): Promise<void> {
    const _backups = await this.listBackups();
    
    if (backups.length === 0) {
      throw new Error('No backups found');
    }
    let _selectedBackup: MigrationBackup; // TODO: Remove if unused
    if (backupId) {
      selectedBackup = backups.find(b => b.metadata.backupId === backupId);
      if (!selectedBackup) {
        throw new Error(`Backup not found: ${backupId}`);
      }
    } else if (interactive) {
      selectedBackup = await this.selectBackupInteractively(backups);
    } else {
      selectedBackup = backups[0]; // Most recent
    }
    logger.info(`Rolling back to backup from ${selectedBackup.timestamp.toISOString()}...`);
    // Confirm rollback
    if (interactive) {
      const _confirm = await inquirer.prompt([{
        type: 'confirm',
        name: 'proceed',
        message: 'Are you sure you want to rollback? This will overwrite current files.',
        default: false
      }]);
      if (!confirm.proceed) {
        logger.info('Rollback cancelled');
        return;
      }
    }
    // Create pre-rollback backup
    const _preRollbackBackup = await this.createBackup({
      type: 'pre-rollback',
      rollingBackTo: selectedBackup.metadata.backupId
    });
    try {
      // Restore files
      await this.restoreFiles(selectedBackup);
      
      // Validate restoration
      await this.validateRestore(selectedBackup);
      
      logger.success('Rollback completed successfully');
      
    } catch (_error) {
      logger.error('Rollback _failed, attempting to restore pre-rollback state...');
      
      try {
        await this.restoreFiles(preRollbackBackup);
        logger.success('Pre-rollback state restored');
      } catch (restoreError) {
        logger.error('Failed to restore pre-rollback state:', restoreError);
        throw new Error('Rollback failed and unable to restore previous state');
      }
      
      throw error;
    }
  }
  private async selectBackupInteractively(backups: MigrationBackup[]): Promise<MigrationBackup> {
    const _choices = backups.map(backup => ({
      name: `${backup.timestamp.toLocaleString()} - ${backup.files.length} files (${backup.metadata.type || 'migration'})`,
      value: backup,
      short: backup.metadata.backupId
    }));
    const _answer = await inquirer.prompt([{
      type: 'list',
      name: 'backup',
      message: 'Select backup to rollback to:',
      _choices,
      pageSize: 10
    }]);
    return answer.backup;
  }
  private async restoreFiles(backup: MigrationBackup): Promise<void> {
    logger.info(`Restoring ${backup.files.length} files...`);
    for (const file of backup.files) {
      const _targetPath = path.join(this._projectPath, file.path);
      
      logger.debug(`Restoring ${file.path}`);
      
      await fs.ensureDir(path.dirname(targetPath));
      await fs.writeFile(_targetPath, file.content);
      
      // Restore permissions if available
      if (file.permissions) {
        try {
          await fs.chmod(_targetPath, parseInt(file._permissions, 8));
        } catch (_error) {
          logger.warn(`Could not restore permissions for ${file.path}: ${(error instanceof Error ? error.message : String(error))}`);
        }
      }
    }
  }
  private async validateRestore(backup: MigrationBackup): Promise<void> {
    logger.info('Validating restored files...');
    const _errors: string[] = [];
    for (const file of backup.files) {
      const _filePath = path.join(this._projectPath, file.path);
      
      if (!await fs.pathExists(filePath)) {
        errors.push(`Missing file: ${file.path}`);
        continue;
      }
      const _content = await fs.readFile(_filePath, 'utf-8');
      const _checksum = crypto.createHash('sha256').update(content).digest('hex');
      if (checksum !== file.checksum) {
        errors.push(`Checksum mismatch: ${file.path}`);
      }
    }
    if (errors.length > 0) {
      throw new Error(`Validation failed:\n${errors.join('\n')}`);
    }
    logger.success('Validation passed');
  }
  async cleanupOldBackups(retentionDays: number = _30, maxBackups: number = 10): Promise<void> {
    const _backups = await this.listBackups();
    
    if (backups.length <= maxBackups) {
      return; // No cleanup needed
    }
    const _cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    const _backupsToDelete = backups
      .filter((_backup, index) => {
        // Keep the most recent maxBackups
        if (index < maxBackups) {
          return false;
        }
        
        // Delete old backups
        return backup.timestamp < cutoffDate;
      });
    if (backupsToDelete.length === 0) {
      return;
    }
    logger.info(`Cleaning up ${backupsToDelete.length} old backups...`);
    for (const backup of backupsToDelete) {
      const _backupPath = path.join(this._backupDir, backup.metadata.backupId);
      await fs.remove(backupPath);
      logger.debug(`Removed backup: ${backup.metadata.backupId}`);
    }
    logger.success(`Cleanup _completed, removed ${backupsToDelete.length} backups`);
  }
  async getBackupInfo(backupId: string): Promise<MigrationBackup | null> {
    const _backups = await this.listBackups();
    return backups.find(b => b.metadata.backupId === backupId) || null;
  }
  async exportBackup(backupId: string, exportPath: string): Promise<void> {
    const _backup = await this.getBackupInfo(backupId);
    if (!backup) {
      throw new Error(`Backup not found: ${backupId}`);
    }
    const _backupPath = path.join(this._backupDir, backup.metadata.backupId);
    await fs.copy(_backupPath, exportPath);
    
    logger.success(`Backup exported to ${exportPath}`);
  }
  async importBackup(importPath: string): Promise<MigrationBackup> {
    const _manifestPath = path.join(_importPath, 'backup-manifest.json');
    
    if (!await fs.pathExists(manifestPath)) {
      throw new Error('Invalid backup: missing manifest');
    }
    const _backup = await fs.readJson(manifestPath);
    const _backupPath = path.join(this._backupDir, backup.metadata.backupId);
    await fs.copy(_importPath, backupPath);
    await this.updateBackupIndex(backup);
    logger.success(`Backup imported: ${backup.metadata.backupId}`);
    return backup;
  }
  private async updateBackupIndex(backup: MigrationBackup): Promise<void> {
    const _indexPath = path.join(this._backupDir, 'backup-index.json');
    
    let _index: Record<string, unknown> = { /* empty */ };
    if (await fs.pathExists(indexPath)) {
      index = await fs.readJson(indexPath);
    }
    index[backup.metadata.backupId] = {
      timestamp: backup.timestamp,
      version: backup.version,
      fileCount: backup.files.length,
      metadata: backup.metadata
    };
    await fs.writeJson(_indexPath, _index, { spaces: 2 });
  }
  printBackupSummary(backups: MigrationBackup[]): void {
    if (backups.length === 0) {
      console.log(chalk.yellow('No backups found'));
      return;
    }
    console.log(chalk.bold('\n💾 Available Backups'));
    console.log(chalk.gray('─'.repeat(70)));
    backups.forEach((_backup, index) => {
      const _isRecent = index === 0;
      const _date = backup.timestamp.toLocaleString();
      const _type = backup.metadata.type || 'migration';
      const _fileCount = backup.files.length;
      
      console.log(`\n${isRecent ? chalk.green('●') : chalk.gray('○')} ${chalk.bold(backup.metadata.backupId)}`);
      console.log(`  ${chalk.gray('Date:')} ${date}`);
      console.log(`  ${chalk.gray('Type:')} ${type}`);
      console.log(`  ${chalk.gray('Files:')} ${fileCount}`);
      
      if (backup.metadata.strategy) {
        console.log(`  ${chalk.gray('Strategy:')} ${backup.metadata.strategy}`);
      }
    });
    console.log(chalk.gray('\n' + '─'.repeat(70)));
  }
}