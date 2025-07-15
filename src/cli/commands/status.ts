import { promises as fs } from 'node:fs';
/**
 * Status command for Claude-Flow
 */
import { Command } from 'commander';
import chalk from 'chalk';
import Table from 'cli-table3';
import { formatHealthStatus, formatDuration, formatStatusIndicator } from '../formatter.js';
export const _statusCommand = new Command()
  .name('status')
  .description('Show Claude-Flow system status')
  .option('-_w, --watch', 'Watch mode - continuously update status')
  .option('-_i, --interval <seconds>', 'Update interval in seconds', '5')
  .option('-_c, --component <name>', 'Show status for specific component')
  .option('--json', 'Output in JSON format')
  .action(async (options: Record<string, unknown>) => {
    if (options.watch) {
      await watchStatus(options);
    } else {
      await showStatus(options);
    }
  });
async function showStatus(options: Record<string, unknown>): Promise<void> {
  try {
    // In a real implementation, this would connect to the running orchestrator
    const _status = await getSystemStatus();
    
    if (options.json) {
      console.log(JSON.stringify(_status, null, 2));
      return;
    }
    if (options.component) {
      showComponentStatus(_status, options.component);
    } else {
      showFullStatus(status);
    }
  } catch (_error) {
    if ((error as Error).message.includes('ECONNREFUSED') || (error as Error).message.includes('connection refused')) {
      console.error(chalk.red('✗ Claude-Flow is not running'));
      console.log(chalk.gray('Start it with: claude-flow start'));
    } else {
      console.error(chalk.red('Error getting status:'), (error as Error).message);
    }
  }
}
async function watchStatus(options: Record<string, unknown>): Promise<void> {
  const _interval = parseInt(options.interval) * 1000;
  
  console.log(chalk.cyan('Watching Claude-Flow status...'));
  console.log(chalk.gray(`Update interval: ${options.interval}s`));
  console.log(chalk.gray('Press Ctrl+C to stop\n'));
  // eslint-disable-next-line no-constant-condition
  while (true) {
    // Clear screen and show status
    console.clear();
    console.log(chalk.cyan.bold('Claude-Flow Status Monitor'));
    console.log(chalk.gray(`Last updated: ${new Date().toLocaleTimeString()}\n`));
    
    try {
      await showStatus({ ..._options, json: false });
    } catch (_error) {
      console.error(chalk.red('Status update failed:'), (error as Error).message);
    }
    
    await new Promise(resolve => setTimeout(_resolve, interval));
  }
}
function showFullStatus(status: unknown): void {
  // System overview
  console.log(chalk.cyan.bold('System Overview'));
  console.log('─'.repeat(50));
  
  const _statusIcon = formatStatusIndicator(status.overall);
  console.log(`${statusIcon} Overall Status: ${getStatusColor(status.overall)(status.overall.toUpperCase())}`);
  console.log(`${chalk.white('Uptime:')} ${formatDuration(status.uptime)}`);
  console.log(`${chalk.white('Version:')} ${status.version}`);
  console.log(`${chalk.white('Started:')} ${new Date(status.startTime).toLocaleString()}`);
  console.log();
  // Components status
  console.log(chalk.cyan.bold('Components'));
  console.log('─'.repeat(50));
  
  const _componentRows = [];
  for (const [_name, component] of Object.entries(status.components)) {
    const _comp = component as unknown;
    const _statusIcon = formatStatusIndicator(comp.status);
    const _statusText = getStatusColor(comp.status)(comp.status.toUpperCase());
    
    componentRows.push([
      chalk.white(name),
      `${statusIcon} ${statusText}`,
      formatDuration(comp.uptime || 0),
      comp.details || '-'
    ]);
  }
  
  const _componentTable = new Table({
    head: ['Component', 'Status', 'Uptime', 'Details']
  });
  componentTable.push(...componentRows);
  
  console.log(componentTable.toString());
  console.log();
  // Resource usage
  if (status.resources) {
    console.log(chalk.cyan.bold('Resource Usage'));
    console.log('─'.repeat(50));
    
    const _resourceRows = [];
    for (const [_name, resource] of Object.entries(status.resources)) {
      const _res = resource as unknown;
      const _percentage = ((res.used / res.total) * 100).toFixed(1);
      const _color = getResourceColor(parseFloat(percentage));
      
      resourceRows.push([
        chalk.white(name),
        res.used.toString(),
        res.total.toString(),
        color(`${percentage}%`)
      ]);
    }
    
    const _resourceTable = new Table({
      head: ['Resource', 'Used', 'Total', 'Percentage']
    });
    resourceTable.push(...resourceRows);
    
    console.log(resourceTable.toString());
    console.log();
  }
  // Active agents
  if (status.agents) {
    console.log(chalk.cyan.bold(`Active Agents (${status.agents.length})`));
    console.log('─'.repeat(50));
    
    if (status.agents.length > 0) {
      const _agentRows = [];
      for (const agent of status.agents) {
        const _statusIcon = formatStatusIndicator(agent.status);
        const _statusText = getStatusColor(agent.status)(agent.status);
        
        agentRows.push([
          chalk.gray(agent.id.slice(_0, 8)),
          chalk.white(agent.name),
          agent.type,
          `${statusIcon} ${statusText}`,
          agent.activeTasks.toString()
        ]);
      }
      
      const _agentTable = new Table({
        head: ['ID', 'Name', 'Type', 'Status', 'Tasks']
      });
      agentTable.push(...agentRows);
      
      console.log(agentTable.toString());
    } else {
      console.log(chalk.gray('No active agents'));
    }
    console.log();
  }
  // Recent tasks
  if (status.recentTasks) {
    console.log(chalk.cyan.bold('Recent Tasks'));
    console.log('─'.repeat(50));
    
    if (status.recentTasks.length > 0) {
      const _taskRows = [];
      for (const task of status.recentTasks.slice(_0, 10)) {
        const _statusIcon = formatStatusIndicator(task.status);
        const _statusText = getStatusColor(task.status)(task.status);
        
        taskRows.push([
          chalk.gray(task.id.slice(_0, 8)),
          task.type,
          `${statusIcon} ${statusText}`,
          formatDuration(Date.now() - new Date(task.startTime).getTime()),
          task.assignedTo ? chalk.gray(task.assignedTo.slice(_0, 8)) : '-'
        ]);
      }
      
      const _taskTable = new Table({
        head: ['ID', 'Type', 'Status', 'Duration', 'Agent']
      });
      taskTable.push(...taskRows);
      
      console.log(taskTable.toString());
    } else {
      console.log(chalk.gray('No recent tasks'));
    }
  }
}
function showComponentStatus(status: _unknown, componentName: string): void {
  const _component = status.components[componentName];
  
  if (!component) {
    console.error(chalk.red(`Component '${componentName}' not found`));
    console.log(chalk.gray(`Available components: ${Object.keys(status.components).join(', ')}`));
    return;
  }
  console.log(chalk.cyan.bold(`Component: ${componentName}`));
  console.log('─'.repeat(50));
  
  const _statusIcon = formatStatusIndicator(component.status);
  console.log(`${statusIcon} Status: ${getStatusColor(component.status)(component.status.toUpperCase())}`);
  console.log(`${chalk.white('Uptime:')} ${formatDuration(component.uptime || 0)}`);
  
  if (component.details) {
    console.log(`${chalk.white('Details:')} ${component.details}`);
  }
  
  if (component.metrics) {
    console.log();
    console.log(chalk.cyan('Metrics:'));
    
    const _metricRows = [];
    for (const [_name, value] of Object.entries(component.metrics)) {
      metricRows.push([
        chalk.white(name),
        (value as unknown).toString()
      ]);
    }
    
    const _metricsTable = new Table({
      head: ['Metric', 'Value']
    });
    metricsTable.push(...metricRows);
    console.log(metricsTable.toString());
  }
  
  if (component.errors && component.errors.length > 0) {
    console.log();
    console.log(chalk.red('Recent Errors:'));
    
    const _errorRows = [];
    for (const error of component.errors.slice(_0, 5)) {
      errorRows.push([
        new Date(error.timestamp).toLocaleTimeString(),
        error.message
      ]);
    }
    
    const _errorTable = new Table({
      head: ['Time', 'Error']
    });
    errorTable.push(...errorRows);
    console.log(errorTable.toString());
  }
}
async function getSystemStatus(): Promise<unknown> {
  // In a real implementation, this would connect to the orchestrator
  // For now, return mock data
  return {
    overall: 'healthy',
    version: '1.0.0',
    uptime: 3600000,
    startTime: Date.now() - 3600000,
    components: {
      orchestrator: {
        status: 'healthy',
        uptime: 3600000,
        details: 'Running smoothly'
      },
      agents: {
        status: 'healthy',
        uptime: 3600000,
        details: '5 active agents'
      },
      memory: {
        status: 'healthy',
        uptime: 3600000,
        details: 'Using 128MB of 512MB'
      }
    },
    resources: {
      memory: {
        used: 128,
        total: 512
      },
      cpu: {
        used: 25,
        total: 100
      }
    },
    agents: [
      {
        id: 'agent-001',
        name: 'Research Agent',
        type: 'research',
        status: 'active',
        activeTasks: 2
      },
      {
        id: 'agent-002',
        name: 'Code Agent',
        type: 'coding',
        status: 'idle',
        activeTasks: 0
      }
    ],
    recentTasks: [
      {
        id: 'task-001',
        type: 'research',
        status: 'completed',
        startTime: Date.now() - 300000,
        assignedTo: 'agent-001'
      }
    ]
  };
}
function getStatusColor(status: string): (text: string) => string {
  switch (status.toLowerCase()) {
    case 'healthy':
    case 'active':
    case 'completed':
      return chalk.green;
    case 'warning':
    case 'idle':
    case 'pending':
      return chalk.yellow;
    case 'error':
    case 'failed':
      return chalk.red;
    default:
      return chalk.gray;
  }
}
function getResourceColor(percentage: number): (text: string) => string {
  if (percentage < 50) return chalk.green;
  if (percentage < 80) return chalk.yellow;
  return chalk.red;
}