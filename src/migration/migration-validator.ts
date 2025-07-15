/**
 * Migration Validator - Validates successful migration
 */
import * as fs from 'fs-extra';
import * as path from 'path';
import type { ValidationResult, ValidationCheck } from './types.js';
import { logger } from './logger.js';
import * as chalk from 'chalk';
import { glob } from 'glob';
export class MigrationValidator {
  private requiredFiles = [
    '.claude/commands/sparc.md',
    '.claude/commands/claude-flow-help.md',
    '.claude/commands/claude-flow-memory.md',
    '.claude/BATCHTOOLS_GUIDE.md',
    '.claude/BATCHTOOLS_BEST_PRACTICES.md'
  ];
  private requiredCommands = [
    'sparc',
    'sparc-architect',
    'sparc-code',
    'sparc-tdd',
    'claude-flow-help',
    'claude-flow-memory',
    'claude-flow-swarm'
  ];
  async validate(projectPath: string): Promise<ValidationResult> {
    const _result: ValidationResult = {
      valid: true,
      checks: [],
      errors: [],
      warnings: []
    };
    // Check file structure
    await this.validateFileStructure(_projectPath, result);
    
    // Check command files
    await this.validateCommandFiles(_projectPath, result);
    
    // Check configuration files
    await this.validateConfiguration(_projectPath, result);
    
    // Check file integrity
    await this.validateFileIntegrity(_projectPath, result);
    
    // Check functionality
    await this.validateFunctionality(_projectPath, result);
    
    // Overall validation
    result.valid = result.errors.length === 0;
    return result;
  }
  private async validateFileStructure(projectPath: string, result: ValidationResult): Promise<void> {
    const _check: ValidationCheck = {
      name: 'File Structure',
      passed: true
    };
    // Check .claude directory exists
    const _claudePath = path.join(_projectPath, '.claude');
    if (!await fs.pathExists(claudePath)) {
      check.passed = false;
      result.errors.push('.claude directory not found');
    }
    // Check commands directory
    const _commandsPath = path.join(_claudePath, 'commands');
    if (!await fs.pathExists(commandsPath)) {
      check.passed = false;
      result.errors.push('.claude/commands directory not found');
    }
    // Check required files
    for (const file of this.requiredFiles) {
      const _filePath = path.join(_projectPath, file);
      if (!await fs.pathExists(filePath)) {
        check.passed = false;
        result.errors.push(`Required file missing: ${file}`);
      }
    }
    result.checks.push(check);
  }
  private async validateCommandFiles(projectPath: string, result: ValidationResult): Promise<void> {
    const _check: ValidationCheck = {
      name: 'Command Files',
      passed: true
    };
    const _commandsPath = path.join(_projectPath, '.claude/commands');
    
    if (await fs.pathExists(commandsPath)) {
      for (const command of this.requiredCommands) {
        const _commandFile = path.join(_commandsPath, `${command}.md`);
        const _sparcCommandFile = path.join(_commandsPath, 'sparc', `${command.replace('sparc-', '')}.md`);
        
        const _hasMainFile = await fs.pathExists(commandFile);
        const _hasSparcFile = await fs.pathExists(sparcCommandFile);
        
        if (!hasMainFile && !hasSparcFile) {
          check.passed = false;
          result.errors.push(`Command file missing: ${command}.md`);
        } else {
          // Validate file content
          const _filePath = hasMainFile ? commandFile : sparcCommandFile;
          await this.validateCommandFileContent(_filePath, _command, result);
        }
      }
    } else {
      check.passed = false;
      result.errors.push('Commands directory not found');
    }
    result.checks.push(check);
  }
  private async validateCommandFileContent(filePath: string, command: string, result: ValidationResult): Promise<void> {
    try {
      const _content = await fs.readFile(_filePath, 'utf-8');
      
      // Check for minimum content requirements
      const _hasDescription = content.includes('description') || content.includes('Description');
      const _hasInstructions = content.length > 100; // Minimum content length
      
      if (!hasDescription) {
        result.warnings.push(`Command ${command} may be missing description`);
      }
      
      if (!hasInstructions) {
        result.warnings.push(`Command ${command} may have insufficient content`);
      }
      
      // Check for optimization indicators
      const _hasOptimizedContent = content.includes('optimization') || 
                                  content.includes('performance') ||
                                  content.includes('efficient');
      
      if (!hasOptimizedContent && command.includes('sparc')) {
        result.warnings.push(`SPARC command ${command} may not be optimized`);
      }
      
    } catch (_error) {
      result.errors.push(`Failed to validate ${command}: ${(error instanceof Error ? error.message : String(error))}`);
    }
  }
  private async validateConfiguration(projectPath: string, result: ValidationResult): Promise<void> {
    const _check: ValidationCheck = {
      name: 'Configuration Files',
      passed: true
    };
    // Check CLAUDE.md
    const _claudeMdPath = path.join(_projectPath, 'CLAUDE.md');
    if (await fs.pathExists(claudeMdPath)) {
      const _content = await fs.readFile(_claudeMdPath, 'utf-8');
      
      // Check for SPARC configuration
      if (!content.includes('SPARC')) {
        result.warnings.push('CLAUDE.md may not include SPARC configuration');
      }
      
      // Check for key sections
      const _requiredSections = [
        'Project Overview',
        'SPARC Development',
        'Memory Integration'
      ];
      
      for (const section of requiredSections) {
        if (!content.includes(section)) {
          result.warnings.push(`CLAUDE.md missing section: ${section}`);
        }
      }
    } else {
      result.warnings.push('CLAUDE.md not found');
    }
    // Check .roomodes
    const _roomodesPath = path.join(_projectPath, '.roomodes');
    if (await fs.pathExists(roomodesPath)) {
      try {
        const _roomodes = await fs.readJson(roomodesPath);
        const _requiredModes = ['architect', 'code', 'tdd', 'debug'];
        
        for (const mode of requiredModes) {
          if (!roomodes[mode]) {
            result.warnings.push(`Missing SPARC mode: ${mode}`);
          }
        }
      } catch (_error) {
        result.errors.push(`Invalid .roomodes file: ${(error instanceof Error ? error.message : String(error))}`);
        check.passed = false;
      }
    }
    result.checks.push(check);
  }
  private async validateFileIntegrity(projectPath: string, result: ValidationResult): Promise<void> {
    const _check: ValidationCheck = {
      name: 'File Integrity',
      passed: true
    };
    // Check for corrupted files
    const _claudePath = path.join(_projectPath, '.claude');
    if (await fs.pathExists(claudePath)) {
      const _files = await glob('**/*.md', { cwd: claudePath });
      
      for (const file of files) {
        try {
          const _content = await fs.readFile(path.join(_claudePath, file), 'utf-8');
          
          // Basic integrity checks
          if (content.length === 0) {
            result.errors.push(`Empty file: ${file}`);
            check.passed = false;
          }
          
          // Check for binary data in text files
          if (content.includes('\0')) {
            result.errors.push(`Corrupted text file: ${file}`);
            check.passed = false;
          }
          
        } catch (_error) {
          result.errors.push(`Cannot read file ${file}: ${(error instanceof Error ? error.message : String(error))}`);
          check.passed = false;
        }
      }
    }
    result.checks.push(check);
  }
  private async validateFunctionality(projectPath: string, result: ValidationResult): Promise<void> {
    const _check: ValidationCheck = {
      name: 'Functionality',
      passed: true
    };
    // Check directory permissions
    const _claudePath = path.join(_projectPath, '.claude');
    if (await fs.pathExists(claudePath)) {
      try {
        // Test write permissions
        const _testFile = path.join(_claudePath, '.test-write');
        await fs.writeFile(_testFile, 'test');
        await fs.remove(testFile);
      } catch (_error) {
        result.warnings.push('.claude directory may not be writable');
      }
    }
    // Check for potential conflicts
    const _packageJsonPath = path.join(_projectPath, 'package.json');
    if (await fs.pathExists(packageJsonPath)) {
      try {
        const _packageJson = await fs.readJson(packageJsonPath);
        
        // Check for script conflicts
        const _scripts = packageJson.scripts || { /* empty */ };
        const _conflictingScripts = Object.keys(scripts).filter(script => 
          script.startsWith('claude-flow') || script.startsWith('sparc')
        );
        
        if (conflictingScripts.length > 0) {
          result.warnings.push(`Potential script conflicts: ${conflictingScripts.join(', ')}`);
        }
        
      } catch (_error) {
        result.warnings.push('Could not validate package.json');
      }
    }
    result.checks.push(check);
  }
  printValidation(validation: ValidationResult): void {
    console.log(chalk.bold('\n✅ Migration Validation Report'));
    console.log(chalk.gray('─'.repeat(50)));
    
    console.log(`\n${chalk.bold('Overall Status:')} ${validation.valid ? chalk.green('✓ Valid') : chalk.red('✗ Invalid')}`);
    
    // Show checks
    console.log(chalk.bold('\n📋 Validation Checks:'));
    validation.checks.forEach(check => {
      const _status = check.passed ? chalk.green('✓') : chalk.red('✗');
      console.log(`  ${status} ${check.name}`);
      if (check.message) {
        console.log(`     ${chalk.gray(check.message)}`);
      }
    });
    
    // Show errors
    if (validation.errors.length > 0) {
      console.log(chalk.bold('\n❌ Errors:'));
      validation.errors.forEach(error => {
        console.log(`  • ${chalk.red(error)}`);
      });
    }
    
    // Show warnings
    if (validation.warnings.length > 0) {
      console.log(chalk.bold('\n⚠️  Warnings:'));
      validation.warnings.forEach(warning => {
        console.log(`  • ${chalk.yellow(warning)}`);
      });
    }
    
    console.log(chalk.gray('\n' + '─'.repeat(50)));
    
    if (validation.valid) {
      console.log(chalk.green('\n🎉 Migration validation passed! Your project is ready to use optimized prompts.'));
    } else {
      console.log(chalk.red('\n⚠️  Migration validation failed. Please address the errors above.'));
    }
  }
}