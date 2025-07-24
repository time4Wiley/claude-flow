#!/usr/bin/env node

import { WebSocket } from 'ws';
import chalk from 'chalk';
import ora from 'ora';

const WS_URL = 'ws://localhost:8080';

// All 87 tools with sample parameters
const TOOLS_TO_VERIFY = [
  // Swarm Management (Core)
  { name: 'swarm_init', params: { topology: 'mesh', maxAgents: 5 } },
  { name: 'agent_spawn', params: { type: 'researcher', name: 'Verifier' } },
  { name: 'agent_assign', params: { agentId: 'auto', task: 'verification' } },
  { name: 'agent_communicate', params: { from: 'auto', to: 'auto', message: 'test' } },
  { name: 'agent_status', params: { agentId: 'auto' } },
  { name: 'agent_terminate', params: { agentId: 'auto' } },
  { name: 'agent_list', params: {} },
  { name: 'agent_metrics', params: {} },
  { name: 'swarm_status', params: {} },
  { name: 'swarm_monitor', params: { duration: 1000 } },
  { name: 'swarm_topology', params: { action: 'get' } },
  { name: 'swarm_optimize', params: {} },
  { name: 'swarm_export', params: {} },
  { name: 'swarm_import', params: { config: {} } },
  { name: 'swarm_reset', params: {} },

  // Task Orchestration
  { name: 'task_orchestrate', params: { task: 'verify tools' } },
  { name: 'task_status', params: { taskId: 'auto' } },
  { name: 'task_assign', params: { taskId: 'auto', agentId: 'auto' } },
  { name: 'task_progress', params: { taskId: 'auto', progress: 50 } },
  { name: 'task_complete', params: { taskId: 'auto' } },
  { name: 'task_cancel', params: { taskId: 'auto' } },
  { name: 'task_results', params: { taskId: 'auto' } },
  { name: 'task_dependencies', params: { taskId: 'auto' } },
  { name: 'task_priority', params: { taskId: 'auto', priority: 'high' } },

  // Memory Management
  { name: 'memory_usage', params: { action: 'store', key: 'test', value: 'data' } },
  { name: 'memory_search', params: { query: 'test' } },
  { name: 'memory_analyze', params: {} },
  { name: 'memory_optimize', params: {} },
  { name: 'memory_export', params: {} },
  { name: 'memory_import', params: { data: {} } },
  { name: 'memory_clear', params: { pattern: 'test/*' } },

  // Neural Network Operations
  { name: 'neural_status', params: {} },
  { name: 'neural_train', params: { pattern: 'test', data: {} } },
  { name: 'neural_predict', params: { input: 'test query' } },
  { name: 'neural_patterns', params: {} },
  { name: 'neural_export', params: {} },
  { name: 'neural_import', params: { model: {} } },
  { name: 'neural_optimize', params: {} },
  { name: 'neural_reset', params: { model: 'all' } },

  // Process Management
  { name: 'process_list', params: {} },
  { name: 'process_start', params: { command: 'echo test' } },
  { name: 'process_stop', params: { processId: 'auto' } },
  { name: 'process_restart', params: { processId: 'auto' } },
  { name: 'process_logs', params: { processId: 'auto' } },
  { name: 'process_config', params: { processId: 'auto' } },
  { name: 'process_stats', params: { processId: 'auto' } },

  // Command Execution
  { name: 'cmd_exec', params: { command: 'echo "verification"' } },
  { name: 'terminal_create', params: {} },
  { name: 'terminal_execute', params: { terminalId: 'auto', command: 'ls' } },
  { name: 'terminal_close', params: { terminalId: 'auto' } },
  { name: 'terminal_list', params: {} },
  { name: 'script_run', params: { script: 'echo test' } },
  { name: 'script_validate', params: { script: 'echo test' } },

  // Configuration
  { name: 'config_get', params: { key: 'test' } },
  { name: 'config_set', params: { key: 'test', value: 'value' } },
  { name: 'config_reset', params: {} },
  { name: 'config_validate', params: {} },
  { name: 'config_export', params: {} },
  { name: 'config_import', params: { config: {} } },

  // GitHub Integration
  { name: 'github_swarm', params: { repository: 'test/repo' } },
  { name: 'repo_analyze', params: { repository: 'test/repo' } },
  { name: 'pr_enhance', params: { pr_number: 1 } },
  { name: 'issue_triage', params: { issue_number: 1 } },
  { name: 'code_review', params: { pr_number: 1 } },
  { name: 'github_webhook', params: { event: 'push' } },
  { name: 'github_status', params: {} },

  // Workflow Management
  { name: 'workflow_create', params: { name: 'test', steps: [] } },
  { name: 'workflow_run', params: { workflowId: 'auto' } },
  { name: 'workflow_status', params: { workflowId: 'auto' } },
  { name: 'workflow_stop', params: { workflowId: 'auto' } },
  { name: 'workflow_list', params: {} },
  { name: 'workflow_export', params: { workflowId: 'auto' } },

  // Performance & Monitoring
  { name: 'benchmark_run', params: { type: 'basic' } },
  { name: 'perf_analyze', params: {} },
  { name: 'metrics_collect', params: {} },
  { name: 'health_check', params: {} },

  // Debugging Tools
  { name: 'debug_enable', params: {} },
  { name: 'debug_disable', params: {} },
  { name: 'debug_breakpoint', params: { location: 'test.js:10' } },
  { name: 'debug_step', params: {} },
  { name: 'debug_inspect', params: { variable: 'test' } },
  { name: 'debug_trace', params: {} },

  // System Operations
  { name: 'system_info', params: {} },
  { name: 'system_health', params: {} },
  { name: 'system_restart', params: { component: 'swarm' } },
  { name: 'system_logs', params: { tail: 100 } },
  { name: 'system_metrics', params: {} },

  // Feature Detection
  { name: 'features_detect', params: {} }
];

