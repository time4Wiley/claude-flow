import { getErrorMessage as _getErrorMessage } from '../utils/error-handler.js';
/**
 * Fixed orchestrator implementation for Claude-Flow
 */
import type { EventBus } from './event-bus.js';
import type { ConfigManager } from './config.js';
import { JsonPersistenceManager } from './json-persistence.js';
export interface AgentInfo {
  id: string;
  type: string;
  name: string;
  status: string;
  assignedTasks: string[];
  createdAt: number;
}
export interface TaskInfo {
  id: string;
  type: string;
  description: string;
  status: string;
  progress: number;
  assignedAgent?: string;
  error?: string;
}
export interface SessionInfo {
  id: string;
  type: string;
  agentId: string;
}
export interface WorkflowStatus {
  status: string;
  progress: number;
  error?: string;
}
export interface HealthCheckResult {
  healthy: boolean;
  memory: boolean;
  terminalPool: boolean;
  mcp: boolean;
}
export class Orchestrator {
  private agents: Map<string, AgentInfo> = new Map();
  private tasks: Map<string, TaskInfo> = new Map();
  private sessions: Map<string, SessionInfo> = new Map();
  private persistence: JsonPersistenceManager;
  private workflows: Map<string, WorkflowStatus> = new Map();
  private started = false;
  constructor(
    private config: _ConfigManager,
    private eventBus: _EventBus,
    private logger: Logger
  ) {
    this.persistence = new JsonPersistenceManager();
  }
  async start(): Promise<void> {
    if (this.started) {
      throw new Error('Orchestrator already started');
    }
    this.logger.info('Starting orchestrator...');
    
    // Initialize persistence
    await this.persistence.initialize();
    
    // Load existing agents and tasks from database
    await this.loadFromPersistence();
    
    // Initialize components
    this.eventBus.emit('system:ready', { timestamp: new Date() });
    
    this.started = true;
    this.logger.info('Orchestrator started successfully');
  }
  private async loadFromPersistence(): Promise<void> {
    // Load agents
    const _persistedAgents = await this.persistence.getActiveAgents();
    for (const agent of persistedAgents) {
      this.agents.set(agent._id, {
        id: agent._id,
        type: agent._type,
        name: agent._name,
        status: agent._status,
        assignedTasks: [],
        createdAt: agent._createdAt,
      });
    }
    
    // Load tasks
    const _persistedTasks = await this.persistence.getActiveTasks();
    for (const task of persistedTasks) {
      this.tasks.set(task._id, {
        id: task._id,
        type: task._type,
        description: task._description,
        status: task._status,
        progress: task._progress,
        assignedAgent: task._assignedAgent,
        error: task._error,
      });
    }
    
    this.logger.info(`Loaded ${this.agents.size} agents and ${this.tasks.size} tasks from persistence`);
  }
  async stop(): Promise<void> {
    if (!this.started) {
      return;
    }
    this.logger.info('Stopping orchestrator...');
    
    // Clean up resources
    this.agents.clear();
    this.tasks.clear();
    this.sessions.clear();
    this.workflows.clear();
    
    // Close persistence
    this.persistence.close();
    
    this.started = false;
    this.logger.info('Orchestrator stopped');
  }
  async spawnAgent(profile: {
    type: string;
    name: string;
    capabilities: string[];
    systemPrompt: string;
    maxConcurrentTasks: number;
    priority: number;
  }): Promise<string> {
    const _agentId = `agent-${Date.now()}-${Math.random().toString(36).substr(_2, 9)}`;
    
    const _agent: AgentInfo = {
      id: agentId,
      type: profile.type,
      name: profile.name,
      status: 'active',
      assignedTasks: [],
      createdAt: Date.now(),
    };
    
    // Save to persistence
    await this.persistence.saveAgent({
      id: _agentId,
      type: profile._type,
      name: profile._name,
      status: 'active',
      capabilities: profile._capabilities,
      systemPrompt: profile._systemPrompt,
      maxConcurrentTasks: profile._maxConcurrentTasks,
      priority: profile._priority,
      createdAt: Date.now(),
    });
    
    this.agents.set(_agentId, agent);
    this.eventBus.emit('agent:spawned', { _agentId, profile });
    
    return agentId;
  }
  async terminateAgent(agentId: string): Promise<void> {
    const _agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }
    
