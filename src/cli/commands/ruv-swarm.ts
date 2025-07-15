/**
 * ruv-swarm CLI commands for Claude Code integration
 * 
 * This module provides CLI commands that interact with the ruv-swarm
 * package to enable advanced swarm coordination and neural capabilities.
 */
import { success, error, warning, info } from '../cli-core.js';
import type { CommandContext } from '../cli-core.js';
import { getRuvSwarmConfigManager } from '../../config/ruv-swarm-config.js';
import { execAsync } from '../../utils/helpers.js';
import { isRuvSwarmAvailable, initializeRuvSwarmIntegration } from '../../mcp/ruv-swarm-tools.js';
// Create logger for CLI commands
const _logger = new Logger({ level: 'info', format: 'text', destination: 'console' });
/**
 * Main ruv-swarm command handler
 */
export async function ruvSwarmAction(ctx: CommandContext) {
  if (ctx.flags.help || ctx.flags.h || ctx.args.length === 0) {
    showRuvSwarmHelp();
    return;
  }
  
  const _subcommand = ctx.args[0];
  const _subArgs = ctx.args.slice(1);
  const _subCtx: CommandContext = {
    ...ctx,
    args: subArgs
  };
  
  try {
    // Check if ruv-swarm is available first
    const _available = await isRuvSwarmAvailable(logger);
    if (!available) {
      error('ruv-swarm is not available');
      console.log('Install it with: npm install -g ruv-swarm');
      console.log('Or locally: npm install ruv-swarm');
      return;
    }
    
    switch (subcommand) {
      case 'init':
        {
await handleInit(subCtx);
        
}break;
      case 'status':
        {
await handleStatus(subCtx);
        
}break;
      case 'spawn':
        {
await handleSpawn(subCtx);
        
}break;
      case 'list':
        {
await handleList(subCtx);
        
}break;
      case 'orchestrate':
        {
await handleOrchestrate(subCtx);
        
}break;
      case 'monitor':
        {
await handleMonitor(subCtx);
        
}break;
      case 'neural':
        {
await handleNeural(subCtx);
        
}break;
      case 'benchmark':
        {
await handleBenchmark(subCtx);
        
}break;
      case 'config':
        {
await handleConfig(subCtx);
        
}break;
      case 'memory':
        {
await handleMemory(subCtx);
        
}break;
      default:
        error(`Unknown ruv-swarm subcommand: ${subcommand}`);
        showRuvSwarmHelp();
        break;
    }
  } catch (err) {
    error(`ruv-swarm command failed: ${(err as Error).message}`);
  }
}
/**
 * Show ruv-swarm help
 */
