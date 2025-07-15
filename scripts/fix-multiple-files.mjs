#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';

console.log('Fixing TypeScript type issues in multiple files...');

const filePaths = [
  '/workspaces/claude-code-flow/src/swarm/prompt-copier-enhanced.ts',
  '/workspaces/claude-code-flow/src/swarm/coordinator.ts',
  '/workspaces/claude-code-flow/src/task/coordination.ts',
  '/workspaces/claude-code-flow/src/integration/mock-components.ts',
  '/workspaces/claude-code-flow/src/task/index.ts'
];

// Track fixes
let totalFixCount = 0;

// Common type fixes that apply to many files
const commonFixes = [
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
  { 
    pattern: /\(.*\): any/g, 
    replacement: (match) => match.replace(': any', ': unknown'),
    description: 'Replace function return type any with unknown'
  },
  { 
    pattern: /async function.*\): any/g, 
    replacement: (match) => match.replace(': any', ': unknown'),
    description: 'Replace async function return type any with unknown'
  },
  // Fix function parameters
  { 
    pattern: /\(([^)]*): any\)/g, 
    replacement: '($1: unknown)',
    description: 'Replace function parameter any with unknown'
  },
  // Fix catch blocks
  { 
    pattern: /catch \(([^:]*): any\)/g, 
    replacement: 'catch ($1: unknown)',
    description: 'Replace catch parameter any with unknown'
  },
  { 
    pattern: /catch \(([^)]*)\) \{/g, 
    replacement: (match, param) => {
      if (!param.includes(':')) {
        return match; // Leave as is if no type annotation
      }
      return match.replace(/: any/, ': unknown');
    },
    description: 'Fix catch block parameter types'
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
  // Fix object type assertions
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
  // Fix event handler types
  { 
    pattern: /\(event: any\)/g, 
    replacement: '(event: Event)',
    description: 'Replace event parameter any with Event'
  },
  // Fix error types
  { 
    pattern: /\(error: any\)/g, 
    replacement: '(error: unknown)',
    description: 'Replace error parameter any with unknown'
  }
];

// Process each file
for (const filePath of filePaths) {
  console.log(`\nProcessing ${filePath.split('/').pop()}...`);
  
  try {
    let content = readFileSync(filePath, 'utf8');
    let fileFixCount = 0;

    // Apply common fixes
    for (const fix of commonFixes) {
      const before = content;
      
      if (typeof fix.replacement === 'function') {
        content = content.replace(fix.pattern, fix.replacement);
      } else {
        content = content.replace(fix.pattern, fix.replacement);
      }
      
      const matches = before.match(fix.pattern);
      if (matches && content !== before) {
        fileFixCount += matches.length;
        console.log(`  ✓ ${fix.description} (${matches.length} fixes)`);
      }
    }

    // Write the fixed content back to the file
    writeFileSync(filePath, content, 'utf8');
    
    console.log(`  📁 Fixed ${fileFixCount} issues in ${filePath.split('/').pop()}`);
    totalFixCount += fileFixCount;
    
  } catch (error) {
    console.log(`  ❌ Error processing ${filePath}: ${error.message}`);
  }
}

console.log(`\n✅ Fixed ${totalFixCount} total type issues across ${filePaths.length} files`);
console.log('Multiple file type fixes completed!');