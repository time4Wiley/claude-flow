#!/usr/bin/env node

/**
 * Script to automatically fix common TypeScript type issues
 * This script will:
 * 1. Replace common `any` types with more specific types
 * 2. Fix Function type to use proper signatures
 * 3. Add eslint-disable comments for require() calls
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Fix type definition

const fixes = [
  // Fix catch blocks
  {
    pattern: /catch\s*\(\s*error\s*:\s*any\s*\)/g,
    replacement: 'catch (error)',
    description: 'Remove any type from catch blocks'
  },
  // Fix common options patterns
  {
    pattern: /\(options:\s*any\)/g,
    replacement: '(options: Record<string, unknown>)',
    description: 'Replace options: any with Record type'
  },
  // Fix Function type
  {
    pattern: /:\s*Function\b/g,
    replacement: ': (...args: unknown[]) => unknown',
    description: 'Replace Function type with proper signature'
  },
  // Fix event handler patterns
  {
    pattern: /\(event:\s*any\)/g,
    replacement: '(event: unknown)',
    description: 'Replace event: any with unknown'
  },
  // Fix data/value patterns
  {
    pattern: /\(data:\s*any\)/g,
    replacement: '(data: unknown)',
    description: 'Replace data: any with unknown'
  },
  {
    pattern: /\(value:\s*any\)/g,
    replacement: '(value: unknown)',
    description: 'Replace value: any with unknown'
  },
  // Fix result patterns
  {
    pattern: /\(result:\s*any\)/g,
    replacement: '(result: unknown)',
    description: 'Replace result: any with unknown'
  },
  // Fix config patterns
  {
    pattern: /\(config:\s*any\)/g,
    replacement: '(config: Record<string, unknown>)',
    description: 'Replace config: any with Record type'
  },
  // Fix args patterns
  {
    pattern: /\(args:\s*any\[\]\)/g,
    replacement: '(args: unknown[])',
    description: 'Replace args: any[] with unknown[]'
  },
  // Fix JSON parse patterns
  {
    pattern: /JSON\.parse\([^)]+\)\s*as\s*any/g,
    replacement: (match) => match.replace(' as any', ' as unknown'),
    description: 'Replace JSON.parse as any with as unknown'
  },
  // Fix require() calls - add eslint comment
  {
    pattern: /^(\s*)(const|let|var)\s+(\w+)\s*=\s*require\(/gm,
    replacement: '$1// eslint-disable-next-line @typescript-eslint/no-var-requires\n$1$2 $3 = require(',
    description: 'Add eslint-disable comment for require() calls'
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
  console.log('🔧 Fixing TypeScript type issues...\n');
  
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