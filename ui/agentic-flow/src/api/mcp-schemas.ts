/**
 * MCP Tool Parameter Schemas
 * JSON Schema definitions for all 71+ MCP tools
 */

export interface ToolParameterSchema {
  type: string;
  properties?: Record<string, any>;
  required?: string[];
  enum?: string[];
  default?: any;
  description?: string;
  minimum?: number;
  maximum?: number;
  items?: any;
}

export interface ToolSchema {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, ToolParameterSchema>;
    required?: string[];
    additionalProperties?: boolean;
  };
}

/**
 * Complete MCP tool schemas
 */
export const MCPToolSchemas: Record<string, ToolSchema> = {
  // Coordination Tools
  swarm_init: {
    name: 'swarm_init',
    description: 'Initialize swarm with topology and configuration',
    parameters: {
      type: 'object',
      properties: {
        topology: {
          type: 'string',
          enum: ['hierarchical', 'mesh', 'ring', 'star'],
          description: 'Swarm topology type'
        },
        maxAgents: {
          type: 'number',
          default: 8,
          minimum: 1,
          maximum: 100,
          description: 'Maximum number of agents'
        },
        strategy: {
          type: 'string',
          default: 'auto',
          description: 'Distribution strategy'
        }
      },
      required: ['topology']
    }
  },

  agent_spawn: {
    name: 'agent_spawn',
    description: 'Create specialized AI agents',
    parameters: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['coordinator', 'researcher', 'coder', 'analyst', 'architect', 'tester', 'reviewer', 'optimizer', 'documenter', 'monitor', 'specialist'],
          description: 'Agent type'
        },
        name: {
          type: 'string',
          description: 'Agent name'
        },
        swarmId: {
          type: 'string',
          description: 'Swarm ID to spawn into'
        },
        capabilities: {
          type: 'array',
          items: { type: 'string' },
          description: 'Agent capabilities'
        }
      },
      required: ['type']
    }
  },

  task_orchestrate: {
    name: 'task_orchestrate',
    description: 'Orchestrate complex task workflows',
    parameters: {
      type: 'object',
      properties: {
        task: {
          type: 'string',
          description: 'Task description'
        },
        dependencies: {
          type: 'array',
          items: { type: 'string' },
          description: 'Task dependencies'
        },
        priority: {
          type: 'string',
          enum: ['low', 'medium', 'high', 'critical'],
          description: 'Task priority'
        },
        strategy: {
          type: 'string',
          enum: ['parallel', 'sequential', 'adaptive', 'balanced'],
          description: 'Execution strategy'
        }
      },
      required: ['task']
    }
  },

  // Monitoring Tools
  swarm_status: {
    name: 'swarm_status',
    description: 'Monitor swarm health and performance',
    parameters: {
      type: 'object',
      properties: {
        swarmId: {
          type: 'string',
          description: 'Swarm ID to check status'
        }
      }
    }
  },

  swarm_monitor: {
    name: 'swarm_monitor',
    description: 'Real-time swarm monitoring',
    parameters: {
      type: 'object',
      properties: {
        swarmId: {
          type: 'string',
          description: 'Swarm ID to monitor'
        },
        interval: {
          type: 'number',
          default: 1000,
          minimum: 100,
          description: 'Update interval in milliseconds'
        }
      }
    }
  },

  agent_list: {
    name: 'agent_list',
    description: 'List active agents & capabilities',
    parameters: {
      type: 'object',
      properties: {
        swarmId: {
          type: 'string',
          description: 'Swarm ID to list agents from'
        }
      }
    }
  },

  agent_metrics: {
    name: 'agent_metrics',
    description: 'Agent performance metrics',
    parameters: {
      type: 'object',
      properties: {
        agentId: {
          type: 'string',
          description: 'Agent ID to get metrics for'
        }
      }
    }
  },

  // Memory Tools
  memory_usage: {
    name: 'memory_usage',
    description: 'Store/retrieve persistent memory with TTL and namespacing',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['store', 'retrieve', 'list', 'delete', 'search'],
          description: 'Memory action to perform'
        },
        key: {
          type: 'string',
          description: 'Memory key'
        },
        value: {
          type: 'string',
          description: 'Value to store (for store action)'
        },
        namespace: {
          type: 'string',
          default: 'default',
          description: 'Memory namespace'
        },
        ttl: {
          type: 'number',
          description: 'Time to live in seconds'
        }
      },
      required: ['action']
    }
  },

  memory_search: {
    name: 'memory_search',
    description: 'Search memory with patterns',
    parameters: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'Search pattern'
        },
        namespace: {
          type: 'string',
          description: 'Namespace to search in'
        },
        limit: {
          type: 'number',
          default: 10,
          minimum: 1,
          maximum: 100,
          description: 'Maximum results to return'
        }
      },
      required: ['pattern']
    }
  },

  // Neural Tools
  neural_status: {
    name: 'neural_status',
    description: 'Check neural network status',
    parameters: {
      type: 'object',
      properties: {
        modelId: {
          type: 'string',
          description: 'Neural model ID'
        }
      }
    }
  },

  neural_train: {
    name: 'neural_train',
    description: 'Train neural patterns with WASM SIMD acceleration',
    parameters: {
      type: 'object',
      properties: {
        pattern_type: {
          type: 'string',
          enum: ['coordination', 'optimization', 'prediction'],
          description: 'Pattern type to train'
        },
        training_data: {
          type: 'string',
          description: 'Training data as JSON string'
        },
        epochs: {
          type: 'number',
          default: 50,
          minimum: 1,
          maximum: 1000,
          description: 'Number of training epochs'
        }
      },
      required: ['pattern_type', 'training_data']
    }
  },

  neural_patterns: {
    name: 'neural_patterns',
    description: 'Analyze cognitive patterns',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['analyze', 'learn', 'predict'],
          description: 'Neural pattern action'
        },
        operation: {
          type: 'string',
          description: 'Operation to analyze'
        },
        outcome: {
          type: 'string',
          description: 'Expected outcome'
        },
        metadata: {
          type: 'object',
          description: 'Additional metadata'
        }
      },
      required: ['action']
    }
  },

  neural_predict: {
    name: 'neural_predict',
    description: 'Make AI predictions',
    parameters: {
      type: 'object',
      properties: {
        modelId: {
          type: 'string',
          description: 'Model ID to use'
        },
        input: {
          type: 'string',
          description: 'Input data for prediction'
        }
      },
      required: ['modelId', 'input']
    }
  },

  // Performance Tools
  performance_report: {
    name: 'performance_report',
    description: 'Generate performance reports with real-time metrics',
    parameters: {
      type: 'object',
      properties: {
        format: {
          type: 'string',
          default: 'summary',
          enum: ['summary', 'detailed', 'json'],
          description: 'Report format'
        },
        timeframe: {
          type: 'string',
          default: '24h',
          enum: ['24h', '7d', '30d'],
          description: 'Report timeframe'
        }
      }
    }
  },

  bottleneck_analyze: {
    name: 'bottleneck_analyze',
    description: 'Identify performance bottlenecks',
    parameters: {
      type: 'object',
      properties: {
        component: {
          type: 'string',
          description: 'Component to analyze'
        },
        metrics: {
          type: 'array',
          items: { type: 'string' },
          description: 'Metrics to analyze'
        }
      }
    }
  },

  token_usage: {
    name: 'token_usage',
    description: 'Analyze token consumption',
    parameters: {
      type: 'object',
      properties: {
        operation: {
          type: 'string',
          description: 'Operation to analyze'
        },
        timeframe: {
          type: 'string',
          default: '24h',
          description: 'Analysis timeframe'
        }
      }
    }
  },

  // GitHub Tools
  github_repo_analyze: {
    name: 'github_repo_analyze',
    description: 'Repository analysis',
    parameters: {
      type: 'object',
      properties: {
        repo: {
          type: 'string',
          description: 'Repository name (owner/repo)'
        },
        analysis_type: {
          type: 'string',
          enum: ['code_quality', 'performance', 'security'],
          description: 'Type of analysis'
        }
      },
      required: ['repo']
    }
  },

  github_pr_manage: {
    name: 'github_pr_manage',
    description: 'Pull request management',
    parameters: {
      type: 'object',
      properties: {
        repo: {
          type: 'string',
          description: 'Repository name'
        },
        action: {
          type: 'string',
          enum: ['review', 'merge', 'close'],
          description: 'PR action'
        },
        pr_number: {
          type: 'number',
          description: 'Pull request number'
        }
      },
      required: ['repo', 'action']
    }
  },

  github_issue_track: {
    name: 'github_issue_track',
    description: 'Issue tracking & triage',
    parameters: {
      type: 'object',
      properties: {
        repo: {
          type: 'string',
          description: 'Repository name'
        },
        action: {
          type: 'string',
          description: 'Issue action'
        }
      },
      required: ['repo', 'action']
    }
  },

  // DAA Tools
  daa_agent_create: {
    name: 'daa_agent_create',
    description: 'Create dynamic agents',
    parameters: {
      type: 'object',
      properties: {
        agent_type: {
          type: 'string',
          description: 'Dynamic agent type'
        },
        capabilities: {
          type: 'array',
          items: { type: 'string' },
          description: 'Agent capabilities'
        },
        resources: {
          type: 'object',
          description: 'Resource allocation'
        }
      },
      required: ['agent_type']
    }
  },

  daa_capability_match: {
    name: 'daa_capability_match',
    description: 'Match capabilities to tasks',
    parameters: {
      type: 'object',
      properties: {
        task_requirements: {
          type: 'array',
          items: { type: 'string' },
          description: 'Required capabilities'
        },
        available_agents: {
          type: 'array',
          items: { type: 'string' },
          description: 'Available agent IDs'
        }
      },
      required: ['task_requirements']
    }
  },

  // Workflow Tools
  workflow_create: {
    name: 'workflow_create',
    description: 'Create custom workflows',
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Workflow name'
        },
        steps: {
          type: 'array',
          description: 'Workflow steps'
        },
        triggers: {
          type: 'array',
          description: 'Workflow triggers'
        }
      },
      required: ['name', 'steps']
    }
  },

  workflow_execute: {
    name: 'workflow_execute',
    description: 'Execute predefined workflows',
    parameters: {
      type: 'object',
      properties: {
        workflowId: {
          type: 'string',
          description: 'Workflow ID to execute'
        },
        params: {
          type: 'object',
          description: 'Workflow parameters'
        }
      },
      required: ['workflowId']
    }
  },

  workflow_export: {
    name: 'workflow_export',
    description: 'Export workflow definitions',
    parameters: {
      type: 'object',
      properties: {
        workflowId: {
          type: 'string',
          description: 'Workflow ID to export'
        },
        format: {
          type: 'string',
          enum: ['json', 'yaml', 'markdown'],
          description: 'Export format'
        }
      },
      required: ['workflowId']
    }
  },

  // SPARC Modes
  sparc_mode: {
    name: 'sparc_mode',
    description: 'Run SPARC development modes',
    parameters: {
      type: 'object',
      properties: {
        mode: {
          type: 'string',
          enum: ['dev', 'api', 'ui', 'test', 'refactor'],
          description: 'SPARC mode'
        },
        task_description: {
          type: 'string',
          description: 'Task description'
        },
        options: {
          type: 'object',
          description: 'Mode-specific options'
        }
      },
      required: ['mode', 'task_description']
    }
  },

  // System Tools
  swarm_scale: {
    name: 'swarm_scale',
    description: 'Auto-scale agent count',
    parameters: {
      type: 'object',
      properties: {
        swarmId: {
          type: 'string',
          description: 'Swarm ID to scale'
        },
        targetSize: {
          type: 'number',
          minimum: 1,
          maximum: 100,
          description: 'Target number of agents'
        }
      }
    }
  },

  swarm_destroy: {
    name: 'swarm_destroy',
    description: 'Gracefully shutdown swarm',
    parameters: {
      type: 'object',
      properties: {
        swarmId: {
          type: 'string',
          description: 'Swarm ID to destroy'
        }
      },
      required: ['swarmId']
    }
  },

  topology_optimize: {
    name: 'topology_optimize',
    description: 'Auto-optimize swarm topology',
    parameters: {
      type: 'object',
      properties: {
        swarmId: {
          type: 'string',
          description: 'Swarm ID to optimize'
        }
      }
    }
  },

  load_balance: {
    name: 'load_balance',
    description: 'Distribute tasks efficiently',
    parameters: {
      type: 'object',
      properties: {
        swarmId: {
          type: 'string',
          description: 'Swarm ID'
        },
        tasks: {
          type: 'array',
          description: 'Tasks to distribute'
        }
      }
    }
  },

  coordination_sync: {
    name: 'coordination_sync',
    description: 'Sync agent coordination',
    parameters: {
      type: 'object',
      properties: {
        swarmId: {
          type: 'string',
          description: 'Swarm ID to sync'
        }
      }
    }
  },

  // Additional monitoring and maintenance tools
  task_status: {
    name: 'task_status',
    description: 'Check task execution status',
    parameters: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'Task ID to check'
        }
      },
      required: ['taskId']
    }
  },

  task_results: {
    name: 'task_results',
    description: 'Get task completion results',
    parameters: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'Task ID to get results for'
        }
      },
      required: ['taskId']
    }
  },

  benchmark_run: {
    name: 'benchmark_run',
    description: 'Performance benchmarks',
    parameters: {
      type: 'object',
      properties: {
        suite: {
          type: 'string',
          description: 'Benchmark suite to run'
        }
      }
    }
  },

  metrics_collect: {
    name: 'metrics_collect',
    description: 'Collect system metrics',
    parameters: {
      type: 'object',
      properties: {
        components: {
          type: 'array',
          items: { type: 'string' },
          description: 'Components to collect metrics from'
        }
      }
    }
  },

  health_check: {
    name: 'health_check',
    description: 'System health monitoring',
    parameters: {
      type: 'object',
      properties: {
        components: {
          type: 'array',
          items: { type: 'string' },
          description: 'Components to check'
        }
      }
    }
  }
};

