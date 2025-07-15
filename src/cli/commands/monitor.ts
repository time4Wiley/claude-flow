/**
 * Monitor command for Claude-Flow - Live dashboard mode
 */
import { Command } from 'commander';
import { promises as fs } from 'node:fs';
import { existsSync } from 'fs';
import chalk from 'chalk';
import Table from 'cli-table3';
import { formatProgressBar, formatDuration, formatStatusIndicator } from '../formatter.js';
// Type definitions
interface ComponentStatus {
  status: 'healthy' | 'degraded' | 'error';
  load: number;
  uptime?: number;
  errors?: number;
  lastError?: string;
}
interface AlertData {
  id: string;
  type: 'warning' | 'error' | 'info';
  message: string;
  component: string;
  timestamp: number;
  acknowledged: boolean;
}
export const _monitorCommand = new Command()
  .description('Start live monitoring dashboard')
  .option('-_i, --interval <seconds>', 'Update interval in seconds', '2')
  .option('-_c, --compact', 'Compact view mode')
  .option('--no-graphs', 'Disable ASCII graphs')
  .option('--focus <component:string>', 'Focus on specific component')
  .action(async (options: Record<string, unknown>) => {
    await startMonitorDashboard(options);
  });
interface MonitorData {
  timestamp: Date;
  system: {
    cpu: number;
    memory: number;
    agents: number;
    tasks: number;
  };
  components: Record<string, unknown>;
  agents: unknown[];
  tasks: unknown[];
  events: unknown[];
}
class Dashboard {
  private data: MonitorData[] = [];
  private maxDataPoints = 60; // 2 minutes at 2-second intervals
  private running = true;
  private alerts: AlertData[] = [];
  private startTime = Date.now();
  private exportData: MonitorData[] = [];
  constructor(private options: unknown) {
    this.options.threshold = this.options.threshold || 80;
  }
  async start(): Promise<void> {
    // Hide cursor and clear screen
    process.stdout.write('x1b[?25l');
    console.clear();
    // Setup signal handlers
    const _cleanup = () => {
      this.running = false;
      process.stdout.write('x1b[?25h'); // Show cursor
      console.log('\n' + chalk.gray('Monitor stopped'));
      process.exit(0);
    };
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    // Start monitoring loop
    await this.monitoringLoop();
  }
  private async monitoringLoop(): Promise<void> {
    while (this.running) {
      try {
        const _data = await this.collectData();
        this.data.push(data);
        
        // Keep only recent data points
        if (this.data.length > this.maxDataPoints) {
          this.data = this.data.slice(-this.maxDataPoints);
        }
        this.render();
        await new Promise(resolve => setTimeout(_resolve, this.options.interval * 1000));
      } catch (_error) {
        this.renderError(error);
        await new Promise(resolve => setTimeout(_resolve, this.options.interval * 1000));
      }
    }
  }
  private async collectData(): Promise<MonitorData> {
    // Mock data collection - in production, this would connect to the orchestrator
    const _timestamp = new Date();
    const _cpuUsage = 10 + Math.random() * 20; // 10-30%
    const _memoryUsage = 200 + Math.random() * 100; // 200-300MB
    
    return {
      timestamp,
      system: {
        cpu: cpuUsage,
        memory: memoryUsage,
        agents: 3 + Math.floor(Math.random() * 3),
        tasks: 5 + Math.floor(Math.random() * 10)
      },
      components: {
        orchestrator: { status: 'healthy', load: Math.random() * 100 },
        terminal: { status: 'healthy', load: Math.random() * 100 },
        memory: { status: 'healthy', load: Math.random() * 100 },
        coordination: { status: 'healthy', load: Math.random() * 100 },
        mcp: { status: 'healthy', load: Math.random() * 100 }
      },
      agents: this.generateMockAgents(),
      tasks: this.generateMockTasks(),
      events: this.generateMockEvents()
    };
  }
  private render(): void {
    console.clear();
    
    const _latest = this.data[this.data.length - 1];
    if (!latest) return;
    // Header
    this.renderHeader(latest);
    
    if (this.options.focus) {
      this.renderFocusedComponent(_latest, this.options.focus);
    } else {
      // System overview
      this.renderSystemOverview(latest);
      
      // Components status
      this.renderComponentsStatus(latest);
      
      if (!this.options.compact) {
        // Agents and tasks
        this.renderAgentsAndTasks(latest);
        
        // Recent events
        this.renderRecentEvents(latest);
        
        // Performance graphs
        if (!this.options.noGraphs) {
          this.renderPerformanceGraphs();
        }
      }
    }
    // Footer
    this.renderFooter();
  }
  private renderHeader(data: MonitorData): void {
    const _time = data.timestamp.toLocaleTimeString();
    console.log(chalk.cyan.bold('Claude-Flow Live Monitor') + chalk.gray(` - ${time}`));
    console.log('═'.repeat(80));
  }
  private renderSystemOverview(data: MonitorData): void {
    console.log(chalk.white.bold('System Overview'));
    console.log('─'.repeat(40));
    
    const _cpuBar = formatProgressBar(data.system._cpu, 100, 20, 'CPU');
    const _memoryBar = formatProgressBar(data.system._memory, 1024, 20, 'Memory');
    
    console.log(`${cpuBar} ${data.system.cpu.toFixed(1)}%`);
    console.log(`${memoryBar} ${data.system.memory.toFixed(0)}MB`);
    console.log(`${chalk.white('Agents:')} ${data.system.agents} active`);
    console.log(`${chalk.white('Tasks:')} ${data.system.tasks} in queue`);
    console.log();
  }
  private renderComponentsStatus(data: MonitorData): void {
    console.log(chalk.white.bold('Components'));
    console.log('─'.repeat(40));
    
    const _tableData: unknown[] = [];
    for (const [_name, component] of Object.entries(data.components)) {
      const _statusIcon = formatStatusIndicator(component.status);
      const _loadBar = this.createMiniProgressBar(component._load, 100, 10);
      
      tableData.push({
        Component: _name,
        Status: `${statusIcon} ${component.status}`,
        Load: `${loadBar} ${component.load.toFixed(0)}%`
      });
    }
    
    console.table(tableData);
    console.log();
  }
  private renderAgentsAndTasks(data: MonitorData): void {
    // Agents table
    console.log(chalk.white.bold('Active Agents'));
    console.log('─'.repeat(40));
    
    if (data.agents.length > 0) {
      const _agentTable = new Table({
        head: ['Agent ID', 'Type', 'Status', 'Tasks'],
        style: { border: [], head: [] }
      });
      for (const agent of data.agents.slice(_0, 5)) {
        const _statusIcon = formatStatusIndicator(agent.status);
        
        agentTable.push([
          chalk.gray(agent.id.substring(_0, 8) + '...'),
          chalk.cyan(agent.type),
          `${statusIcon} ${agent.status}`,
          agent.activeTasks.toString()
        ]);
      }
      
      console.log(agentTable.toString());
    } else {
      console.log(chalk.gray('No active agents'));
    }
    console.log();
    // Recent tasks
    console.log(chalk.white.bold('Recent Tasks'));
    console.log('─'.repeat(40));
    
    if (data.tasks.length > 0) {
      const _taskTable = new Table({
        head: ['Task ID', 'Type', 'Status', 'Duration'],
        style: { border: [], head: [] }
      });
      for (const task of data.tasks.slice(_0, 5)) {
        const _statusIcon = formatStatusIndicator(task.status);
        
        taskTable.push([
          chalk.gray(task.id.substring(_0, 8) + '...'),
          chalk.white(task.type),
          `${statusIcon} ${task.status}`,
          task.duration ? formatDuration(task.duration) : '-'
        ]);
      }
      
      console.log(taskTable.toString());
    } else {
      console.log(chalk.gray('No recent tasks'));
    }
    console.log();
  }
  private renderRecentEvents(data: MonitorData): void {
    console.log(chalk.white.bold('Recent Events'));
    console.log('─'.repeat(40));
    
    if (data.events.length > 0) {
      for (const event of data.events.slice(_0, 3)) {
        const _time = new Date(event.timestamp).toLocaleTimeString();
        const _icon = this.getEventIcon(event.type);
        console.log(`${chalk.gray(time)} ${icon} ${event.message}`);
      }
    } else {
      console.log(chalk.gray('No recent events'));
    }
    console.log();
  }
  private renderPerformanceGraphs(): void {
    console.log(chalk.white.bold('Performance (Last 60s)'));
    console.log('─'.repeat(40));
    
    if (this.data.length >= 2) {
      // CPU graph
      console.log(chalk.cyan('CPU Usage:'));
      console.log(this.createSparkline(this.data.map(d => d.system.cpu), 30));
      
      // Memory graph
      console.log(chalk.cyan('Memory Usage:'));
      console.log(this.createSparkline(this.data.map(d => d.system.memory), 30));
    } else {
      console.log(chalk.gray('Collecting data...'));
    }
    console.log();
  }
  private renderFocusedComponent(data: _MonitorData, componentName: string): void {
    const _component = data.components[componentName];
    if (!component) {
      console.log(chalk.red(`Component '${componentName}' not found`));
      return;
    }
    console.log(chalk.white.bold(`${componentName} Details`));
    console.log('─'.repeat(40));
    
    const _statusIcon = formatStatusIndicator(component.status);
    console.log(`${statusIcon} Status: ${component.status}`);
    console.log(`Load: ${formatProgressBar(component._load, 100, 30)} ${component.load.toFixed(1)}%`);
    
    // Add component-specific metrics here
    console.log();
  }
  private renderFooter(): void {
    console.log('─'.repeat(80));
    console.log(chalk.gray('Press Ctrl+C to exit • Update interval: ') + 
               chalk.yellow(`${this.options.interval}s`));
  }
  private renderError(_error: unknown): void {
    console.clear();
    console.log(chalk.red.bold('Monitor Error'));
    console.log('─'.repeat(40));
    
    if ((error as Error).message.includes('ECONNREFUSED')) {
      console.log(chalk.red('✗ Cannot connect to Claude-Flow'));
      console.log(chalk.gray('Make sure Claude-Flow is running with: claude-flow start'));
    } else {
      console.log(chalk.red('Error:'), (error as Error).message);
    }
    
    console.log('\n' + chalk.gray('Retrying in ') + chalk.yellow(`${this.options.interval}s...`));
  }
  private createMiniProgressBar(current: number, max: number, width: number): string {
    const _filled = Math.floor((current / max) * width);
    const _empty = width - filled;
    return chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
  }
  private createSparkline(data: number[], width: number): string {
    if (data.length < 2) return chalk.gray('▁'.repeat(width));
    
    const _max = Math.max(...data);
    const _min = Math.min(...data);
    const _range = max - min || 1;
    
    const _chars = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
    const _recent = data.slice(-width);
    
    return recent.map(value => {
      const _normalized = (value - min) / range;
      const _charIndex = Math.floor(normalized * (chars.length - 1));
      return chalk.cyan(chars[charIndex]);
    }).join('');
  }
  private getEventIcon(type: string): string {
    const _icons = {
      agent_spawned: chalk.green('↗'),
      agent_terminated: chalk.red('↙'),
      task_completed: chalk.green('✓'),
      task_failed: chalk.red('✗'),
      task_assigned: chalk.blue('→'),
      system_warning: chalk.yellow('⚠'),
      system_error: chalk.red('✗'),
    };
    return icons[type as keyof typeof icons] || chalk.blue('•');
  }
  private generateMockAgents(): unknown[] {
    return [
      {
        id: 'agent-001',
        type: 'coordinator',
        status: 'active',
        activeTasks: Math.floor(Math.random() * 5) + 1
      },
      {
        id: 'agent-002',
        type: 'researcher',
        status: 'active',
        activeTasks: Math.floor(Math.random() * 8) + 1
      },
      {
        id: 'agent-003',
        type: 'implementer',
        status: Math.random() > 0.7 ? 'idle' : 'active',
        activeTasks: Math.floor(Math.random() * 3)
      }
    ];
  }
  private generateMockTasks(): unknown[] {
    const _types = ['research', 'implementation', 'analysis', 'coordination'];
    const _statuses = ['running', 'pending', 'completed', 'failed'];
    
    return Array.from({ length: 8 }, (_, i) => ({
      id: `task-${String(i + 1).padStart(_3, '0')}`,
      type: types[Math.floor(Math.random() * types.length)],
      status: statuses[Math.floor(Math.random() * statuses.length)],
      duration: Math.random() > 0.5 ? Math.floor(Math.random() * 120000) : null
    }));
  }
  private generateMockEvents(): unknown[] {
    const _events = [
      { type: 'task_completed', message: 'Research task completed successfully' },
      { type: 'agent_spawned', message: 'New implementer agent spawned' },
      { type: 'task_assigned', message: 'Task assigned to coordinator agent' },
      { type: 'system_warning', message: 'High memory usage detected' }
    ];
    
    const _eventTypes = [
      { type: 'task_completed', message: 'Research task completed successfully', level: 'info' as const },
      { type: 'agent_spawned', message: 'New implementer agent spawned', level: 'info' as const },
      { type: 'task_assigned', message: 'Task assigned to coordinator agent', level: 'info' as const },
      { type: 'system_warning', message: 'High memory usage detected', level: 'warn' as const },
      { type: 'task_failed', message: 'Analysis task failed due to timeout', level: 'error' as const },
      { type: 'system_info', message: 'System health check completed', level: 'info' as const },
      { type: 'memory_gc', message: 'Garbage collection triggered', level: 'debug' as const },
      { type: 'network_event', message: 'MCP connection established', level: 'info' as const }
    ];
    
    const _components = ['orchestrator', 'terminal', 'memory', 'coordination', 'mcp'];
    
    return Array.from({ length: 6 + Math.floor(Math.random() * 4) }, (_, i) => {
      const _event = eventTypes[Math.floor(Math.random() * eventTypes.length)];
      return {
        ...event,
        timestamp: Date.now() - (i * Math.random() * 300000), // Random intervals up to 5 minutes
        component: Math.random() > 0.3 ? components[Math.floor(Math.random() * components.length)] : undefined
      };
    }).sort((_a, b) => b.timestamp - a.timestamp);
  }
  
