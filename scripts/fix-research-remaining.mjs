#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';

const filePath = '/workspaces/claude-code-flow/src/swarm/strategies/research.ts';

console.log('Fixing remaining TypeScript type issues in research.ts...');

let content = readFileSync(filePath, 'utf8');

// Track fixes
let fixCount = 0;

// Fix remaining any[] issues that weren't caught in the first pass
const fixes = [
  // Fix the batches any[] declaration inside createTaskBatches
  { 
    pattern: /const batches: any\[\] = \[\];/g, 
    replacement: 'const batches: Array<{ id: string; tasks: TaskDefinition[]; canRunInParallel: boolean; estimatedDuration: number; requiredResources: Record<string, unknown> }> = [];',
    description: 'Replace any[] with specific batch type in createTaskBatches'
  },
  // Fix the allocations any[] declaration inside optimizeTaskSchedule
  { 
    pattern: /const allocations: any\[\] = \[\];/g, 
    replacement: 'const allocations: Array<{ agentId: string; tasks: string[]; estimatedWorkload: number; capabilities: string[] }> = [];',
    description: 'Replace any[] with specific allocation type in optimizeTaskSchedule'
  },
  // Fix the dependency resolution issue by using proper type annotation
  { 
    pattern: /task\.constraints\.dependencies\.every\(dep => processed\.has\(dep\.id\)\)/g, 
    replacement: 'task.constraints.dependencies.every(dep => processed.has(typeof dep === "string" ? dep : dep.id))',
    description: 'Fix dependency type checking'
  },
  // Fix object property access in deduplicateResults
  { 
    pattern: /const key = result\.extractedData \|\| result\.id;/g, 
    replacement: 'const key = (result as { extractedData?: string; id?: string }).extractedData || (result as { id?: string }).id;',
    description: 'Fix object property access with type assertion'
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

console.log(`\n✅ Fixed ${fixCount} remaining type issues in research.ts`);
console.log('Research strategy type fixes completed!');