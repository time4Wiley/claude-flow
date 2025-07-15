#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';

const filePath = '/workspaces/claude-code-flow/src/hive-mind/core/Agent.ts';

console.log('Fixing TypeScript type issues in hive-mind/core/Agent.ts...');

let content = readFileSync(filePath, 'utf8');

// Track fixes
let fixCount = 0;

// Specific fixes for Agent.ts - very targeted
const fixes = [
  // Fix any types in interfaces and type annotations
  { 
    pattern: /: any;/g, 
    replacement: ': unknown;',
    description: 'Replace any with unknown'
  },
  { 
    pattern: /: any\[\];/g, 
    replacement: ': unknown[];',
    description: 'Replace any[] with unknown[]'
  },
  { 
    pattern: /Record<string, any>/g, 
    replacement: 'Record<string, unknown>',
    description: 'Replace Record<string, any> with Record<string, unknown>'
  },
  { 
    pattern: /Promise<any>/g, 
    replacement: 'Promise<unknown>',
    description: 'Replace Promise<any> with Promise<unknown>'
  },
  // Fix function parameters and return types
  { 
    pattern: /\(([^)]*): any\)/g, 
    replacement: '($1: unknown)',
    description: 'Replace function parameter any with unknown'
  },
  { 
    pattern: /async ([^(]*)\(([^)]*)\): Promise<any>/g, 
    replacement: 'async $1($2): Promise<unknown>',
    description: 'Replace async function return type any with unknown'
  },
  { 
    pattern: /([^(]*)\(([^)]*)\): any/g, 
    replacement: '$1($2): unknown',
    description: 'Replace function return type any with unknown'
  },
  // Fix variable declarations
  { 
    pattern: /let ([^:=]+): any/g, 
    replacement: 'let $1: unknown',
    description: 'Replace let variable any type with unknown'
  },
  { 
    pattern: /const ([^:=]+): any/g, 
    replacement: 'const $1: unknown',
    description: 'Replace const variable any type with unknown'
  },
  // Fix class properties
  { 
    pattern: /private ([^:=]+): any/g, 
    replacement: 'private $1: unknown',
    description: 'Replace private property any type with unknown'
  },
  { 
    pattern: /public ([^:=]+): any/g, 
    replacement: 'public $1: unknown',
    description: 'Replace public property any type with unknown'
  },
  { 
    pattern: /protected ([^:=]+): any/g, 
    replacement: 'protected $1: unknown',
    description: 'Replace protected property any type with unknown'
  },
  // Fix type assertions
  { 
    pattern: /as any/g, 
    replacement: 'as unknown',
    description: 'Replace as any with as unknown'
  },
  // Fix generic types
  { 
    pattern: /<any>/g, 
    replacement: '<unknown>',
    description: 'Replace generic <any> with <unknown>'
  },
  // Fix Map and Set types
  { 
    pattern: /Map<([^,>]+), any>/g, 
    replacement: 'Map<$1, unknown>',
    description: 'Replace Map value type any with unknown'
  },
  { 
    pattern: /Map<any, ([^>]+)>/g, 
    replacement: 'Map<unknown, $1>',
    description: 'Replace Map key type any with unknown'
  },
  // Fix catch blocks
  { 
    pattern: /catch \(([^:)]*): any\)/g, 
    replacement: 'catch ($1: unknown)',
    description: 'Replace catch parameter any with unknown'
  },
  // Fix error types
  { 
    pattern: /\(error: any\)/g, 
    replacement: '(error: unknown)',
    description: 'Replace error parameter any with unknown'
  }
];

// Apply fixes
for (const fix of fixes) {
  const before = content;
  content = content.replace(fix.pattern, fix.replacement);
  const matches = before.match(fix.pattern);
  if (matches && content !== before) {
    fixCount += matches.length;
    console.log(`✓ ${fix.description} (${matches.length} fixes)`);
  }
}

// Write the fixed content back to the file
writeFileSync(filePath, content, 'utf8');

console.log(`\n✅ Fixed ${fixCount} type issues in hive-mind/core/Agent.ts`);
console.log('Hive-mind Agent type fixes completed!');