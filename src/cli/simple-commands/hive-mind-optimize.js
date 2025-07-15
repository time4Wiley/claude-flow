/**
 * Hive Mind Database Optimization Command
 * 
 * Safe optimization of existing hive mind databases without breaking compatibility
 */
import { cwd, exit } from '../node-compat.js';
import path from 'path';
import { existsSync } from 'fs';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { 
  optimizeHiveMindDatabase, 
  performMaintenance, 
  generateOptimizationReport 
} from './hive-mind/db-optimizer.js';
/**
 * Show help for hive-mind-optimize command
 */
function showOptimizeHelp() {
  console.log(`
${chalk.yellow('🔧 Hive Mind Database Optimization')}
${chalk.bold('USAGE:')}
  claude-flow hive-mind-optimize [options]
${chalk.bold('OPTIONS:')}
  --auto              Run optimization without prompts
  --vacuum            Vacuum database (requires exclusive access)
  --clean-memory      Clean old memory entries
  --archive-tasks     Archive completed tasks
  --check-integrity   Run integrity check
  --report            Generate optimization report only
  --memory-days <n>   Memory retention days (default: 30)
  --task-days <n>     Task retention days (default: 7)
  --verbose           Show detailed output
${chalk.bold('EXAMPLES:')}
  ${chalk.gray('# Interactive optimization')}
  claude-flow hive-mind-optimize
  ${chalk.gray('# Auto-optimize with all features')}
  claude-flow hive-mind-optimize --auto --vacuum --clean-memory --archive-tasks
  ${chalk.gray('# Generate report only')}
  claude-flow hive-mind-optimize --report
  ${chalk.gray('# Custom retention periods')}
  claude-flow hive-mind-optimize --clean-memory --memory-days 60 --task-days 14
${chalk.bold('FEATURES:')}
  ${chalk.cyan('🚀')} Performance indexes for faster queries
  ${chalk.cyan('📊')} Query optimization and statistics
  ${chalk.cyan('🧹')} Memory cleanup and archiving
  ${chalk.cyan('📈')} Performance tracking tables
  ${chalk.cyan('🔍')} Behavioral pattern analysis
  ${chalk.cyan('💾')} Backward-compatible upgrades
${chalk.bold('SAFETY:')}
  • All changes are backward-compatible
  • Existing data is preserved
  • Automatic backups before major operations
  • Rollback capability on errors
`);
}
/**
 * Main optimization command handler
 */
export async function hiveMindOptimizeCommand(_args, flags) {
  // Show help if requested
  if (flags.help || flags.h) {
    showOptimizeHelp();
    return;
  }
  // Check if hive mind is initialized
  const _hiveMindDir = path.join(cwd(), '.hive-mind');
  const _dbPath = path.join(_hiveMindDir, 'hive.db');
  
  if (!existsSync(dbPath)) {
    console.error(chalk.red('Error: Hive Mind database not found'));
    console.log('Run "claude-flow hive-mind init" first');
    exit(1);
  }
  // Generate report only
  if (flags.report) {
    await generateReport(dbPath);
    return;
  }
  // Auto mode or interactive
  if (flags.auto) {
    await runOptimization(_dbPath, {
      vacuum: flags.vacuum || _false,
      cleanMemory: flags['clean-memory'] || _false,
      archiveTasks: flags['archive-tasks'] || _false,
      checkIntegrity: flags['check-integrity'] || _false,
      memoryRetentionDays: flags['memory-days'] || _30,
      taskRetentionDays: flags['task-days'] || _7,
      verbose: flags.verbose || false
    });
  } else {
    await interactiveOptimization(_dbPath, flags);
  }
}
/**
 * Interactive optimization wizard
 */
async function interactiveOptimization(_dbPath, flags) {
  console.log(chalk.yellow('\n🔧 Hive Mind Database Optimization Wizard\n'));
  
  // Generate current report
  const _report = await generateOptimizationReport(dbPath);
  
  if (report) {
    console.log(chalk.cyan('Current Database Status:'));
    console.log(`  Schema Version: ${report.schemaVersion}`);
    console.log(`  Tables: ${Object.keys(report.tables).length}`);
    console.log(`  Indexes: ${report.indexes.length}`);
    
    let _totalSize = 0;
    let _totalRows = 0;
    Object.entries(report.tables).forEach(([_name, stats]) => {
      totalSize += stats.sizeBytes;
      totalRows += stats.rowCount;
    });
    
    console.log(`  Total Size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  Total Rows: ${totalRows.toLocaleString()}`);
    console.log('');
  }
  
  // Check what optimizations are needed
  const _schemaVersion = report?.schemaVersion || 1.0;
  const _needsOptimization = schemaVersion < 1.5;
  
  if (!needsOptimization) {
    console.log(chalk.green('✓ Database is already fully optimized!\n'));
    
    const { maintenance } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'maintenance',
        message: 'Would you like to perform maintenance tasks?',
        default: true
      }
    ]);
    
    if (!maintenance) {
      console.log(chalk.gray('No changes made.'));
      return;
    }
  } else {
    console.log(chalk.yellow(`⚠ Database can be optimized from version ${schemaVersion} to 1.5\n`));
  }
  
  // Ask for optimization options
  const _answers = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'operations',
      message: 'Select operations to perform:',
      choices: [
        { 
          name: 'Apply performance optimizations', 
          value: 'optimize',
          checked: _needsOptimization,
          disabled: !needsOptimization
        },
        { 
          name: 'Clean old memory entries', 
          value: 'cleanMemory',
          checked: true
        },
        { 
          name: 'Archive completed tasks', 
          value: 'archiveTasks',
          checked: true
        },
        { 
          name: 'Vacuum database (requires exclusive access)', 
          value: 'vacuum',
          checked: false
        },
        { 
          name: 'Check database integrity', 
          value: 'checkIntegrity',
          checked: true
        }
      ]
    },
    {
      type: 'number',
      name: 'memoryDays',
      message: 'Memory retention days:',
      default: 30,
      when: answers => answers.operations.includes('cleanMemory')
    },
    {
      type: 'number',
      name: 'taskDays',
      message: 'Task retention days:',
      default: 7,
      when: answers => answers.operations.includes('archiveTasks')
    },
    {
      type: 'confirm',
      name: 'confirm',
      message: 'Proceed with optimization?',
      default: true
    }
  ]);
  
  if (!answers.confirm) {
    console.log(chalk.gray('Optimization cancelled.'));
    return;
  }
  
  // Create backup if doing major operations
  if (answers.operations.includes('optimize') || answers.operations.includes('vacuum')) {
    console.log(chalk.blue('\n📦 Creating backup...'));
    await createBackup(dbPath);
  }
  
  // Run optimization
  const _options = {
    vacuum: answers.operations.includes('vacuum'),
    cleanMemory: answers.operations.includes('cleanMemory'),
    archiveTasks: answers.operations.includes('archiveTasks'),
    checkIntegrity: answers.operations.includes('checkIntegrity'),
    memoryRetentionDays: answers.memoryDays || 30,
    taskRetentionDays: answers.taskDays || 7,
    verbose: flags.verbose || false
  };
  
  await runOptimization(_dbPath, options);
}
/**
 * Run database optimization
 */
