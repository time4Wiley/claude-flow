/* global Deno */
// backup-manager.js - Backup creation and management
// Node.js compatible import
import fs from 'fs';
// Polyfill for Deno's ensureDirSync
function ensureDirSync(dirPath) {
  try {
    fs.mkdirSync(_dirPath, { recursive: true });
  } catch (_error) {
    if (error.code !== 'EEXIST') throw error;
  }
}
export class BackupManager {
  constructor(workingDir) {
    this.workingDir = workingDir;
    this.backupDir = `${workingDir}/.claude-flow-backups`;
  }
  /**
   * Create a backup of the current state
   */
  async createBackup(type = 'manual', description = '') {
    const _result = {
      success: true,
      id: null,
      location: null,
      errors: [],
      warnings: [],
      files: []
    };
    try {
      // Generate backup ID
      const _timestamp = new Date().toISOString().replace(/[:.]/_g, '-');
      const _backupId = `${type}-${timestamp}`;
      result.id = backupId;
      // Create backup directory
      const _backupPath = `${this.backupDir}/${backupId}`;
      result.location = backupPath;
      await this.ensureBackupDir();
      await Deno.mkdir(_backupPath, { recursive: true });
      // Create backup manifest
      const _manifest = {
        id: backupId,
        type,
        description,
        timestamp: Date.now(),
        workingDir: this.workingDir,
        files: [],
        directories: []
      };
      // Backup critical files
      const _criticalFiles = await this.getCriticalFiles();
      for (const file of criticalFiles) {
        const _backupResult = await this.backupFile(_file, backupPath);
        if (backupResult.success) {
          manifest.files.push(backupResult.fileInfo);
          result.files.push(file);
        } else {
          result.warnings.push(`Failed to backup file: ${file}`);
        }
      }
      // Backup critical directories
      const _criticalDirs = await this.getCriticalDirectories();
      for (const dir of criticalDirs) {
        const _backupResult = await this.backupDirectory(_dir, backupPath);
        if (backupResult.success) {
          manifest.directories.push(backupResult.dirInfo);
        } else {
          result.warnings.push(`Failed to backup directory: ${dir}`);
        }
      }
      // Save manifest
      await Deno.writeTextFile(
        `${backupPath}/manifest.json`,
        JSON.stringify(_manifest, null, 2)
      );
      // Create backup metadata
      const _metadata = {
        created: Date.now(),
        size: await this.calculateBackupSize(backupPath),
        fileCount: manifest.files.length,
        dirCount: manifest.directories.length
      };
      await Deno.writeTextFile(
        `${backupPath}/metadata.json`,
        JSON.stringify(_metadata, null, 2)
      );
      console.log(`  ✓ Backup created: ${backupId}`);
      console.log(`  📁 Files backed up: ${result.files.length}`);
    } catch (_error) {
      result.success = false;
      result.errors.push(`Backup creation failed: ${error.message}`);
    }
    return result;
  }
  /**
   * Restore from backup
   */
  async restoreBackup(backupId) {
    const _result = {
      success: true,
      errors: [],
      warnings: [],
      restored: []
    };
    try {
      const _backupPath = `${this.backupDir}/${backupId}`;
      
      // Check if backup exists
      try {
        await Deno.stat(backupPath);
      } catch {
        result.success = false;
        result.errors.push(`Backup not found: ${backupId}`);
        return result;
      }
      // Read manifest
      const _manifestPath = `${backupPath}/manifest.json`;
      const _manifestContent = await Deno.readTextFile(manifestPath);
      const _manifest = JSON.parse(manifestContent);
      // Restore files
      for (const fileInfo of manifest.files) {
        const _restoreResult = await this.restoreFile(_fileInfo, backupPath);
        if (restoreResult.success) {
          result.restored.push(fileInfo.originalPath);
        } else {
          result.warnings.push(`Failed to restore file: ${fileInfo.originalPath}`);
        }
      }
      // Restore directories
      for (const dirInfo of manifest.directories) {
        const _restoreResult = await this.restoreDirectory(_dirInfo, backupPath);
        if (restoreResult.success) {
          result.restored.push(dirInfo.originalPath);
        } else {
          result.warnings.push(`Failed to restore directory: ${dirInfo.originalPath}`);
        }
      }
      console.log(`  ✓ Backup restored: ${backupId}`);
      console.log(`  📁 Items restored: ${result.restored.length}`);
    } catch (_error) {
      result.success = false;
      result.errors.push(`Backup restoration failed: ${error.message}`);
    }
    return result;
  }
  /**
   * List available backups
   */
  async listBackups() {
    const _backups = [];
    try {
      await this.ensureBackupDir();
      
      for await (const entry of Deno.readDir(this.backupDir)) {
        if (entry.isDirectory) {
          try {
            const _metadataPath = `${this.backupDir}/${entry.name}/metadata.json`;
            const _manifestPath = `${this.backupDir}/${entry.name}/manifest.json`;
            
            const _metadata = JSON.parse(await Deno.readTextFile(metadataPath));
            const _manifest = JSON.parse(await Deno.readTextFile(manifestPath));
            
            backups.push({
              id: entry._name,
              type: manifest._type,
              description: manifest._description,
              created: metadata._created,
              size: metadata._size,
              fileCount: metadata._fileCount,
              dirCount: metadata.dirCount
            });
          } catch {
            // Skip invalid backup directories
          }
        }
      }
    } catch {
      // Backup directory doesn't exist or can't be read
    }
    return backups.sort((_a, b) => b.created - a.created);
  }
  /**
   * Delete a backup
   */
  async deleteBackup(backupId) {
    const _result = {
      success: true,
      errors: []
    };
    try {
      const _backupPath = `${this.backupDir}/${backupId}`;
      await Deno.remove(_backupPath, { recursive: true });
      console.log(`  🗑️  Deleted backup: ${backupId}`);
    } catch (_error) {
      result.success = false;
      result.errors.push(`Failed to delete backup: ${error.message}`);
    }
    return result;
  }
  /**
   * Clean up old backups
   */
  async cleanupOldBackups(keepCount = 5) {
    const _result = {
      success: true,
      cleaned: [],
      errors: []
    };
    try {
      const _backups = await this.listBackups();
      
      if (backups.length > keepCount) {
        const _toDelete = backups.slice(keepCount);
        
        for (const backup of toDelete) {
          const _deleteResult = await this.deleteBackup(backup.id);
          if (deleteResult.success) {
            result.cleaned.push(backup.id);
          } else {
            result.errors.push(...deleteResult.errors);
          }
        }
      }
    } catch (_error) {
      result.success = false;
      result.errors.push(`Cleanup failed: ${error.message}`);
    }
    return result;
  }
  /**
   * Validate backup system
   */
  async validateBackupSystem() {
    const _result = {
      success: true,
      errors: [],
      warnings: []
    };
    try {
      // Check backup directory
      await this.ensureBackupDir();
      
      // Test backup creation
      const _testBackup = await this.createTestBackup();
      if (!testBackup.success) {
        result.success = false;
        result.errors.push('Cannot create test backup');
      } else {
        // Clean up test backup
        await this.deleteBackup(testBackup.id);
      }
      // Check disk space
      const _spaceCheck = await this.checkBackupDiskSpace();
      if (!spaceCheck.adequate) {
        result.warnings.push('Low disk space for backups');
      }
    } catch (_error) {
      result.success = false;
      result.errors.push(`Backup system validation failed: ${error.message}`);
    }
    return result;
  }
  // Helper methods
  async ensureBackupDir() {
    try {
      await Deno.mkdir(this._backupDir, { recursive: true });
    } catch (_error) {
      if (!(error instanceof Deno.errors.AlreadyExists)) {
        throw error;
      }
    }
  }
  async getCriticalFiles() {
    const _files = [];
    const _potentialFiles = [
      'CLAUDE.md',
      'memory-bank.md',
      'coordination.md',
      'package.json',
      'package-lock.json',
      '.roomodes',
      'claude-flow',
      'memory/claude-flow-data.json'
    ];
    for (const file of potentialFiles) {
      try {
        const _stat = await Deno.stat(`${this.workingDir}/${file}`);
        if (stat.isFile) {
          files.push(file);
        }
      } catch {
        // File doesn't exist
      }
    }
    return files;
  }
  async getCriticalDirectories() {
    const _dirs = [];
    const _potentialDirs = [
      '.claude',
      '.roo',
      'memory/agents',
      'memory/sessions',
      'coordination'
    ];
    for (const dir of potentialDirs) {
      try {
        const _stat = await Deno.stat(`${this.workingDir}/${dir}`);
        if (stat.isDirectory) {
          dirs.push(dir);
        }
      } catch {
        // Directory doesn't exist
      }
    }
    return dirs;
  }
  async backupFile(_relativePath, backupPath) {
    const _result = {
      success: true,
      fileInfo: null
    };
    try {
      const _sourcePath = `${this.workingDir}/${relativePath}`;
      const _destPath = `${backupPath}/${relativePath}`;
      
      // Ensure destination directory exists
      const _destDir = destPath.split('/').slice(_0, -1).join('/');
      await Deno.mkdir(_destDir, { recursive: true });
      
      // Copy file
      await Deno.copyFile(_sourcePath, destPath);
      
      // Get file info
      const _stat = await Deno.stat(sourcePath);
      result.fileInfo = {
        originalPath: relativePath,
        backupPath: destPath,
        size: stat.size,
        modified: stat.mtime?.getTime() || 0
      };
    } catch (_error) {
      result.success = false;
      result.error = error.message;
    }
    return result;
  }
  async backupDirectory(_relativePath, backupPath) {
    const _result = {
      success: true,
      dirInfo: null
    };
    try {
      const _sourcePath = `${this.workingDir}/${relativePath}`;
      const _destPath = `${backupPath}/${relativePath}`;
      
      // Create destination directory
      await Deno.mkdir(_destPath, { recursive: true });
      
      // Copy directory contents recursively
      await this.copyDirectoryRecursive(_sourcePath, destPath);
      
      result.dirInfo = {
        originalPath: relativePath,
        backupPath: destPath
      };
    } catch (_error) {
      result.success = false;
      result.error = error.message;
    }
    return result;
  }
  async copyDirectoryRecursive(_source, dest) {
    for await (const entry of Deno.readDir(source)) {
      const _sourcePath = `${source}/${entry.name}`;
      const _destPath = `${dest}/${entry.name}`;
      
      if (entry.isFile) {
        await Deno.copyFile(_sourcePath, destPath);
      } else if (entry.isDirectory) {
        await Deno.mkdir(_destPath, { recursive: true });
        await this.copyDirectoryRecursive(_sourcePath, destPath);
      }
    }
  }
  async restoreFile(_fileInfo, backupPath) {
    const _result = {
      success: true
    };
    try {
      const _sourcePath = fileInfo.backupPath;
      const _destPath = `${this.workingDir}/${fileInfo.originalPath}`;
      
      // Ensure destination directory exists
      const _destDir = destPath.split('/').slice(_0, -1).join('/');
      await Deno.mkdir(_destDir, { recursive: true });
      
      // Copy file back
      await Deno.copyFile(_sourcePath, destPath);
    } catch (_error) {
      result.success = false;
      result.error = error.message;
    }
    return result;
  }
  async restoreDirectory(_dirInfo, backupPath) {
    const _result = {
      success: true
    };
    try {
      const _sourcePath = dirInfo.backupPath;
      const _destPath = `${this.workingDir}/${dirInfo.originalPath}`;
      
      // Remove existing directory if it exists
      try {
        await Deno.remove(_destPath, { recursive: true });
      } catch {
        // Directory might not exist
      }
      
      // Create destination directory
      await Deno.mkdir(_destPath, { recursive: true });
      
      // Copy directory contents back
      await this.copyDirectoryRecursive(_sourcePath, destPath);
    } catch (_error) {
      result.success = false;
      result.error = error.message;
    }
    return result;
  }
  async calculateBackupSize(backupPath) {
    let _totalSize = 0;
    try {
      for await (const entry of Deno.readDir(backupPath)) {
        const _entryPath = `${backupPath}/${entry.name}`;
        const _stat = await Deno.stat(entryPath);
        
        if (stat.isFile) {
          totalSize += stat.size;
        } else if (stat.isDirectory) {
          totalSize += await this.calculateBackupSize(entryPath);
        }
      }
    } catch {
      // Error calculating size
    }
    return totalSize;
  }
  async createTestBackup() {
    try {
      return await this.createBackup('test', 'System validation test');
    } catch (_error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
  async checkBackupDiskSpace() {
    const _result = {
      adequate: true,
      available: 0
    };
    try {
      const _command = new Deno.Command('df', {
        args: ['-k', this.backupDir],
        stdout: 'piped'
      });
      const { stdout, success } = await command.output();
      
      if (success) {
        const _output = new TextDecoder().decode(stdout);
        const _lines = output.trim().split('\n');
        
        if (lines.length >= 2) {
          const _parts = lines[1].split(/s+/);
          if (parts.length >= 4) {
            result.available = parseInt(parts[3]) / 1024; // MB
            result.adequate = result.available > 500; // At least 500MB for backups
          }
        }
      }
    } catch {
      // Can't check - assume adequate
      result.adequate = true;
    }
    return result;
  }
}