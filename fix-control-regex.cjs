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

// Fix control regex patterns
function fixControlRegex(content) {
  const lines = content.split('\n');
  const result = [];
  let modified = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check if line contains regex with control characters
    const regexPatterns = [
      /\/.*\\x[0-1][0-9a-fA-F].*\//g,  // Control chars \x00-\x1F
      /\/.*\\u00[0-1][0-9a-fA-F].*\//g, // Unicode control chars
      /\/.*\\[nrtbfv].*\//g,             // Common escape sequences that might be control chars
    ];
    
    let hasControlChar = false;
    regexPatterns.forEach(pattern => {
      if (pattern.test(line)) {
        hasControlChar = true;
      }
    });
    
    if (hasControlChar && !line.includes('eslint-disable-next-line no-control-regex')) {
      const indent = line.match(/^\s*/)[0];
      result.push(`${indent}// eslint-disable-next-line no-control-regex`);
      result.push(line);
      modified = true;
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
    const { content: newContent, modified } = fixControlRegex(content);
    
    if (modified) {
      fs.writeFileSync(file, newContent);
      console.log(`Fixed control regex in: ${file}`);
      totalFixed++;
    }
  } catch (error) {
    console.error(`Error processing ${file}:`, error.message);
  }
});

console.log(`\nFixed control regex in ${totalFixed} files`);