#!/usr/bin/env node

/**
 * Enhanced script to fix more TypeScript type issues
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fixes = [
  // Fix error handling patterns
  {
    pattern: /\} catch \(error: any\)/g,
    replacement: '} catch (error)',
    description: 'Remove any type from catch blocks'
  },
  // Fix callbacks with any
  {
    pattern: /callback:\s*\((.*?):\s*any\)\s*=>/g,
    replacement: 'callback: ($1: unknown) =>',
    description: 'Replace callback any with unknown'
  },
  // Fix async function parameters
  {
    pattern: /async\s+\((.*?):\s*any\)\s*=>/g,
    replacement: 'async ($1: unknown) =>',
    description: 'Replace async function any parameters'
  },
  // Fix object type any
  {
    pattern: /:\s*\{\s*\[key:\s*string\]:\s*any\s*\}/g,
    replacement: ': Record<string, unknown>',
    description: 'Replace object any with Record<string, unknown>'
  },
  // Fix array any
  {
    pattern: /:\s*any\[\]/g,
    replacement: ': unknown[]',
    description: 'Replace any[] with unknown[]'
  },
  // Fix Promise<any>
  {
    pattern: /Promise<any>/g,
    replacement: 'Promise<unknown>',
    description: 'Replace Promise<any> with Promise<unknown>'
  },
  // Fix function return any
  {
    pattern: /\):\s*any\s*{/g,
    replacement: '): unknown {',
    description: 'Replace function return any with unknown'
  },
  // Fix let/const declarations
  {
    pattern: /^(\s*)(let|const)\s+(\w+):\s*any\s*=/gm,
    replacement: '$1$2 $3: unknown =',
    description: 'Replace variable any type with unknown'
  },
  // Fix function parameters
  {
    pattern: /function\s+\w+\s*\((.*?):\s*any/g,
    replacement: (match, param) => match.replace(': any', ': unknown'),
    description: 'Replace function parameter any with unknown'
  },
  // Fix metadata/options patterns
  {
    pattern: /metadata:\s*any/g,
    replacement: 'metadata: Record<string, unknown>',
    description: 'Replace metadata any with Record type'
  },
  // Fix response/result patterns
  {
    pattern: /response:\s*any/g,
    replacement: 'response: unknown',
    description: 'Replace response any with unknown'
  },
  // Fix error patterns
  {
    pattern: /error:\s*any/g,
    replacement: 'error: unknown',
    description: 'Replace error any with unknown'
  },
  // Fix params patterns
  {
    pattern: /params:\s*any/g,
    replacement: 'params: Record<string, unknown>',
    description: 'Replace params any with Record type'
  },
  // Fix payload patterns
  {
    pattern: /payload:\s*any/g,
    replacement: 'payload: unknown',
    description: 'Replace payload any with unknown'
  },
  // Fix handler patterns
  {
    pattern: /handler:\s*any/g,
    replacement: 'handler: (...args: unknown[]) => unknown',
    description: 'Replace handler any with function type'
  },
  // Fix context patterns
  {
    pattern: /context:\s*any/g,
    replacement: 'context: Record<string, unknown>',
    description: 'Replace context any with Record type'
  },
  // Fix request patterns
  {
    pattern: /request:\s*any/g,
    replacement: 'request: unknown',
    description: 'Replace request any with unknown'
  },
  // Fix input patterns
  {
    pattern: /input:\s*any/g,
    replacement: 'input: unknown',
    description: 'Replace input any with unknown'
  },
  // Fix output patterns
  {
    pattern: /output:\s*any/g,
    replacement: 'output: unknown',
    description: 'Replace output any with unknown'
  },
  // Fix item patterns
  {
    pattern: /item:\s*any/g,
    replacement: 'item: unknown',
    description: 'Replace item any with unknown'
  },
  // Fix element patterns
  {
    pattern: /element:\s*any/g,
    replacement: 'element: unknown',
    description: 'Replace element any with unknown'
  },
  // Fix node patterns
  {
    pattern: /node:\s*any/g,
    replacement: 'node: unknown',
    description: 'Replace node any with unknown'
  },
  // Fix arg patterns
  {
    pattern: /arg:\s*any/g,
    replacement: 'arg: unknown',
    description: 'Replace arg any with unknown'
  },
  // Fix obj patterns
  {
    pattern: /obj:\s*any/g,
    replacement: 'obj: Record<string, unknown>',
    description: 'Replace obj any with Record type'
  },
  // Fix Record<string, any>
  {
    pattern: /Record<string,\s*any>/g,
    replacement: 'Record<string, unknown>',
    description: 'Replace Record<string, any> with Record<string, unknown>'
  },
  // Fix Map<string, any>
  {
    pattern: /Map<string,\s*any>/g,
    replacement: 'Map<string, unknown>',
    description: 'Replace Map<string, any> with Map<string, unknown>'
  },
  // Fix Set<any>
  {
    pattern: /Set<any>/g,
    replacement: 'Set<unknown>',
    description: 'Replace Set<any> with Set<unknown>'
  },
  // Fix as any casts
  {
    pattern: /\s+as\s+any/g,
    replacement: ' as unknown',
    description: 'Replace as any with as unknown'
  }
];

async function processFile(filePath) {
  let changeCount = 0;
  
  try {
    let content = await fs.readFile(filePath, 'utf-8');
    const originalContent = content;
    
    // Apply fixes
    for (const fix of fixes) {
      const matches = content.match(fix.pattern);
      if (matches) {
        content = content.replace(fix.pattern, fix.replacement);
        changeCount += matches.length;
      }
    }
    
    // Only write if changes were made
    if (content !== originalContent) {
      await fs.writeFile(filePath, content, 'utf-8');
      console.log(`✓ Fixed ${changeCount} issues in ${filePath}`);
    }
    
  } catch (error) {
    console.error(`✗ Error processing ${filePath}:`, error);
  }
  
  return changeCount;
}

async function* walkDir(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
      yield* walkDir(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
      yield fullPath;
    }
  }
}

async function main() {
  console.log('🔧 Fixing more TypeScript type issues...\n');
  
  const srcDir = path.join(process.cwd(), 'src');
  let totalFiles = 0;
  let totalChanges = 0;
  
  for await (const filePath of walkDir(srcDir)) {
    const changes = await processFile(filePath);
    if (changes > 0) {
      totalFiles++;
      totalChanges += changes;
    }
  }
  
  console.log(`\n✅ Fixed ${totalChanges} issues in ${totalFiles} files`);
}

// Run the script
main().catch(console.error);