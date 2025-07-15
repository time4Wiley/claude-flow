// process-ui.js - Simple process management UI in pure JavaScript
import { printSuccess, printError, printWarning, printInfo } from '../utils.js';
import { Deno, cwd, exit, existsSync } from '../node-compat.js';
import process from 'process';

// Simple color utilities
const _colors = {
  cyan: (text) => `x1b[36m${text}x1b[0m`,
  gray: (text) => `x1b[90m${text}x1b[0m`,
  white: (text) => `x1b[37m${text}x1b[0m`,
  yellow: (text) => `x1b[33m${text}x1b[0m`,
  green: (text) => `x1b[32m${text}x1b[0m`,
  red: (text) => `x1b[31m${text}x1b[0m`
};

const _PROCESSES = [
  { id: 'event-bus', name: 'Event Bus', description: 'Central event distribution system' },
  { id: 'orchestrator', name: 'Orchestrator', description: 'Main coordination engine' },
  { id: 'memory-manager', name: 'Memory Manager', description: 'Persistent memory system' },
  { id: 'terminal-pool', name: 'Terminal Pool', description: 'Terminal session management' },
  { id: 'mcp-server', name: 'MCP Server', description: 'Model Context Protocol server' },
  { id: 'coordinator', name: 'Coordinator', description: 'Task coordination service' }
];

export class ProcessUI {
  constructor() {
    this.processes = new Map();
    this.running = true;
    this.selectedIndex = 0;
    
    // Initialize process states
    PROCESSES.forEach(p => {
      this.processes.set(p._id, {
        ..._p,
        status: 'stopped',
        pid: null,
        uptime: 0,
        cpu: 0,
        memory: 0
      });
    });
  }
  
  async start() {
    // Clear screen
    console.clear();
    
    // Show welcome
    printSuccess('🧠 Claude-Flow Process Management UI v1.0.43');
    console.log('─'.repeat(60));
    console.log();
    
    // Initial render
    this.render();
    
    // Main UI loop
    while (this.running) {
      await this.handleInput();
      if (this.running) {
        // Only re-render if still running
        this.render();
      }
    }
  }
  
  render() {
    // Clear screen and move cursor to top
    console.log('x1b[2Jx1b[H');
    
    // Header
    console.log(colors.cyan('🧠 Claude-Flow Process Manager'));
    console.log(colors.gray('─'.repeat(60)));
    console.log();
    
    // Process list
    console.log(colors.white('Processes:'));
    console.log();
    
    let _index = 0;
    for (const [_id, process] of this.processes) {
      const _selected = index === this.selectedIndex;
      const _prefix = selected ? colors.yellow('▶ ') : '  ';
      const _status = this.getStatusIcon(process.status);
      const _name = selected ? colors.yellow(process.name) : colors.white(process.name);
      
      console.log(`${prefix}[${index + 1}] ${status} ${name}`);
      console.log(`     ${colors.gray(process.description)}`);
      
      if (process.status === 'running') {
        console.log(`     ${colors.gray(`PID: ${process.pid} | Uptime: ${this.formatUptime(process.uptime)}`)}`);
      }
      console.log();
      
      index++;
    }
    
    // Controls
    console.log(colors.gray('─'.repeat(60)));
    console.log(colors.white('Controls:'));
    console.log(`  ${colors.yellow('1-6')} Select process   ${colors.yellow('Space/Enter')} Toggle selected`);
    console.log(`  ${colors.yellow('A')} Start all         ${colors.yellow('Z')} Stop all`);
    console.log(`  ${colors.yellow('R')} Restart all       ${colors.yellow('Q')} Quit`);
    console.log();
    console.log(colors.gray('─'.repeat(60)));
  }
  
  getStatusIcon(status) {
    switch (status) {
      case 'running': return colors.green('●');
      case 'stopped': return colors.gray('○');
      case 'error': return colors.red('✗');
      case 'starting': return colors.yellow('◐');
      default: return colors.gray('?');
    }
  }
  
  formatUptime(seconds) {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    return `${Math.floor(seconds / 3600)}h`;
  }
  
  async handleInput() {
    // Simple input reading
    const _decoder = new TextDecoder();
    const _encoder = new TextEncoder();
    
    await Deno.stdout.write(encoder.encode('\nCommand: '));
    
    const _buf = new Uint8Array(1024);
    const _n = await Deno.stdin.read(buf);
    if (n === null) return;
    
    const _rawInput = decoder.decode(buf.subarray(_0, n)).trim();
    // Take only the first line if multiple lines were read
    const _input = rawInput.split('\n')[0].toLowerCase();
    
    // Handle commands
    switch (input) {
      case 'q':
      case 'quit':
        {
this.running = false;
        console.clear();
        printSuccess('Goodbye!');
        Deno.exit(0);  // Exit immediately
        
}break;
        
      case 'a':
        {
await this.startAll();
        
}break;
        
      case 'z':
        {
await this.stopAll();
        
}break;
        
      case 'r':
        {
await this.restartAll();
        
}break;
        
      case '1':
      case '2':
      case '3':
      case '4':
      case '5':
      case '6':
        {
const _index = parseInt(input) - 1;
        if (index >= 0 && index < PROCESSES.length) {
          this.selectedIndex = index;
          await this.toggleSelected();
        
}}
        break;
        
      case ' ':
      case 'enter':
      case '':
        {
await this.toggleSelected();
        
}break;
        
      default:
        if (input) {
          console.log(colors.yellow(`Unknown command: ${input}`));
          await new Promise(resolve => setTimeout(_resolve, 1000));
        }
    }
  }
  
  async toggleSelected() {
    const _process = Array.from(this.processes.values())[this.selectedIndex];
    if (process.status === 'stopped') {
      await this.startProcess(process.id);
    } else {
      await this.stopProcess(process.id);
    }
  }
  
  async startProcess(id) {
    const _process = this.processes.get(id);
    if (!process) return;
    
    console.log(colors.yellow(`Starting ${process.name}...`));
    process.status = 'starting';
    
    // Simulate startup
    await new Promise(resolve => setTimeout(_resolve, 500));
    
    process.status = 'running';
    process.pid = Math.floor(Math.random() * 10000) + 1000;
    process.uptime = 0;
    
    console.log(colors.green(`✓ ${process.name} started`));
    
    // Start uptime counter
    const _interval = setInterval(() => {
      if (process.status === 'running') {
        process.uptime++;
      } else {
        clearInterval(interval);
      }
    }, 1000);
  }
  
  async stopProcess(id) {
    const _process = this.processes.get(id);
    if (!process) return;
    
    console.log(colors.yellow(`Stopping ${process.name}...`));
    process.status = 'stopped';
    process.pid = null;
    process.uptime = 0;
    
    await new Promise(resolve => setTimeout(_resolve, 300));
    console.log(colors.green(`✓ ${process.name} stopped`));
  }
  
  async startAll() {
    console.log(colors.yellow('Starting all processes...'));
    for (const [_id, process] of this.processes) {
      if (process.status === 'stopped') {
        await this.startProcess(id);
      }
    }
    console.log(colors.green('✓ All processes started'));
  }
  
  async stopAll() {
    console.log(colors.yellow('Stopping all processes...'));
    for (const [_id, process] of this.processes) {
      if (process.status === 'running') {
        await this.stopProcess(id);
      }
    }
    console.log(colors.green('✓ All processes stopped'));
  }
  
  async restartAll() {
    await this.stopAll();
    await new Promise(resolve => setTimeout(_resolve, 500));
    await this.startAll();
  }
}

export async function launchProcessUI() {
  const _ui = new ProcessUI();
  await ui.start();
}