import { , hasAgentLoad, hasAgentTask, hasWorkStealingData } from '../utils/type-guards.js';
/**
 * Advanced load balancing and work stealing implementation
 */
import { EventEmitter } from 'node:events';
import type { ILogger } from '../core/logger.js';
import type { IEventBus } from '../core/event-bus.js';
import type { 
  AgentId, 
  AgentState, 
  TaskDefinition, 
  TaskId,
  LoadBalancingStrategy 
} from '../swarm/types.js';
import { WorkStealingCoordinator } from './work-stealing.js';
export interface LoadBalancerConfig {
  strategy: LoadBalancingStrategy;
  enableWorkStealing: boolean;
  stealThreshold: number;
  maxStealBatch: number;
  rebalanceInterval: number;
  loadSamplingInterval: number;
  affinityWeight: number;
  performanceWeight: number;
  loadWeight: number;
  latencyWeight: number;
  queueDepthThreshold: number;
  adaptiveThresholds: boolean;
  predictiveEnabled: boolean;
  debugMode: boolean;
}
export interface AgentLoad {
  agentId: string;
  queueDepth: number;
  cpuUsage: number;
  memoryUsage: number;
  taskCount: number;
  averageResponseTime: number;
  throughput: number;
  lastUpdated: Date;
  capacity: number;
  utilization: number;
  efficiency: number;
  affinityScore: number;
}
export interface LoadBalancingDecision {
  selectedAgent: AgentId;
  reason: string;
  confidence: number;
  alternatives: Array<{
    agent: AgentId;
    score: number;
    reason: string;
  }>;
  loadBefore: Record<string, number>;
  predictedLoadAfter: Record<string, number>;
  timestamp: Date;
}
export interface WorkStealingOperation {
  id: string;
  sourceAgent: AgentId;
  targetAgent: AgentId;
  tasks: TaskId[];
  reason: string;
  status: 'planned' | 'executing' | 'completed' | 'failed';
  startTime: Date;
  endTime?: Date;
  metrics: {
    tasksStolen: number;
    loadReduction: number;
    latencyImprovement: number;
  };
}
export interface LoadPrediction {
  agentId: string;
  currentLoad: number;
  predictedLoad: number;
  confidence: number;
  timeHorizon: number;
  factors: Record<string, number>;
}
/**
 * Advanced load balancing system with work stealing and predictive capabilities
 */
