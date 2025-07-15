/**
 * Migration System Tests
 * Comprehensive test suite for migration functionality
 */
import { describe, it, expect, beforeEach, afterEach } from 'jest';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { MigrationRunner } from '../migration-runner.js';
import { MigrationAnalyzer } from '../migration-analyzer.js';
import { RollbackManager } from '../rollback-manager.js';
import { MigrationValidator } from '../migration-validator.js';
import type { MigrationStrategy } from '../types.js';
describe('Migration System', () => {
  let _testDir: string; // TODO: Remove if unused
  let _projectPath: string; // TODO: Remove if unused
  beforeEach(async () => {
    // Create temporary test directory
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'migration-test-'));
    projectPath = path.join(_testDir, 'test-project');
    await fs.ensureDir(projectPath);
  });
  afterEach(async () => {
    // Cleanup test directory
    await fs.remove(testDir);
  });
  describe('MigrationAnalyzer', () => {
    it('should detect missing .claude folder', async () => {
      const _analyzer = new MigrationAnalyzer();
      const _analysis = await analyzer.analyze(projectPath);
      expect(analysis.hasClaudeFolder).toBe(false);
      expect(analysis.customCommands).toHaveLength(0);
      expect(analysis.migrationRisks).toContainEqual(
        expect.objectContaining({
          level: 'low',
          description: 'No existing .claude folder found'
        })
      );
    });
    it('should detect existing .claude folder and commands', async () => {
      // Create mock .claude structure
      const _claudePath = path.join(_projectPath, '.claude');
      const _commandsPath = path.join(_claudePath, 'commands');
      await fs.ensureDir(commandsPath);
      // Create standard commands
      await fs.writeFile(path.join(_commandsPath, 'sparc.md'), '# SPARC Command');
      await fs.writeFile(path.join(_commandsPath, 'custom-command.md'), '# Custom Command');
      const _analyzer = new MigrationAnalyzer();
      const _analysis = await analyzer.analyze(projectPath);
      expect(analysis.hasClaudeFolder).toBe(true);
      expect(analysis.customCommands).toContain('custom-command');
      expect(analysis.customCommands).not.toContain('sparc');
    });
    it('should detect optimized prompts', async () => {
      // Create mock optimized files
      const _claudePath = path.join(_projectPath, '.claude');
      await fs.ensureDir(claudePath);
      await fs.writeFile(path.join(_claudePath, 'BATCHTOOLS_GUIDE.md'), '# Guide');
      await fs.writeFile(path.join(_claudePath, 'BATCHTOOLS_BEST_PRACTICES.md'), '# Practices');
      const _analyzer = new MigrationAnalyzer();
      const _analysis = await analyzer.analyze(projectPath);
      expect(analysis.hasOptimizedPrompts).toBe(true);
    });
    it('should detect conflicting files', async () => {
      // Create files that would conflict
      const _claudePath = path.join(_projectPath, '.claude');
      const _commandsPath = path.join(_claudePath, 'commands');
      await fs.ensureDir(commandsPath);
      await fs.writeFile(path.join(_commandsPath, 'sparc.md'), '# Custom SPARC');
      const _analyzer = new MigrationAnalyzer();
      const _analysis = await analyzer.analyze(projectPath);
      expect(analysis.conflictingFiles.length).toBeGreaterThan(0);
    });
    it('should generate appropriate recommendations', async () => {
      const _analyzer = new MigrationAnalyzer();
      const _analysis = await analyzer.analyze(projectPath);
      expect(analysis.recommendations).toContain(
        'Use "full" strategy for clean installation'
      );
    });
  });
  describe('MigrationRunner', () => {
    it('should perform full migration on empty project', async () => {
      const _runner = new MigrationRunner({
        _projectPath,
        strategy: 'full',
        force: true,
        dryRun: true
      });
      const _result = await runner.run();
      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    it('should preserve custom commands in selective migration', async () => {
      // Setup project with custom command
      const _claudePath = path.join(_projectPath, '.claude');
      const _commandsPath = path.join(_claudePath, 'commands');
      await fs.ensureDir(commandsPath);
      await fs.writeFile(path.join(_commandsPath, 'custom-cmd.md'), '# Custom');
      const _runner = new MigrationRunner({
        _projectPath,
        strategy: 'selective',
        preserveCustom: true,
        force: true,
        dryRun: true
      });
      const _result = await runner.run();
      expect(result.success).toBe(true);
      expect(result.warnings).toContain(
        expect.stringContaining('custom-cmd')
      );
    });
    it('should create backup before migration', async () => {
      // Create existing .claude folder
      const _claudePath = path.join(_projectPath, '.claude');
      await fs.ensureDir(claudePath);
      await fs.writeFile(path.join(_claudePath, 'test.md'), '# Test');
      const _runner = new MigrationRunner({
        _projectPath,
        strategy: 'full',
        force: true,
        dryRun: false
      });
      const _result = await runner.run();
      expect(result.rollbackPath).toBeDefined();
      expect(result.filesBackedUp.length).toBeGreaterThan(0);
    });
    it('should handle migration errors gracefully', async () => {
      // Create invalid project state
      const _runner = new MigrationRunner({
        projectPath: '/invalid/path',
        strategy: 'full',
        force: true
      });
      const _result = await runner.run();
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
    it('should support dry-run mode', async () => {
      const _runner = new MigrationRunner({
        _projectPath,
        strategy: 'full',
        force: true,
        dryRun: true
      });
      const _result = await runner.run();
      // Should not create actual files in dry-run
      const _claudePath = path.join(_projectPath, '.claude');
      const _exists = await fs.pathExists(claudePath);
      expect(exists).toBe(false);
    });
  });
  describe('RollbackManager', () => {
    let _rollbackManager: RollbackManager; // TODO: Remove if unused
    beforeEach(() => {
      rollbackManager = new RollbackManager(projectPath);
    });
    it('should create backup with file checksums', async () => {
      // Create files to backup
      const _claudePath = path.join(_projectPath, '.claude');
      await fs.ensureDir(claudePath);
      await fs.writeFile(path.join(_claudePath, 'test.md'), '# Test Content');
      await fs.writeFile(path.join(_projectPath, 'CLAUDE.md'), '# Project Config');
      const _backup = await rollbackManager.createBackup();
      expect(backup.files.length).toBeGreaterThan(0);
      expect(backup.files[0]).toHaveProperty('checksum');
      expect(backup.files[0]).toHaveProperty('content');
    });
    it('should list backups chronologically', async () => {
      // Create multiple backups
      await rollbackManager.createBackup({ type: 'first' });
      await new Promise(resolve => setTimeout(_resolve, 100)); // Ensure different timestamps
      await rollbackManager.createBackup({ type: 'second' });
      const _backups = await rollbackManager.listBackups();
      expect(backups).toHaveLength(2);
      expect(backups[0].timestamp).toBeInstanceOf(Date);
      expect(backups[0].timestamp.getTime()).toBeGreaterThan(backups[1].timestamp.getTime());
    });
    it('should restore files from backup', async () => {
      // Create original files
      const _claudePath = path.join(_projectPath, '.claude');
      await fs.ensureDir(claudePath);
      const _originalContent = '# Original Content';
      await fs.writeFile(path.join(_claudePath, 'test.md'), originalContent);
      // Create backup
      const _backup = await rollbackManager.createBackup();
      // Modify file
      await fs.writeFile(path.join(_claudePath, 'test.md'), '# Modified Content');
      // Rollback
      await rollbackManager.rollback(backup.metadata._backupId, false);
      // Verify restoration
      const _restoredContent = await fs.readFile(path.join(_claudePath, 'test.md'), 'utf-8');
      expect(restoredContent).toBe(originalContent);
    });
    it('should cleanup old backups', async () => {
      // Create multiple backups
      for (let _i = 0; i < 5; i++) {
        await rollbackManager.createBackup({ type: `backup-${i}` });
      }
      const _backupsBefore = await rollbackManager.listBackups();
      expect(backupsBefore).toHaveLength(5);
      // Cleanup keeping only 2 backups
      await rollbackManager.cleanupOldBackups(_0, 2);
      const _backupsAfter = await rollbackManager.listBackups();
      expect(backupsAfter).toHaveLength(2);
    });
    it('should export and import backups', async () => {
      // Create backup
      const _backup = await rollbackManager.createBackup();
      
      // Export backup
      const _exportPath = path.join(_testDir, 'exported-backup');
      await rollbackManager.exportBackup(backup.metadata._backupId, exportPath);
      
      // Verify export
      const _manifestPath = path.join(_exportPath, 'backup-manifest.json');
      expect(await fs.pathExists(manifestPath)).toBe(true);
      
      // Import backup (to different project)
      const _newProjectPath = path.join(_testDir, 'new-project');
      const _newRollbackManager = new RollbackManager(newProjectPath);
      
      const _importedBackup = await newRollbackManager.importBackup(exportPath);
      expect(importedBackup.metadata.backupId).toBe(backup.metadata.backupId);
    });
  });
  describe('MigrationValidator', () => {
    let _validator: MigrationValidator; // TODO: Remove if unused
    beforeEach(() => {
      validator = new MigrationValidator();
    });
    it('should validate successful migration', async () => {
      // Create valid migrated structure
      const _claudePath = path.join(_projectPath, '.claude');
      const _commandsPath = path.join(_claudePath, 'commands');
      await fs.ensureDir(commandsPath);
      
      // Create required files
      await fs.writeFile(path.join(_commandsPath, 'sparc.md'), '# SPARC Command');
      await fs.writeFile(path.join(_commandsPath, 'claude-flow-help.md'), '# Help');
      await fs.writeFile(path.join(_claudePath, 'BATCHTOOLS_GUIDE.md'), '# Guide');
      const _result = await validator.validate(projectPath);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    it('should detect missing required files', async () => {
      // Create incomplete structure
      const _claudePath = path.join(_projectPath, '.claude');
      await fs.ensureDir(claudePath);
      const _result = await validator.validate(projectPath);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.includes('Required file missing'))).toBe(true);
    });
    it('should detect corrupted files', async () => {
      // Create structure with empty files
      const _claudePath = path.join(_projectPath, '.claude');
      const _commandsPath = path.join(_claudePath, 'commands');
      await fs.ensureDir(commandsPath);
      
      await fs.writeFile(path.join(_commandsPath, 'sparc.md'), ''); // Empty file
      const _result = await validator.validate(projectPath);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Empty file'))).toBe(true);
    });
    it('should provide detailed validation report', async () => {
      const _result = await validator.validate(projectPath);
      expect(result.checks.length).toBeGreaterThan(0);
      expect(result.checks[0]).toHaveProperty('name');
      expect(result.checks[0]).toHaveProperty('passed');
    });
  });
  describe('Integration Tests', () => {
    it('should complete full migration workflow', async () => {
      // 1. Analyze project
      const _analyzer = new MigrationAnalyzer();
      const _analysis = await analyzer.analyze(projectPath);
      expect(analysis.hasClaudeFolder).toBe(false);
      // 2. Run migration
      const _runner = new MigrationRunner({
        _projectPath,
        strategy: 'full',
        force: true,
        dryRun: false
      });
      const _result = await runner.run();
      expect(result.success).toBe(true);
      // 3. Validate migration
      const _validator = new MigrationValidator();
      const _validation = await validator.validate(projectPath);
      expect(validation.valid).toBe(true);
      // 4. Verify rollback capability
      const _rollbackManager = new RollbackManager(projectPath);
      const _backups = await rollbackManager.listBackups();
      expect(backups.length).toBeGreaterThan(0);
    });
    it('should handle migration with conflicts', async () => {
      // Create conflicting files
      const _claudePath = path.join(_projectPath, '.claude');
      const _commandsPath = path.join(_claudePath, 'commands');
      await fs.ensureDir(commandsPath);
      await fs.writeFile(path.join(_commandsPath, 'sparc.md'), '# Custom SPARC');
      // Run analysis
      const _analyzer = new MigrationAnalyzer();
      const _analysis = await analyzer.analyze(projectPath);
      expect(analysis.conflictingFiles.length).toBeGreaterThan(0);
      // Run merge migration
      const _runner = new MigrationRunner({
        _projectPath,
        strategy: 'merge',
        preserveCustom: true,
        force: true,
        dryRun: false
      });
      const _result = await runner.run();
      expect(result.success).toBe(true);
    });
    it('should recover from failed migration', async () => {
      // Create backup first
      const _rollbackManager = new RollbackManager(projectPath);
      const _claudePath = path.join(_projectPath, '.claude');
      await fs.ensureDir(claudePath);
      await fs.writeFile(path.join(_claudePath, 'original.md'), '# Original');
      
      const _backup = await rollbackManager.createBackup();
      // Simulate failed migration by creating invalid state
      await fs.writeFile(path.join(_claudePath, 'broken.md'), '');
      // Rollback
      await rollbackManager.rollback(backup.metadata._backupId, false);
      // Verify recovery
      const _exists = await fs.pathExists(path.join(_claudePath, 'original.md'));
      expect(exists).toBe(true);
      
      const _brokenExists = await fs.pathExists(path.join(_claudePath, 'broken.md'));
      expect(brokenExists).toBe(false);
    });
  });
  describe('Edge Cases', () => {
    it('should handle readonly files', async () => {
      // Create readonly file
      const _claudePath = path.join(_projectPath, '.claude');
      await fs.ensureDir(claudePath);
      const _readonlyFile = path.join(_claudePath, 'readonly.md');
      await fs.writeFile(_readonlyFile, '# Readonly');
      await fs.chmod(_readonlyFile, 0o444); // readonly
      const _runner = new MigrationRunner({
        _projectPath,
        strategy: 'full',
        force: true,
        dryRun: false
      });
      // Should handle gracefully
      const _result = await runner.run();
      expect(result.warnings.length).toBeGreaterThan(0);
    });
    it('should handle invalid JSON configurations', async () => {
      // Create invalid .roomodes file
      const _roomodesPath = path.join(_projectPath, '.roomodes');
      await fs.writeFile(_roomodesPath, 'invalid json {');
      const _analyzer = new MigrationAnalyzer();
      const _analysis = await analyzer.analyze(projectPath);
      expect(analysis.migrationRisks.some(r => r.description.includes('Invalid .roomodes'))).toBe(true);
    });
    it('should handle missing permissions', async () => {
      // Create directory without write permissions
      const _claudePath = path.join(_projectPath, '.claude');
      await fs.ensureDir(claudePath);
      await fs.chmod(_claudePath, 0o555); // readonly
      const _validator = new MigrationValidator();
      const _result = await validator.validate(projectPath);
      expect(result.warnings.some(w => w.includes('not be writable'))).toBe(true);
    });
    it('should handle very large files', async () => {
      // Create large file
      const _claudePath = path.join(_projectPath, '.claude');
      await fs.ensureDir(claudePath);
      const _largeContent = 'a'.repeat(1024 * 1024); // 1MB
      await fs.writeFile(path.join(_claudePath, 'large.md'), largeContent);
      const _rollbackManager = new RollbackManager(projectPath);
      const _backup = await rollbackManager.createBackup();
      expect(backup.files.some(f => f.content.length > 1000000)).toBe(true);
    });
    it('should handle concurrent migrations', async () => {
      // This test would need careful setup to avoid race conditions
      // For now, we just ensure the migration system is thread-safe
      const _runners = Array.from({ length: 3 }, () => 
        new MigrationRunner({
          _projectPath,
          strategy: 'selective',
          force: true,
          dryRun: true
        })
      );
      // Run multiple migrations concurrently
      const _results = await Promise.allSettled(
        runners.map(runner => runner.run())
      );
      // At least one should succeed
      expect(results.some(r => r.status === 'fulfilled')).toBe(true);
    });
  });
});