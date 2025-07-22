import chalk from 'chalk';
import { spawn } from 'child_process';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { promises as fs } from 'node:fs';
import type { CommandContext } from '../cli-core.js';
import { success, error, warning, info } from '../cli-core.js';
import open from 'open';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface UIOptions {
  port?: number;
  host?: string;
  open?: boolean;
  mode?: 'development' | 'production';
}

export async function uiAction(ctx: CommandContext): Promise<void> {
  const options: UIOptions = {
    port: (ctx.flags.port as number) || 5173,
    host: (ctx.flags.host as string) || 'localhost',
    open: ctx.flags.open as boolean,
    mode: (ctx.flags.mode as 'development' | 'production') || 'development',
  };

  console.log(chalk.cyan('🚀 Claude Flow UI - Agentic Flow Interface'));
  console.log(chalk.gray('─'.repeat(60)));

  try {
    // Check if UI directory exists
    const uiPath = resolve(__dirname, '../../../../ui/agentic-flow');
    const packageJsonPath = join(uiPath, 'package.json');
    
    try {
      await fs.access(packageJsonPath);
    } catch {
      error('UI project not found. Please ensure ui/agentic-flow is properly set up.');
      return;
    }

    // Check if dependencies are installed
    const nodeModulesPath = join(uiPath, 'node_modules');
    try {
      await fs.access(nodeModulesPath);
    } catch {
      warning('Dependencies not installed. Installing...');
      await installDependencies(uiPath);
    }

    // Start the Vite dev server
    info(`Starting UI server on http://${options.host}:${options.port}`);
    
    const viteArgs = [
      'dev',
      '--port', options.port.toString(),
      '--host', options.host,
    ];

    if (!options.open) {
      viteArgs.push('--no-open');
    }

    const viteProcess = spawn('npm', ['run', ...viteArgs], {
      cwd: uiPath,
      stdio: 'inherit',
      shell: true,
      env: {
        ...process.env,
        NODE_ENV: options.mode,
        VITE_MCP_SERVER_URL: process.env.MCP_SERVER_URL || 'http://localhost:3000',
        VITE_HIVE_MIND_URL: process.env.HIVE_MIND_URL || 'ws://localhost:8080',
      },
    });

    // Handle process termination
    process.on('SIGINT', () => {
      viteProcess.kill('SIGTERM');
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      viteProcess.kill('SIGTERM');
      process.exit(0);
    });

    viteProcess.on('error', (err) => {
      error(`Failed to start UI server: ${err.message}`);
      process.exit(1);
    });

    viteProcess.on('exit', (code) => {
      if (code !== 0) {
        error(`UI server exited with code ${code}`);
        process.exit(code || 1);
      }
    });

    // Open browser after a short delay if requested
    if (options.open) {
      setTimeout(() => {
        const url = `http://${options.host}:${options.port}`;
        open(url).catch(() => {
          warning(`Failed to open browser. Please navigate to ${url} manually.`);
        });
      }, 3000);
    }

    success('UI server started successfully');
    console.log(chalk.gray('Press Ctrl+C to stop the server'));

  } catch (err) {
    error(`Failed to start UI: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

async function installDependencies(uiPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const installProcess = spawn('npm', ['install'], {
      cwd: uiPath,
      stdio: 'inherit',
      shell: true,
    });

    installProcess.on('error', reject);
    installProcess.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`npm install exited with code ${code}`));
      }
    });
  });
}

export const uiCommand = {
  name: 'ui',
  description: 'Launch the Claude Flow UI interface',
  options: [
    {
      name: 'port',
      short: 'p',
      description: 'Port to run the UI server on',
      type: 'number',
      default: 5173,
    },
    {
      name: 'host',
      short: 'h',
      description: 'Host to bind the UI server to',
      type: 'string',
      default: 'localhost',
    },
    {
      name: 'open',
      short: 'o',
      description: 'Open browser automatically',
      type: 'boolean',
    },
    {
      name: 'mode',
      short: 'm',
      description: 'Development or production mode',
      type: 'string',
      default: 'development',
    },
  ],
  action: uiAction,
};