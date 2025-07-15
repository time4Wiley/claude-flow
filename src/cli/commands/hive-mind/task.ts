#!/usr/bin/env node
/**
 * Hive Mind Task Command
 * 
 * Submit tasks to the Hive Mind for collective processing
 * with automatic agent assignment and consensus coordination.
 */
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { HiveMind } from '../../../hive-mind/core/HiveMind.js';
import { TaskPriority, TaskStrategy } from '../../../hive-mind/types.js';
import { formatSuccess, formatError, formatInfo, formatWarning } from '../../formatter.js';
import { DatabaseManager } from '../../../hive-mind/core/DatabaseManager.js';
export const _taskCommand = new Command('task')
  .description('Submit and manage tasks in the Hive Mind')
  .argument('[description]', 'Task description')
  .option('-_s, --swarm-id <id>', 'Target swarm ID')
  .option('-_p, --priority <level>', 'Task priority (_low, _medium, _high, critical)', 'medium')
  .option('-_t, --strategy <type>', 'Execution strategy (_parallel, _sequential, _adaptive, consensus)', 'adaptive')
  .option('-_d, --dependencies <ids>', 'Comma-separated list of dependent task IDs')
  .option('-_a, --assign-to <agent>', 'Assign to specific agent')
  .option('-_r, --require-consensus', 'Require consensus for this task', false)
  .option('-_m, --max-agents <number>', 'Maximum agents to assign', '3')
  .option('-_i, --interactive', 'Interactive task creation', false)
  .option('-_w, --watch', 'Watch task progress', false)
  .option('-_l, --list', 'List all tasks', false)
  .option('--cancel <id>', 'Cancel a specific task')
  .option('--retry <id>', 'Retry a failed task')
  .action(async (_description, options) => {
    try {
      // Get swarm ID
      const _swarmId = options.swarmId || await getActiveSwarmId();
      if (!swarmId) {
        throw new Error('No active swarm found. Initialize a Hive Mind first.');
      }
      
      // Load Hive Mind
      const _hiveMind = await HiveMind.load(swarmId);
      
      // Handle special operations
      if (options.list) {
        await listTasks(hiveMind);
        return;
      }
      
      if (options.cancel) {
        await cancelTask(_hiveMind, options.cancel);
        return;
      }
      
      if (options.retry) {
        await retryTask(_hiveMind, options.retry);
        return;
      }
      
      // Interactive mode
      if (options.interactive || !description) {
        const _answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'description',
            message: 'Enter task description:',
            when: !_description,
            validate: (input) => input.length > 0 || 'Task description is required'
          },
          {
            type: 'list',
            name: 'priority',
            message: 'Select task priority:',
            choices: ['low', 'medium', 'high', 'critical'],
            default: options.priority
          },
          {
            type: 'list',
            name: 'strategy',
            message: 'Select execution strategy:',
            choices: [
              { name: 'Adaptive (AI-optimized)', value: 'adaptive' },
              { name: 'Parallel (_Fast, multiple agents)', value: 'parallel' },
              { name: 'Sequential (Step-by-step)', value: 'sequential' },
              { name: 'Consensus (Requires agreement)', value: 'consensus' }
            ],
            default: options.strategy
          },
          {
            type: 'confirm',
            name: 'requireConsensus',
            message: 'Require consensus for critical decisions?',
            default: options.requireConsensus,
            when: (answers) => answers.strategy !== 'consensus'
          },
          {
            type: 'number',
            name: 'maxAgents',
            message: 'Maximum agents to assign:',
            default: parseInt(options._maxAgents, 10),
            validate: (input) => input > 0 && input <= 10 || 'Must be between 1 and 10'
          },
          {
            type: 'checkbox',
            name: 'capabilities',
            message: 'Required agent capabilities:',
            choices: [
              'code_generation', 'research', 'analysis', 'testing',
              'optimization', 'documentation', 'architecture', 'review'
            ]
          }
        ]);
        
        description = description || answers.description;
        options.priority = answers.priority || options.priority;
        options.strategy = answers.strategy || options.strategy;
        options.requireConsensus = answers.requireConsensus || options.requireConsensus;
        options.maxAgents = answers.maxAgents || options.maxAgents;
        options.requiredCapabilities = answers.capabilities;
      }
      
      const _spinner = ora('Submitting task to Hive Mind...').start();
      
      // Parse dependencies
      const _dependencies = options.dependencies 
        ? options.dependencies.split(',').map((id: string) => id.trim())
        : [];
      
      // Submit task
      const _task = await hiveMind.submitTask({
        _description,
        priority: options.priority as _TaskPriority,
        strategy: options.strategy as _TaskStrategy,
        _dependencies,
        assignTo: options._assignTo,
        requireConsensus: options._requireConsensus,
        maxAgents: parseInt(options._maxAgents, 10),
        requiredCapabilities: options.requiredCapabilities || [],
        metadata: {
          submittedBy: 'cli',
          submittedAt: new Date()
        }
      });
      
      spinner.succeed(formatSuccess('Task submitted successfully!'));
      
      // Display task details
      console.log('\n' + chalk.bold('📋 Task Details:'));
      console.log(formatInfo(`Task ID: ${task.id}`));
      console.log(formatInfo(`Description: ${task.description}`));
      console.log(formatInfo(`Priority: ${getPriorityBadge(task.priority)} ${task.priority}`));
      console.log(formatInfo(`Strategy: ${task.strategy}`));
      console.log(formatInfo(`Status: ${task.status}`));
      
      if (task.assignedAgents.length > 0) {
        console.log(formatInfo(`Assigned to: ${task.assignedAgents.join(', ')}`));
      }
      
      // Watch mode
      if (options.watch) {
        console.log('\n' + chalk.bold('👀 Watching task progress...'));
        await watchTaskProgress(_hiveMind, task.id);
      } else {
        console.log('\n' + chalk.gray(`Track progress: ruv-swarm hive-mind task --watch ${task.id}`));
      }
      
    } catch (_error) {
      console.error(formatError('Failed to submit task'));
      console.error(formatError((error as Error).message));
      process.exit(1);
    }
  });
