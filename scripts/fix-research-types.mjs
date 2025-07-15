#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';

const filePath = '/workspaces/claude-code-flow/src/swarm/strategies/research.ts';

console.log('Fixing TypeScript type issues in research.ts...');

let content = readFileSync(filePath, 'utf8');

// Track fixes
let fixCount = 0;

// Fix specific type issues in research.ts
const fixes = [
  // Fix any types in metadata fields
  { 
    pattern: /metadata: Record<string, any>;/g, 
    replacement: 'metadata: Record<string, unknown>;',
    description: 'Replace any with unknown in metadata'
  },
  // Fix any in cache entry
  { 
    pattern: /data: any;/g, 
    replacement: 'data: unknown;',
    description: 'Replace any with unknown for data field'
  },
  // Fix any in connection pool
  { 
    pattern: /connections: Map<string, any>;/g, 
    replacement: 'connections: Map<string, unknown>;',
    description: 'Replace any with unknown in connections map'
  },
  // Fix semantic model placeholder
  { 
    pattern: /private semanticModel: any;/g, 
    replacement: 'private semanticModel: unknown;',
    description: 'Replace any with unknown for semantic model'
  },
  // Fix function parameters
  { 
    pattern: /async optimizeTaskExecution\(task: TaskDefinition, agent: any\): Promise<any>/g, 
    replacement: 'async optimizeTaskExecution(task: TaskDefinition, agent: unknown): Promise<unknown>',
    description: 'Replace any with unknown in function parameters and return'
  },
  { 
    pattern: /private async executeOptimizedWebSearch\(task: TaskDefinition, agent: any\): Promise<any>/g, 
    replacement: 'private async executeOptimizedWebSearch(task: TaskDefinition, agent: unknown): Promise<unknown>',
    description: 'Replace any with unknown in web search function'
  },
  { 
    pattern: /private async executeOptimizedDataExtraction\(task: TaskDefinition, agent: any\): Promise<any>/g, 
    replacement: 'private async executeOptimizedDataExtraction(task: TaskDefinition, agent: unknown): Promise<unknown>',
    description: 'Replace any with unknown in data extraction function'
  },
  { 
    pattern: /private async executeOptimizedClustering\(task: TaskDefinition, agent: any\): Promise<any>/g, 
    replacement: 'private async executeOptimizedClustering(task: TaskDefinition, agent: unknown): Promise<unknown>',
    description: 'Replace any with unknown in clustering function'
  },
  { 
    pattern: /private async executeGenericResearchTask\(task: TaskDefinition, agent: any\): Promise<any>/g, 
    replacement: 'private async executeGenericResearchTask(task: TaskDefinition, agent: unknown): Promise<unknown>',
    description: 'Replace any with unknown in generic task function'
  },
  // Fix return types with any
  { 
    pattern: /private extractResearchParameters\(description: string\): any/g, 
    replacement: 'private extractResearchParameters(description: string): Record<string, unknown>',
    description: 'Replace any return type with Record<string, unknown>'
  },
  { 
    pattern: /private extractTimeframe\(description: string\): any/g, 
    replacement: 'private extractTimeframe(description: string): { start: Date; end: Date }',
    description: 'Replace any return type with specific interface'
  },
  // Fix Promise<any[]> patterns
  { 
    pattern: /createParallelExtractionTasks\(task: TaskDefinition, agent: any\): Promise<any>\[\]/g, 
    replacement: 'createParallelExtractionTasks(task: TaskDefinition, agent: unknown): Promise<unknown>[]',
    description: 'Replace Promise<any> with Promise<unknown>'
  },
  { 
    pattern: /private async extractDataFromBatch\(batch: ResearchResult\[\]\): Promise<any\[\]>/g, 
    replacement: 'private async extractDataFromBatch(batch: ResearchResult[]): Promise<unknown[]>',
    description: 'Replace Promise<any[]> with Promise<unknown[]>'
  },
  { 
    pattern: /private deduplicateResults\(results: any\[\]\): any\[\]/g, 
    replacement: 'private deduplicateResults(results: unknown[]): unknown[]',
    description: 'Replace any[] with unknown[]'
  },
  { 
    pattern: /private async performSemanticClustering\(data: any\[\]\): Promise<ResearchCluster\[\]>/g, 
    replacement: 'private async performSemanticClustering(data: unknown[]): Promise<ResearchCluster[]>',
    description: 'Replace any[] with unknown[]'
  },
  // Fix connection-related any types
  { 
    pattern: /private async getPooledConnection\(\): Promise<any>/g, 
    replacement: 'private async getPooledConnection(): Promise<{ id: string; timestamp: Date }>',
    description: 'Replace any with specific connection interface'
  },
  { 
    pattern: /private releasePooledConnection\(connection: any\): void/g, 
    replacement: 'private releasePooledConnection(connection: { id: string; timestamp: Date }): void',
    description: 'Replace any with specific connection interface'
  },
  // Fix cache methods
  { 
    pattern: /private getFromCache\(key: string\): any \| null/g, 
    replacement: 'private getFromCache(key: string): unknown | null',
    description: 'Replace any with unknown in cache getter'
  },
  { 
    pattern: /private setCache\(key: string, data: any, ttl: number\): void/g, 
    replacement: 'private setCache(key: string, data: unknown, ttl: number): void',
    description: 'Replace any with unknown in cache setter'
  },
  // Fix task creation
  { 
    pattern: /options: any = {}\)/g, 
    replacement: 'options: Record<string, unknown> = {})',
    description: 'Replace any with Record<string, unknown> for options'
  },
  // Fix batch creation
  { 
    pattern: /private createTaskBatches\(tasks: TaskDefinition\[\], dependencies: Map<string, string\[\]>\): any\[\]/g, 
    replacement: 'private createTaskBatches(tasks: TaskDefinition[], dependencies: Map<string, string[]>): Array<{ id: string; tasks: TaskDefinition[]; canRunInParallel: boolean; estimatedDuration: number; requiredResources: Record<string, unknown> }>',
    description: 'Replace any[] with specific batch interface'
  },
  // Fix agent selection
  { 
    pattern: /async selectAgentForTask\(task: TaskDefinition, availableAgents: any\[\]\): Promise<string \| null>/g, 
    replacement: 'async selectAgentForTask(task: TaskDefinition, availableAgents: Array<{ id?: { id: string } | string; capabilities?: Record<string, boolean>; type?: string; workload?: number }>): Promise<string | null>',
    description: 'Replace any[] with specific agent interface'
  },
  // Fix task optimization
  { 
    pattern: /async optimizeTaskSchedule\(tasks: TaskDefinition\[\], agents: any\[\]\): Promise<any\[\]>/g, 
    replacement: 'async optimizeTaskSchedule(tasks: TaskDefinition[], agents: Array<{ id?: { id: string } | string; type?: string; capabilities?: Record<string, boolean> }>): Promise<Array<{ agentId: string; tasks: string[]; estimatedWorkload: number; capabilities: string[] }>>',
    description: 'Replace any[] with specific interfaces'
  },
  // Fix agent capabilities helper
  { 
    pattern: /private getAgentCapabilitiesList\(agent: any\): string\[\]/g, 
    replacement: 'private getAgentCapabilitiesList(agent: { capabilities?: Record<string, boolean> }): string[]',
    description: 'Replace any with specific agent interface'
  },
  // Fix executeRateLimitedSearch
  { 
    pattern: /private async executeRateLimitedSearch\(query: ResearchQuery, agent: any\): Promise<ResearchResult\[\]>/g, 
    replacement: 'private async executeRateLimitedSearch(query: ResearchQuery, agent: unknown): Promise<ResearchResult[]>',
    description: 'Replace any with unknown for agent parameter'
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

console.log(`\n✅ Fixed ${fixCount} type issues in research.ts`);
console.log('Research strategy type fixes completed!');