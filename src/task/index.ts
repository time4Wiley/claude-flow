/**
 * Task Management System - Main Export
 * Comprehensive task management with orchestration features
 * Integrates with TodoWrite/TodoRead for coordination and Memory for persistence
 */
export {
  TaskEngine,
  type WorkflowTask,
  type TaskDependency,
  type ResourceRequirement,
  type TaskSchedule,
  type TaskExecution,
  type TaskMetrics,
  type TaskLog,
  type Workflow,
  type TaskFilter,
  type TaskSort,
  type TaskCheckpoint
} from './engine.js';
export {
  createTaskCreateCommand,
  createTaskListCommand,
  createTaskStatusCommand,
  createTaskCancelCommand,
  createTaskWorkflowCommand
} from './commands.js';
export {
  type TaskCommandContext,
  type TodoItem,
  type MemoryEntry,
  type CoordinationContext,
  type TaskMetadata
} from './types.js';
export {
  TaskCoordinator
} from './coordination.js';
/**
 * Initialize the complete task management system
 */
export async function initializeTaskManagement(
  config: {
    maxConcurrentTasks?: number;
    memoryManager?: unknown;
    logger?: unknown;
  } = { /* empty */ }
): Promise<{
  taskEngine: unknown;
  taskCoordinator: unknown;
  commands: {
    create: unknown;
    list: unknown;
    status: unknown;
    cancel: unknown;
    workflow: unknown;
  };
}> {
  // Import required classes dynamically to avoid circular dependencies
  const { TaskEngine } = await import('./engine.js');
  const { TaskCoordinator } = await import('./coordination.js');
  const { createTaskCreateCommand, createTaskListCommand, createTaskStatusCommand, createTaskCancelCommand, createTaskWorkflowCommand } = await import('./commands.js');
  
  const _taskEngine = new TaskEngine(
    config.maxConcurrentTasks || _10,
    config.memoryManager
  );
  const _taskCoordinator = new TaskCoordinator(
    _taskEngine,
    config.memoryManager
  );
  const _commandContext = {
    taskEngine,
    taskCoordinator,
    memoryManager: config.memoryManager,
    logger: config.logger
  };
  const _commands = {
    create: createTaskCreateCommand(commandContext),
    list: createTaskListCommand(commandContext),
    status: createTaskStatusCommand(commandContext),
    cancel: createTaskCancelCommand(commandContext),
    workflow: createTaskWorkflowCommand(commandContext)
  };
  return {
    taskEngine,
    taskCoordinator,
    commands
  };
}
/**
 * Helper function to create TodoWrite-style task breakdown
 */
export async function createTaskTodos(
  objective: _string,
  options: {
    strategy?: 'research' | 'development' | 'analysis' | 'testing' | 'optimization' | 'maintenance';
    maxTasks?: number;
    batchOptimized?: boolean;
    parallelExecution?: boolean;
    memoryCoordination?: boolean;
  } = { /* empty */ },
  coordinator?: unknown
): Promise<unknown[]> {
  if (!coordinator) {
    throw new Error('TaskCoordinator instance required for todo creation');
  }
  const _context = {
    sessionId: `session-${Date.now()}`,
    coordinationMode: options.batchOptimized ? 'distributed' : 'centralized'
  };
  return await coordinator.createTaskTodos(_objective, _context, options);
}
/**
 * Helper function to launch parallel agents (Task tool pattern)
 */
export async function launchParallelAgents(
  tasks: Array<{
    agentType: string;
    objective: string;
    mode?: string;
    configuration?: Record<_string, unknown>;
    memoryKey?: string;
    batchOptimized?: boolean;
  }>,
  coordinator?: unknown
): Promise<string[]> {
  if (!coordinator) {
    throw new Error('TaskCoordinator instance required for agent launching');
  }
  const _context = {
    sessionId: `session-${Date.now()}`,
    coordinationMode: 'distributed'
  };
  return await coordinator.launchParallelAgents(_tasks, context);
}
/**
 * Helper function to store coordination data in Memory
 */
export async function storeCoordinationData(
  key: _string,
  value: _any,
  options: {
    namespace?: string;
    tags?: string[];
    expiresAt?: Date;
  } = { /* empty */ },
  coordinator?: unknown
): Promise<void> {
  if (!coordinator) {
    throw new Error('TaskCoordinator instance required for memory storage');
  }
  await coordinator.storeInMemory(_key, _value, options);
}
/**
 * Helper function to retrieve coordination data from Memory
 */
export async function retrieveCoordinationData(
  key: _string,
  namespace?: _string,
  coordinator?: unknown
): Promise<any | null> {
  if (!coordinator) {
    throw new Error('TaskCoordinator instance required for memory retrieval');
  }
  return await coordinator.retrieveFromMemory(_key, namespace);
}
/**
 * Examples and usage patterns for Claude Code integration
 */