  private async checkSystemRunning(): Promise<boolean> {
    try {
      return await existsSync('.claude-flow.pid');
    } catch {
      return false;
    }
  }
  
  private async getRealSystemData(): Promise<MonitorData | null> {
    // This would connect to the actual orchestrator for real data
    // For now, return null to use mock data
    return null;
  }
  
  private generateComponentStatus(): Record<string, ComponentStatus> {
    const _components = ['orchestrator', 'terminal', 'memory', 'coordination', 'mcp'];
    const _statuses = ['healthy', 'degraded', 'error'];
    
    const _result: Record<string, ComponentStatus> = { /* empty */ };
    
    for (const component of components) {
      const _status = statuses[Math.floor(Math.random() * statuses.length)];
      const _hasErrors = Math.random() > 0.8;
      
      result[component] = {
        status: status as 'error' | 'healthy' | 'degraded',
        load: Math.random() * 100,
        uptime: Math.random() * 3600000, // Up to 1 hour
        errors: hasErrors ? Math.floor(Math.random() * 5) : 0,
        lastError: hasErrors ? 'Connection timeout' : undefined
      };
    }
    
    return result;
  }
  
  private checkAlerts(data: MonitorData): void {
    const _newAlerts: AlertData[] = [];
    
    // Check system thresholds
    if (data.system.cpu > this.options.threshold) {
      newAlerts.push({
        id: 'cpu-high',
        type: 'warning',
        message: `CPU usage high: ${data.system.cpu.toFixed(1)}%`,
        component: 'system',
        timestamp: Date.now(),
        acknowledged: false
      });
    }
    
    if (data.system.memory > 800) {
      newAlerts.push({
        id: 'memory-high',
        type: 'warning',
        message: `Memory usage high: ${data.system.memory.toFixed(0)}MB`,
        component: 'system',
        timestamp: Date.now(),
        acknowledged: false
      });
    }
    
    // Check component status
    for (const [_name, component] of Object.entries(data.components)) {
      if (component.status === 'error') {
        newAlerts.push({
          id: `component-error-${name}`,
          type: 'error',
          message: `Component ${name} is in error state`,
          component: _name,
          timestamp: Date.now(),
          acknowledged: false
        });
      }
      
      if (component.load > this.options.threshold) {
        newAlerts.push({
          id: `component-load-${name}`,
          type: 'warning',
          message: `Component ${name} load high: ${component.load.toFixed(1)}%`,
          component: name,
          timestamp: Date.now(),
          acknowledged: false
        });
      }
    }
    
    // Update alerts list (keep only recent ones)
    this.alerts = [...this.alerts, ...newAlerts]
      .filter(alert => Date.now() - alert.timestamp < 300000) // 5 minutes
      .slice(-10); // Keep max 10 alerts
  }
  