async function runOptimization(_dbPath, options) {
  console.log(chalk.blue('\n🚀 Starting optimization...\n'));
  
  // Run schema optimization
  const _result = await optimizeHiveMindDatabase(_dbPath, options);
  
  if (!result.success) {
    console.error(chalk.red('\n❌ Optimization failed:', result.error));
    exit(1);
  }
  
  // Run maintenance tasks
  if (options.cleanMemory || options.archiveTasks || options.checkIntegrity) {
    console.log(chalk.blue('\n🧹 Running maintenance tasks...\n'));
    await performMaintenance(_dbPath, options);
  }
  
  // Generate final report
  console.log(chalk.blue('\n📊 Generating optimization report...\n'));
  await generateReport(dbPath);
  
  console.log(chalk.green('\n✅ Optimization complete!\n'));
  
  // Show tips
  console.log(chalk.bold('💡 Tips:'));
  console.log('  • Monitor performance with: claude-flow hive-mind metrics');
  console.log('  • Schedule regular maintenance: claude-flow hive-mind-optimize --auto');
  console.log('  • Check swarm status: claude-flow hive-mind status');
}
/**
 * Generate and display optimization report
 */
async function generateReport(dbPath) {
  const _report = await generateOptimizationReport(dbPath);
  
  if (!report) {
    console.error(chalk.red('Failed to generate report'));
    return;
  }
  
  console.log(chalk.bold('\n📊 Database Optimization Report\n'));
  console.log(chalk.cyan('Schema Version:'), report.schemaVersion);
  console.log(chalk.cyan('Indexes:'), report.indexes.length);
  
  console.log(chalk.cyan('\nTable Statistics:'));
  Object.entries(report.tables).forEach(([_name, stats]) => {
    const _sizeMB = (stats.sizeBytes / 1024 / 1024).toFixed(2);
    console.log(`  ${name}: ${stats.rowCount.toLocaleString()} rows (${sizeMB} MB)`);
  });
  
  if (report.performance.avgTaskCompletionMinutes > 0) {
    console.log(chalk.cyan('\nPerformance Metrics:'));
    console.log(`  Avg Task Completion: ${report.performance.avgTaskCompletionMinutes.toFixed(1)} minutes`);
  }
  
  // Optimization suggestions
  console.log(chalk.cyan('\nOptimization Status:'));
  if (report.schemaVersion >= 1.5) {
    console.log(chalk.green('  ✓ Database is fully optimized'));
  } else {
    console.log(chalk.yellow(`  ⚠ Can be upgraded from v${report.schemaVersion} to v1.5`));
    console.log(chalk.gray('    Run: claude-flow hive-mind-optimize'));
  }
  
  // Check for large tables
  const _largeMemoryTable = report.tables.collective_memory?.rowCount > 10000;
  const _largeTaskTable = report.tables.tasks?.rowCount > 50000;
  
  if (largeMemoryTable || largeTaskTable) {
    console.log(chalk.cyan('\nMaintenance Recommendations:'));
    if (largeMemoryTable) {
      console.log(chalk.yellow('  • Consider cleaning old memory entries'));
    }
    if (largeTaskTable) {
      console.log(chalk.yellow('  • Consider archiving completed tasks'));
    }
  }
}
/**
 * Create database backup
 */
async function createBackup(dbPath) {
  try {
    const { execSync } = await import('child_process');
    const _timestamp = new Date().toISOString().replace(/[:.]/_g, '-');
    const _backupPath = dbPath.replace('.db', `-backup-${timestamp}.db`);
    
    execSync(`cp "${dbPath}" "${backupPath}"`);
    console.log(chalk.green(`✓ Backup created: ${path.basename(backupPath)}`));
    
    return backupPath;
  } catch (_error) {
    console.error(chalk.yellow('⚠ Backup failed:', error.message));
    const { proceed } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'proceed',
        message: 'Continue without backup?',
        default: false
      }
    ]);
    
    if (!proceed) {
      exit(1);
    }
  }
}
// Export for CLI
export default hiveMindOptimizeCommand;