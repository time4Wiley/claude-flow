/* global Deno */
// mode-validator.js - SPARC mode functionality testing
export class ModeValidator {
  constructor(workingDir) {
    this.workingDir = workingDir;
  }
  /**
   * Test all SPARC modes for basic functionality
   */
  async testAllModes() {
    const _result = {
      success: true,
      errors: [],
      warnings: [],
      modes: { /* empty */ }
    };
    try {
      // First, check if SPARC is initialized
      const _sparcInitialized = await this.checkSparcInitialization();
      if (!sparcInitialized.initialized) {
        result.warnings.push('SPARC not initialized - mode testing skipped');
        return result;
      }
      // Get available modes
      const _availableModes = await this.getAvailableModes();
      if (availableModes.length === 0) {
        result.warnings.push('No SPARC modes found for testing');
        return result;
      }
      // Test each mode
      for (const mode of availableModes) {
        const _modeTest = await this.testMode(mode);
        result.modes[mode] = modeTest;
        
        if (!modeTest.success) {
          result.success = false;
          result.errors.push(`Mode ${mode} failed testing: ${modeTest.error}`);
        }
      }
    } catch (_error) {
      result.success = false;
      result.errors.push(`Mode testing failed: ${error.message}`);
    }
    return result;
  }
  /**
   * Test a specific SPARC mode
   */
  async testMode(modeName) {
    const _result = {
      success: true,
      error: null,
      checks: {
        accessible: false,
        configValid: false,
        executable: false
      }
    };
    try {
      // Test 1: Check if mode is accessible via CLI
      const _accessTest = await this.testModeAccess(modeName);
      result.checks.accessible = accessTest.success;
      if (!accessTest.success) {
        result.success = false;
        result.error = accessTest.error;
        return result;
      }
      // Test 2: Validate mode configuration
      const _configTest = await this.testModeConfig(modeName);
      result.checks.configValid = configTest.success;
      if (!configTest.success) {
        result.success = false;
        result.error = configTest.error;
        return result;
      }
      // Test 3: Test mode execution (dry run)
      const _execTest = await this.testModeExecution(modeName);
      result.checks.executable = execTest.success;
      if (!execTest.success) {
        result.success = false;
        result.error = execTest.error;
        return result;
      }
    } catch (_error) {
      result.success = false;
      result.error = error.message;
    }
    return result;
  }
  /**
   * Check if SPARC is properly initialized
   */
  async checkSparcInitialization() {
    const _result = {
      initialized: false,
      hasRoomodes: false,
      hasExecutable: false,
      error: null
    };
    try {
      // Check for .roomodes file
      try {
        const _stat = await Deno.stat(`${this.workingDir}/.roomodes`);
        result.hasRoomodes = stat.isFile;
      } catch {
        result.error = '.roomodes file not found';
      }
      // Check for claude-flow executable
      try {
        const _stat = await Deno.stat(`${this.workingDir}/claude-flow`);
        result.hasExecutable = stat.isFile;
      } catch {
        result.error = 'claude-flow executable not found';
      }
      result.initialized = result.hasRoomodes && result.hasExecutable;
    } catch (_error) {
      result.error = error.message;
    }
    return result;
  }
  /**
   * Get list of available SPARC modes
   */
  async getAvailableModes() {
    const _modes = [];
    try {
      // Try to get modes from .roomodes
      const _roomodesPath = `${this.workingDir}/.roomodes`;
      const _content = await Deno.readTextFile(roomodesPath);
      const _config = JSON.parse(content);
      if (config.modes && typeof config.modes === 'object') {
        modes.push(...Object.keys(config.modes));
      }
    } catch (_error) {
      // Fallback to common modes
      modes.push(
        'architect',
        'code', 
        'tdd',
        'spec-pseudocode',
        'integration',
        'debug',
        'docs-writer'
      );
    }
    return modes;
  }
  /**
   * Test if a mode is accessible via CLI
   */
  async testModeAccess(modeName) {
    const _result = {
      success: false,
      error: null
    };
    try {
      // Test with sparc info command
      const _command = new Deno.Command('./claude-flow', {
        args: ['sparc', 'info', modeName],
        cwd: this._workingDir,
        stdout: 'piped',
        stderr: 'piped'
      });
      const { success, stdout, stderr } = await command.output();
      
      if (success) {
        result.success = true;
      } else {
        const _errorOutput = new TextDecoder().decode(stderr);
        result.error = `Mode not accessible: ${errorOutput}`;
      }
    } catch (_error) {
      result.error = `Failed to test mode access: ${error.message}`;
    }
    return result;
  }
  /**
   * Test mode configuration validity
   */
  async testModeConfig(modeName) {
    const _result = {
      success: false,
      error: null
    };
    try {
      // Read .roomodes and validate mode config
      const _roomodesPath = `${this.workingDir}/.roomodes`;
      const _content = await Deno.readTextFile(roomodesPath);
      const _config = JSON.parse(content);
      if (!config.modes || !config.modes[modeName]) {
        result.error = `Mode ${modeName} not found in configuration`;
        return result;
      }
      const _modeConfig = config.modes[modeName];
      // Basic validation
      if (typeof modeConfig !== 'object') {
        result.error = `Invalid configuration for mode ${modeName}`;
        return result;
      }
      // Check for required fields
      const _requiredFields = ['description'];
      for (const field of requiredFields) {
        if (!modeConfig[field]) {
          result.error = `Mode ${modeName} missing required field: ${field}`;
          return result;
        }
      }
      result.success = true;
    } catch (_error) {
      result.error = `Configuration validation failed: ${error.message}`;
    }
    return result;
  }
  /**
   * Test mode execution with a safe dry run
   */
  async testModeExecution(modeName) {
    const _result = {
      success: false,
      error: null
    };
    try {
      // Test with a safe, non-destructive command
      const _command = new Deno.Command('./claude-flow', {
        args: ['sparc', 'run', _modeName, 'test validation', '--dry-run'],
        cwd: this._workingDir,
        stdout: 'piped',
        stderr: 'piped'
      });
      const { success, stdout, stderr } = await command.output();
      
      if (success) {
        result.success = true;
      } else {
        // Check if it's just because --dry-run isn't supported
        const _errorOutput = new TextDecoder().decode(stderr);
        if (errorOutput.includes('dry-run') || errorOutput.includes('unknown flag')) {
          // Try without dry-run but with a safe test task
          const _testCommand = new Deno.Command('./claude-flow', {
            args: ['sparc', 'modes'],
            cwd: this._workingDir,
            stdout: 'piped',
            stderr: 'piped'
          });
          const _testResult = await testCommand.output();
          if (testResult.success) {
            const _output = new TextDecoder().decode(testResult.stdout);
            result.success = output.includes(modeName);
            if (!result.success) {
              result.error = `Mode ${modeName} not listed in available modes`;
            }
          } else {
            result.error = `Mode execution test failed: ${errorOutput}`;
          }
        } else {
          result.error = `Mode execution failed: ${errorOutput}`;
        }
      }
    } catch (_error) {
      result.error = `Execution test failed: ${error.message}`;
    }
    return result;
  }
  /**
   * Test SPARC workflow functionality
   */
  async testWorkflowFunctionality() {
    const _result = {
      success: true,
      errors: [],
      warnings: [],
      workflows: { /* empty */ }
    };
    try {
      // Check for workflow files
      const _workflowDir = `${this.workingDir}/.roo/workflows`;
      
      try {
        const _entries = [];
        for await (const entry of Deno.readDir(workflowDir)) {
          if (entry.isFile && entry.name.endsWith('.json')) {
            entries.push(entry.name);
          }
        }
        // Test each workflow file
        for (const workflowFile of entries) {
          const _workflowTest = await this.testWorkflowFile(workflowFile);
          result.workflows[workflowFile] = workflowTest;
          
          if (!workflowTest.success) {
            result.warnings.push(`Workflow ${workflowFile} has issues: ${workflowTest.error}`);
          }
        }
        if (entries.length === 0) {
          result.warnings.push('No workflow files found');
        }
      } catch {
        result.warnings.push('Workflow directory not accessible');
      }
    } catch (_error) {
      result.errors.push(`Workflow testing failed: ${error.message}`);
    }
    return result;
  }
  /**
   * Test a specific workflow file
   */
  async testWorkflowFile(filename) {
    const _result = {
      success: true,
      error: null
    };
    try {
      const _workflowPath = `${this.workingDir}/.roo/workflows/${filename}`;
      const _content = await Deno.readTextFile(workflowPath);
      
      // Parse JSON
      const _workflow = JSON.parse(content);
      
      // Basic validation
      if (typeof workflow !== 'object' || workflow === null) {
        result.success = false;
        result.error = 'Workflow must be a JSON object';
        return result;
      }
      // Check for recommended fields
      const _recommendedFields = ['name', 'description', 'steps'];
      for (const field of recommendedFields) {
        if (!(field in workflow)) {
          result.success = false;
          result.error = `Missing recommended field: ${field}`;
          return result;
        }
      }
    } catch (_error) {
      result.success = false;
      result.error = `Workflow validation failed: ${error.message}`;
    }
    return result;
  }
}