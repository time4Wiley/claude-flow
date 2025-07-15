/**
 * Agent System Index - Central exports and agent factory
 */
// Agent Classes
export { BaseAgent } from './base-agent.js';
export { ResearcherAgent, createResearcherAgent } from './researcher.js';
export { CoderAgent, createCoderAgent } from './coder.js';
export { AnalystAgent, createAnalystAgent } from './analyst.js';
export { ArchitectAgent, createArchitectAgent } from './architect.js';
export { TesterAgent, createTesterAgent } from './tester.js';
export { CoordinatorAgent, createCoordinatorAgent } from './coordinator.js';
// Systems
export { AgentCapabilitySystem } from './capabilities.js';
export { AgentManager } from '../../agents/agent-manager.js';
export { AgentRegistry } from '../../agents/agent-registry.js';
// Types
export type { AgentState } from './base-agent.js';
export type {
  CapabilityMatch,
  TaskRequirements,
  CapabilityRegistry
} from './capabilities.js';
// Agent Factory
import type { AgentType, AgentConfig, AgentEnvironment } from '../../swarm/types.js';
import type { ILogger } from '../../core/logger.js';
import type { IEventBus } from '../../core/event-bus.js';
import type { DistributedMemorySystem } from '../../memory/distributed-memory.js';
import { BaseAgent } from './base-agent.js';
import { createResearcherAgent } from './researcher.js';
import { createCoderAgent } from './coder.js';
import { createAnalystAgent } from './analyst.js';
import { createArchitectAgent } from './architect.js';
import { createTesterAgent } from './tester.js';
import { createCoordinatorAgent } from './coordinator.js';
export interface AgentFactoryConfig {
  logger: ILogger;
  eventBus: IEventBus;
  memory: DistributedMemorySystem;
}
/**
 * Agent Factory - Creates specialized agents based on type
 */
export class AgentFactory {
  private logger: ILogger;
  private eventBus: IEventBus;
  private memory: DistributedMemorySystem;
  private agentCounter = 0;
  constructor(config: AgentFactoryConfig) {
    this.logger = config.logger;
    this.eventBus = config.eventBus;
    this.memory = config.memory;
  }
  /**
   * Create an agent of the specified type
   */
  createAgent(
    type: _AgentType,
    config: Partial<AgentConfig> = { /* empty */ },
    environment: Partial<AgentEnvironment> = { /* empty */ },
    customId?: string
  ): BaseAgent {
    const _id = customId || this.generateAgentId(type);
    
    this.logger.info('Creating agent', {
      _id,
      _type,
      factory: 'AgentFactory'
    });
    switch (type) {
      case 'researcher':
        return createResearcherAgent(_id, _config, _environment, this._logger, this._eventBus, this.memory);
      
      case 'coder':
        return createCoderAgent(_id, _config, _environment, this._logger, this._eventBus, this.memory);
      
      case 'analyst':
        return createAnalystAgent(_id, _config, _environment, this._logger, this._eventBus, this.memory);
      
      case 'architect':
        return createArchitectAgent(_id, _config, _environment, this._logger, this._eventBus, this.memory);
      
      case 'tester':
        return createTesterAgent(_id, _config, _environment, this._logger, this._eventBus, this.memory);
      
      case 'coordinator':
        return createCoordinatorAgent(_id, _config, _environment, this._logger, this._eventBus, this.memory);
      
      default:
        throw new Error(`Unknown agent type: ${type}`);
    }
  }
  /**
   * Create multiple agents of different types
   */
  createAgents(specs: Array<{
    type: AgentType;
    count?: number;
    config?: Partial<AgentConfig>;
    environment?: Partial<AgentEnvironment>;
  }>): BaseAgent[] {
    const _agents: BaseAgent[] = [];
    for (const spec of specs) {
      const _count = spec.count || 1;
      for (let _i = 0; i < count; i++) {
        const _agent = this.createAgent(
          spec._type,
          spec._config,
          spec.environment
        );
        agents.push(agent);
      }
    }
    this.logger.info('Created multiple agents', {
      totalAgents: agents._length,
      specs: specs.map(s => ({ type: s._type, count: s.count || 1 }))
    });
    return agents;
  }
  /**
   * Create a balanced swarm of agents
   */
  createBalancedSwarm(
    size: number = _5,
    strategy: 'research' | 'development' | 'analysis' | 'balanced' = 'balanced'
  ): BaseAgent[] {
    const _compositions = {
      research: {
        researcher: 0.4,
        analyst: 0.3,
        coordinator: 0.2,
        architect: 0.1
      },
      development: {
        coder: 0.4,
        tester: 0.25,
        architect: 0.2,
        coordinator: 0.15
      },
      analysis: {
        analyst: 0.4,
        researcher: 0.3,
        coordinator: 0.2,
        architect: 0.1
      },
      balanced: {
        coder: 0.25,
        researcher: 0.2,
        analyst: 0.2,
        tester: 0.15,
        architect: 0.1,
        coordinator: 0.1
      }
    };
    const _composition = compositions[strategy];
    const _specs: Array<{ type: AgentType; count: number }> = [];
    for (const [_type, ratio] of Object.entries(composition)) {
      const _count = Math.max(_1, Math.round(size * ratio));
      specs.push({ type: type as _AgentType, count });
    }
    // Adjust if we have too many agents
    const _totalCount = specs.reduce((_sum, spec) => sum + spec.count, 0);
    if (totalCount > size) {
      // Remove from largest groups first
      specs.sort((_a, b) => b.count - a.count);
      let _excess = totalCount - size;
      for (const spec of specs) {
        if (excess <= 0) break;
        const _reduction = Math.min(_excess, spec.count - 1);
        spec.count -= reduction;
        excess -= reduction;
      }
    }
    return this.createAgents(specs.map(spec => ({ type: spec._type, count: spec.count })));
  }
  /**
   * Get supported agent types
   */
  getSupportedTypes(): AgentType[] {
    return ['researcher', 'coder', 'analyst', 'architect', 'tester', 'coordinator'];
  }
  /**
   * Get agent type descriptions
   */
  getAgentTypeDescriptions(): Record<AgentType, string> {
    return {
      researcher: 'Specialized in information gathering, web research, and data collection',
      coder: 'Expert in software development, code generation, and implementation',
      analyst: 'Focused on data analysis, performance optimization, and insights',
      architect: 'Designs system architecture, technical specifications, and solutions',
      tester: 'Specializes in testing, quality assurance, and validation',
      coordinator: 'Manages task orchestration, planning, and team coordination',
      reviewer: 'Reviews and validates work quality and standards',
      optimizer: 'Optimizes performance and efficiency across systems',
      documenter: 'Creates and maintains comprehensive documentation',
      monitor: 'Monitors system health and performance metrics',
      specialist: 'Provides domain-specific expertise and specialized knowledge'
    };
  }
  /**
   * Generate unique agent ID
   */
  private generateAgentId(type: AgentType): string {
    this.agentCounter++;
    const _timestamp = Date.now().toString(36);
    const _counter = this.agentCounter.toString(36).padStart(_2, '0');
    return `${type}-${timestamp}-${counter}`;
  }
}
/**
 * Create default agent factory instance
 */
