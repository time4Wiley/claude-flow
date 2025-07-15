#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';

const filePath = '/workspaces/claude-code-flow/src/cli/agents/hive-agents.ts';

console.log('Fixing TypeScript type issues in hive-agents.ts...');

let content = readFileSync(filePath, 'utf8');

// Track fixes
let fixCount = 0;

// Create interfaces for better typing
const interfaceDefinitions = `
// Interface definitions for better typing
interface AgentEnvironment {
  runtime: 'deno' | 'node' | 'browser';
  version: string;
  workingDirectory: string;
  tempDirectory?: string;
  logDirectory?: string;
  apiEndpoints?: Record<string, string>;
  credentials?: Record<string, string>;
  availableTools?: string[];
  toolConfigs?: Record<string, unknown>;
}

interface AgentLogger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

interface AgentEventBus {
  emit(event: string, data: unknown): void;
  on(event: string, handler: (data: unknown) => void): void;
  off(event: string, handler: (data: unknown) => void): void;
}

interface AgentMemory {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
}

interface TaskInput {
  complexity?: number;
  type?: string;
  [key: string]: unknown;
}

interface WorkItem {
  qualityScore?: number;
  issues?: string[];
  securityConcerns?: string[];
  recommendations?: string[];
  [key: string]: unknown;
}

interface SystemRequirements {
  architecture?: string;
  components?: string[];
  patterns?: string[];
  technologies?: string[];
  interfaces?: string[];
  [key: string]: unknown;
}
`;

// Add interfaces at the top after the imports
content = content.replace(
  /import type { AgentCapabilities, AgentConfig, TaskDefinition } from '\.\.\/\.\.\/swarm\/types\.js';/,
  `import type { AgentCapabilities, AgentConfig, TaskDefinition } from '../../swarm/types.js';

${interfaceDefinitions}`
);

// Fix specific type issues
const fixes = [
  // Fix constructor parameters in all agent classes
  { 
    pattern: /environment: any,\s*logger: any,\s*eventBus: any,\s*memory: any/g, 
    replacement: 'environment: AgentEnvironment,\n    logger: AgentLogger,\n    eventBus: AgentEventBus,\n    memory: AgentMemory',
    description: 'Replace any with specific interfaces in constructor parameters'
  },
  // Fix factory method parameters
  { 
    pattern: /environment: any,\s*logger: any,\s*eventBus: any,\s*memory: any\s*\): BaseAgent/g, 
    replacement: 'environment: AgentEnvironment,\n    logger: AgentLogger,\n    eventBus: AgentEventBus,\n    memory: AgentMemory\n  ): BaseAgent',
    description: 'Replace any with specific interfaces in factory method'
  },
  // Fix factory createBalancedSwarm parameters
  { 
    pattern: /agentConfig: AgentConfig,\s*environment: any,\s*logger: any,\s*eventBus: any,\s*memory: any/g, 
    replacement: 'agentConfig: AgentConfig,\n    environment: AgentEnvironment,\n    logger: AgentLogger,\n    eventBus: AgentEventBus,\n    memory: AgentMemory',
    description: 'Replace any with specific interfaces in createBalancedSwarm'
  },
  // Fix method parameters
  { 
    pattern: /async estimateEffort\(task: any\): Promise<number>/g, 
    replacement: 'async estimateEffort(task: TaskInput): Promise<number>',
    description: 'Replace any with TaskInput interface'
  },
  { 
    pattern: /async validateWork\(work: any\): Promise<unknown>/g, 
    replacement: 'async validateWork(work: WorkItem): Promise<unknown>',
    description: 'Replace any with WorkItem interface'
  },
  { 
    pattern: /async designSystem\(requirements: any\): Promise<unknown>/g, 
    replacement: 'async designSystem(requirements: SystemRequirements): Promise<unknown>',
    description: 'Replace any with SystemRequirements interface'
  }
];

// Apply fixes
for (const fix of fixes) {
  const before = content;
  content = content.replace(fix.pattern, fix.replacement);
  const matches = before.match(fix.pattern);
  if (matches) {
    fixCount += matches.length;
    console.log(`✓ ${fix.description} (${matches.length} fixes)`);
  }
}

// Write the fixed content back to the file
writeFileSync(filePath, content, 'utf8');

console.log(`\n✅ Fixed ${fixCount} type issues in hive-agents.ts`);
console.log('Hive agents type fixes completed!');