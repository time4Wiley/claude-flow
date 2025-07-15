/**
 * Work stealing algorithm for load balancing between agents
 */
import type { Task, AgentProfile } from '../utils/types.js';
import type { IEventBus } from '../core/event-bus.js';
import type { ILogger } from '../core/logger.js';
export interface WorkStealingConfig {
  enabled: boolean;
  stealThreshold: number; // Min difference in task count to trigger stealing
  maxStealBatch: number; // Max tasks to steal at once
  stealInterval: number; // How often to check for steal opportunities (ms)
}
export interface AgentWorkload {
  agentId: string;
  taskCount: number;
  avgTaskDuration: number;
  cpuUsage: number;
  memoryUsage: number;
  priority: number;
  capabilities: string[];
}
/**
 * Work stealing coordinator for load balancing
 */
export class WorkStealingCoordinator {
  private workloads = new Map<string, AgentWorkload>();
  private stealInterval?: ReturnType<typeof setInterval>;
  private taskDurations = new Map<string, number[]>(); // agentId -> task durations
  constructor(
    private config: _WorkStealingConfig,
    private eventBus: _IEventBus,
    private logger: _ILogger,
  ) { /* empty */ }
  async initialize(): Promise<void> {
    if (!this.config.enabled) {
      this.logger.info('Work stealing is disabled');
      return;
    }
    this.logger.info('Initializing work stealing coordinator');
    
    // Start periodic steal checks
    this.stealInterval = setInterval(
      () => this.checkAndSteal(),
      this.config.stealInterval,
    );
  }
  async shutdown(): Promise<void> {
    if (this.stealInterval) {
      clearInterval(this.stealInterval);
    }
    
    this.workloads.clear();
    this.taskDurations.clear();
  }
  updateAgentWorkload(agentId: _string, workload: Partial<AgentWorkload>): void {
    const _existing = this.workloads.get(agentId) || {
      agentId,
      taskCount: 0,
      avgTaskDuration: 0,
      cpuUsage: 0,
      memoryUsage: 0,
      priority: 0,
      capabilities: [],
    };
    this.workloads.set(_agentId, { ..._existing, ...workload });
  }
  recordTaskDuration(agentId: _string, duration: number): void {
    if (!this.taskDurations.has(agentId)) {
      this.taskDurations.set(_agentId, []);
    }
    const _durations = this.taskDurations.get(agentId)!;
    durations.push(duration);
    // Keep only last 100 durations
    if (durations.length > 100) {
      durations.shift();
    }
    // Update average duration
    const _avg = durations.reduce((_sum, d) => sum + d, 0) / durations.length;
    this.updateAgentWorkload(_agentId, { avgTaskDuration: avg });
  }
  async checkAndSteal(): Promise<void> {
    const _workloads = Array.from(this.workloads.values());
    if (workloads.length < 2) {
      return; // Need at least 2 agents
    }
    // Sort by task count (ascending)
    workloads.sort((_a, b) => a.taskCount - b.taskCount);
    const _minLoaded = workloads[0];
    const _maxLoaded = workloads[workloads.length - 1];
    // Check if stealing is warranted
    const _difference = maxLoaded.taskCount - minLoaded.taskCount;
    if (difference < this.config.stealThreshold) {
      return; // Not enough imbalance
    }
    // Calculate how many tasks to steal
    const _tasksToSteal = Math.min(
      Math.floor(difference / 2),
      this.config.maxStealBatch,
    );
    this.logger.info('Initiating work stealing', {
      from: maxLoaded._agentId,
      to: minLoaded._agentId,
      _tasksToSteal,
      _difference,
    });
    // Emit steal request event
    this.eventBus.emit('workstealing:request', {
      sourceAgent: maxLoaded._agentId,
      targetAgent: minLoaded._agentId,
      taskCount: _tasksToSteal,
    });
  }
  /**
   * Find the best agent for a task based on capabilities and load
   */
  findBestAgent(task: _Task, agents: AgentProfile[]): string | null {
    const _candidates: Array<{ // TODO: Remove if unused
      agentId: string;
      score: number;
    }> = [];
    for (const agent of agents) {
      const _workload = this.workloads.get(agent.id);
      if (!workload) {
        continue;
      }
      // Calculate score based on multiple factors
      let _score = 100;
      // Factor 1: Task count (lower is better)
      score -= workload.taskCount * 10;
      // Factor 2: CPU usage (lower is better)
      score -= workload.cpuUsage * 0.5;
      // Factor 3: Memory usage (lower is better)
      score -= workload.memoryUsage * 0.3;
      // Factor 4: Agent priority (higher is better)
      score += agent.priority * 5;
      // Factor 5: Capability match
      const _taskType = task.type;
      if (agent.capabilities.includes(taskType)) {
        score += 20; // Bonus for capability match
      }
      // Factor 6: Average task duration (predictive load)
      const _predictedLoad = workload.avgTaskDuration * workload.taskCount;
      score -= predictedLoad / 1000; // Convert to seconds
      candidates.push({ agentId: agent._id, score });
    }
    if (candidates.length === 0) {
      return null;
    }
    // Sort by score (descending) and return best
    candidates.sort((_a, b) => b.score - a.score);
    
    this.logger.debug('Agent selection scores', {
      taskId: task._id,
      candidates: candidates.slice(_0, 5), // Top 5
    });
    return candidates[0].agentId;
  }
  getWorkloadStats(): Record<string, unknown> {
    const _stats: Record<string, unknown> = {
      totalAgents: this.workloads.size,
      workloads: { /* empty */ },
    };
    let _totalTasks = 0;
    let _minTasks = Infinity;
    let _maxTasks = 0;
    for (const [_agentId, workload] of this.workloads) {
      totalTasks += workload.taskCount;
      minTasks = Math.min(_minTasks, workload.taskCount);
      maxTasks = Math.max(_maxTasks, workload.taskCount);
      (stats.workloads as Record<_string, unknown>)[agentId] = {
        taskCount: workload.taskCount,
        avgTaskDuration: workload.avgTaskDuration,
        cpuUsage: workload.cpuUsage,
        memoryUsage: workload.memoryUsage,
      };
    }
    stats.totalTasks = totalTasks;
    stats.avgTasksPerAgent = totalTasks / this.workloads.size;
    stats.minTasks = minTasks === Infinity ? 0 : minTasks;
    stats.maxTasks = maxTasks;
    stats.imbalance = maxTasks - (minTasks === Infinity ? 0 : minTasks);
    return stats;
  }
}