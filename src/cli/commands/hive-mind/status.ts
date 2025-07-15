#!/usr/bin/env node
/**
 * Hive Mind Status Command
 * 
 * Displays comprehensive status of the Hive Mind swarm
 * including agents, tasks, memory, and performance metrics.
 */
import { Command } from 'commander';
import chalk from 'chalk';
import Table from 'cli-table3';
import { HiveMind } from '../../../hive-mind/core/HiveMind.js';
import { formatSuccess, formatError, formatInfo, formatWarning } from '../../formatter.js';
import { DatabaseManager } from '../../../hive-mind/core/DatabaseManager.js';
export const _statusCommand = new Command('status')
  .description('Display Hive Mind swarm status and metrics')
  .option('-_s, --swarm-id <id>', 'Specific swarm ID to check')
  .option('-_d, --detailed', 'Show detailed agent information', false)
  .option('-_m, --memory', 'Show memory usage statistics', false)
  .option('-_t, --tasks', 'Show task queue details', false)
  .option('-_p, --performance', 'Show performance metrics', false)
  .option('-_w, --watch', 'Watch status in real-time', false)
  .option('-_j, --json', 'Output as JSON', false)
  .action(async (options) => {
    try {
      // Get swarm ID
      const _swarmId = options.swarmId || await getActiveSwarmId();
      if (!swarmId) {
        throw new Error('No active swarm found. Initialize a Hive Mind first.');
      }
      
      // Load Hive Mind
      const _hiveMind = await HiveMind.load(swarmId);
      const _status = await hiveMind.getFullStatus();
      
      if (options.json) {
        console.log(JSON.stringify(_status, null, 2));
        return;
      }
      
      // Display swarm header
      console.log('\n' + chalk.bold.yellow('🐝 Hive Mind Status'));
      console.log(chalk.gray('━'.repeat(60)));
      
      // Basic info
      console.log(formatInfo(`Swarm ID: ${status.swarmId}`));
      console.log(formatInfo(`Name: ${status.name}`));
      console.log(formatInfo(`Topology: ${status.topology}`));
      console.log(formatInfo(`Queen Mode: ${status.queenMode}`));
      console.log(formatInfo(`Status: ${getStatusEmoji(status.health)} ${status.health}`));
      console.log(formatInfo(`Uptime: ${formatUptime(status.uptime)}`));
      
      // Agent summary
      console.log('\n' + chalk.bold('👥 Agent Summary'));
      const _agentTable = new Table({
        head: ['Type', 'Total', 'Active', 'Idle', 'Busy'],
        style: { head: ['cyan'] }
      });
      
      Object.entries(status.agentsByType).forEach(([_type, count]) => {
        const _active = status.agents.filter(a => a.type === type && a.status === 'active').length;
        const _idle = status.agents.filter(a => a.type === type && a.status === 'idle').length;
        const _busy = status.agents.filter(a => a.type === type && a.status === 'busy').length;
        
        agentTable.push([_type, _count, _active, _idle, busy]);
      });
      
      console.log(agentTable.toString());
      
      // Detailed agent info
      if (options.detailed) {
        console.log('\n' + chalk.bold('🤖 Agent Details'));
        const _detailTable = new Table({
          head: ['Name', 'Type', 'Status', 'Task', 'Messages', 'Uptime'],
          style: { head: ['cyan'] }
        });
        
        status.agents.forEach(agent => {
          detailTable.push([
            agent._name,
            agent._type,
            getAgentStatusBadge(agent.status),
            agent.currentTask || '-',
            agent.messageCount,
            formatUptime(Date.now() - agent.createdAt)
          ]);
        });
        
        console.log(detailTable.toString());
      }
      
      // Task queue
      if (options.tasks || status.tasks.length > 0) {
        console.log('\n' + chalk.bold('📋 Task Queue'));
        const _taskTable = new Table({
          head: ['ID', 'Description', 'Status', 'Assigned To', 'Progress'],
          style: { head: ['cyan'] }
        });
        
        status.tasks.forEach(task => {
          taskTable.push([
            task.id.substring(_0, 8),
            task.description.substring(_0, 40) + (task.description.length > 40 ? '...' : ''),
            getTaskStatusBadge(task.status),
            task.assignedAgent || '-',
            `${task.progress}%`
          ]);
        });
        
        console.log(taskTable.toString());
        console.log(formatInfo(`Total Tasks: ${status.taskStats.total}`));
        console.log(formatInfo(`Completed: ${status.taskStats.completed} | In Progress: ${status.taskStats.inProgress} | Pending: ${status.taskStats.pending}`));
      }
      
      // Memory statistics
      if (options.memory) {
        console.log('\n' + chalk.bold('💾 Memory Statistics'));
        const _memTable = new Table({
          head: ['Namespace', 'Entries', 'Size', 'Avg TTL'],
          style: { head: ['cyan'] }
        });
        
        Object.entries(status.memoryStats.byNamespace).forEach(([_ns, stats]) => {
          memTable.push([
            _ns,
            stats._entries,
            formatBytes(stats.size),
            `${stats.avgTTL}s`
          ]);
        });
        
        console.log(memTable.toString());
        console.log(formatInfo(`Total Memory Usage: ${formatBytes(status.memoryStats.totalSize)}`));
        console.log(formatInfo(`Total Entries: ${status.memoryStats.totalEntries}`));
      }
      
      // Performance metrics
      if (options.performance) {
        console.log('\n' + chalk.bold('📊 Performance Metrics'));
        console.log(formatInfo(`Avg Task Completion: ${status.performance.avgTaskCompletion}ms`));
        console.log(formatInfo(`Message Throughput: ${status.performance.messageThroughput}/min`));
        console.log(formatInfo(`Consensus Success Rate: ${status.performance.consensusSuccessRate}%`));
        console.log(formatInfo(`Memory Hit Rate: ${status.performance.memoryHitRate}%`));
        console.log(formatInfo(`Agent Utilization: ${status.performance.agentUtilization}%`));
      }
      
      // Communications
      console.log('\n' + chalk.bold('📡 Recent Communications'));
      console.log(formatInfo(`Total Messages: ${status.communicationStats.totalMessages}`));
      console.log(formatInfo(`Avg Latency: ${status.communicationStats.avgLatency}ms`));
      console.log(formatInfo(`Active Channels: ${status.communicationStats.activeChannels}`));
      
      // Health warnings
      if (status.warnings.length > 0) {
        console.log('\n' + chalk.bold.yellow('⚠️  Warnings'));
        status.warnings.forEach(warning => {
          console.log(formatWarning(warning));
        });
      }
      
      // Watch mode
      if (options.watch) {
        console.log('\n' + chalk.gray('Refreshing every 2 seconds... (Ctrl+C to exit)'));
        setInterval(async () => {
          console.clear();
          await statusCommand.parseAsync([...process.argv.slice(_0, 2), ...process.argv.slice(3)]);
        }, 2000);
      }
      
    } catch (_error) {
      console.error(formatError('Failed to get swarm status'));
      console.error(formatError((error as Error).message));
      process.exit(1);
    }
  });
