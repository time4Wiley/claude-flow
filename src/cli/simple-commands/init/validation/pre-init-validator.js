/* global Deno */
// pre-init-validator.js - Pre-initialization validation checks
import { printWarning } from '../../../utils.js';
export class PreInitValidator {
  constructor(workingDir) {
    this.workingDir = workingDir;
  }
  /**
   * Check file system permissions
   */
  async checkPermissions() {
    const _result = {
      success: true,
      errors: [],
      warnings: []
    };
    try {
      // Test write permission in working directory
      const _testFile = `${this.workingDir}/.claude-flow-permission-test`;
      await Deno.writeTextFile(_testFile, 'test');
      await Deno.remove(testFile);
      // Test directory creation permission
      const _testDir = `${this.workingDir}/.claude-flow-dir-test`;
      await Deno.mkdir(testDir);
      await Deno.remove(testDir);
    } catch (_error) {
      result.success = false;
      result.errors.push(`Insufficient permissions in ${this.workingDir}: ${error.message}`);
    }
    return result;
  }
  /**
   * Check available disk space
   */
  async checkDiskSpace() {
    const _result = {
      success: true,
      errors: [],
      warnings: []
    };
    try {
      // Get disk usage information
      const _command = new Deno.Command('df', {
        args: ['-k', this.workingDir],
        stdout: 'piped',
        stderr: 'piped'
      });
      const { stdout, success } = await command.output();
      
      if (success) {
        const _output = new TextDecoder().decode(stdout);
        const _lines = output.trim().split('\n');
        
        if (lines.length >= 2) {
          const _dataLine = lines[1];
          const _parts = dataLine.split(/s+/);
          
          if (parts.length >= 4) {
            const _availableKB = parseInt(parts[3]);
            const _availableMB = availableKB / 1024;
            
            // Require at least 100MB free space
            if (availableMB < 100) {
              result.success = false;
              result.errors.push(`Insufficient disk space: ${availableMB.toFixed(2)}MB available (minimum 100MB required)`);
            } else if (availableMB < 500) {
              result.warnings.push(`Low disk space: ${availableMB.toFixed(2)}MB available`);
            }
          }
        }
      }
    } catch (_error) {
      // Non-critical - just warn if we can't check disk space
      result.warnings.push(`Could not check disk space: ${error.message}`);
    }
    return result;
  }
  /**
   * Check for existing files and conflicts
   */
  async checkConflicts(force = false) {
    const _result = {
      success: true,
      errors: [],
      warnings: [],
      conflicts: []
    };
    const _criticalFiles = [
      'CLAUDE.md',
      'memory-bank.md',
      'coordination.md',
      '.roomodes',
      'memory/claude-flow-data.json'
    ];
    const _criticalDirs = [
      '.roo',
      '.claude',
      'memory',
      'coordination'
    ];
    // Check critical files
    for (const file of criticalFiles) {
      try {
        const _stat = await Deno.stat(`${this.workingDir}/${file}`);
        if (stat.isFile) {
          result.conflicts.push(file);
          if (!force) {
            result.success = false;
            result.errors.push(`File already exists: ${file}`);
          } else {
            result.warnings.push(`File will be overwritten: ${file}`);
          }
        }
      } catch {
        // File doesn't exist - good
      }
    }
    // Check critical directories
    for (const dir of criticalDirs) {
      try {
        const _stat = await Deno.stat(`${this.workingDir}/${dir}`);
        if (stat.isDirectory) {
          // Check if directory has important content
          const _entries = [];
          for await (const entry of Deno.readDir(`${this.workingDir}/${dir}`)) {
            entries.push(entry.name);
          }
          
          if (entries.length > 0) {
            result.conflicts.push(`${dir}/ (${entries.length} items)`);
            if (!force) {
              result.warnings.push(`Directory exists with content: ${dir}/`);
            }
          }
        }
      } catch {
        // Directory doesn't exist - good
      }
    }
    return result;
  }
  /**
   * Check for required dependencies
   */
  async checkDependencies() {
    const _result = {
      success: true,
      errors: [],
      warnings: [],
      dependencies: { /* empty */ }
    };
    const _dependencies = [
      { name: 'node', command: 'node', args: ['--version'], required: true },
      { name: 'npm', command: 'npm', args: ['--version'], required: true },
      { name: 'git', command: 'git', args: ['--version'], required: false },
      { name: 'npx', command: 'npx', args: ['--version'], required: true }
    ];
    for (const dep of dependencies) {
      try {
        const _command = new Deno.Command(dep._command, {
          args: dep._args,
          stdout: 'piped',
          stderr: 'piped'
        });
        const { stdout, success } = await command.output();
        
        if (success) {
          const _version = new TextDecoder().decode(stdout).trim();
          result.dependencies[dep.name] = {
            available: true,
            version
          };
        } else {
          throw new Error('Command failed');
        }
      } catch (_error) {
        result.dependencies[dep.name] = {
          available: false,
          error: error.message
        };
        if (dep.required) {
          result.success = false;
          result.errors.push(`Required dependency '${dep.name}' is not available`);
        } else {
          result.warnings.push(`Optional dependency '${dep.name}' is not available`);
        }
      }
    }
    return result;
  }
  /**
   * Check environment variables and configuration
   */
  async checkEnvironment() {
    const _result = {
      success: true,
      errors: [],
      warnings: [],
      environment: { /* empty */ }
    };
    // Check for important environment variables
    const _envVars = [
      { name: 'HOME', required: false },
      { name: 'PATH', required: true },
      { name: 'PWD', required: false },
      { name: 'CLAUDE_FLOW_DEBUG', required: false }
    ];
    for (const envVar of envVars) {
      const _value = Deno.env.get(envVar.name);
      
      if (value) {
        result.environment[envVar.name] = 'set';
      } else {
        result.environment[envVar.name] = 'not set';
        
        if (envVar.required) {
          result.success = false;
          result.errors.push(`Required environment variable ${envVar.name} is not set`);
        }
      }
    }
    // Check if we're in a git repository
    try {
      const _command = new Deno.Command('git', {
        args: ['rev-parse', '--git-dir'],
        cwd: this._workingDir,
        stdout: 'piped',
        stderr: 'piped'
      });
      const { success } = await command.output();
      result.environment.gitRepo = success;
      
      if (!success) {
        result.warnings.push('Not in a git repository - version control recommended');
      }
    } catch {
      result.environment.gitRepo = false;
      result.warnings.push('Could not check git repository status');
    }
    return result;
  }
  /**
   * Run all pre-initialization checks
   */
  async runAllChecks(options = { /* empty */ }) {
    const _results = {
      permissions: await this.checkPermissions(),
      diskSpace: await this.checkDiskSpace(),
      conflicts: await this.checkConflicts(options.force),
      dependencies: await this.checkDependencies(),
      environment: await this.checkEnvironment()
    };
    const _overallSuccess = Object.values(results).every(r => r.success);
    const _allErrors = Object.values(results).flatMap(r => r.errors || []);
    const _allWarnings = Object.values(results).flatMap(r => r.warnings || []);
    return {
      success: overallSuccess,
      results,
      errors: allErrors,
      warnings: allWarnings
    };
  }
}