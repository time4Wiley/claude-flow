#!/usr/bin/env node
/**
 * Claude-Flow Migration Tool
 * Helps existing projects migrate to optimized prompts and configurations
 */
import { Command } from '@cliffy/command';
import { MigrationRunner } from './migration-runner.js';
import { MigrationAnalyzer } from './migration-analyzer.js';
import type { MigrationStrategy } from './types.js';
import { logger } from './logger.js';
import * as chalk from 'chalk';
import * as path from 'path';
const _program = new Command();
program
  .name('claude-flow-migrate')
  .description('Migrate existing claude-flow projects to optimized prompts')
  .version('1.0.0');
program
  .command('analyze [path]')
  .description('Analyze existing project for migration readiness')
  .option('-_d, --detailed', 'Show detailed analysis')
  .option('-_o, --output <file>', 'Output analysis to file')
  .action(async (projectPath = '.', options) => {
    try {
      const _analyzer = new MigrationAnalyzer();
      const _analysis = await analyzer.analyze(path.resolve(projectPath));
      
      if (options.output) {
        await analyzer.saveAnalysis(_analysis, options.output);
        logger.success(`Analysis saved to ${options.output}`);
      }
      
      analyzer.printAnalysis(_analysis, options.detailed);
    } catch (_error) {
      logger.error('Analysis failed:', error);
      process.exit(1);
    }
  });
program
  .command('migrate [path]')
  .description('Migrate project to optimized prompts')
  .option('-_s, --strategy <type>', 'Migration strategy: _full, _selective, merge', 'selective')
  .option('-_b, --backup <dir>', 'Backup directory', '.claude-backup')
  .option('-_f, --force', 'Force migration without prompts')
  .option('--dry-run', 'Simulate migration without making changes')
  .option('--preserve-custom', 'Preserve custom commands and configurations')
  .option('--skip-validation', 'Skip post-migration validation')
  .action(async (projectPath = '.', options) => {
    try {
      const _runner = new MigrationRunner({
        projectPath: path.resolve(projectPath),
        strategy: options.strategy as MigrationStrategy,
        backupDir: options.backup,
        force: options.force,
        dryRun: options.dryRun,
        preserveCustom: options.preserveCustom,
        skipValidation: options.skipValidation
      });
      
      await runner.run();
    } catch (_error) {
      logger.error('Migration failed:', error);
      process.exit(1);
    }
  });
program
  .command('rollback [path]')
  .description('Rollback to previous configuration')
  .option('-_b, --backup <dir>', 'Backup directory to restore from', '.claude-backup')
  .option('-_t, --timestamp <time>', 'Restore from specific timestamp')
  .option('-_f, --force', 'Force rollback without prompts')
  .action(async (projectPath = '.', options) => {
    try {
      const _runner = new MigrationRunner({
        projectPath: path.resolve(projectPath),
        strategy: 'full',
        backupDir: options.backup,
        force: options.force
      });
      
      await runner.rollback(options.timestamp);
    } catch (_error) {
      logger.error('Rollback failed:', error);
      process.exit(1);
    }
  });
program
  .command('validate [path]')
  .description('Validate migration was successful')
  .option('-_v, --verbose', 'Show detailed validation results')
  .action(async (projectPath = '.', options) => {
    try {
      const _runner = new MigrationRunner({
        projectPath: path.resolve(projectPath),
        strategy: 'full'
      });
      
      const _isValid = await runner.validate(options.verbose);
      
      if (isValid) {
        logger.success('Migration validated successfully!');
      } else {
        logger.error('Migration validation failed');
        process.exit(1);
      }
    } catch (_error) {
      logger.error('Validation failed:', error);
      process.exit(1);
    }
  });
program
  .command('list-backups [path]')
  .description('List available backups')
  .option('-_b, --backup <dir>', 'Backup directory', '.claude-backup')
  .action(async (projectPath = '.', options) => {
    try {
      const _runner = new MigrationRunner({
        projectPath: path.resolve(projectPath),
        strategy: 'full',
        backupDir: options.backup
      });
      
      await runner.listBackups();
    } catch (_error) {
      logger.error('Failed to list backups:', error);
      process.exit(1);
    }
  });
// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
program.parse(process.argv);