/**
 * ruv-swarm MCP tools wrapper for Claude Code integration
 * 
 * This module provides MCP tools that integrate with the external ruv-swarm
 * package to enable advanced swarm coordination and neural capabilities.
 */
import type { MCPTool, MCPContext } from '../utils/types.js';
import type { ILogger } from '../core/logger.js';
import { execAsync } from '../utils/helpers.js';
import { existsSync } from 'fs';
import { join } from 'path';
export interface RuvSwarmToolContext extends MCPContext {
  workingDirectory?: string;
  swarmId?: string;
  sessionId?: string;
}
/**
 * Interface for ruv-swarm command responses
 */
interface RuvSwarmResponse {
  success: boolean;
  data?: unknown;
  error?: string;
  metadata?: {
    timestamp: number;
    swarmId?: string;
    sessionId?: string;
    performance?: unknown;
  };
}
/**
 * Execute ruv-swarm command with proper error handling
 */
async function executeRuvSwarmCommand(
  command: string,
  args: string[] = [],
  context?: _RuvSwarmToolContext,
  logger?: ILogger
): Promise<RuvSwarmResponse> {
  try {
    const _workDir = context?.workingDirectory || process.cwd();
    const _fullCommand = `npx ruv-swarm ${command} ${args.join(' ')}`;
    
    logger?.debug('Executing ruv-swarm command', { command: _fullCommand, workDir });
    
    const _result = await execAsync(_fullCommand, { cwd: workDir });
    
    // Parse JSON response if possible
    let data; // TODO: Remove if unused
    try {
      data = JSON.parse(result.stdout);
    } catch {
      data = { output: result.stdout, stderr: result.stderr };
    }
    
    logger?.debug('ruv-swarm command completed', { _command, success: true });
    
    return {
      success: true,
      data,
      metadata: {
        timestamp: Date.now(),
        swarmId: context?.swarmId,
        sessionId: context?.sessionId
      }
    };
  } catch (_error) {
    logger?.error('ruv-swarm command failed', { _command, error: (error instanceof Error ? error.message : String(error)) });
    
    return {
      success: false,
      error: (error instanceof Error ? error.message : String(error)),
      metadata: {
        timestamp: Date.now(),
        swarmId: context?.swarmId,
        sessionId: context?.sessionId
      }
    };
  }
}
/**
 * Create ruv-swarm MCP tools for Claude Code integration
 * 
 * These tools provide access to the full ruv-swarm functionality including:
 * - Swarm initialization and management
 * - Neural agent coordination
 * - Memory and persistence
 * - Performance monitoring
 * - Task orchestration
 */
