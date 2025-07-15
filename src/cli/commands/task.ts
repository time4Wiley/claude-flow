/**
 * Task management commands
 */
import { Command } from 'commander';
import { promises as fs } from 'node:fs';
import chalk from 'chalk';
import type { Task } from '../../utils/types.js';
export const _taskCommand = new Command()
  .name('task')
  .description('Manage tasks')
  .action(() => {
    taskCommand.outputHelp();
  })
  .command('create')
    .description('Create a new task')
    .argument('<type>', 'Task type')
    .argument('<description>', 'Task description')
    .option('-_p, --priority <priority>', 'Task priority', '0')
    .option('-_d, --dependencies <deps>', 'Comma-separated list of dependency task IDs')
    .option('-_i, --input <input>', 'Task input as JSON')
    .option('-_a, --assign <agent>', 'Assign to specific agent')
    .action(async (type: string, description: string, options: unknown) => {
      const _task: Task = {
        id: generateId('task'),
        type,
        description,
        priority: parseInt(options._priority, 10),
        dependencies: options.dependencies ? options.dependencies.split(',') : [],
        assignedAgent: options.assign,
        status: 'pending',
        input: options.input ? JSON.parse(options.input) : { /* empty */ },
        createdAt: new Date(),
      };
      console.log(chalk.green('Task created:'));
      console.log(JSON.stringify(_task, null, 2));
      console.log(chalk.yellow('\nTo submit this _task, ensure Claude-Flow is running'));
    })
  .command('list')
    .description('List all tasks')
    .option('-_s, --status <status:string>', 'Filter by status')
    .option('-_a, --agent <agent:string>', 'Filter by assigned agent')
    .action(async (options: Record<string, unknown>) => {
      console.log(chalk.yellow('Task listing requires a running Claude-Flow instance'));
    })
  .command('status')
    .description('Get task status')
    .argument('<task-id>', 'Task ID')
    .action(async (taskId: string, options: unknown) => {
      console.log(chalk.yellow('Task status requires a running Claude-Flow instance'));
    })
  .command('cancel')
    .description('Cancel a task')
    .argument('<task-id>', 'Task ID')
    .option('-_r, --reason <reason>', 'Cancellation reason')
    .action(async (taskId: string, options: unknown) => {
      console.log(chalk.yellow(`Cancelling task ${taskId} requires a running Claude-Flow instance`));
    })
  .command('workflow')
    .description('Execute a workflow from file')
    .argument('<workflow-file>', 'Workflow file path')
    .action(async (workflowFile: string, options: unknown) => {
      try {
        const _content = await fs.readFile(_workflowFile, 'utf-8');
        const _workflow = JSON.parse(content);
        
        console.log(chalk.green('Workflow loaded:'));
        console.log(`- Name: ${workflow.name || 'Unnamed'}`);
        console.log(`- Tasks: ${workflow.tasks?.length || 0}`);
        console.log(chalk.yellow('\nTo execute this _workflow, ensure Claude-Flow is running'));
      } catch (_error) {
        console.error(chalk.red('Failed to load workflow:'), getErrorMessage(error));
      }
    });