/**
 * Get schema for a specific tool
 */
export function getToolSchema(toolName: string): ToolSchema | undefined {
  return MCPToolSchemas[toolName];
}

/**
 * Validate tool parameters against schema
 */
export function validateToolParameters(toolName: string, parameters: any): {
  valid: boolean;
  errors?: string[];
} {
  const schema = getToolSchema(toolName);
  if (!schema) {
    return {
      valid: false,
      errors: [`Unknown tool: ${toolName}`]
    };
  }

  const errors: string[] = [];
  const paramSchema = schema.parameters;

  // Check required parameters
  if (paramSchema.required) {
    for (const required of paramSchema.required) {
      if (!(required in parameters)) {
        errors.push(`Missing required parameter: ${required}`);
      }
    }
  }

  // Validate parameter types and values
  for (const [key, value] of Object.entries(parameters)) {
    const propSchema = paramSchema.properties[key];
    if (!propSchema) {
      if (paramSchema.additionalProperties === false) {
        errors.push(`Unknown parameter: ${key}`);
      }
      continue;
    }

    // Type validation
    if (propSchema.type) {
      const actualType = Array.isArray(value) ? 'array' : typeof value;
      if (actualType !== propSchema.type) {
        errors.push(`Parameter ${key} must be of type ${propSchema.type}, got ${actualType}`);
      }
    }

    // Enum validation
    if (propSchema.enum && !propSchema.enum.includes(value)) {
      errors.push(`Parameter ${key} must be one of: ${propSchema.enum.join(', ')}`);
    }

    // Number range validation
    if (propSchema.type === 'number') {
      if (propSchema.minimum !== undefined && value < propSchema.minimum) {
        errors.push(`Parameter ${key} must be >= ${propSchema.minimum}`);
      }
      if (propSchema.maximum !== undefined && value > propSchema.maximum) {
        errors.push(`Parameter ${key} must be <= ${propSchema.maximum}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined
  };
}

/**
 * Get tool categories
 */
export function getToolCategories(): string[] {
  return [
    'coordination',
    'monitoring',
    'memory',
    'neural',
    'github',
    'system',
    'workflow',
    'daa',
    'sparc'
  ];
}

/**
 * Get tools grouped by category
 */
export function getToolsByCategory(): Record<string, string[]> {
  const categories: Record<string, string[]> = {};
  
  for (const [toolName, schema] of Object.entries(MCPToolSchemas)) {
    // Determine category from tool name prefix
    let category = 'system';
    if (toolName.startsWith('swarm_') || toolName.startsWith('agent_') || toolName.startsWith('task_')) {
      category = 'coordination';
    } else if (toolName.includes('monitor') || toolName.includes('metrics') || toolName.includes('status')) {
      category = 'monitoring';
    } else if (toolName.startsWith('memory_')) {
      category = 'memory';
    } else if (toolName.startsWith('neural_')) {
      category = 'neural';
    } else if (toolName.startsWith('github_')) {
      category = 'github';
    } else if (toolName.startsWith('workflow_')) {
      category = 'workflow';
    } else if (toolName.startsWith('daa_')) {
      category = 'daa';
    } else if (toolName.startsWith('sparc_')) {
      category = 'sparc';
    } else if (toolName.includes('performance') || toolName.includes('bottleneck') || toolName.includes('token')) {
      category = 'system';
    }
    
    if (!categories[category]) {
      categories[category] = [];
    }
    categories[category].push(toolName);
  }
  
  return categories;
}