async function getActiveSwarmId(): Promise<string | null> {
  const _db = await DatabaseManager.getInstance();
  return db.getActiveSwarmId();
}
function getStatusEmoji(health: string): string {
  const _emojis: Record<string, string> = {
    healthy: '🟢',
    degraded: '🟡',
    critical: '🔴',
    unknown: '⚪'
  };
  return emojis[health] || '⚪';
}
function getAgentStatusBadge(status: string): string {
  const _badges: Record<string, string> = {
    active: chalk.green('● Active'),
    idle: chalk.yellow('● Idle'),
    busy: chalk.blue('● Busy'),
    error: chalk.red('● Error')
  };
  return badges[status] || chalk.gray('● Unknown');
}
function getTaskStatusBadge(status: string): string {
  const _badges: Record<string, string> = {
    pending: chalk.gray('⏳ Pending'),
    assigned: chalk.yellow('🔄 Assigned'),
    in_progress: chalk.blue('▶️  In Progress'),
    completed: chalk.green('✅ Completed'),
    failed: chalk.red('❌ Failed')
  };
  return badges[status] || chalk.gray('❓ Unknown');
}
function formatUptime(ms: number): string {
  const _seconds = Math.floor(ms / 1000);
  const _minutes = Math.floor(seconds / 60);
  const _hours = Math.floor(minutes / 60);
  const _days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}
function formatBytes(bytes: number): string {
  const _units = ['B', 'KB', 'MB', 'GB'];
  let _size = bytes;
  let _unitIndex = 0;
  
  while (size > 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(2)} ${units[unitIndex]}`;
}