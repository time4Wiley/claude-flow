#!/usr/bin/env node
/* eslint-env node */
import fs from 'fs';
import path from 'path';
/**
 * Deploy Claude optimized template to a target project
 * Usage: node deploy-to-project.js <target-project-path>
 */
const _args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: node deploy-to-project.js <target-project-path>');
  console.error('Example: node deploy-to-project.js /path/to/my-project');
  process.exit(1);
}
const _TARGET_PROJECT = args[0];
const _SOURCE_DIR = path.join(__dirname, '.claude');
const _TARGET_DIR = path.join(_TARGET_PROJECT, '.claude');
const _MANIFEST_PATH = path.join(__dirname, 'manifest.json');
console.log('Claude Optimized Template Deployment');
console.log('====================================');
console.log(`Source: ${SOURCE_DIR}`);
console.log(`Target: ${TARGET_DIR}`);
// Validate target project
if (!fs.existsSync(TARGET_PROJECT)) {
  console.error(`Error: Target project directory does not exist: ${TARGET_PROJECT}`);
  process.exit(1);
}
// Check if it's a valid project (has package.json or similar)
const _projectFiles = ['package.json', 'tsconfig.json', 'deno.json', 'go.mod', 'Cargo.toml', 'setup.py'];
const _hasProjectFile = projectFiles.some(file => fs.existsSync(path.join(_TARGET_PROJECT, file)));
if (!hasProjectFile) {
  console.warn('Warning: Target directory does not appear to be a project root (no package._json, etc.)');
  console.log('Continue anyway? (y/n)');
  // For automation, we'll continue
}
// Read manifest
const _manifest = JSON.parse(fs.readFileSync(_MANIFEST_PATH, 'utf8'));
// Create target .claude directory
if (!fs.existsSync(TARGET_DIR)) {
  fs.mkdirSync(_TARGET_DIR, { recursive: true });
  console.log('✓ Created .claude directory');
} else {
  console.log('⚠️  .claude directory already exists - files will be overwritten');
}
// Create directory structure
console.log('\nCreating directory structure...');
for (const [_dirName, dirInfo] of Object.entries(manifest.directories)) {
  const _targetPath = path.join(_TARGET_DIR, dirInfo.path);
  if (!fs.existsSync(targetPath)) {
    fs.mkdirSync(_targetPath, { recursive: true });
    console.log(`  ✓ ${dirInfo.path}`);
  }
  
  // Create README for empty directories
  if (dirInfo.createEmpty) {
    const _readmePath = path.join(_targetPath, 'README.md');
    if (!fs.existsSync(readmePath)) {
      fs.writeFileSync(_readmePath, `# ${dirName}\n\nThis directory will be populated during usage.\n`);
    }
  }
}
// Copy files
console.log('\nDeploying template files...');
let _successCount = 0;
let _errorCount = 0;
for (const file of manifest.files) {
  const _sourcePath = path.join(_SOURCE_DIR, file.destination);
  const _targetPath = path.join(_TARGET_DIR, file.destination);
  
  try {
    if (fs.existsSync(sourcePath)) {
      // Ensure target directory exists
      const _targetDir = path.dirname(targetPath);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(_targetDir, { recursive: true });
      }
      
      // Copy file
      fs.copyFileSync(_sourcePath, targetPath);
      console.log(`  ✓ ${file.destination}`);
      successCount++;
    } else {
      console.error(`  ✗ ${file.destination} - Source file not found`);
      errorCount++;
    }
  } catch (_error) {
    console.error(`  ✗ ${file.destination} - Error: ${error.message}`);
    errorCount++;
  }
}
// Create deployment info
const _deploymentInfo = {
  deployed: new Date().toISOString(),
  version: manifest.version,
  targetProject: TARGET_PROJECT,
  filesDeployed: successCount,
  errors: errorCount
};
fs.writeFileSync(
  path.join(_TARGET_DIR, '.deployment-info.json'),
  JSON.stringify(_deploymentInfo, null, 2)
);
// Summary
console.log('\n' + '='.repeat(50));
console.log('Deployment Summary:');
console.log(`  Files deployed: ${successCount}`);
console.log(`  Errors: ${errorCount}`);
console.log(`  Target project: ${TARGET_PROJECT}`);
console.log(`  Template version: ${manifest.version}`);
if (errorCount === 0) {
  console.log('\n🎉 Template deployed successfully!');
  console.log('\nNext steps:');
  console.log('1. Open Claude Code in your project');
  console.log('2. Type / to see available commands');
  console.log('3. Use /sparc for SPARC methodology');
  console.log('4. Use /claude-flow-* for Claude Flow features');
  console.log('\nFor _help, see the documentation files in .claude/');
} else {
  console.log('\n⚠️  Template deployed with errors. Please check the messages above.');
}