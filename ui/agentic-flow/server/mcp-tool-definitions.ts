/**
 * MCP Tool Definitions for Claude Flow
 * Defines all 87 tools with complete parameter schemas
 */

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

export const CLAUDE_FLOW_TOOLS: Record<string, ToolDefinition> = {
  // ===== COORDINATION TOOLS (9) =====
  swarm_init: {
    name: 'swarm_init',
    description: 'Initialize a new swarm with specified topology and configuration',
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
          description: 'Maximum number of agents in the swarm',
          minimum: 1,
          maximum: 50
        },
        strategy: {
          type: 'string',
          enum: ['balanced', 'specialized', 'adaptive'],
          description: 'Agent distribution strategy'
        },
        name: {
          type: 'string',
          description: 'Optional swarm name'
        }
      },
      required: ['topology']
    }
  },

  agent_spawn: {
    name: 'agent_spawn',
    description: 'Spawn a new agent with specified type and capabilities',
    inputSchema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['researcher', 'coder', 'analyst', 'architect', 'tester', 'coordinator', 'specialist'],
          description: 'Agent type'
        },
        name: {
          type: 'string',
          description: 'Agent name'
        },
        capabilities: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of agent capabilities'
        },
        priority: {
          type: 'string',
          enum: ['low', 'medium', 'high'],
          description: 'Agent priority level'
        }
      },
      required: ['type']
    }
  },

  task_orchestrate: {
    name: 'task_orchestrate',
    description: 'Orchestrate a complex task across the swarm',
    inputSchema: {
      type: 'object',
      properties: {
        task: {
          type: 'string',
          description: 'Task description'
        },
        strategy: {
          type: 'string',
          enum: ['parallel', 'sequential', 'adaptive'],
          description: 'Execution strategy'
        },
        priority: {
          type: 'string',
          enum: ['low', 'medium', 'high', 'critical'],
          description: 'Task priority'
        },
        dependencies: {
          type: 'array',
          items: { type: 'string' },
          description: 'Task dependencies'
        },
        timeout: {
          type: 'number',
          description: 'Task timeout in seconds'
        }
      },
      required: ['task']
    }
  },

  task_status: {
    name: 'task_status',
    description: 'Get status of a specific task or all tasks',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'Optional task ID to check specific task'
        },
        includeHistory: {
          type: 'boolean',
          description: 'Include task history'
        }
      }
    }
  },

  task_results: {
    name: 'task_results',
    description: 'Retrieve results from completed tasks',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'Task ID to get results for'
        },
        format: {
          type: 'string',
          enum: ['json', 'summary', 'detailed'],
          description: 'Result format'
        }
      }
    }
  },

  swarm_status: {
    name: 'swarm_status',
    description: 'Get current swarm status and health',
    inputSchema: {
      type: 'object',
      properties: {
        verbose: {
          type: 'boolean',
          description: 'Include detailed status information'
        }
      }
    }
  },

  swarm_monitor: {
    name: 'swarm_monitor',
    description: 'Monitor real-time swarm activity and performance',
    inputSchema: {
      type: 'object',
      properties: {
        duration: {
          type: 'number',
          description: 'Monitoring duration in seconds'
        },
        metrics: {
          type: 'array',
          items: { type: 'string' },
          description: 'Specific metrics to monitor'
        }
      }
    }
  },

  coordination_optimize: {
    name: 'coordination_optimize',
    description: 'Optimize swarm coordination based on performance data',
    inputSchema: {
      type: 'object',
      properties: {
        targetMetric: {
          type: 'string',
          enum: ['speed', 'accuracy', 'cost', 'balanced'],
          description: 'Optimization target'
        },
        constraints: {
          type: 'object',
          description: 'Optimization constraints'
        }
      }
    }
  },

  swarm_broadcast: {
    name: 'swarm_broadcast',
    description: 'Broadcast a message to all agents in the swarm',
    inputSchema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'Message to broadcast'
        },
        targetAgents: {
          type: 'array',
          items: { type: 'string' },
          description: 'Specific agents to target (optional)'
        }
      },
      required: ['message']
    }
  },

  // ===== NEURAL TOOLS (15) =====
  neural_status: {
    name: 'neural_status',
    description: 'Get status of neural processing capabilities',
    inputSchema: {
      type: 'object',
      properties: {
        includeModels: {
          type: 'boolean',
          description: 'Include model details'
        }
      }
    }
  },

  neural_train: {
    name: 'neural_train',
    description: 'Train neural patterns from successful operations',
    inputSchema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          description: 'Training data'
        },
        model: {
          type: 'string',
          description: 'Model to train'
        },
        epochs: {
          type: 'number',
          description: 'Training epochs'
        }
      },
      required: ['data']
    }
  },

  neural_patterns: {
    name: 'neural_patterns',
    description: 'Analyze and retrieve learned neural patterns',
    inputSchema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          description: 'Pattern category to analyze'
        },
        limit: {
          type: 'number',
          description: 'Maximum patterns to return'
        }
      }
    }
  },

  neural_predict: {
    name: 'neural_predict',
    description: 'Predict outcomes using neural models',
    inputSchema: {
      type: 'object',
      properties: {
        input: {
          type: 'object',
          description: 'Input data for prediction'
        },
        model: {
          type: 'string',
          description: 'Model to use for prediction'
        }
      },
      required: ['input']
    }
  },

  neural_optimize: {
    name: 'neural_optimize',
    description: 'Optimize neural model performance',
    inputSchema: {
      type: 'object',
      properties: {
        model: {
          type: 'string',
          description: 'Model to optimize'
        },
        targetMetric: {
          type: 'string',
          description: 'Optimization target'
        }
      }
    }
  },

  neural_export: {
    name: 'neural_export',
    description: 'Export neural models and patterns',
    inputSchema: {
      type: 'object',
      properties: {
        format: {
          type: 'string',
          enum: ['json', 'onnx', 'tensorflow'],
          description: 'Export format'
        },
        models: {
          type: 'array',
          items: { type: 'string' },
          description: 'Models to export'
        }
      }
    }
  },

  neural_import: {
    name: 'neural_import',
    description: 'Import neural models from external sources',
    inputSchema: {
      type: 'object',
      properties: {
        source: {
          type: 'string',
          description: 'Import source path or URL'
        },
        format: {
          type: 'string',
          enum: ['json', 'onnx', 'tensorflow'],
          description: 'Import format'
        }
      },
      required: ['source']
    }
  },

  neural_benchmark: {
    name: 'neural_benchmark',
    description: 'Benchmark neural model performance',
    inputSchema: {
      type: 'object',
      properties: {
        models: {
          type: 'array',
          items: { type: 'string' },
          description: 'Models to benchmark'
        },
        dataset: {
          type: 'string',
          description: 'Test dataset'
        }
      }
    }
  },

  neural_ensemble: {
    name: 'neural_ensemble',
    description: 'Create ensemble of neural models',
    inputSchema: {
      type: 'object',
      properties: {
        models: {
          type: 'array',
          items: { type: 'string' },
          description: 'Models to ensemble'
        },
        method: {
          type: 'string',
          enum: ['voting', 'averaging', 'stacking'],
          description: 'Ensemble method'
        }
      },
      required: ['models']
    }
  },

  neural_analyze: {
    name: 'neural_analyze',
    description: 'Analyze neural network behavior and decisions',
    inputSchema: {
      type: 'object',
      properties: {
        model: {
          type: 'string',
          description: 'Model to analyze'
        },
        input: {
          type: 'object',
          description: 'Sample input for analysis'
        }
      }
    }
  },

  neural_compress: {
    name: 'neural_compress',
    description: 'Compress neural models for efficiency',
    inputSchema: {
      type: 'object',
      properties: {
        model: {
          type: 'string',
          description: 'Model to compress'
        },
        method: {
          type: 'string',
          enum: ['quantization', 'pruning', 'distillation'],
          description: 'Compression method'
        }
      },
      required: ['model']
    }
  },

  neural_finetune: {
    name: 'neural_finetune',
    description: 'Fine-tune neural models on specific data',
    inputSchema: {
      type: 'object',
      properties: {
        model: {
          type: 'string',
          description: 'Model to fine-tune'
        },
        data: {
          type: 'object',
          description: 'Fine-tuning data'
        },
        learningRate: {
          type: 'number',
          description: 'Learning rate'
        }
      },
      required: ['model', 'data']
    }
  },

  neural_explain: {
    name: 'neural_explain',
    description: 'Generate explanations for neural model decisions',
    inputSchema: {
      type: 'object',
      properties: {
        model: {
          type: 'string',
          description: 'Model to explain'
        },
        prediction: {
          type: 'object',
          description: 'Prediction to explain'
        }
      },
      required: ['model', 'prediction']
    }
  },

  neural_validate: {
    name: 'neural_validate',
    description: 'Validate neural model integrity and performance',
    inputSchema: {
      type: 'object',
      properties: {
        model: {
          type: 'string',
          description: 'Model to validate'
        },
        testSuite: {
          type: 'string',
          description: 'Validation test suite'
        }
      }
    }
  },

  neural_visualize: {
    name: 'neural_visualize',
    description: 'Visualize neural network architecture and activations',
    inputSchema: {
      type: 'object',
      properties: {
        model: {
          type: 'string',
          description: 'Model to visualize'
        },
        layer: {
          type: 'string',
          description: 'Specific layer to visualize'
        },
        format: {
          type: 'string',
          enum: ['graph', 'heatmap', 'activation'],
          description: 'Visualization format'
        }
      }
    }
  },

  // ===== MEMORY TOOLS (11) =====
  memory_usage: {
    name: 'memory_usage',
    description: 'Store, retrieve, or manage memory entries',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['store', 'retrieve', 'delete', 'list'],
          description: 'Memory action'
        },
        key: {
          type: 'string',
          description: 'Memory key'
        },
        value: {
          type: 'object',
          description: 'Value to store (for store action)'
        },
        pattern: {
          type: 'string',
          description: 'Pattern for list action'
        }
      },
      required: ['action']
    }
  },

  memory_search: {
    name: 'memory_search',
    description: 'Search memory with advanced queries',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query'
        },
        filters: {
          type: 'object',
          description: 'Search filters'
        },
        limit: {
          type: 'number',
          description: 'Maximum results'
        }
      },
      required: ['query']
    }
  },

  memory_persist: {
    name: 'memory_persist',
    description: 'Persist memory to permanent storage',
    inputSchema: {
      type: 'object',
      properties: {
        namespace: {
          type: 'string',
          description: 'Memory namespace to persist'
        },
        format: {
          type: 'string',
          enum: ['json', 'sqlite', 'binary'],
          description: 'Persistence format'
        }
      }
    }
  },

  memory_restore: {
    name: 'memory_restore',
    description: 'Restore memory from persistent storage',
    inputSchema: {
      type: 'object',
      properties: {
        source: {
          type: 'string',
          description: 'Restore source path'
        },
        namespace: {
          type: 'string',
          description: 'Target namespace'
        }
      },
      required: ['source']
    }
  },

  memory_analyze: {
    name: 'memory_analyze',
    description: 'Analyze memory patterns and usage',
    inputSchema: {
      type: 'object',
      properties: {
        timeRange: {
          type: 'object',
          properties: {
            start: { type: 'string' },
            end: { type: 'string' }
          },
          description: 'Time range for analysis'
        },
        metrics: {
          type: 'array',
          items: { type: 'string' },
          description: 'Specific metrics to analyze'
        }
      }
    }
  },

  memory_consolidate: {
    name: 'memory_consolidate',
    description: 'Consolidate and optimize memory storage',
    inputSchema: {
      type: 'object',
      properties: {
        strategy: {
          type: 'string',
          enum: ['merge', 'compress', 'deduplicate'],
          description: 'Consolidation strategy'
        },
        threshold: {
          type: 'number',
          description: 'Consolidation threshold'
        }
      }
    }
  },

  memory_export: {
    name: 'memory_export',
    description: 'Export memory to external format',
    inputSchema: {
      type: 'object',
      properties: {
        format: {
          type: 'string',
          enum: ['json', 'csv', 'markdown'],
          description: 'Export format'
        },
        filter: {
          type: 'object',
          description: 'Export filters'
        }
      }
    }
  },

  memory_import: {
    name: 'memory_import',
    description: 'Import memory from external sources',
    inputSchema: {
      type: 'object',
      properties: {
        source: {
          type: 'string',
          description: 'Import source'
        },
        format: {
          type: 'string',
          enum: ['json', 'csv', 'markdown'],
          description: 'Import format'
        },
        merge: {
          type: 'boolean',
          description: 'Merge with existing memory'
        }
      },
      required: ['source']
    }
  },

  memory_graph: {
    name: 'memory_graph',
    description: 'Build knowledge graph from memory',
    inputSchema: {
      type: 'object',
      properties: {
        depth: {
          type: 'number',
          description: 'Graph traversal depth'
        },
        startNode: {
          type: 'string',
          description: 'Starting node for graph'
        }
      }
    }
  },

  memory_prune: {
    name: 'memory_prune',
    description: 'Prune old or unused memory entries',
    inputSchema: {
      type: 'object',
      properties: {
        age: {
          type: 'number',
          description: 'Age threshold in days'
        },
        strategy: {
          type: 'string',
          enum: ['lru', 'lfu', 'age'],
          description: 'Pruning strategy'
        }
      }
    }
  },

  memory_sync: {
    name: 'memory_sync',
    description: 'Synchronize memory across swarm agents',
    inputSchema: {
      type: 'object',
      properties: {
        agents: {
          type: 'array',
          items: { type: 'string' },
          description: 'Agents to sync'
        },
        bidirectional: {
          type: 'boolean',
          description: 'Enable bidirectional sync'
        }
      }
    }
  },

  // ===== MONITORING TOOLS (5) =====
  agent_list: {
    name: 'agent_list',
    description: 'List all active agents in the swarm',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['active', 'idle', 'all'],
          description: 'Filter by agent status'
        },
        verbose: {
          type: 'boolean',
          description: 'Include detailed agent information'
        }
      }
    }
  },

  agent_metrics: {
    name: 'agent_metrics',
    description: 'Get performance metrics for specific agents',
    inputSchema: {
      type: 'object',
      properties: {
        agentId: {
          type: 'string',
          description: 'Agent ID (optional, all if not specified)'
        },
        timeRange: {
          type: 'string',
          enum: ['1h', '24h', '7d', '30d'],
          description: 'Time range for metrics'
        }
      }
    }
  },

  monitoring_dashboard: {
    name: 'monitoring_dashboard',
    description: 'Launch interactive monitoring dashboard',
    inputSchema: {
      type: 'object',
      properties: {
        port: {
          type: 'number',
          description: 'Dashboard port'
        },
        autoRefresh: {
          type: 'boolean',
          description: 'Enable auto-refresh'
        }
      }
    }
  },

  alert_configure: {
    name: 'alert_configure',
    description: 'Configure monitoring alerts',
    inputSchema: {
      type: 'object',
      properties: {
        metric: {
          type: 'string',
          description: 'Metric to monitor'
        },
        threshold: {
          type: 'number',
          description: 'Alert threshold'
        },
        action: {
          type: 'string',
          enum: ['log', 'notify', 'pause'],
          description: 'Alert action'
        }
      },
      required: ['metric', 'threshold']
    }
  },

  metrics_export: {
    name: 'metrics_export',
    description: 'Export monitoring metrics',
    inputSchema: {
      type: 'object',
      properties: {
        format: {
          type: 'string',
          enum: ['json', 'csv', 'prometheus'],
          description: 'Export format'
        },
        timeRange: {
          type: 'object',
          properties: {
            start: { type: 'string' },
            end: { type: 'string' }
          }
        }
      }
    }
  },

  // ===== PERFORMANCE TOOLS (10) =====
  performance_report: {
    name: 'performance_report',
    description: 'Generate comprehensive performance report',
    inputSchema: {
      type: 'object',
      properties: {
        detailed: {
          type: 'boolean',
          description: 'Include detailed metrics'
        },
        compareBaseline: {
          type: 'boolean',
          description: 'Compare against baseline'
        }
      }
    }
  },

  bottleneck_analyze: {
    name: 'bottleneck_analyze',
    description: 'Identify and analyze performance bottlenecks',
    inputSchema: {
      type: 'object',
      properties: {
        depth: {
          type: 'string',
          enum: ['surface', 'deep', 'comprehensive'],
          description: 'Analysis depth'
        },
        focus: {
          type: 'array',
          items: { type: 'string' },
          description: 'Specific areas to focus on'
        }
      }
    }
  },

  performance_optimize: {
    name: 'performance_optimize',
    description: 'Apply performance optimizations',
    inputSchema: {
      type: 'object',
      properties: {
        target: {
          type: 'string',
          enum: ['speed', 'memory', 'throughput', 'balanced'],
          description: 'Optimization target'
        },
        aggressive: {
          type: 'boolean',
          description: 'Use aggressive optimizations'
        }
      }
    }
  },

  benchmark_run: {
    name: 'benchmark_run',
    description: 'Run performance benchmarks',
    inputSchema: {
      type: 'object',
      properties: {
        suite: {
          type: 'string',
          description: 'Benchmark suite to run'
        },
        iterations: {
          type: 'number',
          description: 'Number of iterations'
        }
      }
    }
  },

  profile_execution: {
    name: 'profile_execution',
    description: 'Profile code execution',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'Task to profile'
        },
        level: {
          type: 'string',
          enum: ['basic', 'detailed', 'comprehensive'],
          description: 'Profiling level'
        }
      }
    }
  },

  cache_analyze: {
    name: 'cache_analyze',
    description: 'Analyze cache performance and usage',
    inputSchema: {
      type: 'object',
      properties: {
        cacheType: {
          type: 'string',
          enum: ['memory', 'disk', 'distributed'],
          description: 'Cache type to analyze'
        }
      }
    }
  },

  resource_monitor: {
    name: 'resource_monitor',
    description: 'Monitor system resource usage',
    inputSchema: {
      type: 'object',
      properties: {
        resources: {
          type: 'array',
          items: { type: 'string' },
          description: 'Resources to monitor (cpu, memory, disk, network)'
        },
        interval: {
          type: 'number',
          description: 'Monitoring interval in seconds'
        }
      }
    }
  },

  load_test: {
    name: 'load_test',
    description: 'Run load testing scenarios',
    inputSchema: {
      type: 'object',
      properties: {
        scenario: {
          type: 'string',
          description: 'Load test scenario'
        },
        users: {
          type: 'number',
          description: 'Number of concurrent users'
        },
        duration: {
          type: 'number',
          description: 'Test duration in seconds'
        }
      },
      required: ['scenario']
    }
  },

  performance_baseline: {
    name: 'performance_baseline',
    description: 'Establish performance baseline',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Baseline name'
        },
        metrics: {
          type: 'array',
          items: { type: 'string' },
          description: 'Metrics to include in baseline'
        }
      }
    }
  },

  latency_trace: {
    name: 'latency_trace',
    description: 'Trace latency through the system',
    inputSchema: {
      type: 'object',
      properties: {
        operation: {
          type: 'string',
          description: 'Operation to trace'
        },
        detailed: {
          type: 'boolean',
          description: 'Include detailed trace'
        }
      }
    }
  },

  // ===== WORKFLOW TOOLS (9) =====
  workflow_create: {
    name: 'workflow_create',
    description: 'Create a new workflow definition',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Workflow name'
        },
        steps: {
          type: 'array',
          items: { type: 'object' },
          description: 'Workflow steps'
        },
        triggers: {
          type: 'array',
          items: { type: 'string' },
          description: 'Workflow triggers'
        }
      },
      required: ['name', 'steps']
    }
  },

  workflow_execute: {
    name: 'workflow_execute',
    description: 'Execute a saved workflow',
    inputSchema: {
      type: 'object',
      properties: {
        workflowId: {
          type: 'string',
          description: 'Workflow ID to execute'
        },
        parameters: {
          type: 'object',
          description: 'Workflow parameters'
        },
        async: {
          type: 'boolean',
          description: 'Execute asynchronously'
        }
      },
      required: ['workflowId']
    }
  },

  workflow_list: {
    name: 'workflow_list',
    description: 'List available workflows',
    inputSchema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          description: 'Filter by category'
        },
        includeSystem: {
          type: 'boolean',
          description: 'Include system workflows'
        }
      }
    }
  },

  workflow_status: {
    name: 'workflow_status',
    description: 'Get workflow execution status',
    inputSchema: {
      type: 'object',
      properties: {
        executionId: {
          type: 'string',
          description: 'Execution ID to check'
        }
      }
    }
  },

  workflow_pause: {
    name: 'workflow_pause',
    description: 'Pause a running workflow',
    inputSchema: {
      type: 'object',
      properties: {
        executionId: {
          type: 'string',
          description: 'Execution ID to pause'
        }
      },
      required: ['executionId']
    }
  },

  workflow_resume: {
    name: 'workflow_resume',
    description: 'Resume a paused workflow',
    inputSchema: {
      type: 'object',
      properties: {
        executionId: {
          type: 'string',
          description: 'Execution ID to resume'
        }
      },
      required: ['executionId']
    }
  },

  workflow_cancel: {
    name: 'workflow_cancel',
    description: 'Cancel a running workflow',
    inputSchema: {
      type: 'object',
      properties: {
        executionId: {
          type: 'string',
          description: 'Execution ID to cancel'
        }
      },
      required: ['executionId']
    }
  },

  workflow_schedule: {
    name: 'workflow_schedule',
    description: 'Schedule workflow execution',
    inputSchema: {
      type: 'object',
      properties: {
        workflowId: {
          type: 'string',
          description: 'Workflow to schedule'
        },
        schedule: {
          type: 'string',
          description: 'Cron expression or time specification'
        }
      },
      required: ['workflowId', 'schedule']
    }
  },

  workflow_export: {
    name: 'workflow_export',
    description: 'Export workflow definition',
    inputSchema: {
      type: 'object',
      properties: {
        workflowId: {
          type: 'string',
          description: 'Workflow to export'
        },
        format: {
          type: 'string',
          enum: ['json', 'yaml', 'graphviz'],
          description: 'Export format'
        }
      },
      required: ['workflowId']
    }
  },

  // ===== GITHUB TOOLS (7) =====
  github_repo_analyze: {
    name: 'github_repo_analyze',
    description: 'Analyze GitHub repository with AI insights',
    inputSchema: {
      type: 'object',
      properties: {
        repository: {
          type: 'string',
          description: 'Repository in format owner/repo'
        },
        deep: {
          type: 'boolean',
          description: 'Perform deep analysis'
        },
        include: {
          type: 'array',
          items: { type: 'string' },
          description: 'Specific areas to analyze'
        }
      },
      required: ['repository']
    }
  },

  github_pr_manage: {
    name: 'github_pr_manage',
    description: 'Manage pull requests with AI assistance',
    inputSchema: {
      type: 'object',
      properties: {
        repository: {
          type: 'string',
          description: 'Repository in format owner/repo'
        },
        action: {
          type: 'string',
          enum: ['review', 'enhance', 'merge', 'close'],
          description: 'PR action'
        },
        prNumber: {
          type: 'number',
          description: 'Pull request number'
        }
      },
      required: ['repository', 'action']
    }
  },

  github_issue_process: {
    name: 'github_issue_process',
    description: 'Process GitHub issues with AI',
    inputSchema: {
      type: 'object',
      properties: {
        repository: {
          type: 'string',
          description: 'Repository in format owner/repo'
        },
        action: {
          type: 'string',
          enum: ['triage', 'analyze', 'respond', 'close'],
          description: 'Issue action'
        },
        issueNumber: {
          type: 'number',
          description: 'Issue number'
        }
      },
      required: ['repository', 'action']
    }
  },

  github_code_review: {
    name: 'github_code_review',
    description: 'AI-powered code review',
    inputSchema: {
      type: 'object',
      properties: {
        repository: {
          type: 'string',
          description: 'Repository in format owner/repo'
        },
        target: {
          type: 'string',
          description: 'Branch, PR, or commit to review'
        },
        depth: {
          type: 'string',
          enum: ['quick', 'standard', 'comprehensive'],
          description: 'Review depth'
        }
      },
      required: ['repository', 'target']
    }
  },

  github_workflow_generate: {
    name: 'github_workflow_generate',
    description: 'Generate GitHub Actions workflows',
    inputSchema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['ci', 'cd', 'test', 'security', 'custom'],
          description: 'Workflow type'
        },
        language: {
          type: 'string',
          description: 'Project language'
        },
        features: {
          type: 'array',
          items: { type: 'string' },
          description: 'Workflow features'
        }
      },
      required: ['type']
    }
  },

  github_release_manage: {
    name: 'github_release_manage',
    description: 'Manage GitHub releases',
    inputSchema: {
      type: 'object',
      properties: {
        repository: {
          type: 'string',
          description: 'Repository in format owner/repo'
        },
        action: {
          type: 'string',
          enum: ['create', 'update', 'publish', 'draft'],
          description: 'Release action'
        },
        version: {
          type: 'string',
          description: 'Release version'
        }
      },
      required: ['repository', 'action']
    }
  },

  github_swarm: {
    name: 'github_swarm',
    description: 'Create specialized GitHub management swarm',
    inputSchema: {
      type: 'object',
      properties: {
        repository: {
          type: 'string',
          description: 'Repository in format owner/repo'
        },
        agents: {
          type: 'number',
          description: 'Number of specialized agents'
        },
        focus: {
          type: 'string',
          enum: ['maintenance', 'development', 'security', 'documentation'],
          description: 'Swarm focus area'
        }
      },
      required: ['repository']
    }
  },

  // ===== DAA TOOLS (7) =====
  daa_agent_create: {
    name: 'daa_agent_create',
    description: 'Create a dynamic autonomous agent',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Agent name'
        },
        capabilities: {
          type: 'array',
          items: { type: 'string' },
          description: 'Agent capabilities'
        },
        autonomyLevel: {
          type: 'string',
          enum: ['low', 'medium', 'high', 'full'],
          description: 'Autonomy level'
        }
      },
      required: ['name', 'capabilities']
    }
  },

  daa_capability_add: {
    name: 'daa_capability_add',
    description: 'Add capability to an agent',
    inputSchema: {
      type: 'object',
      properties: {
        agentId: {
          type: 'string',
          description: 'Agent ID'
        },
        capability: {
          type: 'string',
          description: 'Capability to add'
        },
        training: {
          type: 'object',
          description: 'Optional training data'
        }
      },
      required: ['agentId', 'capability']
    }
  },

  daa_capability_match: {
    name: 'daa_capability_match',
    description: 'Match agents to task requirements',
    inputSchema: {
      type: 'object',
      properties: {
        requirements: {
          type: 'array',
          items: { type: 'string' },
          description: 'Required capabilities'
        },
        strategy: {
          type: 'string',
          enum: ['best', 'balanced', 'specialized'],
          description: 'Matching strategy'
        }
      },
      required: ['requirements']
    }
  },

  daa_evolution_trigger: {
    name: 'daa_evolution_trigger',
    description: 'Trigger agent evolution based on performance',
    inputSchema: {
      type: 'object',
      properties: {
        agentId: {
          type: 'string',
          description: 'Agent to evolve'
        },
        metrics: {
          type: 'object',
          description: 'Performance metrics'
        }
      }
    }
  },

  daa_swarm_adapt: {
    name: 'daa_swarm_adapt',
    description: 'Adapt swarm configuration dynamically',
    inputSchema: {
      type: 'object',
      properties: {
        trigger: {
          type: 'string',
          enum: ['performance', 'workload', 'failure', 'manual'],
          description: 'Adaptation trigger'
        },
        constraints: {
          type: 'object',
          description: 'Adaptation constraints'
        }
      }
    }
  },

  daa_knowledge_transfer: {
    name: 'daa_knowledge_transfer',
    description: 'Transfer knowledge between agents',
    inputSchema: {
      type: 'object',
      properties: {
        sourceAgent: {
          type: 'string',
          description: 'Source agent ID'
        },
        targetAgent: {
          type: 'string',
          description: 'Target agent ID'
        },
        knowledge: {
          type: 'array',
          items: { type: 'string' },
          description: 'Knowledge categories to transfer'
        }
      },
      required: ['sourceAgent', 'targetAgent']
    }
  },

  daa_performance_evolve: {
    name: 'daa_performance_evolve',
    description: 'Evolve agent based on performance data',
    inputSchema: {
      type: 'object',
      properties: {
        agentId: {
          type: 'string',
          description: 'Agent to evolve'
        },
        generations: {
          type: 'number',
          description: 'Number of evolution generations'
        }
      },
      required: ['agentId']
    }
  },

  // ===== SYSTEM TOOLS (12) =====
  terminal_execute: {
    name: 'terminal_execute',
    description: 'Execute terminal commands',
    inputSchema: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'Command to execute'
        },
        workingDirectory: {
          type: 'string',
          description: 'Working directory'
        },
        timeout: {
          type: 'number',
          description: 'Command timeout in seconds'
        }
      },
      required: ['command']
    }
  },

  config_manage: {
    name: 'config_manage',
    description: 'Manage Claude Flow configuration',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['get', 'set', 'reset', 'export'],
          description: 'Configuration action'
        },
        key: {
          type: 'string',
          description: 'Configuration key'
        },
        value: {
          type: 'string',
          description: 'Configuration value (for set)'
        }
      },
      required: ['action']
    }
  },

  system_health: {
    name: 'system_health',
    description: 'Check system health status',
    inputSchema: {
      type: 'object',
      properties: {
        components: {
          type: 'array',
          items: { type: 'string' },
          description: 'Specific components to check'
        },
        verbose: {
          type: 'boolean',
          description: 'Include detailed health info'
        }
      }
    }
  },

  log_analyze: {
    name: 'log_analyze',
    description: 'Analyze system logs',
    inputSchema: {
      type: 'object',
      properties: {
        timeRange: {
          type: 'string',
          enum: ['1h', '24h', '7d', '30d'],
          description: 'Time range to analyze'
        },
        severity: {
          type: 'string',
          enum: ['debug', 'info', 'warning', 'error', 'critical'],
          description: 'Minimum severity level'
        },
        pattern: {
          type: 'string',
          description: 'Pattern to search for'
        }
      }
    }
  },

  backup_create: {
    name: 'backup_create',
    description: 'Create system backup',
    inputSchema: {
      type: 'object',
      properties: {
        components: {
          type: 'array',
          items: { type: 'string' },
          description: 'Components to backup'
        },
        destination: {
          type: 'string',
          description: 'Backup destination'
        }
      }
    }
  },

  backup_restore: {
    name: 'backup_restore',
    description: 'Restore from backup',
    inputSchema: {
      type: 'object',
      properties: {
        backupId: {
          type: 'string',
          description: 'Backup ID to restore'
        },
        components: {
          type: 'array',
          items: { type: 'string' },
          description: 'Specific components to restore'
        }
      },
      required: ['backupId']
    }
  },

  features_detect: {
    name: 'features_detect',
    description: 'Detect available system features',
    inputSchema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          description: 'Feature category to check'
        }
      }
    }
  },

  plugin_manage: {
    name: 'plugin_manage',
    description: 'Manage Claude Flow plugins',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['install', 'remove', 'list', 'update'],
          description: 'Plugin action'
        },
        plugin: {
          type: 'string',
          description: 'Plugin name or ID'
        }
      },
      required: ['action']
    }
  },

  telemetry_control: {
    name: 'telemetry_control',
    description: 'Control telemetry settings',
    inputSchema: {
      type: 'object',
      properties: {
        enabled: {
          type: 'boolean',
          description: 'Enable/disable telemetry'
        },
        level: {
          type: 'string',
          enum: ['minimal', 'standard', 'detailed'],
          description: 'Telemetry level'
        }
      }
    }
  },

  update_check: {
    name: 'update_check',
    description: 'Check for Claude Flow updates',
    inputSchema: {
      type: 'object',
      properties: {
        channel: {
          type: 'string',
          enum: ['stable', 'beta', 'alpha'],
          description: 'Update channel'
        },
        autoUpdate: {
          type: 'boolean',
          description: 'Enable auto-update'
        }
      }
    }
  },

  diagnostic_run: {
    name: 'diagnostic_run',
    description: 'Run system diagnostics',
    inputSchema: {
      type: 'object',
      properties: {
        level: {
          type: 'string',
          enum: ['quick', 'standard', 'comprehensive'],
          description: 'Diagnostic level'
        },
        areas: {
          type: 'array',
          items: { type: 'string' },
          description: 'Specific areas to diagnose'
        }
      }
    }
  },

  environment_info: {
    name: 'environment_info',
    description: 'Get environment information',
    inputSchema: {
      type: 'object',
      properties: {
        includeSecrets: {
          type: 'boolean',
          description: 'Include sensitive information'
        }
      }
    }
  }
};

