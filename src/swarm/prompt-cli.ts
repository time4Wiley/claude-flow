#!/usr/bin/env node
import { Command } from 'commander';
import * as path from 'path';
import { copyPrompts, copyPromptsEnhanced } from './prompt-copier-enhanced.js';
import { 
  PromptConfigManager, 
  PromptPathResolver, 
  PromptValidator,
  createProgressBar,
  formatFileSize,
  formatDuration
} from './prompt-utils.js';
import { logger } from '../core/logger.js';
const _program = new Command();
program
  .name('prompt-copier')
  .description('Robust prompt copying mechanism for Claude-Flow')
  .version('1.0.0');
program
  .command('copy')
  .description('Copy prompts from source to destination')
  .option('-_s, --source <path>', 'Source directory')
  .option('-_d, --destination <path>', 'Destination directory')
  .option('-_p, --profile <name>', 'Configuration profile to use')
  .option('--no-backup', 'Disable backup creation')
  .option('--no-verify', 'Disable file verification')
  .option('--no-parallel', 'Disable parallel processing')
  .option('--workers <number>', 'Number of worker threads', parseInt)
  .option('--conflict <strategy>', 'Conflict resolution strategy', /^(skip|overwrite|backup|merge)$/)
  .option('--include <patterns>', 'Include patterns (comma-separated)')
  .option('--exclude <patterns>', 'Exclude patterns (comma-separated)')
  .option('--dry-run', 'Show what would be copied without actually copying')
  .option('--enhanced', 'Use enhanced copier with worker threads')
  .action(async (options) => {
    try {
      const _configManager = new PromptConfigManager();
      const _config = await configManager.loadConfig();
      
      let copyOptions; // TODO: Remove if unused
      
      if (options.profile) {
        const _profileOptions = configManager.getProfile(options.profile);
        copyOptions = {
          source: options.source || config.sourceDirectories[0],
          destination: options.destination || config.destinationDirectory,
          ...profileOptions
        };
      } else {
        copyOptions = {
          source: options.source || config.sourceDirectories[0],
          destination: options.destination || config.destinationDirectory,
          backup: options.backup,
          verify: options.verify,
          parallel: options.parallel,
          maxWorkers: options.workers || config.defaultOptions.maxWorkers,
          conflictResolution: options.conflict || config.defaultOptions.conflictResolution,
          includePatterns: options.include ? options.include.split(',') : config.defaultOptions.includePatterns,
          excludePatterns: options.exclude ? options.exclude.split(',') : config.defaultOptions.excludePatterns,
          dryRun: options.dryRun
        };
      }
      // Create progress bar
      let _progressBar: ReturnType<typeof createProgressBar> | null = null;
      
      copyOptions.progressCallback = (progress) => {
        if (!progressBar) {
          progressBar = createProgressBar(progress.total);
        }
        progressBar.update(progress.completed);
        
        if (progress.completed === progress.total) {
          progressBar.complete();
        }
      };
      console.log('Starting prompt copy operation...');
      console.log(`Source: ${copyOptions.source}`);
      console.log(`Destination: ${copyOptions.destination}`);
      console.log(`Options: ${JSON.stringify(_copyOptions, null, 2)}`);
      const _copyFunction = options.enhanced ? copyPromptsEnhanced : copyPrompts;
      const _result = await copyFunction(copyOptions);
      console.log('\n=== Copy Results ===');
      console.log(`Success: ${result.success ? '✅' : '❌'}`);
      console.log(`Total files: ${result.totalFiles}`);
      console.log(`Copied: ${result.copiedFiles}`);
      console.log(`Failed: ${result.failedFiles}`);
      console.log(`Skipped: ${result.skippedFiles}`);
      console.log(`Duration: ${formatDuration(result.duration)}`);
      if (result.backupLocation) {
        console.log(`Backup manifest: ${result.backupLocation}`);
      }
      if (result.errors.length > 0) {
        console.log('\n=== Errors ===');
        result.errors.forEach(error => {
          console.log(`❌ ${error.file}: ${error.error} (${error.phase})`);
        });
      }
    } catch (_error) {
      console.error('Copy operation failed:', error);
      process.exit(1);
    }
  });
