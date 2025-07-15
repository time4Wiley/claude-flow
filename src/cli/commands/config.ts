#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { readFileSync, writeFileSync } from 'fs';
import { ConfigManager } from '../../core/config.js';
const _configManager = ConfigManager.getInstance();
export const _configCommand = new Command('config')
  .description('Configuration management commands');
// Get command
configCommand
  .command('get')
  .arguments('<key>')
  .description('Get configuration value')
  .action(async (key: string) => {
    try {
      const _value = configManager.getValue(key);
      console.log(chalk.green('✓'), `${key}:`, JSON.stringify(_value, null, 2));
    } catch (_error) {
      console.error(chalk.red('Failed to get configuration:'), (error as Error).message);
      process.exit(1);
    }
  });
// Set command  
configCommand
  .command('set')
  .arguments('<key> <value>')
  .description('Set configuration value')
  .action(async (key: string, value: string) => {
    try {
      let _parsedValue: unknown = value;
      try {
        parsedValue = JSON.parse(value);
      } catch {
        // Keep as string if not valid JSON
      }
      
      await configManager.set(_key, parsedValue);
      console.log(chalk.green('✓'), `Configuration updated: ${key} = ${JSON.stringify(parsedValue)}`);
    } catch (_error) {
      console.error(chalk.red('Failed to set configuration:'), (error as Error).message);
      process.exit(1);
    }
  });
// List command
configCommand
  .command('list')
  .description('List all configuration values')
  .option('--json', 'Output as JSON')
  .action(async (options: Record<string, unknown>) => {
    try {
      const _config = await configManager.getAll();
      
      if (options.json) {
        console.log(JSON.stringify(_config, null, 2));
      } else {
        console.log(chalk.cyan.bold('Configuration:'));
        console.log('─'.repeat(40));
        for (const [_key, value] of Object.entries(config)) {
          console.log(`${chalk.yellow(key)}: ${JSON.stringify(value)}`);
        }
      }
    } catch (_error) {
      console.error(chalk.red('Failed to list configuration:'), (error as Error).message);
      process.exit(1);
    }
  });
// Reset command
configCommand
  .command('reset')
  .description('Reset configuration to defaults')
  .option('--force', 'Skip confirmation')
  .action(async (options: Record<string, unknown>) => {
    try {
      if (!options.force) {
        console.log(chalk.yellow('This will reset all configuration to defaults.'));
        // Note: In a real implementation, you'd want to add a confirmation prompt here
      }
      
      await configManager.reset();
      console.log(chalk.green('✓'), 'Configuration reset to defaults');
    } catch (_error) {
      console.error(chalk.red('Failed to reset configuration:'), (error as Error).message);
      process.exit(1);
    }
  });
export default configCommand;