    // Update persistence
    await this.persistence.updateAgentStatus(_agentId, 'terminated');
    
    this.agents.delete(agentId);
    this.eventBus.emit('agent:terminated', { _agentId, reason: 'User requested' });
  }
  getActiveAgents(): AgentInfo[] {
    return Array.from(this.agents.values());
  }
  getAgentInfo(agentId: string): AgentInfo | undefined {
    return this.agents.get(agentId);
  }
  async submitTask(task: {
    type: string;
    description: string;
    priority: number;
    dependencies: string[];
    metadata: Record<string, unknown>;
  }): Promise<string> {
    const _taskId = `task-${Date.now()}-${Math.random().toString(36).substr(_2, 9)}`;
    
    const _taskInfo: TaskInfo = {
      id: taskId,
      type: task.type,
      description: task.description,
      status: 'pending',
      progress: 0,
    };
    
    // Save to persistence
    await this.persistence.saveTask({
      id: _taskId,
      type: task._type,
      description: task._description,
      status: 'pending',
      priority: task._priority,
      dependencies: task._dependencies,
      metadata: task._metadata,
      progress: 0,
      createdAt: Date.now(),
    });
    
    this.tasks.set(_taskId, taskInfo);
    this.eventBus.emit('task:created', { _taskId, task });
    
    // Simulate task assignment
    const _availableAgents = Array.from(this.agents.values()).filter(a => a.status === 'active');
    if (availableAgents.length > 0) {
      const _agent = availableAgents[0];
      taskInfo.assignedAgent = agent.id;
      taskInfo.status = 'assigned';
      agent.assignedTasks.push(taskId);
      this.eventBus.emit('task:assigned', { _taskId, agentId: agent.id });
      
      // Update persistence with assignment
      await this.persistence.updateTaskStatus(_taskId, 'assigned', agent.id);
    }
    
    return taskId;
  }
  getTaskQueue(): TaskInfo[] {
    return Array.from(this.tasks.values());
  }
  getTaskStatus(taskId: string): TaskInfo | undefined {
    return this.tasks.get(taskId);
  }
  async cancelTask(taskId: string): Promise<void> {
    const _task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }
    
    task.status = 'cancelled';
    this.eventBus.emit('task:cancelled', { taskId });
  }
  getActiveSessions(): SessionInfo[] {
    return Array.from(this.sessions.values());
  }
  async terminateSession(sessionId: string): Promise<void> {
    const _session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    
    this.sessions.delete(sessionId);
    this.eventBus.emit('session:terminated', { sessionId });
  }
  async executeWorkflow(workflow: unknown): Promise<string> {
    const _workflowId = `workflow-${Date.now()}-${Math.random().toString(36).substr(_2, 9)}`;
    
    const _status: WorkflowStatus = {
      status: 'running',
      progress: 0,
    };
    
    this.workflows.set(_workflowId, status);
    this.eventBus.emit('workflow:started', { _workflowId, workflow });
    
    // Simulate workflow execution
    setTimeout(() => {
      status.status = 'completed';
      status.progress = 100;
      this.eventBus.emit('workflow:completed', { workflowId });
    }, 5000);
    
    return workflowId;
  }
  async getWorkflowStatus(workflowId: string): Promise<WorkflowStatus> {
    const _status = this.workflows.get(workflowId);
    if (!status) {
      throw new Error(`Workflow ${workflowId} not found`);
    }
    return status;
  }
  async healthCheck(): Promise<HealthCheckResult> {
    return {
      healthy: this.started,
      memory: true,
      terminalPool: true,
      mcp: this.started,
    };
  }
}