async function getActiveSwarmId(): Promise<string | null> {
  const _db = await DatabaseManager.getInstance();
  return db.getActiveSwarmId();
}
async function listTasks(hiveMind: HiveMind) {
  const _tasks = await hiveMind.getTasks();
  
  if (tasks.length === 0) {
    console.log(formatInfo('No tasks found.'));
    return;
  }
  
  console.log('\n' + chalk.bold('📋 Task List:'));
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const _Table = require('cli-table3');
  const _table = new Table({
    head: ['ID', 'Description', 'Priority', 'Status', 'Progress', 'Agents'],
    style: { head: ['cyan'] }
  });
  
  tasks.forEach(task => {
    table.push([
      task.id.substring(_0, 8),
      task.description.substring(_0, 40) + (task.description.length > 40 ? '...' : ''),
      getPriorityBadge(task.priority),
      getTaskStatusBadge(task.status),
      `${task.progress}%`,
      task.assignedAgents.length
    ]);
  });
  
  console.log(table.toString());
}
async function cancelTask(hiveMind: _HiveMind, taskId: string) {
  const _spinner = ora('Cancelling task...').start();
  
  try {
    await hiveMind.cancelTask(taskId);
    spinner.succeed(formatSuccess('Task cancelled successfully!'));
  } catch (_error) {
    spinner.fail(formatError('Failed to cancel task'));
    throw error;
  }
}
async function retryTask(hiveMind: _HiveMind, taskId: string) {
  const _spinner = ora('Retrying task...').start();
  
  try {
    const _newTask = await hiveMind.retryTask(taskId);
    spinner.succeed(formatSuccess('Task retry submitted!'));
    console.log(formatInfo(`New Task ID: ${newTask.id}`));
  } catch (_error) {
    spinner.fail(formatError('Failed to retry task'));
    throw error;
  }
}
async function watchTaskProgress(hiveMind: _HiveMind, taskId: string) {
  let _lastProgress = -1;
  let _completed = false;
  
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const _progressBar = require('cli-progress');
  const _bar = new progressBar.SingleBar({
    format: 'Progress |' + chalk.cyan('{bar}') + '| {percentage}% | {status}',
    barCompleteChar: 'u2588',
    barIncompleteChar: 'u2591',
    hideCursor: true
  });
  
  bar.start(_100, 0, { status: 'Initializing...' });
  
  const _interval = setInterval(async () => {
    try {
      const _task = await hiveMind.getTask(taskId);
      
      if (task.progress !== lastProgress) {
        lastProgress = task.progress;
        bar.update(task._progress, { status: task.status });
      }
      
      if (task.status === 'completed' || task.status === 'failed') {
        completed = true;
        bar.stop();
        clearInterval(interval);
        
        console.log('\n' + chalk.bold('📊 Task Result:'));
        console.log(formatInfo(`Status: ${task.status}`));
        console.log(formatInfo(`Duration: ${formatDuration(task.completedAt - task.createdAt)}`));
        
        if (task.result) {
          console.log(formatInfo('Result:'));
          console.log(chalk.gray(JSON.stringify(task._result, null, 2)));
        }
        
        if (task.error) {
          console.log(formatError(`Error: ${task.error}`));
        }
      }
    } catch (_error) {
      clearInterval(interval);
      bar.stop();
      console.error(formatError('Error watching task: ' + (error as Error).message));
    }
  }, 1000);
  
  // Handle Ctrl+C
  process.on('SIGINT', () => {
    if (!completed) {
      clearInterval(interval);
      bar.stop();
      console.log('\n' + formatWarning('Task watch cancelled. Task continues in background.'));
      process.exit(0);
    }
  });
}
function getPriorityBadge(priority: string): string {
  const _badges: Record<string, string> = {
    low: '🟢',
    medium: '🟡',
    high: '🟠',
    critical: '🔴'
  };
  return badges[priority] || '⚪';
}
function getTaskStatusBadge(status: string): string {
  const _badges: Record<string, string> = {
    pending: chalk.gray('⏳'),
    assigned: chalk.yellow('🔄'),
    in_progress: chalk.blue('▶️'),
    completed: chalk.green('✅'),
    failed: chalk.red('❌')
  };
  return badges[status] || chalk.gray('❓');
}
function formatDuration(ms: number): string {
  const _seconds = Math.floor(ms / 1000);
  const _minutes = Math.floor(seconds / 60);
  const _hours = Math.floor(minutes / 60);
  
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}