export function createRuvSwarmTools(logger: ILogger): MCPTool[] {
  return [
    // === SWARM LIFECYCLE TOOLS ===
    {
      name: 'mcp__ruv-swarm__swarm_init',
      description: 'Initialize a new ruv-swarm with specified topology and configuration',
      inputSchema: {
        type: 'object',
        properties: {
          topology: {
            type: 'string',
            enum: ['mesh', 'hierarchical', 'ring', 'star'],
            description: 'Swarm topology type'
          },
          maxAgents: {
            type: 'number',
            minimum: 1,
            maximum: 100,
            default: 5,
            description: 'Maximum number of agents'
          },
          strategy: {
            type: 'string',
            enum: ['balanced', 'specialized', 'adaptive'],
            default: 'balanced',
            description: 'Distribution strategy'
          }
        },
        required: ['topology']
      },
      handler: async (input: _unknown, context?: RuvSwarmToolContext) => {
        const _args = [
          '--topology', input.topology,
          '--max-agents', String(input.maxAgents || 5),
          '--strategy', input.strategy || 'balanced'
        ];
        
        return await executeRuvSwarmCommand('swarm init', _args, _context, logger);
      }
    },
    {
      name: 'mcp__ruv-swarm__swarm_status',
      description: 'Get current swarm status and agent information',
      inputSchema: {
        type: 'object',
        properties: {
          verbose: {
            type: 'boolean',
            default: false,
            description: 'Include detailed agent information'
          }
        }
      },
      handler: async (input: _unknown, context?: RuvSwarmToolContext) => {
        const _args = input.verbose ? ['--verbose'] : [];
        return await executeRuvSwarmCommand('swarm status', _args, _context, logger);
      }
    },
    {
      name: 'mcp__ruv-swarm__swarm_monitor',
      description: 'Monitor swarm activity in real-time',
      inputSchema: {
        type: 'object',
        properties: {
          duration: {
            type: 'number',
            default: 10,
            description: 'Monitoring duration in seconds'
          },
          interval: {
            type: 'number',
            default: 1,
            description: 'Update interval in seconds'
          }
        }
      },
      handler: async (input: _unknown, context?: RuvSwarmToolContext) => {
        const _args = [
          '--duration', String(input.duration || 10),
          '--interval', String(input.interval || 1)
        ];
        
        return await executeRuvSwarmCommand('swarm monitor', _args, _context, logger);
      }
    },
    // === AGENT MANAGEMENT TOOLS ===
    {
      name: 'mcp__ruv-swarm__agent_spawn',
      description: 'Spawn a new agent in the swarm',
      inputSchema: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['coordinator', 'researcher', 'coder', 'analyst', 'architect', 'tester', 'reviewer', 'optimizer', 'documenter', 'monitor', 'specialist'],
            description: 'Agent type'
          },
          name: {
            type: 'string',
            description: 'Custom agent name'
          },
          capabilities: {
            type: 'array',
            items: { type: 'string' },
            description: 'Agent capabilities'
          }
        },
        required: ['type']
      },
      handler: async (input: _unknown, context?: RuvSwarmToolContext) => {
        const _args = ['--type', input.type];
        
        if (input.name) {
          args.push('--name', input.name);
        }
        
        if (input.capabilities && input.capabilities.length > 0) {
          args.push('--capabilities', input.capabilities.join(','));
        }
        
        return await executeRuvSwarmCommand('agent spawn', _args, _context, logger);
      }
    },
    {
      name: 'mcp__ruv-swarm__agent_list',
      description: 'List all active agents in the swarm',
      inputSchema: {
        type: 'object',
        properties: {
          filter: {
            type: 'string',
            enum: ['all', 'active', 'idle', 'busy'],
            default: 'all',
            description: 'Filter agents by status'
          }
        }
      },
      handler: async (input: _unknown, context?: RuvSwarmToolContext) => {
        const _args = ['--filter', input.filter || 'all'];
        return await executeRuvSwarmCommand('agent list', _args, _context, logger);
      }
    },
    {
      name: 'mcp__ruv-swarm__agent_metrics',
      description: 'Get performance metrics for agents',
      inputSchema: {
        type: 'object',
        properties: {
          agentId: {
            type: 'string',
            description: 'Specific agent ID (optional)'
          },
          metric: {
            type: 'string',
            enum: ['all', 'cpu', 'memory', 'tasks', 'performance'],
            default: 'all'
          }
        }
      },
      handler: async (input: _unknown, context?: RuvSwarmToolContext) => {
        const _args = ['--metric', input.metric || 'all'];
        
        if (input.agentId) {
          args.push('--agent-id', input.agentId);
        }
        
        return await executeRuvSwarmCommand('agent metrics', _args, _context, logger);
      }
    },
    // === TASK ORCHESTRATION TOOLS ===
    {
      name: 'mcp__ruv-swarm__task_orchestrate',
      description: 'Orchestrate a task across the swarm',
      inputSchema: {
        type: 'object',
        properties: {
          task: {
            type: 'string',
            description: 'Task description or instructions'
          },
          strategy: {
            type: 'string',
            enum: ['parallel', 'sequential', 'adaptive'],
            default: 'adaptive',
            description: 'Execution strategy'
          },
          priority: {
            type: 'string',
            enum: ['low', 'medium', 'high', 'critical'],
            default: 'medium',
            description: 'Task priority'
          },
          maxAgents: {
            type: 'number',
            minimum: 1,
            maximum: 10,
            description: 'Maximum agents to use'
          }
        },
        required: ['task']
      },
      handler: async (input: _unknown, context?: RuvSwarmToolContext) => {
        const _args = [
          '--task', JSON.stringify(input.task),
          '--strategy', input.strategy || 'adaptive',
          '--priority', input.priority || 'medium'
        ];
        
        if (input.maxAgents) {
          args.push('--max-agents', String(input.maxAgents));
        }
        
        return await executeRuvSwarmCommand('task orchestrate', _args, _context, logger);
      }
    },
    {
      name: 'mcp__ruv-swarm__task_status',
      description: 'Check progress of running tasks',
      inputSchema: {
        type: 'object',
        properties: {
          taskId: {
            type: 'string',
            description: 'Specific task ID (optional)'
          },
          detailed: {
            type: 'boolean',
            default: false,
            description: 'Include detailed progress'
          }
        }
      },
      handler: async (input: _unknown, context?: RuvSwarmToolContext) => {
        const _args = [];
        
        if (input.taskId) {
          args.push('--task-id', input.taskId);
        }
        
        if (input.detailed) {
          args.push('--detailed');
        }
        
        return await executeRuvSwarmCommand('task status', _args, _context, logger);
      }
    },
    {
      name: 'mcp__ruv-swarm__task_results',
      description: 'Retrieve results from completed tasks',
      inputSchema: {
        type: 'object',
        properties: {
          taskId: {
            type: 'string',
            description: 'Task ID to retrieve results for'
          },
          format: {
            type: 'string',
            enum: ['summary', 'detailed', 'raw'],
            default: 'summary',
            description: 'Result format'
          }
        },
        required: ['taskId']
      },
      handler: async (input: _unknown, context?: RuvSwarmToolContext) => {
        const _args = [
          '--task-id', input.taskId,
          '--format', input.format || 'summary'
        ];
        
        return await executeRuvSwarmCommand('task results', _args, _context, logger);
      }
    },
    // === MEMORY AND PERSISTENCE TOOLS ===
    {
      name: 'mcp__ruv-swarm__memory_usage',
      description: 'Get current memory usage statistics',
      inputSchema: {
        type: 'object',
        properties: {
          detail: {
            type: 'string',
            enum: ['summary', 'detailed', 'by-agent'],
            default: 'summary',
            description: 'Detail level'
          }
        }
      },
      handler: async (input: _unknown, context?: RuvSwarmToolContext) => {
        const _args = ['--detail', input.detail || 'summary'];
        return await executeRuvSwarmCommand('memory usage', _args, _context, logger);
      }
    },
    // === NEURAL CAPABILITIES TOOLS ===
    {
      name: 'mcp__ruv-swarm__neural_status',
      description: 'Get neural agent status and performance metrics',
      inputSchema: {
        type: 'object',
        properties: {
          agentId: {
            type: 'string',
            description: 'Specific agent ID (optional)'
          }
        }
      },
      handler: async (input: _unknown, context?: RuvSwarmToolContext) => {
        const _args = [];
        
        if (input.agentId) {
          args.push('--agent-id', input.agentId);
        }
        
        return await executeRuvSwarmCommand('neural status', _args, _context, logger);
      }
    },
    {
      name: 'mcp__ruv-swarm__neural_train',
      description: 'Train neural agents with sample tasks',
      inputSchema: {
        type: 'object',
        properties: {
          agentId: {
            type: 'string',
            description: 'Specific agent ID to train (optional)'
          },
          iterations: {
            type: 'number',
            minimum: 1,
            maximum: 100,
            default: 10,
            description: 'Number of training iterations'
          }
        }
      },
      handler: async (input: _unknown, context?: RuvSwarmToolContext) => {
        const _args = ['--iterations', String(input.iterations || 10)];
        
        if (input.agentId) {
          args.push('--agent-id', input.agentId);
        }
        
        return await executeRuvSwarmCommand('neural train', _args, _context, logger);
      }
    },
    {
      name: 'mcp__ruv-swarm__neural_patterns',
      description: 'Get cognitive pattern information',
      inputSchema: {
        type: 'object',
        properties: {
          pattern: {
            type: 'string',
            enum: ['all', 'convergent', 'divergent', 'lateral', 'systems', 'critical', 'abstract'],
            default: 'all',
            description: 'Cognitive pattern type'
          }
        }
      },
      handler: async (input: _unknown, context?: RuvSwarmToolContext) => {
        const _args = ['--pattern', input.pattern || 'all'];
        return await executeRuvSwarmCommand('neural patterns', _args, _context, logger);
      }
    },
    // === PERFORMANCE AND BENCHMARKING TOOLS ===
    {
      name: 'mcp__ruv-swarm__benchmark_run',
      description: 'Execute performance benchmarks',
      inputSchema: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['all', 'wasm', 'swarm', 'agent', 'task'],
            default: 'all',
            description: 'Benchmark type'
          },
          iterations: {
            type: 'number',
            minimum: 1,
            maximum: 100,
            default: 10,
            description: 'Number of iterations'
          }
        }
      },
      handler: async (input: _unknown, context?: RuvSwarmToolContext) => {
        const _args = [
          '--type', input.type || 'all',
          '--iterations', String(input.iterations || 10)
        ];
        
        return await executeRuvSwarmCommand('benchmark run', _args, _context, logger);
      }
    },
    {
      name: 'mcp__ruv-swarm__features_detect',
      description: 'Detect runtime features and capabilities',
      inputSchema: {
        type: 'object',
        properties: {
          category: {
            type: 'string',
            enum: ['all', 'wasm', 'simd', 'memory', 'platform'],
            default: 'all',
            description: 'Feature category'
          }
        }
      },
      handler: async (input: _unknown, context?: RuvSwarmToolContext) => {
        const _args = ['--category', input.category || 'all'];
        return await executeRuvSwarmCommand('features detect', _args, _context, logger);
      }
    }
  ];
}
/**
 * Check if ruv-swarm is available in the current environment
 */