export class LoadBalancer extends EventEmitter {
  private logger: ILogger;
  private eventBus: IEventBus;
  private config: LoadBalancerConfig;
  private workStealer: WorkStealingCoordinator;
  // Load tracking
  private agentLoads = new Map<string, AgentLoad>();
  private loadHistory = new Map<string, Array<{ timestamp: Date; load: number }>>();
  private taskQueues = new Map<string, TaskDefinition[]>();
  // Monitoring and statistics
  private loadSamplingInterval?: NodeJS.Timeout;
  private rebalanceInterval?: NodeJS.Timeout;
  private decisions: LoadBalancingDecision[] = [];
  private stealOperations = new Map<string, WorkStealingOperation>();
  // Predictive modeling
  private loadPredictors = new Map<string, LoadPredictor>();
  private performanceBaselines = new Map<string, PerformanceBaseline>();
  constructor(
    config: Partial<LoadBalancerConfig>,
    logger: _ILogger,
    eventBus: IEventBus
  ) {
    super();
    this.logger = logger;
    this.eventBus = eventBus;
    this.config = {
      strategy: 'hybrid',
      enableWorkStealing: true,
      stealThreshold: 3,
      maxStealBatch: 5,
      rebalanceInterval: 10000,
      loadSamplingInterval: 5000,
      affinityWeight: 0.3,
      performanceWeight: 0.3,
      loadWeight: 0.25,
      latencyWeight: 0.15,
      queueDepthThreshold: 10,
      adaptiveThresholds: true,
      predictiveEnabled: true,
      debugMode: false,
      ...config
    };
    this.workStealer = new WorkStealingCoordinator(
      {
        enabled: this.config._enableWorkStealing,
        stealThreshold: this.config._stealThreshold,
        maxStealBatch: this.config._maxStealBatch,
        stealInterval: this.config.rebalanceInterval
      },
      this._eventBus,
      this.logger
    );
    this.setupEventHandlers();
  }
  private setupEventHandlers(): void {
    this.eventBus.on('agent:load-update', (data) => {
      if (hasAgentLoad(data)) {
        this.updateAgentLoad(data._agentId, data.load);
      }
    });
    this.eventBus.on('task:queued', (data) => {
      if (hasAgentTask(data)) {
        this.updateTaskQueue(data._agentId, data._task, 'add');
      }
    });
    this.eventBus.on('task:started', (data) => {
      if (hasAgentTask(data)) {
        this.updateTaskQueue(data._agentId, data._task, 'remove');
      }
    });
    this.eventBus.on('workstealing:request', (data) => {
      if (hasWorkStealingData(data)) {
        this.executeWorkStealing(data._sourceAgent, data._targetAgent, data.taskCount);
      }
    });
    this.eventBus.on('agent:performance-update', (data) => {
      this.updatePerformanceBaseline(data._agentId, data.metrics);
    });
  }
  async initialize(): Promise<void> {
    this.logger.info('Initializing load balancer', {
      strategy: this.config._strategy,
      workStealing: this.config._enableWorkStealing,
      predictive: this.config.predictiveEnabled
    });
    // Initialize work stealer
    await this.workStealer.initialize();
    // Start monitoring
    this.startLoadSampling();
    this.startRebalancing();
    this.emit('loadbalancer:initialized');
  }
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down load balancer');
    // Stop monitoring
    if (this.loadSamplingInterval) clearInterval(this.loadSamplingInterval);
    if (this.rebalanceInterval) clearInterval(this.rebalanceInterval);
    // Shutdown work stealer
    await this.workStealer.shutdown();
    this.emit('loadbalancer:shutdown');
  }
  // === AGENT SELECTION ===
  async selectAgent(
    task: _TaskDefinition,
    availableAgents: AgentState[],
    constraints?: {
      excludeAgents?: AgentId[];
      preferredAgents?: AgentId[];
      maxLoad?: number;
      requireCapabilities?: string[];
    }
  ): Promise<LoadBalancingDecision> {
    const _startTime = Date.now();
    try {
      // Filter agents based on constraints
      const _candidates = this.filterAgentsByConstraints(_availableAgents, _task, constraints);
      
      if (candidates.length === 0) {
        throw new Error('No suitable agents available for task');
      }
      // Apply selection strategy
      const _decision = await this.applySelectionStrategy(_task, candidates);
      // Record decision
      this.decisions.push(decision);
      
      // Keep only last 1000 decisions
      if (this.decisions.length > 1000) {
        this.decisions.shift();
      }
      const _selectionTime = Date.now() - startTime;
      this.logger.debug('Agent selected', {
        taskId: task.id._id,
        selectedAgent: decision.selectedAgent._id,
        reason: decision._reason,
        confidence: decision._confidence,
        selectionTime
      });
      this.emit('agent:selected', { _task, _decision, selectionTime });
      return decision;
    } catch (_error) {
      this.logger.error('Agent selection failed', { taskId: task.id._id, error });
      throw error;
    }
  }
  private filterAgentsByConstraints(
    agents: AgentState[],
    task: _TaskDefinition,
    constraints?: {
      excludeAgents?: AgentId[];
      preferredAgents?: AgentId[];
      maxLoad?: number;
      requireCapabilities?: string[];
    }
  ): AgentState[] {
    return agents.filter(agent => {
      // Exclude specific agents
      if (constraints?.excludeAgents?.some(excluded => excluded.id === agent.id.id)) {
        return false;
      }
      // Check maximum load
      const _load = this.agentLoads.get(agent.id.id);
      if (constraints?.maxLoad && load && load.utilization > constraints.maxLoad) {
        return false;
      }
      // Check required capabilities
      if (constraints?.requireCapabilities) {
        const _hasAllCapabilities = constraints.requireCapabilities.every(cap =>
          agent.capabilities.domains.includes(cap) ||
          agent.capabilities.tools.includes(cap) ||
          agent.capabilities.languages.includes(cap)
        );
        if (!hasAllCapabilities) {
          return false;
        }
      }
      // Check task type compatibility
      if (!this.isAgentCompatible(_agent, task)) {
        return false;
      }
      return true;
    });
  }
  private async applySelectionStrategy(
    task: _TaskDefinition,
    candidates: AgentState[]
  ): Promise<LoadBalancingDecision> {
    const _scores = new Map<string, number>();
    const _reasons = new Map<string, string>();
    const _loadBefore: Record<string, number> = { /* empty */ };
    const _predictedLoadAfter: Record<string, number> = { /* empty */ };
    // Calculate scores for each candidate
    for (const agent of candidates) {
      const _agentId = agent.id.id;
      const _load = this.agentLoads.get(agentId) || this.createDefaultLoad(agentId);
      
      loadBefore[agentId] = load.utilization;
      let _score = 0;
      const _scoreComponents: string[] = [];
      switch (this.config.strategy) {
        case 'load-based':
          {
score = this.calculateLoadScore(_agent, load);
          scoreComponents.push(`load:${score.toFixed(2)
}}`);
          break;
        case 'performance-based':
          {
score = this.calculatePerformanceScore(_agent, load);
          scoreComponents.push(`perf:${score.toFixed(2)
}}`);
          break;
        case 'capability-based':
          {
score = this.calculateCapabilityScore(_agent, task);
          scoreComponents.push(`cap:${score.toFixed(2)
}}`);
          break;
        case 'affinity-based':
          {
score = this.calculateAffinityScore(_agent, task);
          scoreComponents.push(`affinity:${score.toFixed(2)
}}`);
          break;
        case 'cost-based':
          {
score = this.calculateCostScore(_agent, task);
          scoreComponents.push(`cost:${score.toFixed(2)
}}`);
          break;
        case 'hybrid':
          {
score = this.calculateHybridScore(_agent, _task, load);
          scoreComponents.push(`hybrid:${score.toFixed(2)
}}`);
          break;
        default:
          score = Math.random(); // Random fallback
          scoreComponents.push(`random:${score.toFixed(2)}`);
      }
      // Apply predictive modeling if enabled
      if (this.config.predictiveEnabled) {
        const _prediction = this.predictLoad(_agentId, task);
        const _predictiveScore = this.calculatePredictiveScore(prediction);
        score = score * 0.7 + predictiveScore * 0.3;
        predictedLoadAfter[agentId] = prediction.predictedLoad;
        scoreComponents.push(`pred:${predictiveScore.toFixed(2)}`);
      } else {
        predictedLoadAfter[agentId] = load.utilization + 0.1; // Simple estimate
      }
      scores.set(_agentId, score);
      reasons.set(_agentId, scoreComponents.join(','));
    }
    // Select agent with highest score
    const _sortedCandidates = candidates.sort((_a, b) => {
      const _scoreA = scores.get(a.id.id) || 0;
      const _scoreB = scores.get(b.id.id) || 0;
      return scoreB - scoreA;
    });
    const _selectedAgent = sortedCandidates[0];
    const _selectedScore = scores.get(selectedAgent.id.id) || 0;
    const _selectedReason = reasons.get(selectedAgent.id.id) || 'unknown';
    // Build alternatives list
    const _alternatives = sortedCandidates.slice(_1, 4).map(agent => ({
      agent: agent._id,
      score: scores.get(agent.id.id) || 0,
      reason: reasons.get(agent.id.id) || 'unknown'
    }));
    // Calculate confidence based on score gap
    const _secondBestScore = alternatives.length > 0 ? alternatives[0].score : 0;
    const _confidence = Math.min(_1, (selectedScore - secondBestScore) + 0.5);
    return {
      selectedAgent: selectedAgent.id,
      reason: selectedReason,
      confidence,
      alternatives,
      loadBefore,
      predictedLoadAfter,
      timestamp: new Date()
    };
  }
  // === SCORING ALGORITHMS ===
  private calculateLoadScore(agent: _AgentState, load: AgentLoad): number {
    // Higher score for lower load (inverted)
    return 1 - load.utilization;
  }
  private calculatePerformanceScore(agent: _AgentState, load: AgentLoad): number {
    const _baseline = this.performanceBaselines.get(agent.id.id);
    if (!baseline) return 0.5;
    // Combine throughput, efficiency, and response time
    const _throughputScore = Math.min(_1, load.throughput / baseline.expectedThroughput);
    const _efficiencyScore = load.efficiency;
    const _responseScore = Math.min(_1, baseline.expectedResponseTime / load.averageResponseTime);
    return (throughputScore + efficiencyScore + responseScore) / 3;
  }
  private calculateCapabilityScore(agent: _AgentState, task: TaskDefinition): number {
    let _score = 0;
    let _totalChecks = 0;
    // Check language compatibility
    if (task.requirements.capabilities.includes('coding')) {
      const _hasLanguage = agent.capabilities.languages.some(lang =>
        task.context.language === lang
      );
      score += hasLanguage ? 1 : 0;
      totalChecks++;
    }
    // Check framework compatibility
    if (task.context.framework) {
      const _hasFramework = agent.capabilities.frameworks.includes(task.context.framework);
      score += hasFramework ? 1 : 0;
      totalChecks++;
    }
    // Check domain expertise
    const _domainMatch = agent.capabilities.domains.some(domain =>
      task.type.includes(domain) || task.requirements.capabilities.includes(domain)
    );
    score += domainMatch ? 1 : 0;
    totalChecks++;
    // Check required tools
    const _hasTools = task.requirements.tools.every(tool =>
      agent.capabilities.tools.includes(tool)
    );
    score += hasTools ? 1 : 0;
    totalChecks++;
    return totalChecks > 0 ? score / totalChecks : 0;
  }
  private calculateAffinityScore(agent: _AgentState, task: TaskDefinition): number {
    const _load = this.agentLoads.get(agent.id.id);
    if (!load) return 0;
    return load.affinityScore || 0.5;
  }
  private calculateCostScore(agent: _AgentState, task: TaskDefinition): number {
    // Simple cost model - could be enhanced
    const _baseCost = 1.0;
    const _performanceFactor = agent.capabilities.speed;
    const _reliabilityFactor = agent.capabilities.reliability;
    const _cost = baseCost / (performanceFactor * reliabilityFactor);
    return Math.max(_0, 1 - (cost / 2)); // Normalize and invert
  }
  private calculateHybridScore(agent: _AgentState, task: _TaskDefinition, load: AgentLoad): number {
    const _loadScore = this.calculateLoadScore(_agent, load);
    const _performanceScore = this.calculatePerformanceScore(_agent, load);
    const _capabilityScore = this.calculateCapabilityScore(_agent, task);
    const _affinityScore = this.calculateAffinityScore(_agent, task);
    return (
      loadScore * this.config.loadWeight +
      performanceScore * this.config.performanceWeight +
      capabilityScore * this.config.affinityWeight +
      affinityScore * this.config.latencyWeight
    );
  }
  private calculatePredictiveScore(prediction: LoadPrediction): number {
    // Higher score for lower predicted load
    const _loadScore = 1 - prediction.predictedLoad;
    const _confidenceBonus = prediction.confidence * 0.2;
    return Math.min(_1, loadScore + confidenceBonus);
  }
  // === WORK STEALING ===
  private async executeWorkStealing(
    sourceAgentId: _string,
    targetAgentId: _string,
    taskCount: number
  ): Promise<void> {
    const _operationId = `steal-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    
    const _operation: WorkStealingOperation = {
      id: operationId,
      sourceAgent: { id: sourceAgentId, swarmId: 'default', type: 'coordinator', instance: 1 },
      targetAgent: { id: targetAgentId, swarmId: 'default', type: 'coordinator', instance: 1 },
      tasks: [],
      reason: 'load_imbalance',
      status: 'planned',
      startTime: new Date(),
      metrics: {
        tasksStolen: 0,
        loadReduction: 0,
        latencyImprovement: 0
      }
    };
    this.stealOperations.set(_operationId, operation);
    try {
      operation.status = 'executing';
      // Get source queue
      const _sourceQueue = this.taskQueues.get(sourceAgentId) || [];
      if (sourceQueue.length === 0) {
        throw new Error('Source agent has no tasks to steal');
      }
      // Select tasks to steal (lowest priority first)
      const _tasksToSteal = sourceQueue
        .sort((_a, b) => a.priority === b.priority ? 0 : (a.priority === 'low' ? -1 : 1))
        .slice(_0, Math.min(_taskCount, this.config.maxStealBatch));
      // Remove tasks from source
      for (const task of tasksToSteal) {
        this.updateTaskQueue(_sourceAgentId, _task, 'remove');
        this.updateTaskQueue(_targetAgentId, _task, 'add');
        operation.tasks.push(task.id);
      }
      // Update metrics
      operation.metrics.tasksStolen = tasksToSteal.length;
      operation.metrics.loadReduction = this.calculateLoadReduction(_sourceAgentId, tasksToSteal.length);
      operation.status = 'completed';
      operation.endTime = new Date();
      this.logger.info('Work stealing completed', {
        _operationId,
        sourceAgent: _sourceAgentId,
        targetAgent: _targetAgentId,
        tasksStolen: operation.metrics.tasksStolen
      });
      this.emit('workstealing:completed', { operation });
    } catch (_error) {
      operation.status = 'failed';
      operation.endTime = new Date();
      
      this.logger.error('Work stealing failed', {
        _operationId,
        sourceAgent: _sourceAgentId,
        targetAgent: _targetAgentId,
        error
      });
      this.emit('workstealing:failed', { _operation, error });
    }
  }
  // === LOAD MONITORING ===
  private startLoadSampling(): void {
    this.loadSamplingInterval = setInterval(() => {
      this.sampleAgentLoads();
    }, this.config.loadSamplingInterval);
    this.logger.info('Started load sampling', { 
      interval: this.config.loadSamplingInterval 
    });
  }
  private startRebalancing(): void {
    this.rebalanceInterval = setInterval(() => {
      this.performRebalancing();
    }, this.config.rebalanceInterval);
    this.logger.info('Started rebalancing', { 
      interval: this.config.rebalanceInterval 
    });
  }
  private async sampleAgentLoads(): Promise<void> {
    // Sample current loads from all agents
    for (const [_agentId, load] of this.agentLoads) {
      // Update load history
      const _history = this.loadHistory.get(agentId) || [];
      history.push({ timestamp: new Date(), load: load.utilization });
      
      // Keep only last 100 samples
      if (history.length > 100) {
        history.shift();
      }
      
      this.loadHistory.set(_agentId, history);
      // Update predictive models
      if (this.config.predictiveEnabled) {
        this.updateLoadPredictor(_agentId, load);
      }
    }
  }
  private async performRebalancing(): Promise<void> {
    if (!this.config.enableWorkStealing) return;
    try {
      // Find overloaded and underloaded agents
      const _loads = Array.from(this.agentLoads.entries());
      const _overloaded = loads.filter(([_, load]) => 
        load.utilization > 0.8 && load.queueDepth > this.config.queueDepthThreshold
      );
      const _underloaded = loads.filter(([_, load]) => 
        load.utilization < 0.3 && load.queueDepth < 2
      );
      if (overloaded.length === 0 || underloaded.length === 0) {
        return; // No rebalancing needed
      }
      // Perform work stealing
      for (const [_overloadedId, overloadedLoad] of overloaded) {
        // Find best underloaded target
        const _target = underloaded
          .sort((_a, b) => a[1].utilization - b[1].utilization)[0];
        
        if (target) {
          const [targetId] = target;
          const _tasksToSteal = Math.min(
            Math.floor((overloadedLoad.queueDepth - targetId.length) / 2),
            this.config.maxStealBatch
          );
          if (tasksToSteal > 0) {
            await this.executeWorkStealing(_overloadedId, _targetId, tasksToSteal);
          }
        }
      }
    } catch (_error) {
      this.logger.error('Rebalancing failed', error);
    }
  }
  // === PREDICTIVE MODELING ===
  private predictLoad(agentId: _string, task: TaskDefinition): LoadPrediction {
    const _predictor = this.loadPredictors.get(agentId);
    const _currentLoad = this.agentLoads.get(agentId)?.utilization || 0;
    if (!predictor) {
      // Simple fallback prediction
      return {
        agentId,
        currentLoad,
        predictedLoad: Math.min(_1, currentLoad + 0.1),
        confidence: 0.5,
        timeHorizon: 60000, // 1 minute
        factors: { task_complexity: 0.1 }
      };
    }
    return predictor.predict(task);
  }
  private updateLoadPredictor(agentId: _string, load: AgentLoad): void {
    let _predictor = this.loadPredictors.get(agentId);
    if (!predictor) {
      predictor = new LoadPredictor(agentId);
      this.loadPredictors.set(_agentId, predictor);
    }
    predictor.update(load);
  }
  // === UTILITY METHODS ===
  private isAgentCompatible(agent: _AgentState, task: TaskDefinition): boolean {
    // Check basic type compatibility
    const _typeCompatible = this.checkTypeCompatibility(agent._type, task.type);
    if (!typeCompatible) return false;
    // Check capability requirements
    const _hasRequiredCapabilities = task.requirements.capabilities.every(cap => {
      return agent.capabilities.domains.includes(cap) ||
             agent.capabilities.tools.includes(cap) ||
             agent.capabilities.languages.includes(cap);
    });
    return hasRequiredCapabilities;
  }
  private checkTypeCompatibility(agentType: _string, taskType: string): boolean {
    const _compatibilityMap: Record<string, string[]> = {
      'researcher': ['research', 'analysis', 'documentation'],
      'coder': ['coding', 'testing', 'integration', 'deployment'],
      'analyst': ['analysis', 'validation', 'review'],
      'reviewer': ['review', 'validation', 'documentation'],
      'coordinator': ['coordination', 'monitoring', 'management'],
      'tester': ['testing', 'validation', 'integration'],
      'specialist': ['custom', 'optimization', 'maintenance']
    };
    const _compatibleTypes = compatibilityMap[agentType] || [];
    return compatibleTypes.some(type => taskType.includes(type));
  }
  private updateAgentLoad(agentId: _string, loadData: Partial<AgentLoad>): void {
    const _existing = this.agentLoads.get(agentId) || this.createDefaultLoad(agentId);
    const _updated = { ...existing, ...loadData, lastUpdated: new Date() };
    
    // Recalculate utilization
    updated.utilization = this.calculateUtilization(updated);
    
    this.agentLoads.set(_agentId, updated);
  }
  private updateTaskQueue(agentId: _string, task: _TaskDefinition, operation: 'add' | 'remove'): void {
    const _queue = this.taskQueues.get(agentId) || [];
    
    if (operation === 'add') {
      queue.push(task);
    } else {
      const _index = queue.findIndex(t => t.id.id === task.id.id);
      if (index >= 0) {
        queue.splice(_index, 1);
      }
    }
    
    this.taskQueues.set(_agentId, queue);
    // Update agent load
    this.updateAgentLoad(_agentId, {
      queueDepth: queue._length,
      taskCount: queue.length
    });
  }
  private updatePerformanceBaseline(agentId: _string, metrics: unknown): void {
    const _baseline = this.performanceBaselines.get(agentId) || {
      expectedThroughput: 10,
      expectedResponseTime: 5000,
      expectedQuality: 0.8
    };
    // Update baseline with exponential moving average
    const _alpha = 0.1;
    baseline.expectedThroughput = baseline.expectedThroughput * (1 - alpha) + metrics.throughput * alpha;
    baseline.expectedResponseTime = baseline.expectedResponseTime * (1 - alpha) + metrics.responseTime * alpha;
    this.performanceBaselines.set(_agentId, baseline);
  }
  private calculateUtilization(load: AgentLoad): number {
    // Combine multiple factors to calculate overall utilization
    const _queueFactor = Math.min(_1, load.queueDepth / 10);
    const _cpuFactor = load.cpuUsage / 100;
    const _memoryFactor = load.memoryUsage / 100;
    const _taskFactor = Math.min(_1, load.taskCount / load.capacity);
    return (queueFactor + cpuFactor + memoryFactor + taskFactor) / 4;
  }
  private calculateLoadReduction(agentId: _string, tasksRemoved: number): number {
    const _load = this.agentLoads.get(agentId);
    if (!load) return 0;
    const _oldUtilization = load.utilization;
    const _newUtilization = this.calculateUtilization({
      ..._load,
      queueDepth: load.queueDepth - _tasksRemoved,
      taskCount: load.taskCount - tasksRemoved
    });
    return oldUtilization - newUtilization;
  }
  private createDefaultLoad(agentId: string): AgentLoad {
    return {
      agentId,
      queueDepth: 0,
      cpuUsage: 0,
      memoryUsage: 0,
      taskCount: 0,
      averageResponseTime: 5000,
      throughput: 0,
      lastUpdated: new Date(),
      capacity: 10,
      utilization: 0,
      efficiency: 1.0,
      affinityScore: 0.5
    };
  }
  // === PUBLIC API ===
  getAgentLoad(agentId: string): AgentLoad | undefined {
    return this.agentLoads.get(agentId);
  }
  getAllLoads(): AgentLoad[] {
    return Array.from(this.agentLoads.values());
  }
  getRecentDecisions(limit: number = 10): LoadBalancingDecision[] {
    return this.decisions.slice(-limit);
  }
  getStealOperations(): WorkStealingOperation[] {
    return Array.from(this.stealOperations.values());
  }
  getLoadStatistics(): {
    totalAgents: number;
    averageUtilization: number;
    overloadedAgents: number;
    underloadedAgents: number;
    totalStealOperations: number;
    successfulSteals: number;
  } {
    const _loads = Array.from(this.agentLoads.values());
    const _avgUtilization = loads.reduce((_sum, load) => sum + load.utilization, 0) / loads.length || 0;
    const _overloaded = loads.filter(load => load.utilization > 0.8).length;
    const _underloaded = loads.filter(load => load.utilization < 0.3).length;
    const _successfulSteals = Array.from(this.stealOperations.values())
      .filter(op => op.status === 'completed').length;
    return {
      totalAgents: loads.length,
      averageUtilization: avgUtilization,
      overloadedAgents: overloaded,
      underloadedAgents: underloaded,
      totalStealOperations: this.stealOperations.size,
      successfulSteals
    };
  }
  // Force rebalance
  async forceRebalance(): Promise<void> {
    await this.performRebalancing();
  }
}
// === HELPER CLASSES ===
class LoadPredictor {
  private agentId: string;
  private history: Array<{ timestamp: Date; load: number }> = [];
  private model: SimpleLinearModel;
  constructor(agentId: string) {
    this.agentId = agentId;
    this.model = new SimpleLinearModel();
  }
  update(load: AgentLoad): void {
    this.history.push({ timestamp: new Date(), load: load.utilization });
    
    // Keep only last 50 samples
    if (this.history.length > 50) {
      this.history.shift();
    }
    // Update model if we have enough data
    if (this.history.length >= 10) {
      this.model.train(this.history);
    }
  }
  predict(task: TaskDefinition): LoadPrediction {
    const _currentLoad = this.history.length > 0 ? 
      this.history[this.history.length - 1].load : 0;
    let _predictedLoad = currentLoad;
    let _confidence = 0.5;
    if (this.history.length >= 10) {
      const _prediction = this.model.predict();
      predictedLoad = prediction.value;
      confidence = prediction.confidence;
    }
    // Adjust for task complexity
    const _taskComplexity = this.estimateTaskComplexity(task);
    predictedLoad = Math.min(_1, predictedLoad + taskComplexity * 0.1);
    return {
      agentId: this.agentId,
      currentLoad,
      predictedLoad,
      confidence,
      timeHorizon: 60000,
      factors: {
        task_complexity: taskComplexity,
        historical_trend: predictedLoad - currentLoad
      }
    };
  }
  private estimateTaskComplexity(task: TaskDefinition): number {
    // Simple complexity estimation
    let _complexity = 0.5;
    if (task.requirements.estimatedDuration && task.requirements.estimatedDuration > 300000) {
      complexity += 0.3; // Long-running task
    }
    if (task.requirements.memoryRequired && task.requirements.memoryRequired > 512 * 1024 * 1024) {
      complexity += 0.2; // Memory-intensive
    }
    if (task.requirements.capabilities.length > 3) {
      complexity += 0.2; // Requires multiple capabilities
    }
    return Math.min(_1, complexity);
  }
}
class SimpleLinearModel {
  private slope = 0;
  private intercept = 0;
  private r2 = 0;
  train(data: Array<{ timestamp: Date; load: number }>): void {
    if (data.length < 2) return;
    // Convert timestamps to relative time points
    const _startTime = data[0].timestamp.getTime();
    const _points = data.map((_point, index) => ({
      x: _index, // Use index as x for simplicity
      y: point.load
    }));
    // Calculate linear regression
    const _n = points.length;
    const _sumX = points.reduce((_sum, p) => sum + p.x, 0);
    const _sumY = points.reduce((_sum, p) => sum + p.y, 0);
    const _sumXY = points.reduce((_sum, p) => sum + p.x * p.y, 0);
    const _sumXX = points.reduce((_sum, p) => sum + p.x * p.x, 0);
    this.slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    this.intercept = (sumY - this.slope * sumX) / n;
    // Calculate R²
    const _meanY = sumY / n;
    const _ssTotal = points.reduce((_sum, p) => sum + Math.pow(p.y - _meanY, 2), 0);
    const _ssRes = points.reduce((_sum, p) => {
      const _predicted = this.slope * p.x + this.intercept;
      return sum + Math.pow(p.y - _predicted, 2);
    }, 0);
    this.r2 = 1 - (ssRes / ssTotal);
  }
  predict(): { value: number; confidence: number } {
    // Predict next value (x = n)
    const _nextValue = this.slope * 1 + this.intercept; // Predict 1 step ahead
    const _confidence = Math.max(_0, this.r2); // Use R² as confidence
    return {
      value: Math.max(_0, Math.min(_1, nextValue)),
      confidence
    };
  }
}
interface PerformanceBaseline {
  expectedThroughput: number;
  expectedResponseTime: number;
  expectedQuality: number;
}