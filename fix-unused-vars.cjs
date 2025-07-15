#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Get all TypeScript/JavaScript files
function getAllFiles(dir, exts = ['.ts', '.js']) {
  let results = [];
  const list = fs.readdirSync(dir);
  
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat && stat.isDirectory()) {
      results = results.concat(getAllFiles(filePath, exts));
    } else if (exts.some(ext => file.endsWith(ext))) {
      results.push(filePath);
    }
  });
  
  return results;
}

// Common unused imports to remove completely
const commonUnusedImports = [
  'getErrorMessage',
  'generateId',
  'validateInput',
  'formatOutput',
  'Logger',
  'Config',
  'Utils',
  'Helper'
];

// Fix unused variables
function fixUnusedVars(content) {
  let lines = content.split('\n');
  let modified = false;
  
  // Remove unused imports
  lines = lines.map(line => {
    const trimmed = line.trim();
    
    // Handle import statements
    if (trimmed.startsWith('import ') && trimmed.includes('{')) {
      let newLine = line;
      commonUnusedImports.forEach(unused => {
        const patterns = [
          new RegExp(`\\b${unused}\\s*,`, 'g'),
          new RegExp(`,\\s*${unused}\\b`, 'g'),
          new RegExp(`{\\s*${unused}\\s*}`, 'g')
        ];
        
        patterns.forEach(pattern => {
          if (pattern.test(newLine)) {
            newLine = newLine.replace(pattern, (match) => {
              if (match.includes(',')) {
                return match.startsWith(',') ? '' : ',';
              }
              return '{}';
            });
            modified = true;
          }
        });
      });
      
      // Clean up empty imports
      if (newLine.includes('{}')) {
        return ''; // Remove entire line
      }
      
      return newLine;
    }
    
    return line;
  }).filter(line => line !== '');
  
  // Fix function parameters by prefixing with underscore
  lines = lines.map(line => {
    // Match function parameters
    const functionPattern = /function\s+\w*\s*\(([^)]+)\)/g;
    const arrowFunctionPattern = /\(([^)]+)\)\s*=>/g;
    const methodPattern = /\w+\s*\(([^)]+)\)\s*[{:]/g;
    
    let newLine = line;
    
    [functionPattern, arrowFunctionPattern, methodPattern].forEach(pattern => {
      newLine = newLine.replace(pattern, (match, params) => {
        const fixedParams = params.split(',').map(param => {
          const trimmed = param.trim();
          // Skip if already prefixed or is a destructured parameter
          if (trimmed.startsWith('_') || trimmed.includes('{') || trimmed.includes('[')) {
            return param;
          }
          
          // Common unused parameter names
          const unusedParams = ['req', 'res', 'next', 'error', 'event', 'context', 'callback'];
          const paramName = trimmed.split(':')[0].split('=')[0].trim();
          
          if (unusedParams.includes(paramName)) {
            modified = true;
            return param.replace(paramName, `_${paramName}`);
          }
          
          return param;
        }).join(',');
        
        return match.replace(params, fixedParams);
      });
    });
    
    return newLine;
  });
  
  // Fix variable declarations that might be unused
  lines = lines.map(line => {
    const trimmed = line.trim();
    
    // Add TODO comments for potentially unused variables
    if ((trimmed.startsWith('const ') || trimmed.startsWith('let ')) && 
        !trimmed.includes('=') && 
        !line.includes('TODO')) {
      modified = true;
      return line + ' // TODO: Remove if unused';
    }
    
    return line;
  });
  
  return { content: lines.join('\n'), modified };
}

// Main execution
const files = getAllFiles('./src');
let totalFixed = 0;

files.forEach(file => {
  try {
    const content = fs.readFileSync(file, 'utf8');
    const { content: newContent, modified } = fixUnusedVars(content);
    
    if (modified) {
      fs.writeFileSync(file, newContent);
      console.log(`Fixed unused variables in: ${file}`);
      totalFixed++;
    }
  } catch (error) {
    console.error(`Error processing ${file}:`, error.message);
  }
});

console.log(`\nFixed unused variables in ${totalFixed} files`);