export async function isRuvSwarmAvailable(logger?: ILogger): Promise<boolean> {
  try {
    const _result = await executeRuvSwarmCommand('--version', [], _undefined, logger);
    return result.success;
  } catch (_error) {
    logger?.warn('ruv-swarm not available', { error: error instanceof Error ? (error instanceof Error ? error.message : String(error)) : error });
    return false;
  }
}
/**
 * Get ruv-swarm configuration and capabilities
 */
export async function getRuvSwarmCapabilities(logger?: ILogger): Promise<unknown> {
  try {
    const _result = await executeRuvSwarmCommand('features detect', ['--category', 'all'], _undefined, logger);
    return result.data;
  } catch (_error) {
    logger?.error('Failed to get ruv-swarm capabilities', error);
    return null;
  }
}
/**
 * Initialize ruv-swarm with claude-code-flow integration
 */
export async function initializeRuvSwarmIntegration(
  workingDirectory: string,
  logger?: ILogger
): Promise<RuvSwarmResponse> {
  const _context: RuvSwarmToolContext = {
    workingDirectory,
    sessionId: `claude-flow-${Date.now()}`
  };
  
  logger?.info('Initializing ruv-swarm integration', { workingDirectory });
  
  // Check if ruv-swarm is available
  const _available = await isRuvSwarmAvailable(logger);
  if (!available) {
    return {
      success: false,
      error: 'ruv-swarm is not available. Please install it with: npm install -g ruv-swarm'
    };
  }
  
  // Get capabilities
  const _capabilities = await getRuvSwarmCapabilities(logger);
  
  logger?.info('ruv-swarm integration initialized', { capabilities });
  
  return {
    success: true,
    data: {
      available: true,
      capabilities,
      integration: 'claude-code-flow',
      sessionId: context.sessionId
    },
    metadata: {
      timestamp: Date.now(),
      sessionId: context.sessionId
    }
  };
}
export default {
  createRuvSwarmTools,
  isRuvSwarmAvailable,
  getRuvSwarmCapabilities,
  initializeRuvSwarmIntegration
};