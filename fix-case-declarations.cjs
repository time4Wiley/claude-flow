#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

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

// Fix case declarations by adding braces
function fixCaseDeclarations(content) {
  const lines = content.split('\n');
  const result = [];
  let modified = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // Check if this is a case statement
    if (trimmed.startsWith('case ') && trimmed.endsWith(':')) {
      result.push(line);
      
      // Look ahead to see if next non-empty line is a declaration
      let j = i + 1;
      let nextLine = '';
      let indentLevel = line.length - line.trimStart().length;
      
      while (j < lines.length) {
        const checkLine = lines[j];
        const checkTrimmed = checkLine.trim();
        
        if (checkTrimmed === '') {
          result.push(checkLine);
          j++;
          continue;
        }
        
        // Check if this is a variable declaration
        if (checkTrimmed.startsWith('const ') || 
            checkTrimmed.startsWith('let ') || 
            checkTrimmed.startsWith('var ') ||
            checkTrimmed.startsWith('function ') ||
            checkTrimmed.startsWith('class ')) {
          
          // Add opening brace after case
          result[result.length - 1] = line + ' {';
          modified = true;
          
          // Process lines until break/return
          while (j < lines.length) {
            const innerLine = lines[j];
            const innerTrimmed = innerLine.trim();
            
            if (innerTrimmed.startsWith('break') || 
                innerTrimmed.startsWith('return') ||
                innerTrimmed.startsWith('case ') ||
                innerTrimmed.startsWith('default:')) {
              
              if (innerTrimmed.startsWith('break') || innerTrimmed.startsWith('return')) {
                result.push(innerLine);
                result.push(' '.repeat(indentLevel) + '}');
                j++;
                break;
              } else {
                result.push(' '.repeat(indentLevel) + '}');
                i = j - 1; // Will be incremented by outer loop
                break;
              }
            } else {
              result.push(innerLine);
            }
            j++;
          }
          break;
        } else {
          result.push(checkLine);
          j++;
          break;
        }
      }
      
      i = j - 1; // Will be incremented by outer loop
    } else {
      result.push(line);
    }
  }
  
  return { content: result.join('\n'), modified };
}

// Main execution
const files = getAllFiles('./src');
let totalFixed = 0;

files.forEach(file => {
  try {
    const content = fs.readFileSync(file, 'utf8');
    const { content: newContent, modified } = fixCaseDeclarations(content);
    
    if (modified) {
      fs.writeFileSync(file, newContent);
      console.log(`Fixed case declarations in: ${file}`);
      totalFixed++;
    }
  } catch (error) {
    console.error(`Error processing ${file}:`, error.message);
  }
});

console.log(`\nFixed case declarations in ${totalFixed} files`);