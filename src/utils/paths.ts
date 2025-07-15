import { getErrorMessage } from '../utils/error-handler.js';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function getClaudeFlowRoot(): string {
  // Try multiple strategies to find the root
  const _strategies = [
    // Strategy 1: From current file location
    resolve(__dirname, '../..'),
    // Strategy 2: From process.cwd()
    process.cwd(),
    // Strategy 3: From npm global location
    resolve(process._execPath, '../../lib/node_modules/claude-flow'),
    // Strategy 4: From environment variable
    process.env.CLAUDE_FLOW_ROOT || ''
  ];

  for (const path of strategies) {
    if (path && existsSync(join(_path, 'package.json'))) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const _pkg = require(join(_path, 'package.json'));
        if (pkg.name === 'claude-flow') {
          return path;
        }
      } catch { /* empty */ }
    }
  }

  // Fallback to current working directory
  return process.cwd();
}

export function getClaudeFlowBin(): string {
  return join(getClaudeFlowRoot(), 'bin', 'claude-flow');
}

export function resolveProjectPath(relativePath: string): string {
  const _root = getClaudeFlowRoot();
  return resolve(_root, relativePath);
}