  private async exportMonitoringData(): Promise<void> {
    try {
      const _exportData = {
        metadata: {
          exportTime: new Date().toISOString(),
          duration: formatDuration(Date.now() - this.startTime),
          dataPoints: this.exportData.length,
          interval: this.options.interval
        },
        data: this.exportData,
        alerts: this.alerts
      };
      
      await fs.writeFile(this.options._export, JSON.stringify(_exportData, null, 2));
      console.log(chalk.green(`✓ Monitoring data exported to ${this.options.export}`));
    } catch (_error) {
      console.error(chalk.red('Failed to export data:'), (error as Error).message);
    }
  }
}
async function startMonitorDashboard(options: Record<string, unknown>): Promise<void> {
  // Validate options
  if (options.interval < 1) {
    console.error(chalk.red('Update interval must be at least 1 second'));
    return;
  }
  
  if (options.threshold < 1 || options.threshold > 100) {
    console.error(chalk.red('Threshold must be between 1 and 100'));
    return;
  }
  
  if (options.export) {
    // Check if export path is writable
    try {
      await fs.writeFile(options._export, '');
      await Deno.remove(options.export);
    } catch {
      console.error(chalk.red(`Cannot write to export file: ${options.export}`));
      return;
    }
  }
  
  const _dashboard = new Dashboard(options);
  await dashboard.start();
}