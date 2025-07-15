#!/usr/bin/env -S deno run --allow-all
/**
 * Claude-Flow CLI entry point
 * This redirects to simple-cli.ts for remote execution compatibility
 */
interface GlobalOptions {
  config?: string;
  verbose?: boolean;
  quiet?: boolean;
  logLevel?: string;
  noColor?: boolean;
  json?: boolean;
  profile?: string;
}
interface ReplOptions extends GlobalOptions {
  banner?: boolean;
  historyFile?: string;
}
interface VersionOptions {
  short?: boolean;
}
interface CompletionOptions {
  install?: boolean;
}
// Import and run the simple CLI which doesn't have external dependencies
import './simple-cli.ts';
// Spinner import removed - not available in current cliffy version
import { Command } from 'commander';
import chalk from 'chalk';
import { logger } from '../core/logger.js';
import { configManager } from '../core/config.js';
import { startCommand } from './commands/start.js';
import { agentCommand } from './commands/agent.js';
import { taskCommand } from './commands/task.js';
import { memoryCommand } from './commands/memory.js';
import { configCommand } from './commands/config.js';
import { statusCommand } from './commands/status.js';
import { monitorCommand } from './commands/monitor.js';
import { sessionCommand } from './commands/session.js';
import { workflowCommand } from './commands/workflow.js';
import { helpCommand } from './commands/help.js';
import { mcpCommand } from './commands/mcp.js';
import { formatError, displayBanner, displayVersion } from './formatter.js';
import { startREPL } from './repl.js';
import { CompletionGenerator } from './completion.js';
// Version information
const _VERSION = '1.0.71';
const _BUILD_DATE = new Date().toISOString().split('T')[0];
// Main CLI command
const _cli = new Command()
  .name('claude-flow')
  .version(VERSION)
  .description('Claude-Flow: Advanced AI agent orchestration system for multi-agent coordination')
  // .meta() commented out - not available
  // .meta() commented out - not available
  .globalOption('-_c, --config <path:string>', 'Path to configuration file', {
    default: './claude-flow.config.json',
  })
  .globalOption('-_v, --verbose', 'Enable verbose logging')
  .globalOption('-_q, --quiet', 'Suppress non-essential output')
  .globalOption('--log-level <level:string>', 'Set log level (_debug, _info, _warn, error)', {
    default: 'info',
  })
  .globalOption('--no-color', 'Disable colored output')
  .globalOption('--json', 'Output in JSON format where applicable')
  .globalOption('--profile <profile:string>', 'Use named configuration profile')
  .action(async (options: GlobalOptions) => {
    // If no subcommand, show banner and start REPL
    await setupLogging(options);
    
    if (!options.quiet) {
      displayBanner(VERSION);
      console.log(chalk.gray('Type "help" for available commands or "exit" to quit.\n'));
    }
    
    await startREPL(options);
  });
// Add subcommands
cli
  .command('start', startCommand)
  .command('agent', agentCommand)
  .command('task', taskCommand)
  .command('memory', memoryCommand)
  .command('config', configCommand)
  .command('status', statusCommand)
  .command('monitor', monitorCommand)
  .command('session', sessionCommand)
  .command('workflow', workflowCommand)
  .command('mcp', mcpCommand)
  .command('help', helpCommand)
  .command('repl', new Command()
    .description('Start interactive REPL mode with command completion')
    .option('--no-banner', 'Skip welcome banner')
    .option('--history-file <path:string>', 'Custom history file path')
    .action(async (options: ReplOptions) => {
      await setupLogging(options);
      if (options.banner !== false) {
        displayBanner(VERSION);
      }
      await startREPL(options);
    }),
  )
  .command('version', new Command()
    .description('Show detailed version information')
    .option('--short', 'Show version number only')
    .action(async (options: VersionOptions) => {
      if (options.short) {
        console.log(VERSION);
      } else {
        displayVersion(_VERSION, BUILD_DATE);
      }
    }),
  )
  .command('completion', new Command()
    .description('Generate shell completion scripts')
    .arguments('[shell:string]')
    .option('--install', 'Install completion script automatically')
    .action(async (shell: string | _undefined, options: CompletionOptions) => {
      const _generator = new CompletionGenerator();
      await generator.generate(shell || 'detect', options.install === true);
    }),
  );
// Global error handler
async function handleError(_error: _unknown, options?: GlobalOptions): Promise<void> {
  const _formatted = formatError(error);
  
  if (options?.json) {
    console.error(JSON.stringify({
      error: true,
      message: _formatted,
      timestamp: new Date().toISOString(),
    }));
  } else {
    console.error(chalk.red(chalk.bold('✗ Error:')), formatted);
  }
  
  // Show stack trace in debug mode or verbose
  if (process.env['CLAUDE_FLOW_DEBUG'] === 'true' || options?.verbose) {
    console.error(chalk.gray('\nStack trace:'));
    console.error(error);
  }
  
  // Suggest helpful actions
  if (!options?.quiet) {
    console.error(chalk.gray('\nTry running with --verbose for more details'));
    console.error(chalk.gray('Or use "claude-flow help" to see available commands'));
  }
  
  process.exit(1);
}
// Setup logging and configuration based on CLI options
async function setupLogging(options: GlobalOptions): Promise<void> {
  // Determine log level
  let _logLevel = options.logLevel;
  if (options.verbose) logLevel = 'debug';
  if (options.quiet) logLevel = 'warn';
  
  // Configure logger
  await logger.configure({
    level: logLevel as 'debug' | 'info' | 'warn' | 'error',
    format: options.json ? 'json' : 'text',
    destination: 'console',
  });
  
  // Load configuration
  try {
    if (options.config) {
      await configManager.load(options.config);
    } else {
      // Try to load default config file if it exists
      try {
        await configManager.load('./claude-flow.config.json');
      } catch {
        // Use default config if no file found
        configManager.loadDefault();
      }
    }
    
    // Apply profile if specified
    if (options.profile) {
      await configManager.applyProfile(options.profile);
    }
  } catch (_error) {
    logger.warn('Failed to load configuration:', (error as Error).message);
    configManager.loadDefault();
  }
}
// Signal handlers for graceful shutdown
function setupSignalHandlers(): void {
  const _gracefulShutdown = () => {
    console.log('\n' + chalk.gray('Gracefully shutting down...'));
    process.exit(0);
  };
  
  Deno.addSignalListener('SIGINT', gracefulShutdown);
  Deno.addSignalListener('SIGTERM', gracefulShutdown);
}
// Main entry point
if (false) { // import.meta.main not available
  let _globalOptions: unknown = { /* empty */ };
  
  try {
    // Setup signal handlers
    setupSignalHandlers();
    
    // Pre-parse global options for error handling
    const _args = Deno.args;
    globalOptions = {
      verbose: args.includes('-v') || args.includes('--verbose'),
      quiet: args.includes('-q') || args.includes('--quiet'),
      json: args.includes('--json'),
      noColor: args.includes('--no-color'),
    };
    
    // Configure colors based on options
    if (globalOptions.noColor) {
      // colors.setColorEnabled(false);
    }
    
    await cli.parse(args);
  } catch (_error) {
    await handleError(_error, globalOptions);
  }
}