// Export tool categories for easy access
export const TOOL_CATEGORIES = {
  coordination: [
    'swarm_init', 'agent_spawn', 'task_orchestrate', 'task_status',
    'task_results', 'swarm_status', 'swarm_monitor', 'coordination_optimize',
    'swarm_broadcast'
  ],
  neural: [
    'neural_status', 'neural_train', 'neural_patterns', 'neural_predict',
    'neural_optimize', 'neural_export', 'neural_import', 'neural_benchmark',
    'neural_ensemble', 'neural_analyze', 'neural_compress', 'neural_finetune',
    'neural_explain', 'neural_validate', 'neural_visualize'
  ],
  memory: [
    'memory_usage', 'memory_search', 'memory_persist', 'memory_restore',
    'memory_analyze', 'memory_consolidate', 'memory_export', 'memory_import',
    'memory_graph', 'memory_prune', 'memory_sync'
  ],
  monitoring: [
    'agent_list', 'agent_metrics', 'monitoring_dashboard', 'alert_configure',
    'metrics_export'
  ],
  performance: [
    'performance_report', 'bottleneck_analyze', 'performance_optimize',
    'benchmark_run', 'profile_execution', 'cache_analyze', 'resource_monitor',
    'load_test', 'performance_baseline', 'latency_trace'
  ],
  workflow: [
    'workflow_create', 'workflow_execute', 'workflow_list', 'workflow_status',
    'workflow_pause', 'workflow_resume', 'workflow_cancel', 'workflow_schedule',
    'workflow_export'
  ],
  github: [
    'github_repo_analyze', 'github_pr_manage', 'github_issue_process',
    'github_code_review', 'github_workflow_generate', 'github_release_manage',
    'github_swarm'
  ],
  daa: [
    'daa_agent_create', 'daa_capability_add', 'daa_capability_match',
    'daa_evolution_trigger', 'daa_swarm_adapt', 'daa_knowledge_transfer',
    'daa_performance_evolve'
  ],
  system: [
    'terminal_execute', 'config_manage', 'system_health', 'log_analyze',
    'backup_create', 'backup_restore', 'features_detect', 'plugin_manage',
    'telemetry_control', 'update_check', 'diagnostic_run', 'environment_info'
  ]
};

