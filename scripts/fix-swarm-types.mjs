#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';

const filePath = '/workspaces/claude-code-flow/src/swarm/types.ts';

console.log('Fixing TypeScript type issues in swarm/types.ts...');

let content = readFileSync(filePath, 'utf8');

// Track fixes
let fixCount = 0;

// Fix specific type issues in swarm types
const fixes = [
  // Fix Record<string, any> patterns
  { 
    pattern: /preferences: Record<string, any>;/g, 
    replacement: 'preferences: Record<string, unknown>;',
    description: 'Replace any with unknown in preferences'
  },
  { 
    pattern: /toolConfigs: Record<string, any>;/g, 
    replacement: 'toolConfigs: Record<string, unknown>;',
    description: 'Replace any with unknown in toolConfigs'
  },
  { 
    pattern: /context: Record<string, any>;/g, 
    replacement: 'context: Record<string, unknown>;',
    description: 'Replace any with unknown in context'
  },
  // Fix task-related any types
  { 
    pattern: /requirements: Record<string, any>;/g, 
    replacement: 'requirements: Record<string, unknown>;',
    description: 'Replace any with unknown in requirements'
  },
  // Fix input/output any types
  { 
    pattern: /input: any;/g, 
    replacement: 'input: unknown;',
    description: 'Replace any with unknown in input'
  },
  { 
    pattern: /expectedOutput: any;/g, 
    replacement: 'expectedOutput: unknown;',
    description: 'Replace any with unknown in expectedOutput'
  },
  { 
    pattern: /output: any;/g, 
    replacement: 'output: unknown;',
    description: 'Replace any with unknown in output'
  },
  // Fix context any types
  { 
    pattern: /context: any;/g, 
    replacement: 'context: unknown;',
    description: 'Replace any with unknown in context field'
  },
  { 
    pattern: /metadata: any;/g, 
    replacement: 'metadata: unknown;',
    description: 'Replace any with unknown in metadata'
  },
  // Fix validation and execution results
  { 
    pattern: /validationResult: any;/g, 
    replacement: 'validationResult: unknown;',
    description: 'Replace any with unknown in validationResult'
  },
  { 
    pattern: /executionResult: any;/g, 
    replacement: 'executionResult: unknown;',
    description: 'Replace any with unknown in executionResult'
  },
  { 
    pattern: /result: any;/g, 
    replacement: 'result: unknown;',
    description: 'Replace any with unknown in result'
  },
  // Fix swarm configuration any types
  { 
    pattern: /resourceLimits: Record<string, any>;/g, 
    replacement: 'resourceLimits: Record<string, number | string>;',
    description: 'Replace any with number | string in resourceLimits'
  },
  { 
    pattern: /alertThresholds: Record<string, any>;/g, 
    replacement: 'alertThresholds: Record<string, number>;',
    description: 'Replace any with number in alertThresholds'
  },
  { 
    pattern: /value: any;/g, 
    replacement: 'value: unknown;',
    description: 'Replace any with unknown in value fields'
  },
  // Fix patterns arrays and other collections
  { 
    pattern: /patterns: any\[\];/g, 
    replacement: 'patterns: unknown[];',
    description: 'Replace any[] with unknown[] in patterns'
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

console.log(`\n✅ Fixed ${fixCount} type issues in swarm/types.ts`);
console.log('Swarm types fixes completed!');