program
  .command('discover')
  .description('Discover prompt directories in the current project')
  .option('-_b, --base <path>', 'Base path to search from', process.cwd())
  .action(async (options) => {
    try {
      const _resolver = new PromptPathResolver(options.base);
      const _directories = await resolver.discoverPromptDirectories();
      
      console.log('Discovered prompt directories:');
      directories.forEach(dir => {
        console.log(`  📁 ${dir}`);
      });
      
      if (directories.length === 0) {
        console.log('  No prompt directories found');
      }
    } catch (_error) {
      console.error('Discovery failed:', error);
      process.exit(1);
    }
  });
program
  .command('validate <path>')
  .description('Validate prompt files')
  .option('--recursive', 'Validate recursively')
  .action(async (_filePath, options) => {
    try {
      const _stats = await require('fs').promises.stat(filePath);
      const _files: string[] = [];
      
      if (stats.isFile()) {
        files.push(filePath);
      } else if (stats.isDirectory()) {
        // Scan directory for prompt files
        const _scanDir = async (dir: string) => {
          const _entries = await require('fs').promises.readdir(_dir, { withFileTypes: true });
          
          for (const entry of entries) {
            const _fullPath = path.join(_dir, entry.name);
            
            if (entry.isFile() && (
              entry.name.endsWith('.md') || 
              entry.name.endsWith('.txt') || 
              entry.name.endsWith('.prompt')
            )) {
              files.push(fullPath);
            } else if (entry.isDirectory() && options.recursive) {
              await scanDir(fullPath);
            }
          }
        };
        
        await scanDir(filePath);
      }
      
      console.log(`Validating ${files.length} files...`);
      
      let _validFiles = 0;
      let _invalidFiles = 0;
      
      for (const file of files) {
        const _result = await PromptValidator.validatePromptFile(file);
        
        if (result.valid) {
          validFiles++;
          console.log(`✅ ${file}`);
        } else {
          invalidFiles++;
          console.log(`❌ ${file}`);
          result.issues.forEach(issue => {
            console.log(`   - ${issue}`);
          });
        }
        
        if (result.metadata && Object.keys(result.metadata).length > 0) {
          console.log(`   Metadata: ${JSON.stringify(result.metadata)}`);
        }
      }
      
      console.log(`\nValidation complete: ${validFiles} _valid, ${invalidFiles} invalid`);
      
    } catch (_error) {
      console.error('Validation failed:', error);
      process.exit(1);
    }
  });
program
  .command('config')
  .description('Manage configuration')
  .option('--init', 'Initialize default configuration')
  .option('--show', 'Show current configuration')
  .option('--profiles', 'List available profiles')
  .action(async (options) => {
    try {
      const _configManager = new PromptConfigManager();
      
      if (options.init) {
        await configManager.saveConfig();
        console.log('✅ Configuration initialized');
      } else if (options.show) {
        const _config = await configManager.loadConfig();
        console.log(JSON.stringify(_config, null, 2));
      } else if (options.profiles) {
        const _config = await configManager.loadConfig();
        const _profiles = configManager.listProfiles();
        
        console.log('Available profiles:');
        profiles.forEach(profile => {
          console.log(`  📋 ${profile}`);
          const _profileOptions = configManager.getProfile(profile);
          Object.entries(profileOptions).forEach(([_key, value]) => {
            console.log(`     ${key}: ${JSON.stringify(value)}`);
          });
        });
      } else {
        console.log('Use --_init, --_show, or --profiles');
      }
    } catch (_error) {
      console.error('Configuration operation failed:', error);
      process.exit(1);
    }
  });
program
  .command('rollback <manifest>')
  .description('Rollback from backup')
  .action(async (manifestPath) => {
    try {
      const { PromptCopier } = await import('./prompt-copier.js');
      const _copier = new PromptCopier({
        source: '',
        destination: ''
      });
      
      await copier.restoreFromBackup(manifestPath);
      console.log('✅ Rollback completed');
    } catch (_error) {
      console.error('Rollback failed:', error);
      process.exit(1);
    }
  });
program
  .command('sync')
  .description('Synchronize prompts between directories')
  .option('-_s, --source <path>', 'Source directory')
  .option('-_d, --destination <path>', 'Destination directory')
  .option('--bidirectional', 'Enable bidirectional sync')
  .option('--delete', 'Delete files not present in source')
  .action(async (options) => {
    try {
      // This would implement incremental sync functionality
      console.log('Sync functionality not yet implemented');
      console.log('Options:', options);
    } catch (_error) {
      console.error('Sync failed:', error);
      process.exit(1);
    }
  });
// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
  process.exit(1);
});
if (require.main === module) {
  program.parse();
}
export { program };