// Helper function to get all tools
export function getAllTools(): ToolDefinition[] {
  return Object.values(CLAUDE_FLOW_TOOLS);
}

// Helper function to get tools by category
export function getToolsByCategory(category: keyof typeof TOOL_CATEGORIES): ToolDefinition[] {
  const toolNames = TOOL_CATEGORIES[category];
  return toolNames.map(name => CLAUDE_FLOW_TOOLS[name]).filter(Boolean);
}

// Helper function to validate tool input
export function validateToolInput(toolName: string, input: any): { valid: boolean; errors?: string[] } {
  const tool = CLAUDE_FLOW_TOOLS[toolName];
  if (!tool) {
    return { valid: false, errors: ['Tool not found'] };
  }

  const errors: string[] = [];
  const schema = tool.inputSchema;

  // Check required fields
  if (schema.required) {
    for (const field of schema.required) {
      if (!(field in input)) {
        errors.push(`Missing required field: ${field}`);
      }
    }
  }

  // Basic type validation
  for (const [key, value] of Object.entries(input)) {
    const propSchema = schema.properties[key];
    if (!propSchema) {
      errors.push(`Unknown field: ${key}`);
      continue;
    }

    // Type checking
    if (propSchema.type === 'string' && typeof value !== 'string') {
      errors.push(`Field ${key} must be a string`);
    } else if (propSchema.type === 'number' && typeof value !== 'number') {
      errors.push(`Field ${key} must be a number`);
    } else if (propSchema.type === 'boolean' && typeof value !== 'boolean') {
      errors.push(`Field ${key} must be a boolean`);
    } else if (propSchema.type === 'array' && !Array.isArray(value)) {
      errors.push(`Field ${key} must be an array`);
    } else if (propSchema.type === 'object' && typeof value !== 'object') {
      errors.push(`Field ${key} must be an object`);
    }

    // Enum validation
    if (propSchema.enum && !propSchema.enum.includes(value)) {
      errors.push(`Field ${key} must be one of: ${propSchema.enum.join(', ')}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined
  };
}

// Export total tool count
export const TOTAL_TOOLS = Object.keys(CLAUDE_FLOW_TOOLS).length;