export const _USAGE_EXAMPLES = {
  todoWrite: `
// Example: Using TodoWrite for task coordination
import { createTaskTodos } from './task.js';
const _todos = await createTaskTodos(
  "Build e-commerce platform",
  {
    strategy: 'development',
    batchOptimized: _true,
    parallelExecution: _true,
    memoryCoordination: true
  },
  coordinator
);
// This creates a structured todo list with:
// - System architecture design (high priority)
// - Frontend development (parallel execution)
// - Backend development (parallel execution) 
// - Testing and integration (depends on frontend/backend)
`,
  taskTool: `
// Example: Using Task tool pattern for parallel agents
import { launchParallelAgents } from './task.js';
const _agentIds = await launchParallelAgents([
  {
    agentType: 'researcher',
    objective: 'Research best practices for microservices',
    mode: 'researcher',
    memoryKey: 'microservices_research',
    batchOptimized: true
  },
  {
    agentType: 'architect',
    objective: 'Design system architecture based on research',
    mode: 'architect',
    memoryKey: 'system_architecture',
    batchOptimized: true
  },
  {
    agentType: 'coder',
    objective: 'Implement core services',
    mode: 'coder',
    memoryKey: 'core_implementation',
    batchOptimized: true
  }
], coordinator);
`,
  memoryCoordination: `
// Example: Using Memory for cross-agent coordination
import { storeCoordinationData, retrieveCoordinationData } from './task.js';
// Store research findings for other agents
await storeCoordinationData(
  'research_findings',
  {
    bestPractices: [...],
    technologies: [...],
    patterns: [...]
  },
  {
    namespace: 'project_coordination',
    tags: ['research', 'architecture']
  },
  coordinator
);
// Retrieve findings in another agent
const _findings = await retrieveCoordinationData(
  'research_findings',
  'project_coordination',
  coordinator
);
`,
  batchOperations: `
// Example: Coordinated batch operations
import { TaskCoordinator } from './task.js';
const _results = await coordinator.coordinateBatchOperations([
  {
    type: 'read',
    targets: ['src/**/*.ts'],
    configuration: { pattern: 'class.*{' }
  },
  {
    type: 'analyze',
    targets: ['package.json', 'tsconfig.json'],
    configuration: { focus: 'dependencies' }
  },
  {
    type: 'search',
    targets: ['docs/**/*.md'],
    configuration: { term: 'API documentation' }
  }
], context);
`,
  swarmCoordination: `
// Example: Swarm coordination patterns
await coordinator.coordinateSwarm(
  "Comprehensive system development",
  {
    sessionId: 'dev-session-1',
    coordinationMode: 'hierarchical'
  },
  [
    { type: 'lead-architect', role: 'team-lead', capabilities: ['design', 'coordination'] },
    { type: 'frontend-dev-1', role: 'coder', capabilities: ['react', 'ui'] },
    { type: 'frontend-dev-2', role: 'coder', capabilities: ['react', 'testing'] },
    { type: 'backend-dev-1', role: 'coder', capabilities: ['nodejs', 'api'] },
    { type: 'backend-dev-2', role: 'coder', capabilities: ['database', 'scaling'] },
    { type: 'devops-engineer', role: 'specialist', capabilities: ['deployment', 'monitoring'] }
  ]
);
`
};
/**
 * Command line usage examples
 */
export const _CLI_EXAMPLES = {
  taskCreate: `
# Create a complex task with dependencies and scheduling
claude-flow task create development "Implement user authentication system" \
  --priority 80 \
  --dependencies "task-123,task-456" \
  --dep-type finish-to-start \
  --assign backend-team \
  --tags "auth,security,backend" \
  --deadline "2024-02-15T18:00:00Z" \
  --cpu 2 \
  --memory 1024 \
  --max-retries 5 \
  --rollback previous-checkpoint
`,
  taskList: `
# List tasks with advanced filtering and visualization
claude-flow task list \
  --status running,pending \
  --priority 70-100 \
  --tags auth,security \
  --sort deadline \
  --sort-dir asc \
  --format table \
  --show-dependencies \
  --show-progress \
  --limit 20
`,
  taskStatus: `
# Get detailed task status with all metrics
claude-flow task status task-789 \
  --show-logs \
  --show-checkpoints \
  --show-metrics \
  --show-dependencies \
  --show-resources \
  --watch
`,
  taskCancel: `
# Cancel task with safe rollback and cascade
claude-flow task cancel task-789 \
  --reason "Requirements changed" \
  --cascade \
  --dry-run
`,
  taskWorkflow: `
# Create and execute workflows
claude-flow task workflow create "E-commerce Platform" \
  --description "Complete e-commerce development workflow" \
  --max-concurrent 8 \
  --strategy priority-based \
  --error-handling continue-on-error
claude-flow task workflow execute workflow-123 \
  --variables '{"environment":"staging","version":"2.1.0"}' \
  --monitor
claude-flow task workflow visualize workflow-123 \
  --format dot \
  --output workflow-graph.dot
`
};
export default {
  initializeTaskManagement,
  createTaskTodos,
  launchParallelAgents,
  storeCoordinationData,
  retrieveCoordinationData,
  USAGE_EXAMPLES,
  CLI_EXAMPLES
};