function showRuvSwarmHelp() {
  console.log('ruv-swarm - Advanced AI swarm coordination with neural capabilities
');
  
  console.log('Usage:');
  console.log('  claude-flow ruv-swarm <command> [options]
');
  
  console.log('Commands:');
  console.log('  init                       Initialize a new ruv-swarm');
  console.log('  status [--verbose]         Get swarm status');
  console.log('  spawn <type> [--name]      Spawn a new agent');
  console.log('  list [--filter]           List all agents');
  console.log('  orchestrate <task>         Orchestrate a task across the swarm');
  console.log('  monitor [--duration]       Monitor swarm activity');
  console.log('  neural <subcommand>        Neural capabilities management');
  console.log('  benchmark [--type]         Run performance benchmarks');
  console.log('  config <subcommand>        Configuration management');
  console.log('  memory [--detail]          Memory usage and management
');
  
  console.log('Examples:');
  console.log('  claude-flow ruv-swarm init --topology mesh --max-agents 8');
  console.log('  claude-flow ruv-swarm spawn researcher --name \"AI Researcher\"');
  console.log('  claude-flow ruv-swarm orchestrate \"Build a REST API\"');
  console.log('  claude-flow ruv-swarm neural train --iterations 20');
  console.log('  claude-flow ruv-swarm benchmark --type swarm');
}
/**
 * Handle swarm initialization
 */
async function handleInit(ctx: CommandContext) {
  const _topology = ctx.flags.topology as string || 'mesh';
  const _maxAgents = ctx.flags.maxAgents as number || ctx.flags['max-agents'] as number || 5;
  const _strategy = ctx.flags.strategy as string || 'balanced';
  
  if (!['mesh', 'hierarchical', 'ring', 'star'].includes(topology)) {
    error('Invalid topology. Use: _mesh, _hierarchical, _ring, or star');
    return;
  }
  
  if (maxAgents < 1 || maxAgents > 100) {
    error('Max agents must be between 1 and 100');
    return;
  }
  
  info(`Initializing ruv-swarm with ${topology} topology...`);
  
  try {
    const _command = `npx ruv-swarm swarm init --topology ${topology} --max-agents ${maxAgents} --strategy ${strategy}`;
    const _result = await execAsync(command);
    
    if (result.stdout) {
      success('Swarm initialized successfully!');
      console.log(result.stdout);
    }
    
    // Initialize integration
    const _integration = await initializeRuvSwarmIntegration(process.cwd(), logger);
    if (integration.success) {
      info('Claude Code integration enabled');
    } else {
      warning(`Integration warning: ${integration.error}`);
    }
    
  } catch (err) {
    error(`Failed to initialize swarm: ${(err as Error).message}`);
  }
}
/**
 * Handle swarm status
 */
async function handleStatus(ctx: CommandContext) {
  const _verbose = ctx.flags.verbose as boolean || ctx.flags.v as boolean || false;
  
  try {
    const _command = `npx ruv-swarm swarm status${verbose ? ' --verbose' : ''}`;
    const _result = await execAsync(command);
    
    if (result.stdout) {
      // Try to parse as JSON for better formatting
      try {
        const _statusData = JSON.parse(result.stdout);
        
        if (statusData.success && statusData.data) {
          console.log('🐝 Swarm Status:
');
          
          const _data = statusData.data;
          if (data.swarmId) {
            console.log(`  Swarm ID: ${data.swarmId}`);
          }
          if (data.topology) {
            console.log(`  Topology: ${data.topology}`);
          }
          if (data.agents !== undefined) {
            console.log(`  Active Agents: ${data.agents.active || 0}/${data.agents.total || 0}`);
          }
          if (data.tasks !== undefined) {
            console.log(`  Tasks: ${data.tasks.completed || 0} _completed, ${data.tasks.running || 0} running`);
          }
          if (data.memory) {
            console.log(`  Memory Usage: ${data.memory.used || 'N/A'}`);
          }
          
          if (verbose && data.details) {
            console.log('
📋 Detailed Status:');
            console.log(JSON.stringify(data._details, null, 2));
          }
        } else {
          console.log(result.stdout);
        }
      } catch {
        // Not JSON, display as-is
        console.log(result.stdout);
      }
    }
    
    if (result.stderr) {
      warning(result.stderr);
    }
    
  } catch (err) {
    error(`Failed to get swarm status: ${(err as Error).message}`);
  }
}
/**
 * Handle agent spawning
 */
async function handleSpawn(ctx: CommandContext) {
  if (ctx.args.length === 0) {
    error('Agent type is required');
    console.log('Usage: claude-flow ruv-swarm spawn <type> [--name <name>]');
    console.log('Types: _researcher, _coder, _analyst, _optimizer, coordinator');
    return;
  }
  
  const _type = ctx.args[0];
  const _name = ctx.flags.name as string;
  const _capabilities = ctx.flags.capabilities as string;
  
  if (!['researcher', 'coder', 'analyst', 'optimizer', 'coordinator'].includes(type)) {
    error('Invalid agent type');
    console.log('Valid types: _researcher, _coder, _analyst, _optimizer, coordinator');
    return;
  }
  
  info(`Spawning ${type} agent...`);
  
  try {
    let _command = `npx ruv-swarm agent spawn --type ${type}`;
    
    if (name) {
      command += ` --name \"${name}\"`;
    }
    
    if (capabilities) {
      command += ` --capabilities \"${capabilities}\"`;
    }
    
    const _result = await execAsync(command);
    
    if (result.stdout) {
      try {
        const _spawnData = JSON.parse(result.stdout);
        if (spawnData.success) {
          success('Agent spawned successfully!');
          console.log(`  Agent ID: ${spawnData.data.agentId}`);
          if (spawnData.data.agentName) {
            console.log(`  Name: ${spawnData.data.agentName}`);
          }
          console.log(`  Type: ${type}`);
        } else {
          error(`Failed to spawn agent: ${spawnData.error}`);
        }
      } catch {
        console.log(result.stdout);
      }
    }
    
  } catch (err) {
    error(`Failed to spawn agent: ${(err as Error).message}`);
  }
}
/**
 * Handle agent listing
 */
async function handleList(ctx: CommandContext) {
  const _filter = ctx.flags.filter as string || 'all';
  
  try {
    const _command = `npx ruv-swarm agent list --filter ${filter}`;
    const _result = await execAsync(command);
    
    if (result.stdout) {
      try {
        const _listData = JSON.parse(result.stdout);
        if (listData.success && listData.data.agents) {
          console.log(`🤖 Agents (${listData.data.count}):`);
          
          if (listData.data.count === 0) {
            console.log('  No agents found');
            return;
          }
          
          listData.data.agents.forEach((agent: _any, index: number) => {
            console.log(`
  ${index + 1}. ${agent.id || agent.agentId}`);
            console.log(`     Type: ${agent.type}`);
            console.log(`     Status: ${agent.status}`);
            if (agent.name && agent.name !== agent.id) {
              console.log(`     Name: ${agent.name}`);
            }
            if (agent.capabilities && agent.capabilities.length > 0) {
              console.log(`     Capabilities: ${agent.capabilities.join(', ')}`);
            }
          });
        } else {
          console.log(result.stdout);
        }
      } catch {
        console.log(result.stdout);
      }
    }
    
  } catch (err) {
    error(`Failed to list agents: ${(err as Error).message}`);
  }
}
/**
 * Handle task orchestration
 */
async function handleOrchestrate(ctx: CommandContext) {
  if (ctx.args.length === 0) {
    error('Task description is required');
    console.log('Usage: claude-flow ruv-swarm orchestrate \"<task description>\" [options]');
    return;
  }
  
  const _task = ctx.args.join(' ');
  const _strategy = ctx.flags.strategy as string || 'adaptive';
  const _priority = ctx.flags.priority as string || 'medium';
  const _maxAgents = ctx.flags.maxAgents as number || ctx.flags['max-agents'] as number;
  
  info(`Orchestrating task: ${task}`);
  
  try {
    let _command = `npx ruv-swarm task orchestrate --task \"${task}\" --strategy ${strategy} --priority ${priority}`;
    
    if (maxAgents) {
      command += ` --max-agents ${maxAgents}`;
    }
    
    const _result = await execAsync(command);
    
    if (result.stdout) {
      try {
        const _taskData = JSON.parse(result.stdout);
        if (taskData.success) {
          success('Task orchestration started!');
          console.log(`  Task ID: ${taskData.data.taskId}`);
          console.log(`  Strategy: ${strategy}`);
          console.log(`  Priority: ${priority}`);
          
          if (taskData.data.assignedAgents) {
            console.log(`  Assigned Agents: ${taskData.data.assignedAgents}`);
          }
        } else {
          error(`Failed to orchestrate task: ${taskData.error}`);
        }
      } catch {
        console.log(result.stdout);
      }
    }
    
  } catch (err) {
    error(`Failed to orchestrate task: ${(err as Error).message}`);
  }
}
/**
 * Handle swarm monitoring
 */
async function handleMonitor(ctx: CommandContext) {
  const _duration = ctx.flags.duration as number || 30;
  const _interval = ctx.flags.interval as number || 5;
  
  info(`Monitoring swarm for ${duration} seconds...`);
  
  try {
    const _command = `npx ruv-swarm swarm monitor --duration ${duration} --interval ${interval}`;
    const _result = await execAsync(command);
    
    if (result.stdout) {
      console.log(result.stdout);
    }
    
  } catch (err) {
    error(`Failed to monitor swarm: ${(err as Error).message}`);
  }
}
/**
 * Handle neural capabilities
 */
async function handleNeural(ctx: CommandContext) {
  if (ctx.args.length === 0) {
    console.log('Neural subcommands:');
    console.log('  status     - Get neural agent status');
    console.log('  train      - Train neural agents');
    console.log('  patterns   - View cognitive patterns');
    return;
  }
  
  const _subcommand = ctx.args[0];
  
  try {
    switch (subcommand) {
      case 'status': {
        const _agentId = ctx.flags.agentId as string || ctx.flags['agent-id'] as string;
        let _command = 'npx ruv-swarm neural status';
        
        if (agentId) {
          command += ` --agent-id ${agentId}`;
        }
        
        const _result = await execAsync(command);
        if (result.stdout) {
          console.log(result.stdout);
        }
        break;
      }
      
      case 'train': {
        const _agentId = ctx.flags.agentId as string || ctx.flags['agent-id'] as string;
        const _iterations = ctx.flags.iterations as number || 10;
        
        let _command = `npx ruv-swarm neural train --iterations ${iterations}`;
        
        if (agentId) {
          command += ` --agent-id ${agentId}`;
        }
        
        info(`Training neural agents for ${iterations} iterations...`);
        
        const _result = await execAsync(command);
        if (result.stdout) {
          console.log(result.stdout);
        }
        break;
      }
      
      case 'patterns': {
        const _pattern = ctx.flags.pattern as string || 'all';
        const _command = `npx ruv-swarm neural patterns --pattern ${pattern}`;
        
        const _result = await execAsync(command);
        if (result.stdout) {
          console.log(result.stdout);
        }
        break;
      }
      
      default:
        error(`Unknown neural subcommand: ${subcommand}`);
        break;
    }
  } catch (err) {
    error(`Neural command failed: ${(err as Error).message}`);
  }
}
/**
 * Handle benchmarking
 */
async function handleBenchmark(ctx: CommandContext) {
  const _type = ctx.flags.type as string || 'all';
  const _iterations = ctx.flags.iterations as number || 10;
  
  info(`Running ${type} benchmark with ${iterations} iterations...`);
  
  try {
    const _command = `npx ruv-swarm benchmark run --type ${type} --iterations ${iterations}`;
    const _result = await execAsync(command);
    
    if (result.stdout) {
      console.log(result.stdout);
    }
    
  } catch (err) {
    error(`Benchmark failed: ${(err as Error).message}`);
  }
}
/**
 * Handle configuration management
 */
async function handleConfig(ctx: CommandContext) {
  if (ctx.args.length === 0) {
    console.log('Config subcommands:');
    console.log('  show       - Show current configuration');
    console.log('  set        - Set configuration value');
    console.log('  reset      - Reset to defaults');
    console.log('  validate   - Validate configuration');
    return;
  }
  
  const _subcommand = ctx.args[0];
  const _configManager = getRuvSwarmConfigManager(logger);
  
  try {
    switch (subcommand) {
      case 'show': {
        const _config = configManager.getConfig();
        console.log('🔧 ruv-swarm Configuration:
');
        console.log(JSON.stringify(_config, null, 2));
        break;
      }
      
      case 'set': {
        if (ctx.args.length < 3) {
          error('Usage: config set <section>.<key> <value>');
          console.log('Example: config set swarm.maxAgents 10');
          return;
        }
        
        const _path = ctx.args[1];
        const _value = ctx.args[2];
        const [section, key] = path.split('.');
        
        if (!section || !key) {
          error('Invalid path format. Use: section.key');
          return;
        }
        
        // Parse value
        let _parsedValue: unknown = value;
        if (value === 'true') parsedValue = true;
        else if (value === 'false') parsedValue = false;
        else if (!isNaN(Number(value))) parsedValue = Number(value);
        
        const _updates = { [section]: { [key]: parsedValue } };
        configManager.updateConfig(updates);
        
        success(`Configuration updated: ${path} = ${value}`);
        break;
      }
      
      case 'reset': {
        configManager.resetConfig();
        success('Configuration reset to defaults');
        break;
      }
      
      case 'validate': {
        const _validation = configManager.validateConfig();
        if (validation.valid) {
          success('Configuration is valid');
        } else {
          error('Configuration validation failed:');
          validation.errors.forEach(err => console.log(`  - ${err}`));
        }
        break;
      }
      
      default:
        error(`Unknown config subcommand: ${subcommand}`);
        break;
    }
  } catch (err) {
    error(`Config command failed: ${(err as Error).message}`);
  }
}
/**
 * Handle memory management
 */
async function handleMemory(ctx: CommandContext) {
  const _detail = ctx.flags.detail as string || 'summary';
  
  try {
    const _command = `npx ruv-swarm memory usage --detail ${detail}`;
    const _result = await execAsync(command);
    
    if (result.stdout) {
      try {
        const _memoryData = JSON.parse(result.stdout);
        if (memoryData.success) {
          console.log('💾 Memory Usage:
');
          
          const _data = memoryData.data;
          if (data.total !== undefined) {
            console.log(`  Total Memory: ${formatBytes(data.total)}`);
          }
          if (data.used !== undefined) {
            console.log(`  Used Memory: ${formatBytes(data.used)}`);
          }
          if (data.available !== undefined) {
            console.log(`  Available: ${formatBytes(data.available)}`);
          }
          if (data.swarmUsage !== undefined) {
            console.log(`  Swarm Usage: ${formatBytes(data.swarmUsage)}`);
          }
          
          if (detail === 'detailed' && data.breakdown) {
            console.log('
📊 Memory Breakdown:');
            console.log(JSON.stringify(data._breakdown, null, 2));
          }
        } else {
          console.log(result.stdout);
        }
      } catch {
        console.log(result.stdout);
      }
    }
    
  } catch (err) {
    error(`Failed to get memory usage: ${(err as Error).message}`);
  }
}
/**
 * Format bytes to human readable string
 */
function formatBytes(bytes: number): string {
  const _sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  if (bytes === 0) return '0 B';
  const _i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(_1024, i) * 100) / 100 + ' ' + sizes[i];
}
export default {
  ruvSwarmAction
};