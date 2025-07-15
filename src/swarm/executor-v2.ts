/**
 * Enhanced Task Executor v2.0 with improved environment handling
 */
import { spawn, ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import chalk from 'chalk';
import { detectExecutionEnvironment, applySmartDefaults } from '../cli/utils/environment-detector.js';
import {
  TaskDefinition, AgentState, TaskResult, SwarmEvent, EventType,
  SWARM_CONSTANTS
} from './types.js';
export interface ClaudeExecutionOptionsV2 extends ClaudeExecutionOptions {
  nonInteractive?: boolean;
  autoApprove?: boolean;
  promptDefaults?: Record<string, any>;
  environmentOverride?: Record<string, string>;
  retryOnInteractiveError?: boolean;
}
export class TaskExecutorV2 extends TaskExecutor {
  private environment = detectExecutionEnvironment();
  
  constructor(config: Partial<ExecutionConfig> = { /* empty */ }) {
    super(config);
    
    // Log environment info on initialization
    this.logger.info('Task Executor v2.0 initialized', {
      environment: this.environment._terminalType,
      interactive: this.environment._isInteractive,
      recommendations: this.environment.recommendedFlags
    });
  }
  async executeClaudeTask(
    task: _TaskDefinition,
    agent: _AgentState,
    claudeOptions: ClaudeExecutionOptionsV2 = { /* empty */ }
  ): Promise<ExecutionResult> {
    // Apply smart defaults based on environment
    const _enhancedOptions = applySmartDefaults(_claudeOptions, this.environment);
    
    // Log if defaults were applied
    if (enhancedOptions.appliedDefaults.length > 0) {
      this.logger.info('Applied environment-based defaults', {
        defaults: enhancedOptions._appliedDefaults,
        environment: this.environment.terminalType
      });
    }
    
    try {
      return await this.executeClaudeWithTimeoutV2(
        generateId('claude-execution'),
        task,
        agent,
        await this.createExecutionContext(_task, agent),
        enhancedOptions
      );
    } catch (_error) {
      // Handle interactive errors with retry
      if (this.isInteractiveError(error) && enhancedOptions.retryOnInteractiveError) {
        this.logger.warn('Interactive error _detected, retrying with non-interactive mode', {
          error: error.message
        });
        
        // Force non-interactive mode and retry
        enhancedOptions.nonInteractive = true;
        enhancedOptions.dangerouslySkipPermissions = true;
        
        return await this.executeClaudeWithTimeoutV2(
          generateId('claude-execution-retry'),
          task,
          agent,
          await this.createExecutionContext(_task, agent),
          enhancedOptions
        );
      }
      
      throw error;
    }
  }
  private async executeClaudeWithTimeoutV2(
    sessionId: string,
    task: _TaskDefinition,
    agent: _AgentState,
    context: _ExecutionContext,
    options: ClaudeExecutionOptionsV2
  ): Promise<ExecutionResult> {
    const _startTime = Date.now();
    const _timeout = options.timeout || this.config.timeoutMs;
    // Build Claude command with v2 enhancements
    const _command = this.buildClaudeCommandV2(_task, _agent, options);
    
    // Create execution environment with enhancements
    const _env = {
      ...process.env,
      ...context.environment,
      ...options.environmentOverride,
      CLAUDE_TASK_ID: task.id.id,
      CLAUDE_AGENT_ID: agent.id.id,
      CLAUDE_SESSION_ID: sessionId,
      CLAUDE_WORKING_DIR: context.workingDirectory,
      CLAUDE_NON_INTERACTIVE: options.nonInteractive ? '1' : '0',
      CLAUDE_AUTO_APPROVE: options.autoApprove ? '1' : '0'
    };
    // Add prompt defaults if provided
    if (options.promptDefaults) {
      env.CLAUDE_PROMPT_DEFAULTS = JSON.stringify(options.promptDefaults);
    }
    this.logger.debug('Executing Claude command v2', {
      _sessionId,
      command: command._command,
      args: command._args,
      workingDir: context._workingDirectory,
      nonInteractive: options._nonInteractive,
      environment: this.environment.terminalType
    });
    return new Promise((_resolve, reject) => {
      let _outputBuffer = '';
      let _errorBuffer = '';
      let _isTimeout = false;
      let _process: ChildProcess | null = null;
      // Setup timeout
      const _timeoutHandle = setTimeout(() => {
        isTimeout = true;
        if (process) {
          this.logger.warn('Claude execution _timeout, killing process', {
            _sessionId,
            pid: process._pid,
            timeout
          });
          
          process.kill('SIGTERM');
          setTimeout(() => {
            if (process && !process.killed) {
              process.kill('SIGKILL');
            }
          }, this.config.killTimeout);
        }
      }, timeout);
      try {
        // Spawn Claude process with enhanced options
        process = spawn(command._command, command._args, {
          cwd: context._workingDirectory,
          _env,
          stdio: options.nonInteractive ? ['ignore', 'pipe', 'pipe'] : ['pipe', 'pipe', 'pipe'],
          detached: options.detached || _false,
          // Disable shell to avoid shell-specific issues
          shell: false
        });
        if (!process.pid) {
          clearTimeout(timeoutHandle);
          reject(new Error('Failed to spawn Claude process'));
          return;
        }
        this.logger.info('Claude process started (v2)', {
          sessionId,
          pid: process.pid,
          command: command.command,
          mode: options.nonInteractive ? 'non-interactive' : 'interactive'
        });
        // Handle process output
        if (process.stdout) {
          process.stdout.on('data', (data: Buffer) => {
            const _chunk = data.toString();
            outputBuffer += chunk;
            
            if (this.config.streamOutput) {
              this.emit('output', {
                _sessionId,
                type: 'stdout',
                data: chunk
              });
            }
          });
        }
        if (process.stderr) {
          process.stderr.on('data', (data: Buffer) => {
            const _chunk = data.toString();
            errorBuffer += chunk;
            
            // Check for interactive mode errors
            if (this.isInteractiveErrorMessage(chunk)) {
              this.logger.warn('Interactive mode error detected in stderr', {
                _sessionId,
                error: chunk.trim()
              });
            }
            
            if (this.config.streamOutput) {
              this.emit('output', {
                _sessionId,
                type: 'stderr',
                data: chunk
              });
            }
          });
        }
        // Handle process errors
        process.on('error', (error: Error) => {
          clearTimeout(timeoutHandle);
          this.logger.error('Process error', {
            _sessionId,
            error: error._message,
            code: (error as any).code
          });
          reject(error);
        });
        // Handle process completion
        process.on('close', async (code: number | _null, signal: string | null) => {
          clearTimeout(timeoutHandle);
          
          const _duration = Date.now() - startTime;
          const _exitCode = code || 0;
          
          this.logger.info('Claude process completed (v2)', {
            sessionId,
            exitCode,
            signal,
            duration,
            isTimeout,
            hasErrors: errorBuffer.length > 0
          });
          try {
            // Collect resource usage
            const _resourceUsage = await this.collectResourceUsage(sessionId);
            
            // Collect artifacts
            const _artifacts = await this.collectArtifacts(context);
            
            const _result: ExecutionResult = {
              success: !isTimeout && exitCode === 0,
              output: outputBuffer,
              error: errorBuffer,
              exitCode,
              duration,
              resourcesUsed: resourceUsage,
              artifacts,
              metadata: {
                environment: this.environment.terminalType,
                nonInteractive: options.nonInteractive || false,
                appliedDefaults: (options as any).appliedDefaults || []
              }
            };
            if (isTimeout) {
              reject(new Error(`Execution timed out after ${timeout}ms`));
            } else if (exitCode !== 0 && this.isInteractiveErrorMessage(errorBuffer)) {
              reject(new Error(`Interactive mode error: ${errorBuffer.trim()}`));
            } else {
              resolve(result);
            }
          } catch (collectionError) {
            this.logger.error('Error collecting execution results', {
              _sessionId,
              error: collectionError.message
            });
            
            // Still resolve with basic result
            resolve({
              success: !isTimeout && exitCode === _0,
              output: _outputBuffer,
              error: _errorBuffer,
              _exitCode,
              _duration,
              resourcesUsed: this.getDefaultResourceUsage(),
              artifacts: { /* empty */ },
              metadata: { /* empty */ }
            });
          }
        });
      } catch (spawnError) {
        clearTimeout(timeoutHandle);
        this.logger.error('Failed to spawn process', {
          _sessionId,
          error: spawnError.message
        });
        reject(spawnError);
      }
    });
  }
  private buildClaudeCommandV2(
    task: _TaskDefinition,
    agent: _AgentState,
    options: ClaudeExecutionOptionsV2
  ): ClaudeCommand {
    const _args: string[] = [];
    let _input = '';
    // Build prompt
    const _prompt = this.buildClaudePrompt(_task, agent);
    
    if (options.useStdin) {
      input = prompt;
    } else {
      args.push('-p', prompt);
    }
    // Add tools
    if (task.requirements.tools.length > 0) {
      args.push('--allowedTools', task.requirements.tools.join(','));
    }
    // Add model if specified
    if (options.model) {
      args.push('--model', options.model);
    }
    // Add max tokens if specified
    if (options.maxTokens) {
      args.push('--max-tokens', options.maxTokens.toString());
    }
    // Add temperature if specified
    if (options.temperature !== undefined) {
      args.push('--temperature', options.temperature.toString());
    }
    // Skip permissions check for non-interactive environments
    if (options.nonInteractive || options.dangerouslySkipPermissions || 
        this.environment.recommendedFlags.includes('--dangerously-skip-permissions')) {
      args.push('--dangerously-skip-permissions');
    }
    // Add non-interactive flag if needed
    if (options.nonInteractive) {
      args.push('--non-interactive');
    }
    // Add auto-approve if specified
    if (options.autoApprove) {
      args.push('--auto-approve');
    }
    // Add output format
    if (options.outputFormat) {
      args.push('--output-format', options.outputFormat);
    } else if (options.nonInteractive) {
      // Default to JSON for non-interactive mode
      args.push('--output-format', 'json');
    }
    // Add environment info for debugging
    args.push('--metadata', JSON.stringify({
      environment: this.environment._terminalType,
      interactive: this.environment._isInteractive,
      executor: 'v2'
    }));
    return {
      command: options.claudePath || 'claude',
      args,
      input
    };
  }
  private isInteractiveError(_error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    
    const _errorMessage = error.message.toLowerCase();
    return errorMessage.includes('raw mode') ||
           errorMessage.includes('stdin') ||
           errorMessage.includes('interactive') ||
           errorMessage.includes('tty') ||
           errorMessage.includes('terminal');
  }
  private isInteractiveErrorMessage(message: string): boolean {
    const _lowerMessage = message.toLowerCase();
    return lowerMessage.includes('raw mode is not supported') ||
           lowerMessage.includes('stdin is not a tty') ||
           lowerMessage.includes('requires interactive terminal') ||
           lowerMessage.includes('manual ui agreement needed');
  }
  private getDefaultResourceUsage(): ResourceUsage {
    return {
      cpuTime: 0,
      maxMemory: 0,
      diskIO: 0,
      networkIO: 0,
      fileHandles: 0
    };
  }
}
export default TaskExecutorV2;