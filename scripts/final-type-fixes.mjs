#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';

console.log('Final batch of TypeScript type fixes...');

const filePaths = [
  '/workspaces/claude-code-flow/src/mcp/swarm-tools.ts',
  '/workspaces/claude-code-flow/src/hive-mind/types.ts',
  '/workspaces/claude-code-flow/src/communication/message-bus.ts',
  '/workspaces/claude-code-flow/src/types/vscode.d.ts',
  '/workspaces/claude-code-flow/src/cli/commands/hive-mind/task.ts',
  '/workspaces/claude-code-flow/src/cli/commands/hive-mind/wizard.ts'
];

// Track fixes
let totalFixCount = 0;

// Comprehensive type fixes
const fixes = [
  // Standard any replacements
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
  // Function signatures
  { 
    pattern: /\): Promise<any>/g, 
    replacement: '): Promise<unknown>',
    description: 'Replace function return Promise<any> with Promise<unknown>'
  },
  { 
    pattern: /\): any/g, 
    replacement: '): unknown',
    description: 'Replace function return any with unknown'
  },
  { 
    pattern: /\(([^)]*): any\)/g, 
    replacement: '($1: unknown)',
    description: 'Replace function parameter any with unknown'
  },
  // Variables and properties
  { 
    pattern: /let ([a-zA-Z_$][a-zA-Z0-9_$]*): any/g, 
    replacement: 'let $1: unknown',
    description: 'Replace let variable any type with unknown'
  },
  { 
    pattern: /const ([a-zA-Z_$][a-zA-Z0-9_$]*): any/g, 
    replacement: 'const $1: unknown',
    description: 'Replace const variable any type with unknown'
  },
  { 
    pattern: /private ([a-zA-Z_$][a-zA-Z0-9_$]*): any/g, 
    replacement: 'private $1: unknown',
    description: 'Replace private property any type with unknown'
  },
  { 
    pattern: /public ([a-zA-Z_$][a-zA-Z0-9_$]*): any/g, 
    replacement: 'public $1: unknown',
    description: 'Replace public property any type with unknown'
  },
  { 
    pattern: /protected ([a-zA-Z_$][a-zA-Z0-9_$]*): any/g, 
    replacement: 'protected $1: unknown',
    description: 'Replace protected property any type with unknown'
  },
  // Type assertions and generics
  { 
    pattern: /as any/g, 
    replacement: 'as unknown',
    description: 'Replace as any with as unknown'
  },
  { 
    pattern: /<any>/g, 
    replacement: '<unknown>',
    description: 'Replace generic <any> with <unknown>'
  },
  // Collections
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
  { 
    pattern: /Set<any>/g, 
    replacement: 'Set<unknown>',
    description: 'Replace Set<any> with Set<unknown>'
  },
  // Error handling
  { 
    pattern: /catch \(([a-zA-Z_$][a-zA-Z0-9_$]*): any\)/g, 
    replacement: 'catch ($1: unknown)',
    description: 'Replace catch parameter any with unknown'
  },
  { 
    pattern: /\(error: any\)/g, 
    replacement: '(error: unknown)',
    description: 'Replace error parameter any with unknown'
  },
  // Interface properties
  { 
    pattern: /^\s*([a-zA-Z_$][a-zA-Z0-9_$]*): any;$/gm, 
    replacement: '  $1: unknown;',
    description: 'Replace interface property any with unknown'
  },
  // Array types
  { 
    pattern: /Array<any>/g, 
    replacement: 'Array<unknown>',
    description: 'Replace Array<any> with Array<unknown>'
  }
];

// Process each file
for (const filePath of filePaths) {
  const fileName = filePath.split('/').pop();
  console.log(`\nProcessing ${fileName}...`);
  
  try {
    let content = readFileSync(filePath, 'utf8');
    let fileFixCount = 0;

    // Apply fixes
    for (const fix of fixes) {
      const before = content;
      content = content.replace(fix.pattern, fix.replacement);
      const matches = before.match(fix.pattern);
      if (matches && content !== before) {
        fileFixCount += matches.length;
        console.log(`  ✓ ${fix.description} (${matches.length} fixes)`);
      }
    }

    // Write the fixed content back to the file
    writeFileSync(filePath, content, 'utf8');
    
    console.log(`  📁 Fixed ${fileFixCount} issues in ${fileName}`);
    totalFixCount += fileFixCount;
    
  } catch (error) {
    console.log(`  ❌ Error processing ${fileName}: ${error.message}`);
  }
}

console.log(`\n✅ Fixed ${totalFixCount} total type issues across ${filePaths.length} files`);
console.log('Final type fixes completed!');