class ToolVerifier {
  constructor() {
    this.ws = null;
    this.messageId = 0;
    this.results = {
      total: 0,
      success: 0,
      failed: 0,
      errors: []
    };
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(WS_URL);
      
      this.ws.on('open', () => {
        console.log(chalk.green('✓ Connected to MCP WebSocket server'));
        resolve();
      });
      
      this.ws.on('error', (error) => {
        console.error(chalk.red('✗ Connection error:'), error);
        reject(error);
      });
    });
  }

  async sendRequest(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.messageId;
      const request = {
        jsonrpc: '2.0',
        id,
        method,
        params
      };

      const timeout = setTimeout(() => {
        reject(new Error('Request timed out'));
      }, 10000);

      const handler = (data) => {
        try {
          const response = JSON.parse(data.toString());
          if (response.id === id) {
            clearTimeout(timeout);
            this.ws.removeListener('message', handler);
            if (response.error) {
              reject(new Error(response.error.message));
            } else {
              resolve(response.result);
            }
          }
        } catch (err) {
          // Handle streaming responses
        }
      };

      this.ws.on('message', handler);
      this.ws.send(JSON.stringify(request));
    });
  }

  async verifyTool(tool) {
    const spinner = ora(`Verifying ${chalk.cyan(tool.name)}...`).start();
    
    try {
      const result = await this.sendRequest('tools/call', {
        name: tool.name,
        arguments: tool.params
      });

      // Check if result contains real data (not mock)
      if (result && result.content && result.content[0]) {
        const content = result.content[0].text;
        
        // Verify it's not a mock response
        if (content.includes('Mock') || content.includes('TODO') || content.includes('placeholder')) {
          throw new Error('Tool returned mock data');
        }

        // Tool-specific verification
        const verified = this.verifyToolResult(tool.name, content);
        
        if (verified) {
          spinner.succeed(`${chalk.cyan(tool.name)} - ${chalk.green('VERIFIED')} ✓`);
          this.results.success++;
          return { tool: tool.name, status: 'success', content };
        } else {
          throw new Error('Tool result verification failed');
        }
      } else {
        throw new Error('Invalid response structure');
      }
    } catch (error) {
      spinner.fail(`${chalk.cyan(tool.name)} - ${chalk.red('FAILED')} ✗`);
      console.error(chalk.gray(`  Error: ${error.message}`));
      this.results.failed++;
      this.results.errors.push({ tool: tool.name, error: error.message });
      return { tool: tool.name, status: 'failed', error: error.message };
    }
  }

  verifyToolResult(toolName, content) {
    // Tool-specific verification logic
    const verifications = {
      'swarm_init': () => content.includes('Swarm initialized') && content.includes('topology'),
      'agent_spawn': () => content.includes('Agent spawned') && /ID: [a-f0-9-]+/.test(content),
      'memory_usage': () => content.includes('Memory') && (content.includes('stored') || content.includes('retrieved')),
      'neural_train': () => content.includes('Neural') && content.includes('trained'),
      'task_orchestrate': () => content.includes('Task') && /Task ID: [a-f0-9-]+/.test(content),
      'process_list': () => content.includes('Process') || content.includes('No active processes'),
      'cmd_exec': () => content.includes('Command executed') || content.includes('Output'),
      'config_get': () => content.includes('Config') || content.includes('value'),
      'github_swarm': () => content.includes('GitHub') || content.includes('token not configured'),
      'benchmark_run': () => content.includes('Benchmark') && content.includes('completed'),
      'system_info': () => content.includes('System') && content.includes('information'),
      'features_detect': () => content.includes('Features') && content.includes('detected')
    };

    // Check if we have specific verification for this tool
    if (verifications[toolName]) {
      return verifications[toolName]();
    }

    // Generic verification - ensure it's not empty and contains relevant content
    return content.length > 10 && !content.includes('Error');
  }

  async verifyAllTools() {
    console.log(chalk.blue('\n═══════════════════════════════════════════'));
    console.log(chalk.blue.bold('  MCP WebSocket Tool Verification'));
    console.log(chalk.blue('═══════════════════════════════════════════\n'));

    this.results.total = TOOLS_TO_VERIFY.length;

    // Group tools by category for better output
    const categories = {
      'Swarm Management': TOOLS_TO_VERIFY.slice(0, 15),
      'Task Orchestration': TOOLS_TO_VERIFY.slice(15, 24),
      'Memory Management': TOOLS_TO_VERIFY.slice(24, 31),
      'Neural Operations': TOOLS_TO_VERIFY.slice(31, 39),
      'Process Management': TOOLS_TO_VERIFY.slice(39, 46),
      'Command Execution': TOOLS_TO_VERIFY.slice(46, 53),
      'Configuration': TOOLS_TO_VERIFY.slice(53, 59),
      'GitHub Integration': TOOLS_TO_VERIFY.slice(59, 66),
      'Workflow Management': TOOLS_TO_VERIFY.slice(66, 72),
      'Performance & Monitoring': TOOLS_TO_VERIFY.slice(72, 76),
      'Debugging': TOOLS_TO_VERIFY.slice(76, 82),
      'System Operations': TOOLS_TO_VERIFY.slice(82, 87),
      'Features': TOOLS_TO_VERIFY.slice(87)
    };

    for (const [category, tools] of Object.entries(categories)) {
      if (tools.length === 0) continue;
      
      console.log(chalk.yellow(`\n${category}:`));
      console.log(chalk.gray('─'.repeat(40)));
      
      for (const tool of tools) {
        await this.verifyTool(tool);
        await new Promise(resolve => setTimeout(resolve, 100)); // Small delay
      }
    }

    // Summary
    console.log(chalk.blue('\n═══════════════════════════════════════════'));
    console.log(chalk.blue.bold('  Verification Summary'));
    console.log(chalk.blue('═══════════════════════════════════════════\n'));
    
    console.log(`Total Tools: ${chalk.cyan(this.results.total)}`);
    console.log(`Verified: ${chalk.green(this.results.success)}`);
    console.log(`Failed: ${chalk.red(this.results.failed)}`);
    console.log(`Success Rate: ${chalk.yellow((this.results.success / this.results.total * 100).toFixed(1) + '%')}`);

    if (this.results.errors.length > 0) {
      console.log(chalk.red('\nFailed Tools:'));
      this.results.errors.forEach(err => {
        console.log(chalk.red(`  - ${err.tool}: ${err.error}`));
      });
    }

    // Save detailed results
    await this.saveResults();
  }

  async saveResults() {
    const timestamp = new Date().toISOString();
    const report = {
      timestamp,
      summary: this.results,
      tools: TOOLS_TO_VERIFY.length,
      verified: this.results.success,
      failed: this.results.failed,
      successRate: (this.results.success / this.results.total * 100).toFixed(1) + '%',
      errors: this.results.errors
    };

    try {
      const fs = await import('fs/promises');
      await fs.writeFile(
        'verification-report.json',
        JSON.stringify(report, null, 2)
      );
      console.log(chalk.green('\n✓ Detailed report saved to verification-report.json'));
    } catch (error) {
      console.error(chalk.red('Failed to save report:'), error);
    }
  }

  close() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

// Main execution
async function main() {
  const verifier = new ToolVerifier();
  
  try {
    await verifier.connect();
    await verifier.verifyAllTools();
  } catch (error) {
    console.error(chalk.red('Verification failed:'), error);
    process.exit(1);
  } finally {
    verifier.close();
  }
}

// Run verification
if (process.argv[1] === new URL(import.meta.url).pathname) {
  main().catch(console.error);
}

export { ToolVerifier };