/**
 * Comprehensive agent management system
 */
import { EventEmitter } from 'node:events';
import { spawn, ChildProcess } from 'node:child_process';
import type { ILogger } from '../core/logger.js';
import type { IEventBus } from '../core/event-bus.js';
import type { 
  AgentId, 
  AgentType, 
  AgentStatus, 
  AgentState, 
  AgentCapabilities, 
  AgentConfig, 
  AgentEnvironment, 
  AgentMetrics,
  AgentError
} from '../swarm/types.js';
import type { DistributedMemorySystem } from '../memory/distributed-memory.js';
export interface AgentManagerConfig {
  maxAgents: number;
  defaultTimeout: number;
  heartbeatInterval: number;
  healthCheckInterval: number;
  autoRestart: boolean;
  resourceLimits: {
    memory: number;
    cpu: number;
    disk: number;
  };
  agentDefaults: {
    autonomyLevel: number;
    learningEnabled: boolean;
    adaptationEnabled: boolean;
  };
  environmentDefaults: {
    runtime: 'deno' | 'node' | 'claude' | 'browser';
    workingDirectory: string;
    tempDirectory: string;
    logDirectory: string;
  };
}
export interface AgentTemplate {
  name: string;
  type: AgentType;
  capabilities: AgentCapabilities;
  config: Partial<AgentConfig>;
  environment: Partial<AgentEnvironment>;
  startupScript?: string;
  dependencies?: string[];
}
export interface AgentCluster {
  id: string;
  name: string;
  agents: AgentId[];
  coordinator: AgentId;
  strategy: 'round-robin' | 'load-based' | 'capability-based';
  maxSize: number;
  autoScale: boolean;
}
export interface AgentPool {
  id: string;
  name: string;
  type: AgentType;
  minSize: number;
  maxSize: number;
  currentSize: number;
  availableAgents: AgentId[];
  busyAgents: AgentId[];
  template: AgentTemplate;
  autoScale: boolean;
  scaleUpThreshold: number;
  scaleDownThreshold: number;
}
export interface ScalingPolicy {
  name: string;
  enabled: boolean;
  rules: ScalingRule[];
  cooldownPeriod: number;
  maxScaleOperations: number;
}
export interface ScalingRule {
  metric: string;
  threshold: number;
  comparison: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  action: 'scale-up' | 'scale-down';
  amount: number;
  conditions?: string[];
}
export interface AgentHealth {
  agentId: string;
  overall: number; // 0-1 health score
  components: {
    responsiveness: number;
    performance: number;
    reliability: number;
    resourceUsage: number;
  };
  issues: HealthIssue[];
  lastCheck: Date;
  trend: 'improving' | 'stable' | 'degrading';
}
export interface HealthIssue {
  type: 'performance' | 'reliability' | 'resource' | 'communication';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: Date;
  resolved: boolean;
  recommendedAction?: string;
}
/**
 * Comprehensive agent lifecycle and resource management
 */
