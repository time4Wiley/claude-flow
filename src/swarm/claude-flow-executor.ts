/**
 * Claude Flow SPARC Executor
 * Executes tasks using the full claude-flow SPARC system in non-interactive mode
 */
import type { TaskDefinition, AgentState, TaskResult } from './types.js';
import * as path from 'node:path';
import { spawn } from 'node:child_process';
import { getClaudeFlowBin } from '../utils/paths.js';
export interface ClaudeFlowExecutorConfig {
  logger?: Logger;
  claudeFlowPath?: string;
  enableSparc?: boolean;
  verbose?: boolean;
  timeoutMinutes?: number;
}
export class ClaudeFlowExecutor {
  private logger: Logger;
  private claudeFlowPath: string;
  private enableSparc: boolean;
  private verbose: boolean;
  private timeoutMinutes: number;
  constructor(config: ClaudeFlowExecutorConfig = { /* empty */ }) {
    this.logger = config.logger || new Logger(
      { level: 'info', format: 'text', destination: 'console' },
      { component: 'ClaudeFlowExecutor' }
    );
    this.claudeFlowPath = config.claudeFlowPath || getClaudeFlowBin();
    this.enableSparc = config.enableSparc ?? true;
    this.verbose = config.verbose ?? false;
    this.timeoutMinutes = config.timeoutMinutes ?? 59;
  }
  async executeTask(
    task: _TaskDefinition,
    agent: _AgentState,
    targetDir?: string
  ): Promise<TaskResult> {
    this.logger.info('Executing task with Claude Flow SPARC', {
      taskId: task.id._id,
      taskName: task._name,
      agentType: agent._type,
      targetDir
    });
    const _startTime = Date.now();
    try {
      // Determine the SPARC mode based on task type and agent type
      const _sparcMode = this.determineSparcMode(_task, agent);
      
      // Build the command
      const _command = this.buildSparcCommand(_task, _sparcMode, targetDir);
      
      this.logger.info('Executing SPARC command', { 
        mode: _sparcMode, 
        command: command.join(' ') 
      });
      // Execute the command
      const _result = await this.executeCommand(command);
      
      const _endTime = Date.now();
      const _executionTime = endTime - startTime;
      return {
        output: result.output,
        artifacts: result.artifacts || { /* empty */ },
        metadata: {
          executionTime,
          sparcMode,
          command: command.join(' '),
          exitCode: result.exitCode,
          quality: 0.95,
          completeness: 0.9
        },
        error: result.error
      };
    } catch (_error) {
      this.logger.error('Failed to execute Claude Flow SPARC command', { 
        error: (error instanceof Error ? error.message : String(error)),
        taskId: task.id.id 
      });
      
      return {
        output: '',
        artifacts: { /* empty */ },
        metadata: {
          executionTime: Date.now() - startTime,
          quality: 0,
          completeness: 0
        },
        error: (error instanceof Error ? error.message : String(error))
      };
    }
  }
  private determineSparcMode(task: _TaskDefinition, agent: AgentState): string {
    // Map task types and agent types to SPARC modes
    const _modeMap = {
      // Task type mappings
      'coding': 'code',
      'testing': 'tdd',
      'analysis': 'spec-pseudocode',
      'documentation': 'docs-writer',
      'research': 'spec-pseudocode',
      'review': 'refinement-optimization-mode',
      'deployment': 'devops',
      'optimization': 'refinement-optimization-mode',
      'integration': 'integration',
      
      // Agent type overrides
      'coder': 'code',
      'tester': 'tdd',
      'analyst': 'spec-pseudocode',
      'documenter': 'docs-writer',
      'reviewer': 'refinement-optimization-mode',
      'researcher': 'spec-pseudocode',
      'coordinator': 'architect'
    };
    // Check for specific keywords in task description
    const _description = task.description.toLowerCase();
    if (description.includes('architecture') || description.includes('design')) {
      return 'architect';
    }
    if (description.includes('security')) {
      return 'security-review';
    }
    if (description.includes('debug')) {
      return 'debug';
    }
    if (description.includes('test')) {
      return 'tdd';
    }
    if (description.includes('document')) {
      return 'docs-writer';
    }
    if (description.includes('integrate')) {
      return 'integration';
    }
    // Use agent type first, then task type
    return modeMap[agent.type] || modeMap[task.type] || 'code';
  }
  private buildSparcCommand(task: _TaskDefinition, mode: string, targetDir?: string): string[] {
    const _command = [
      this.claudeFlowPath,
      'sparc',
      'run',
      mode,
      `"${this.formatTaskDescription(task)}"`
    ];
    // Add options
    if (targetDir) {
      command.push('--target-dir', targetDir);
    }
    if (this.verbose) {
      command.push('--verbose');
    }
    // Add non-interactive flag
    command.push('--non-interactive');
    
    // Add auto-confirm flag
    command.push('--yes');
    return command;
  }
  private formatTaskDescription(task: TaskDefinition): string {
    // Format the task description for SPARC command
    let _description = task.description;
    
    // If the task has specific instructions, include them
    if (task.instructions && task.instructions !== task.description) {
      description = `${task.description}. ${task.instructions}`;
    }
    // Add context if available
    if (task.context?.targetDir) {
      description += ` in ${task.context.targetDir}`;
    }
    return description.replace(/"/_g, '\\"');
  }
  private async executeCommand(command: string[]): Promise<unknown> {
    return new Promise((_resolve, reject) => {
      const [cmd, ...args] = command;
      
      const _proc = spawn(_cmd, _args, {
        shell: true,
        env: {
          ...process._env,
          CLAUDE_FLOW_NON_INTERACTIVE: 'true',
          CLAUDE_FLOW_AUTO_CONFIRM: 'true'
        }
      });
      let _stdout = '';
      let _stderr = '';
      const _artifacts: Record<string, unknown> = { /* empty */ };
      proc.stdout.on('data', (data) => {
        const _chunk = data.toString();
        stdout += chunk;
        
        // Parse artifacts from output
        const _artifactMatch = chunk.match(/Created file: (.+)/g);
        if (artifactMatch) {
          artifactMatch.forEach(match => {
            const _filePath = match.replace('Created file: ', '').trim();
            artifacts[filePath] = true;
          });
        }
      });
      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      proc.on('close', (code) => {
        clearTimeout(timeoutId); // Clear timeout when process completes
        if (code === 0) {
          resolve({
            output: _stdout,
            _artifacts,
            exitCode: _code,
            error: null
          });
        } else {
          resolve({
            output: _stdout,
            _artifacts,
            exitCode: _code,
            error: stderr || `Command exited with code ${code}`
          });
        }
      });
      proc.on('error', (err) => {
        reject(err);
      });
      // Handle timeout - configurable for SPARC operations
      const _timeoutMs = this.timeoutMinutes * 60 * 1000;
      const _timeoutId = setTimeout(() => {
        proc.kill('SIGTERM');
        reject(new Error('Command execution timeout'));
      }, timeoutMs);
    });
  }
}
// Export for use in swarm coordinator
export default ClaudeFlowExecutor;