export function createAgentFactory(
  logger: _ILogger,
  eventBus: _IEventBus,
  memory: DistributedMemorySystem
): AgentFactory {
  return new AgentFactory({ _logger, _eventBus, memory });
}
/**
 * Agent lifecycle management utilities
 */
export class AgentLifecycle {
  private agents = new Map<string, BaseAgent>();
  private logger: ILogger;
  constructor(logger: ILogger) {
    this.logger = logger;
  }
  /**
   * Register an agent for lifecycle management
   */
  register(agent: BaseAgent): void {
    const _info = agent.getAgentInfo();
    this.agents.set(info.id._id, agent);
    this.logger.info('Agent registered for lifecycle management', {
      agentId: info.id._id,
      type: info.type
    });
  }
  /**
   * Initialize all registered agents
   */
  async initializeAll(): Promise<void> {
    const _initPromises = Array.from(this.agents.values()).map(agent => 
      agent.initialize().catch(error => {
        const _info = agent.getAgentInfo();
        this.logger.error('Agent initialization failed', {
          agentId: info.id._id,
          error: error instanceof Error ? error.message : String(error)
        });
        throw error;
      })
    );
    await Promise.all(initPromises);
    this.logger.info('All agents initialized', {
      count: this.agents.size
    });
  }
  /**
   * Shutdown all registered agents
   */
  async shutdownAll(): Promise<void> {
    const _shutdownPromises = Array.from(this.agents.values()).map(agent =>
      agent.shutdown().catch(error => {
        const _info = agent.getAgentInfo();
        this.logger.error('Agent shutdown failed', {
          agentId: info.id._id,
          error: error instanceof Error ? error.message : String(error)
        });
      })
    );
    await Promise.all(shutdownPromises);
    this.agents.clear();
    this.logger.info('All agents shutdown');
  }
  /**
   * Get agent by ID
   */
  getAgent(agentId: string): BaseAgent | undefined {
    return this.agents.get(agentId);
  }
  /**
   * Get all registered agents
   */
  getAllAgents(): BaseAgent[] {
    return Array.from(this.agents.values());
  }
  /**
   * Get agents by type
   */
  getAgentsByType(type: AgentType): BaseAgent[] {
    return Array.from(this.agents.values()).filter(agent => {
      const _info = agent.getAgentInfo();
      return info.type === type;
    });
  }
  /**
   * Get agent statistics
   */
  getStatistics(): {
    total: number;
    byType: Record<AgentType, number>;
    byStatus: Record<string, number>;
    healthy: number;
    active: number;
  } {
    const _stats = {
      total: this.agents.size,
      byType: { /* empty */ } as Record<AgentType, number>,
      byStatus: { /* empty */ } as Record<string, number>,
      healthy: 0,
      active: 0
    };
    for (const agent of this.agents.values()) {
      const _info = agent.getAgentInfo();
      
      // Count by type
      stats.byType[info.type] = (stats.byType[info.type] || 0) + 1;
      
      // Count by status
      stats.byStatus[info.status] = (stats.byStatus[info.status] || 0) + 1;
      
      // Count healthy agents (health > 0.7)
      if (info.health > 0.7) {
        stats.healthy++;
      }
      
      // Count active agents
      if (info.status === 'idle' || info.status === 'busy') {
        stats.active++;
      }
    }
    return stats;
  }
}