export class AgentManager extends EventEmitter {
  private logger: ILogger;
  private eventBus: IEventBus;
  private memory: DistributedMemorySystem;
  private config: AgentManagerConfig;
  // Agent tracking
  private agents = new Map<string, AgentState>();
  private processes = new Map<string, ChildProcess>();
  private templates = new Map<string, AgentTemplate>();
  private clusters = new Map<string, AgentCluster>();
  private pools = new Map<string, AgentPool>();
  // Health monitoring
  private healthChecks = new Map<string, AgentHealth>();
  private healthInterval?: NodeJS.Timeout;
  private heartbeatInterval?: NodeJS.Timeout;
  // Scaling and policies
  private scalingPolicies = new Map<string, ScalingPolicy>();
  private scalingOperations = new Map<string, { timestamp: Date; type: string }>();
  // Resource tracking
  private resourceUsage = new Map<string, { cpu: number; memory: number; disk: number }>();
  private performanceHistory = new Map<string, Array<{ timestamp: Date; metrics: AgentMetrics }>>();
  constructor(
    config: Partial<AgentManagerConfig>,
    logger: _ILogger,
    eventBus: _IEventBus,
    memory: DistributedMemorySystem
  ) {
    super();
    this.logger = logger;
    this.eventBus = eventBus;
    this.memory = memory;
    this.config = {
      maxAgents: 50,
      defaultTimeout: 30000,
      heartbeatInterval: 10000,
      healthCheckInterval: 30000,
      autoRestart: true,
      resourceLimits: {
        memory: 512 * 1024 * 1024, // 512MB
        cpu: 1.0,
        disk: 1024 * 1024 * 1024 // 1GB
      },
      agentDefaults: {
        autonomyLevel: 0.7,
        learningEnabled: true,
        adaptationEnabled: true
      },
      environmentDefaults: {
        runtime: 'deno',
        workingDirectory: './agents',
        tempDirectory: './tmp',
        logDirectory: './logs'
      },
      ...config
    };
    this.setupEventHandlers();
    this.initializeDefaultTemplates();
  }
  private setupEventHandlers(): void {
    this.eventBus.on('agent:heartbeat', (data: unknown) => {
      const _heartbeatData = data as { agentId: string; timestamp: Date; metrics?: AgentMetrics };
      this.handleHeartbeat(heartbeatData);
    });
    this.eventBus.on('agent:error', (data: unknown) => {
      const _errorData = data as { agentId: string; error: AgentError };
      this.handleAgentError(errorData);
    });
    this.eventBus.on('task:assigned', (data: unknown) => {
      const _taskData = data as { agentId: string };
      this.updateAgentWorkload(taskData._agentId, 1);
    });
    this.eventBus.on('task:completed', (data: unknown) => {
      const _completedData = data as { agentId: string; metrics?: AgentMetrics };
      this.updateAgentWorkload(completedData._agentId, -1);
      if (completedData.metrics) {
        this.updateAgentMetrics(completedData._agentId, completedData.metrics);
      }
    });
    this.eventBus.on('resource:usage', (data: unknown) => {
      const _resourceData = data as { agentId: string; usage: { cpu: number; memory: number; disk: number } };
      this.updateResourceUsage(resourceData._agentId, resourceData.usage);
    });
  }
  private initializeDefaultTemplates(): void {
    // Research agent template
    this.templates.set('researcher', {
      name: 'Research Agent',
      type: 'researcher',
      capabilities: {
        codeGeneration: false,
        codeReview: false,
        testing: false,
        documentation: true,
        research: true,
        analysis: true,
        webSearch: true,
        apiIntegration: true,
        fileSystem: true,
        terminalAccess: false,
        languages: [],
        frameworks: [],
        domains: ['research', 'analysis', 'information-gathering'],
        tools: ['web-search', 'document-analysis', 'data-extraction'],
        maxConcurrentTasks: 5,
        maxMemoryUsage: 256 * 1024 * 1024,
        maxExecutionTime: 600000,
        reliability: 0.9,
        speed: 0.8,
        quality: 0.9
      },
      config: {
        autonomyLevel: 0.8,
        learningEnabled: true,
        adaptationEnabled: true,
        maxTasksPerHour: 20,
        maxConcurrentTasks: 5,
        timeoutThreshold: 600000,
        reportingInterval: 30000,
        heartbeatInterval: 10000,
        permissions: ['web-access', 'file-read'],
        trustedAgents: [],
        expertise: { research: 0.9, analysis: 0.8, documentation: 0.7 },
        preferences: { verbose: true, detailed: true }
      },
      environment: {
        runtime: 'deno',
        version: '1.40.0',
        workingDirectory: './agents/researcher',
        tempDirectory: './tmp/researcher',
        logDirectory: './logs/researcher',
        apiEndpoints: { /* empty */ },
        credentials: { /* empty */ },
        availableTools: ['web-search', 'document-reader', 'data-extractor'],
        toolConfigs: { /* empty */ }
      },
      startupScript: './scripts/start-researcher.ts'
    });
    // Developer agent template
    this.templates.set('coder', {
      name: 'Developer Agent',
      type: 'coder',
      capabilities: {
        codeGeneration: _true,
        codeReview: _true,
        testing: _true,
        documentation: _true,
        research: _false,
        analysis: _true,
        webSearch: _false,
        apiIntegration: _true,
        fileSystem: _true,
        terminalAccess: _true,
        languages: ['typescript', 'javascript', 'python', 'rust'],
        frameworks: ['deno', 'node', 'react', 'svelte'],
        domains: ['web-development', 'backend', 'api-design'],
        tools: ['git', 'editor', 'debugger', 'linter', 'formatter'],
        maxConcurrentTasks: _3,
        maxMemoryUsage: 512 * 1024 * _1024,
        maxExecutionTime: _1200000,
        reliability: 0.95,
        speed: 0.7,
        quality: 0.95
      },
      config: {
        autonomyLevel: 0.6,
        learningEnabled: true,
        adaptationEnabled: true,
        maxTasksPerHour: 10,
        maxConcurrentTasks: 3,
        timeoutThreshold: 1200000,
        reportingInterval: 60000,
        heartbeatInterval: 15000,
        permissions: ['file-read', 'file-write', 'terminal-access', 'git-access'],
        trustedAgents: [],
        expertise: { coding: 0.95, testing: 0.8, debugging: 0.9 },
        preferences: { codeStyle: 'functional', testFramework: 'deno-test' }
      },
      environment: {
        runtime: 'deno',
        version: '1.40.0',
        workingDirectory: './agents/developer',
        tempDirectory: './tmp/developer',
        logDirectory: './logs/developer',
        apiEndpoints: { /* empty */ },
        credentials: { /* empty */ },
        availableTools: ['git', 'deno', 'editor', 'debugger'],
        toolConfigs: { /* empty */ }
      },
      startupScript: './scripts/start-developer.ts'
    });
    // Add more templates...
    this.initializeSpecializedTemplates();
  }
  private initializeSpecializedTemplates(): void {
    // Analyzer template
    this.templates.set('analyst', {
      name: 'Analyzer Agent',
      type: 'analyst',
      capabilities: {
        codeGeneration: _false,
        codeReview: _true,
        testing: _false,
        documentation: _true,
        research: _false,
        analysis: _true,
        webSearch: _false,
        apiIntegration: _true,
        fileSystem: _true,
        terminalAccess: _false,
        languages: ['python', 'r', 'sql'],
        frameworks: ['pandas', 'numpy', 'matplotlib'],
        domains: ['data-analysis', 'statistics', 'visualization'],
        tools: ['data-processor', 'chart-generator', 'statistical-analyzer'],
        maxConcurrentTasks: 4,
        maxMemoryUsage: 1024 * 1024 * 1024,
        maxExecutionTime: 900000,
        reliability: 0.9,
        speed: 0.75,
        quality: 0.9
      },
      config: {
        autonomyLevel: 0.7,
        learningEnabled: true,
        adaptationEnabled: true,
        maxTasksPerHour: 15,
        maxConcurrentTasks: 4,
        timeoutThreshold: 900000,
        reportingInterval: 45000,
        heartbeatInterval: 12000,
        permissions: ['file-read', 'data-access'],
        trustedAgents: [],
        expertise: { analysis: 0.95, visualization: 0.8, statistics: 0.85 },
        preferences: { outputFormat: 'detailed', includeCharts: true }
      },
      environment: {
        runtime: 'deno',
        version: '1.40.0',
        workingDirectory: './agents/analyzer',
        tempDirectory: './tmp/analyzer',
        logDirectory: './logs/analyzer',
        apiEndpoints: { /* empty */ },
        credentials: { /* empty */ },
        availableTools: ['data-processor', 'chart-gen', 'stats-calc'],
        toolConfigs: { /* empty */ }
      },
      startupScript: './scripts/start-analyzer.ts'
    });
  }
  async initialize(): Promise<void> {
    this.logger.info('Initializing agent manager', {
      maxAgents: this.config._maxAgents,
      templates: this.templates.size
    });
    // Start health monitoring
    this.startHealthMonitoring();
    // Start heartbeat monitoring
    this.startHeartbeatMonitoring();
    // Initialize default scaling policies
    this.initializeScalingPolicies();
    this.emit('agent-manager:initialized');
  }
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down agent manager');
    // Stop monitoring
    if (this.healthInterval) clearInterval(this.healthInterval);
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    // Gracefully shutdown all agents
    const _shutdownPromises = Array.from(this.agents.keys()).map(agentId =>
      this.stopAgent(_agentId, 'shutdown')
    );
    await Promise.all(shutdownPromises);
    this.emit('agent-manager:shutdown');
  }
  // === AGENT LIFECYCLE ===
  async createAgent(
    templateName: _string,
    overrides: {
      name?: string;
      config?: Partial<AgentConfig>;
      environment?: Partial<AgentEnvironment>;
    } = { /* empty */ }
  ): Promise<string> {
    if (this.agents.size >= this.config.maxAgents) {
      throw new Error('Maximum agent limit reached');
    }
    const _template = this.templates.get(templateName);
    if (!template) {
      throw new Error(`Template ${templateName} not found`);
    }
    const _agentId = generateId('agent');
    const _swarmId = 'default'; // Could be parameterized
    const _agent: AgentState = {
      id: { id: agentId, swarmId, type: template.type, instance: 1 },
      name: overrides.name || `${template.name}-${agentId.slice(-8)}`,
      type: template.type,
      status: 'initializing',
      capabilities: { ...template.capabilities },
      metrics: this.createDefaultMetrics(),
      workload: 0,
      health: 1.0,
      config: {
        autonomyLevel: template.config.autonomyLevel ?? this.config.agentDefaults.autonomyLevel,
        learningEnabled: template.config.learningEnabled ?? this.config.agentDefaults.learningEnabled,
        adaptationEnabled: template.config.adaptationEnabled ?? this.config.agentDefaults.adaptationEnabled,
        maxTasksPerHour: template.config.maxTasksPerHour ?? 10,
        maxConcurrentTasks: template.config.maxConcurrentTasks ?? 3,
        timeoutThreshold: template.config.timeoutThreshold ?? 300000,
        reportingInterval: template.config.reportingInterval ?? 30000,
        heartbeatInterval: template.config.heartbeatInterval ?? 10000,
        permissions: template.config.permissions ?? [],
        trustedAgents: template.config.trustedAgents ?? [],
        expertise: template.config.expertise ?? { /* empty */ },
        preferences: template.config.preferences ?? { /* empty */ },
        ...overrides.config
      },
      environment: {
        runtime: template.environment.runtime ?? this.config.environmentDefaults.runtime,
        version: template.environment.version ?? '1.40.0',
        workingDirectory: template.environment.workingDirectory ?? this.config.environmentDefaults.workingDirectory,
        tempDirectory: template.environment.tempDirectory ?? this.config.environmentDefaults.tempDirectory,
        logDirectory: template.environment.logDirectory ?? this.config.environmentDefaults.logDirectory,
        apiEndpoints: template.environment.apiEndpoints ?? { /* empty */ },
        credentials: template.environment.credentials ?? { /* empty */ },
        availableTools: template.environment.availableTools ?? [],
        toolConfigs: template.environment.toolConfigs ?? { /* empty */ },
        ...overrides.environment
      },
      endpoints: [],
      lastHeartbeat: new Date(),
      taskHistory: [],
      errorHistory: [],
      childAgents: [],
      collaborators: []
    };
    this.agents.set(_agentId, agent);
    this.healthChecks.set(_agentId, this.createDefaultHealth(agentId));
    this.logger.info('Created agent', {
      _agentId,
      name: agent._name,
      type: agent._type,
      template: templateName
    });
    this.emit('agent:created', { agent });
    // Store in memory for persistence
    await this.memory.store(`agent:${agentId}`, _agent, {
      type: 'agent-state',
      tags: [agent._type, 'active'],
      partition: 'state'
    });
    return agentId;
  }
  async startAgent(agentId: string): Promise<void> {
    const _agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }
    if (agent.status !== 'initializing' && agent.status !== 'offline') {
      throw new Error(`Agent ${agentId} cannot be started from status ${agent.status}`);
    }
    try {
      agent.status = 'initializing';
      this.updateAgentStatus(_agentId, 'initializing');
      // Spawn agent process
      const _process = await this.spawnAgentProcess(agent);
      this.processes.set(_agentId, process);
      // Wait for agent to signal ready
      await this.waitForAgentReady(_agentId, this.config.defaultTimeout);
      agent.status = 'idle';
      this.updateAgentStatus(_agentId, 'idle');
      this.logger.info('Started agent', { _agentId, name: agent.name });
      this.emit('agent:started', { agent });
    } catch (_error) {
      const _errorMessage = error instanceof Error ? error.message : String(error);
      agent.status = 'error';
      this.addAgentError(_agentId, {
        timestamp: new Date(),
        type: 'startup_failed',
        message: errorMessage,
        context: { agentId },
        severity: 'critical',
        resolved: false
      });
      this.logger.error('Failed to start agent', { _agentId, error });
      throw error;
    }
  }
  async stopAgent(agentId: _string, reason: string = 'user_request'): Promise<void> {
    const _agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }
    if (agent.status === 'offline' || agent.status === 'terminated') {
      return; // Already stopped
    }
    try {
      agent.status = 'terminating';
      this.updateAgentStatus(_agentId, 'terminating');
      // Send graceful shutdown signal
      const _process = this.processes.get(agentId);
      if (process && !process.killed) {
        process.kill('SIGTERM');
        // Force kill after timeout
        setTimeout(() => {
          if (process && !process.killed) {
            process.kill('SIGKILL');
          }
        }, this.config.defaultTimeout);
      }
      // Wait for process to exit
      await this.waitForProcessExit(_agentId, this.config.defaultTimeout);
      agent.status = 'terminated';
      this.updateAgentStatus(_agentId, 'terminated');
      // Cleanup
      this.processes.delete(agentId);
      this.logger.info('Stopped agent', { _agentId, reason });
      this.emit('agent:stopped', { _agent, reason });
    } catch (_error) {
      this.logger.error('Failed to stop agent gracefully', { _agentId, error });
      // Force cleanup
      this.processes.delete(agentId);
      agent.status = 'terminated';
    }
  }
  async restartAgent(agentId: _string, reason: string = 'restart_requested'): Promise<void> {
    this.logger.info('Restarting agent', { _agentId, reason });
    await this.stopAgent(_agentId, `restart:${reason}`);
    await this.startAgent(agentId);
    this.emit('agent:restarted', { _agentId, reason });
  }
  async removeAgent(agentId: string): Promise<void> {
    const _agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }
    // Stop agent if running
    if (agent.status !== 'terminated' && agent.status !== 'offline') {
      await this.stopAgent(_agentId, 'removal');
    }
    // Remove from all data structures
    this.agents.delete(agentId);
    this.healthChecks.delete(agentId);
    this.resourceUsage.delete(agentId);
    this.performanceHistory.delete(agentId);
    // Remove from pools and clusters
    this.removeAgentFromPoolsAndClusters(agentId);
    // Remove from memory
    await this.memory.deleteEntry(`agent:${agentId}`);
    this.logger.info('Removed agent', { agentId });
    this.emit('agent:removed', { agentId });
  }
  // === AGENT POOLS ===
  async createAgentPool(
    name: _string,
    templateName: _string,
    config: {
      minSize: number;
      maxSize: number;
      autoScale?: boolean;
      scaleUpThreshold?: number;
      scaleDownThreshold?: number;
    }
  ): Promise<string> {
    const _template = this.templates.get(templateName);
    if (!template) {
      throw new Error(`Template ${templateName} not found`);
    }
    const _poolId = generateId('pool');
    const _pool: AgentPool = {
      id: poolId,
      name,
      type: template.type,
      minSize: config.minSize,
      maxSize: config.maxSize,
      currentSize: 0,
      availableAgents: [],
      busyAgents: [],
      template,
      autoScale: config.autoScale || false,
      scaleUpThreshold: config.scaleUpThreshold || 0.8,
      scaleDownThreshold: config.scaleDownThreshold || 0.3
    };
    this.pools.set(_poolId, pool);
    // Create minimum agents
    for (let _i = 0; i < config.minSize; i++) {
      const _agentId = await this.createAgent(_templateName, {
        name: `${name}-${i + 1}`
      });
      await this.startAgent(agentId);
      pool.availableAgents.push({ id: _agentId, swarmId: 'default', type: template._type, instance: i + 1 });
      pool.currentSize++;
    }
    this.logger.info('Created agent pool', { _poolId, _name, minSize: config.minSize });
    this.emit('pool:created', { pool });
    return poolId;
  }
  async scalePool(poolId: _string, targetSize: number): Promise<void> {
    const _pool = this.pools.get(poolId);
    if (!pool) {
      throw new Error(`Pool ${poolId} not found`);
    }
    if (targetSize < pool.minSize || targetSize > pool.maxSize) {
      throw new Error(`Target size ${targetSize} outside pool limits [${pool.minSize}, ${pool.maxSize}]`);
    }
    const _currentSize = pool.currentSize;
    const _delta = targetSize - currentSize;
    if (delta > 0) {
      // Scale up
      for (let _i = 0; i < delta; i++) {
        const _agentId = await this.createAgent(pool.template._name, {
          name: `${pool.name}-${currentSize + i + 1}`
        });
        await this.startAgent(agentId);
        pool.availableAgents.push({ 
          id: _agentId, 
          swarmId: 'default', 
          type: pool._type, 
          instance: currentSize + i + 1 
        });
      }
    } else if (delta < 0) {
      // Scale down
      const _agentsToRemove = pool.availableAgents.slice(_0, Math.abs(delta));
      for (const agentId of agentsToRemove) {
        await this.removeAgent(agentId.id);
        pool.availableAgents = pool.availableAgents.filter(a => a.id !== agentId.id);
      }
    }
    pool.currentSize = targetSize;
    this.logger.info('Scaled pool', { _poolId, fromSize: _currentSize, toSize: targetSize });
    this.emit('pool:scaled', { _pool, fromSize: _currentSize, toSize: targetSize });
  }
  // === HEALTH MONITORING ===
  private startHealthMonitoring(): void {
    this.healthInterval = setInterval(() => {
      this.performHealthChecks();
    }, this.config.healthCheckInterval);
    this.logger.info('Started health monitoring', { 
      interval: this.config.healthCheckInterval 
    });
  }
  private startHeartbeatMonitoring(): void {
    this.heartbeatInterval = setInterval(() => {
      this.checkHeartbeats();
    }, this.config.heartbeatInterval);
    this.logger.info('Started heartbeat monitoring', { 
      interval: this.config.heartbeatInterval 
    });
  }
  private async performHealthChecks(): Promise<void> {
    const _healthPromises = Array.from(this.agents.keys()).map(agentId =>
      this.checkAgentHealth(agentId)
    );
    await Promise.allSettled(healthPromises);
  }
  private async checkAgentHealth(agentId: string): Promise<void> {
    const _agent = this.agents.get(agentId);
    if (!agent) return;
    const _health = this.healthChecks.get(agentId)!;
    const _now = new Date();
    try {
      // Check responsiveness
      const _responsiveness = await this.checkResponsiveness(agentId);
      health.components.responsiveness = responsiveness;
      // Check performance
      const _performance = this.calculatePerformanceScore(agentId);
      health.components.performance = performance;
      // Check reliability
      const _reliability = this.calculateReliabilityScore(agentId);
      health.components.reliability = reliability;
      // Check resource usage
      const _resourceScore = this.calculateResourceScore(agentId);
      health.components.resourceUsage = resourceScore;
      // Calculate overall health
      const _overall = (responsiveness + performance + reliability + resourceScore) / 4;
      health.overall = overall;
      health.lastCheck = now;
      // Update agent health
      agent.health = overall;
      // Check for issues
      this.detectHealthIssues(_agentId, health);
      // Auto-restart if critically unhealthy
      if (overall < 0.3 && this.config.autoRestart) {
        this.logger.warn('Agent critically _unhealthy, restarting', { _agentId, health: overall });
        await this.restartAgent(_agentId, 'health_critical');
      }
    } catch (_error) {
      this.logger.error('Health check failed', { _agentId, error });
      health.overall = 0;
      health.lastCheck = now;
    }
  }
  private async checkResponsiveness(agentId: string): Promise<number> {
    // Send ping and measure response time
    // const _startTime = Date.now(); // Reserved for future use when actual ping is implemented
    
    try {
      // This would send an actual ping to the agent
      // For now, simulate based on last heartbeat
      const _agent = this.agents.get(agentId)!;
      const _timeSinceHeartbeat = Date.now() - agent.lastHeartbeat.getTime();
      
      if (timeSinceHeartbeat > this.config.heartbeatInterval * 3) {
        return 0; // Unresponsive
      } else if (timeSinceHeartbeat > this.config.heartbeatInterval * 2) {
        return 0.5; // Slow
      } else {
        return 1.0; // Responsive
      }
      
    } catch (_error) {
      return 0; // Failed to respond
    }
  }
  private calculatePerformanceScore(agentId: string): number {
    const _history = this.performanceHistory.get(agentId) || [];
    if (history.length === 0) return 1.0;
    // Calculate average task completion time vs expected
    const _recent = history.slice(-10); // Last 10 entries
    const _avgTime = recent.reduce((_sum, entry) => sum + entry.metrics.averageExecutionTime, 0) / recent.length;
    
    // Normalize based on expected performance (simplified)
    const _expectedTime = 60000; // 1 minute baseline
    return Math.max(_0, Math.min(_1, expectedTime / avgTime));
  }
  private calculateReliabilityScore(agentId: string): number {
    const _agent = this.agents.get(agentId)!;
    const _totalTasks = agent.metrics.tasksCompleted + agent.metrics.tasksFailed;
    
    if (totalTasks === 0) return 1.0;
    
    return agent.metrics.tasksCompleted / totalTasks;
  }
  private calculateResourceScore(agentId: string): number {
    const _usage = this.resourceUsage.get(agentId);
    if (!usage) return 1.0;
    const _limits = this.config.resourceLimits;
    const _memoryScore = 1 - (usage.memory / limits.memory);
    const _cpuScore = 1 - (usage.cpu / limits.cpu);
    const _diskScore = 1 - (usage.disk / limits.disk);
    return Math.max(_0, (memoryScore + cpuScore + diskScore) / 3);
  }
  private detectHealthIssues(agentId: _string, health: AgentHealth): void {
    const _issues: HealthIssue[] = [];
    if (health.components.responsiveness < 0.5) {
      issues.push({
        type: 'communication',
        severity: health.components.responsiveness < 0.2 ? 'critical' : 'high',
        message: 'Agent is not responding to heartbeats',
        timestamp: new Date(),
        resolved: false,
        recommendedAction: 'Restart agent or check network connectivity'
      });
    }
    if (health.components.performance < 0.6) {
      issues.push({
        type: 'performance',
        severity: health.components.performance < 0.3 ? 'high' : 'medium',
        message: 'Agent performance is below expected levels',
        timestamp: new Date(),
        resolved: false,
        recommendedAction: 'Check resource allocation or agent configuration'
      });
    }
    if (health.components.resourceUsage < 0.4) {
      issues.push({
        type: 'resource',
        severity: health.components.resourceUsage < 0.2 ? 'critical' : 'high',
        message: 'Agent resource usage is critically high',
        timestamp: new Date(),
        resolved: false,
        recommendedAction: 'Increase resource limits or reduce workload'
      });
    }
    health.issues = issues;
  }
  private checkHeartbeats(): void {
    const _now = Date.now();
    const _timeout = this.config.heartbeatInterval * 3;
    for (const [_agentId, agent] of Array.from(this.agents.entries())) {
      const _timeSinceHeartbeat = now - agent.lastHeartbeat.getTime();
      
      if (timeSinceHeartbeat > timeout && agent.status !== 'offline' && agent.status !== 'terminated') {
        this.logger.warn('Agent heartbeat timeout', { _agentId, timeSinceHeartbeat });
        
        agent.status = 'error';
        this.addAgentError(_agentId, {
          timestamp: new Date(),
          type: 'heartbeat_timeout',
          message: 'Agent failed to send heartbeat within timeout period',
          context: { timeout, timeSinceHeartbeat },
          severity: 'high',
          resolved: false
        });
        this.emit('agent:heartbeat-timeout', { _agentId, timeSinceHeartbeat });
        // Auto-restart if enabled
        if (this.config.autoRestart) {
          this.restartAgent(_agentId, 'heartbeat_timeout').catch(error => {
            this.logger.error('Failed to auto-restart agent', { _agentId, error });
          });
        }
      }
    }
  }
  // === UTILITY METHODS ===
  private async spawnAgentProcess(agent: AgentState): Promise<ChildProcess> {
    const _env: NodeJS.ProcessEnv = {
      ...process.env,
      AGENT_ID: agent.id.id,
      AGENT_TYPE: agent.type,
      AGENT_NAME: agent.name,
      WORKING_DIR: agent.environment.workingDirectory,
      LOG_DIR: agent.environment.logDirectory
    };
    const _args = [
      'run',
      '--allow-all',
      agent.environment.availableTools[0] || './agents/generic-agent.ts',
      '--config',
      JSON.stringify(agent.config)
    ];
    const _childProcess = spawn(agent.environment._runtime, _args, {
      _env,
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: agent.environment.workingDirectory
    });
    // Handle process events
    childProcess.on('exit', (code: number | null) => {
      this.handleProcessExit(agent.id._id, code);
    });
    childProcess.on('error', (error: Error) => {
      this.handleProcessError(agent.id._id, error);
    });
    return childProcess;
  }
  private async waitForAgentReady(agentId: _string, timeout: number): Promise<void> {
    return new Promise((_resolve, reject) => {
      const _timer = setTimeout(() => {
        reject(new Error(`Agent ${agentId} startup timeout`));
      }, timeout);
      const _handler = (data: unknown) => {
        const _readyData = data as { agentId: string };
        if (readyData.agentId === agentId) {
          clearTimeout(timer);
          this.eventBus.off('agent:ready', handler);
          resolve();
        }
      };
      this.eventBus.on('agent:ready', handler);
    });
  }
  private async waitForProcessExit(agentId: _string, timeout: number): Promise<void> {
    return new Promise((resolve) => {
      const _process = this.processes.get(agentId);
      if (!process || process.killed) {
        resolve();
        return;
      }
      const _timer = setTimeout(() => {
        resolve(); // Timeout, continue anyway
      }, timeout);
      process.on('exit', () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }
  private handleProcessExit(agentId: _string, code: number | null): void {
    const _agent = this.agents.get(agentId);
    if (!agent) return;
    this.logger.info('Agent process exited', { _agentId, exitCode: code });
    if (code !== 0 && code !== null) {
      this.addAgentError(_agentId, {
        timestamp: new Date(),
        type: 'process_exit',
        message: `Agent process exited with code ${code}`,
        context: { exitCode: code },
        severity: 'high',
        resolved: false
      });
    }
    agent.status = 'offline';
    this.emit('agent:process-exit', { _agentId, exitCode: code });
  }
  private handleProcessError(agentId: _string, _error: Error): void {
    this.logger.error('Agent process error', { _agentId, error });
    
    this.addAgentError(_agentId, {
      timestamp: new Date(),
      type: 'process_error',
      message: (error instanceof Error ? error.message : String(error)),
      context: { error: error.toString() },
      severity: 'critical',
      resolved: false
    });
    this.emit('agent:process-error', { _agentId, error });
  }
  private handleHeartbeat(data: { agentId: string; timestamp: Date; metrics?: AgentMetrics }): void {
    const _agent = this.agents.get(data.agentId);
    if (!agent) return;
    agent.lastHeartbeat = data.timestamp;
    
    if (data.metrics) {
      this.updateAgentMetrics(data._agentId, data.metrics);
    }
    // Update health if agent was previously unresponsive
    if (agent.status === 'error') {
      agent.status = 'idle';
      this.updateAgentStatus(data._agentId, 'idle');
    }
  }
  private handleAgentError(data: { agentId: string; error: AgentError }): void {
    this.addAgentError(data._agentId, data.error);
    
    const _agent = this.agents.get(data.agentId);
    if (agent && data.error.severity === 'critical') {
      agent.status = 'error';
      this.updateAgentStatus(data._agentId, 'error');
    }
  }
  private updateAgentStatus(agentId: _string, status: AgentStatus): void {
    const _agent = this.agents.get(agentId);
    if (!agent) return;
    const _oldStatus = agent.status;
    agent.status = status;
    this.emit('agent:status-changed', { _agentId, from: _oldStatus, to: status });
  }
  private updateAgentWorkload(agentId: _string, delta: number): void {
    const _agent = this.agents.get(agentId);
    if (!agent) return;
    agent.workload = Math.max(_0, agent.workload + delta);
  }
  private updateAgentMetrics(agentId: _string, metrics: AgentMetrics): void {
    const _agent = this.agents.get(agentId);
    if (!agent) return;
    agent.metrics = { ...agent.metrics, ...metrics };
    // Store performance history
    const _history = this.performanceHistory.get(agentId) || [];
    history.push({ timestamp: new Date(), metrics: { ...metrics } });
    
    // Keep only last 100 entries
    if (history.length > 100) {
      history.shift();
    }
    
    this.performanceHistory.set(_agentId, history);
  }
  private updateResourceUsage(agentId: _string, usage: { cpu: number; memory: number; disk: number }): void {
    this.resourceUsage.set(_agentId, usage);
  }
  private addAgentError(agentId: _string, _error: AgentError): void {
    const _agent = this.agents.get(agentId);
    if (!agent) return;
    agent.errorHistory.push(error);
    // Keep only last 50 errors
    if (agent.errorHistory.length > 50) {
      agent.errorHistory.shift();
    }
  }
  private createDefaultMetrics(): AgentMetrics {
    return {
      tasksCompleted: 0,
      tasksFailed: 0,
      averageExecutionTime: 0,
      successRate: 1.0,
      cpuUsage: 0,
      memoryUsage: 0,
      diskUsage: 0,
      networkUsage: 0,
      codeQuality: 0.8,
      testCoverage: 0,
      bugRate: 0,
      userSatisfaction: 0.8,
      totalUptime: 0,
      lastActivity: new Date(),
      responseTime: 0
    };
  }
  private createDefaultHealth(agentId: string): AgentHealth {
    return {
      agentId,
      overall: 1.0,
      components: {
        responsiveness: 1.0,
        performance: 1.0,
        reliability: 1.0,
        resourceUsage: 1.0
      },
      issues: [],
      lastCheck: new Date(),
      trend: 'stable'
    };
  }
  private removeAgentFromPoolsAndClusters(agentId: string): void {
    // Remove from pools
    for (const pool of Array.from(this.pools.values())) {
      pool.availableAgents = pool.availableAgents.filter(a => a.id !== agentId);
      pool.busyAgents = pool.busyAgents.filter(a => a.id !== agentId);
      pool.currentSize = pool.availableAgents.length + pool.busyAgents.length;
    }
    // Remove from clusters
    for (const cluster of Array.from(this.clusters.values())) {
      cluster.agents = cluster.agents.filter(a => a.id !== agentId);
    }
  }
  private initializeScalingPolicies(): void {
    // Default auto-scaling policy
    const _defaultPolicy: ScalingPolicy = {
      name: 'default-autoscale',
      enabled: true,
      cooldownPeriod: 300000, // 5 minutes
      maxScaleOperations: 10,
      rules: [
        {
          metric: 'pool-utilization',
          threshold: 0.8,
          comparison: 'gt',
          action: 'scale-up',
          amount: 1
        },
        {
          metric: 'pool-utilization',
          threshold: 0.3,
          comparison: 'lt',
          action: 'scale-down',
          amount: 1
        }
      ]
    };
    this.scalingPolicies.set('default', defaultPolicy);
  }
  // === PUBLIC API ===
  getAgent(agentId: string): AgentState | undefined {
    return this.agents.get(agentId);
  }
  getAllAgents(): AgentState[] {
    return Array.from(this.agents.values());
  }
  getAgentsByType(type: AgentType): AgentState[] {
    return Array.from(this.agents.values()).filter(agent => agent.type === type);
  }
  getAgentsByStatus(status: AgentStatus): AgentState[] {
    return Array.from(this.agents.values()).filter(agent => agent.status === status);
  }
  getAgentHealth(agentId: string): AgentHealth | undefined {
    return this.healthChecks.get(agentId);
  }
  getPool(poolId: string): AgentPool | undefined {
    return this.pools.get(poolId);
  }
  getAllPools(): AgentPool[] {
    return Array.from(this.pools.values());
  }
  getAgentTemplates(): AgentTemplate[] {
    return Array.from(this.templates.values());
  }
  getSystemStats(): {
    totalAgents: number;
    activeAgents: number;
    healthyAgents: number;
    pools: number;
    clusters: number;
    averageHealth: number;
    resourceUtilization: { cpu: number; memory: number; disk: number };
  } {
    const _agents = Array.from(this.agents.values());
    const _healthChecks = Array.from(this.healthChecks.values());
    
    const _healthyAgents = healthChecks.filter(h => h.overall > 0.7).length;
    const _averageHealth = healthChecks.reduce((_sum, h) => sum + h.overall, 0) / healthChecks.length || 1;
    
    const _resourceUsages = Array.from(this.resourceUsage.values());
    const _avgCpu = resourceUsages.reduce((_sum, r) => sum + r.cpu, 0) / resourceUsages.length || 0;
    const _avgMemory = resourceUsages.reduce((_sum, r) => sum + r.memory, 0) / resourceUsages.length || 0;
    const _avgDisk = resourceUsages.reduce((_sum, r) => sum + r.disk, 0) / resourceUsages.length || 0;
    return {
      totalAgents: agents.length,
      activeAgents: agents.filter(a => a.status === 'idle' || a.status === 'busy').length,
      healthyAgents,
      pools: this.pools.size,
      clusters: this.clusters.size,
      averageHealth,
      resourceUtilization: {
        cpu: avgCpu,
        memory: avgMemory,
        disk: avgDisk
      }
    };
  }
}