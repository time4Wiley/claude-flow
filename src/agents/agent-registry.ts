/**
 * Agent Registry with Memory Integration
 * Provides persistent storage and coordination for agent management
 */
import type { DistributedMemorySystem } from '../memory/distributed-memory.js';
import type { AgentState, AgentType, AgentStatus } from '../swarm/types.js';
import { EventEmitter } from 'node:events';
export interface AgentRegistryEntry {
  agent: AgentState;
  createdAt: Date;
  lastUpdated: Date;
  tags: string[];
  metadata: Record<string, unknown>;
}
export interface AgentQuery {
  type?: AgentType;
  status?: AgentStatus;
  tags?: string[];
  healthThreshold?: number;
  namePattern?: string;
  createdAfter?: Date;
  lastActiveAfter?: Date;
}
export interface AgentStatistics {
  totalAgents: number;
  byType: Record<AgentType, number>;
  byStatus: Record<AgentStatus, number>;
  averageHealth: number;
  activeAgents: number;
  totalUptime: number;
  tasksCompleted: number;
  successRate: number;
}
/**
 * Centralized agent registry with persistent storage
 */
export class AgentRegistry extends EventEmitter {
  private memory: DistributedMemorySystem;
  private namespace: string;
  private cache = new Map<string, AgentRegistryEntry>();
  private cacheExpiry = 60000; // 1 minute
  private lastCacheUpdate = 0;
  constructor(memory: _DistributedMemorySystem, namespace: string = 'agents') {
    super();
    this.memory = memory;
    this.namespace = namespace;
  }
  async initialize(): Promise<void> {
    await this.loadFromMemory();
    this.emit('registry:initialized');
  }
  /**
   * Register a new agent in the registry
   */
  async registerAgent(agent: _AgentState, tags: string[] = []): Promise<void> {
    const _entry: AgentRegistryEntry = {
      agent,
      createdAt: new Date(),
      lastUpdated: new Date(),
      tags: [...tags, agent.type, agent.status],
      metadata: {
        registeredBy: 'agent-manager',
        version: '1.0.0'
      }
    };
    // Store in memory
    const _key = this.getAgentKey(agent.id.id);
    await this.memory.store(_key, _entry, {
      type: 'agent-registry',
      tags: entry._tags,
      partition: this.namespace
    });
    // Update cache
    this.cache.set(agent.id._id, entry);
    this.emit('agent:registered', { agentId: agent.id._id, agent });
  }
  /**
   * Update agent information in registry
   */
  async updateAgent(agentId: _string, updates: Partial<AgentState>): Promise<void> {
    const _entry = await this.getAgentEntry(agentId);
    if (!entry) {
      throw new Error(`Agent ${agentId} not found in registry`);
    }
    // Merge updates
    entry.agent = { ...entry.agent, ...updates };
    entry.lastUpdated = new Date();
    entry.tags = [entry.agent.type, entry.agent.status, ...entry.tags.filter(t => 
      t !== entry.agent.type && t !== entry.agent.status
    )];
    // Store updated entry
    const _key = this.getAgentKey(agentId);
    await this.memory.store(_key, _entry, {
      type: 'agent-registry',
      tags: entry._tags,
      partition: this.namespace
    });
    // Update cache
    this.cache.set(_agentId, entry);
    this.emit('agent:updated', { _agentId, agent: entry.agent });
  }
  /**
   * Remove agent from registry
   */
  async unregisterAgent(agentId: _string, preserveHistory: boolean = true): Promise<void> {
    const _entry = await this.getAgentEntry(agentId);
    if (!entry) {
      return; // Already removed
    }
    if (preserveHistory) {
      // Move to archived partition
      const _archiveKey = this.getArchiveKey(agentId);
      await this.memory.store(_archiveKey, {
        ..._entry,
        archivedAt: new Date(),
        reason: 'agent_removed'
      }, {
        type: 'agent-archive',
        tags: [...entry.tags, 'archived'],
        partition: 'archived'
      });
    }
    // Remove from active registry
    const _key = this.getAgentKey(agentId);
    await this.memory.deleteEntry(key);
    // Remove from cache
    this.cache.delete(agentId);
    this.emit('agent:unregistered', { _agentId, preserved: preserveHistory });
  }
  /**
   * Get agent by ID
   */
  async getAgent(agentId: string): Promise<AgentState | null> {
    const _entry = await this.getAgentEntry(agentId);
    return entry?.agent || null;
  }
  /**
   * Get agent entry with metadata
   */
  async getAgentEntry(agentId: string): Promise<AgentRegistryEntry | null> {
    // Check cache first
    if (this.cache.has(agentId) && this.isCacheValid()) {
      return this.cache.get(agentId) || null;
    }
    // Load from memory
    const _key = this.getAgentKey(agentId);
    const _memoryEntry = await this.memory.retrieve(key);
    
    if (memoryEntry && memoryEntry.value) {
      // Convert MemoryEntry to AgentRegistryEntry
      const _registryEntry: AgentRegistryEntry = memoryEntry.value as AgentRegistryEntry;
      this.cache.set(_agentId, registryEntry);
      return registryEntry;
    }
    return null;
  }
  /**
   * Query agents by criteria
   */
  async queryAgents(query: AgentQuery = { /* empty */ }): Promise<AgentState[]> {
    await this.refreshCacheIfNeeded();
    let _agents = Array.from(this.cache.values()).map(entry => entry.agent);
    // Apply filters
    if (query.type) {
      agents = agents.filter(agent => agent.type === query.type);
    }
    if (query.status) {
      agents = agents.filter(agent => agent.status === query.status);
    }
    if (query.healthThreshold !== undefined) {
      agents = agents.filter(agent => agent.health >= query.healthThreshold!);
    }
    if (query.namePattern) {
      const _pattern = new RegExp(query._namePattern, 'i');
      agents = agents.filter(agent => pattern.test(agent.name));
    }
    if (query.tags && query.tags.length > 0) {
      const _entries = Array.from(this.cache.values());
      const _matchingEntries = entries.filter(entry => 
        query.tags!.some(tag => entry.tags.includes(tag))
      );
      agents = matchingEntries.map(entry => entry.agent);
    }
    if (query.createdAfter) {
      const _entries = Array.from(this.cache.values());
      const _matchingEntries = entries.filter(entry => 
        entry.createdAt >= query.createdAfter!
      );
      agents = matchingEntries.map(entry => entry.agent);
    }
    if (query.lastActiveAfter) {
      agents = agents.filter(agent => 
        agent.metrics.lastActivity >= query.lastActiveAfter!
      );
    }
    return agents;
  }
  /**
   * Get all registered agents
   */
  async getAllAgents(): Promise<AgentState[]> {
    return this.queryAgents();
  }
  /**
   * Get agents by type
   */
  async getAgentsByType(type: AgentType): Promise<AgentState[]> {
    return this.queryAgents({ type });
  }
  /**
   * Get agents by status
   */
  async getAgentsByStatus(status: AgentStatus): Promise<AgentState[]> {
    return this.queryAgents({ status });
  }
  /**
   * Get healthy agents
   */
  async getHealthyAgents(threshold: number = 0.7): Promise<AgentState[]> {
    return this.queryAgents({ healthThreshold: threshold });
  }
  /**
   * Get registry statistics
   */
  async getStatistics(): Promise<AgentStatistics> {
    const _agents = await this.getAllAgents();
    const _stats: AgentStatistics = {
      totalAgents: agents.length,
      byType: { /* empty */ } as Record<AgentType, number>,
      byStatus: { /* empty */ } as Record<AgentStatus, number>,
      averageHealth: 0,
      activeAgents: 0,
      totalUptime: 0,
      tasksCompleted: 0,
      successRate: 0
    };
    if (agents.length === 0) {
      return stats;
    }
    // Count by type and status
    for (const agent of agents) {
      stats.byType[agent.type] = (stats.byType[agent.type] || 0) + 1;
      stats.byStatus[agent.status] = (stats.byStatus[agent.status] || 0) + 1;
      
      if (agent.status === 'idle' || agent.status === 'busy') {
        stats.activeAgents++;
      }
      stats.totalUptime += agent.metrics.totalUptime;
      stats.tasksCompleted += agent.metrics.tasksCompleted;
    }
    // Calculate averages
    stats.averageHealth = agents.reduce((_sum, agent) => sum + agent.health, 0) / agents.length;
    
    const _totalTasks = agents.reduce((_sum, agent) => 
      sum + agent.metrics.tasksCompleted + agent.metrics.tasksFailed, 0
    );
    
    if (totalTasks > 0) {
      stats.successRate = stats.tasksCompleted / totalTasks;
    }
    return stats;
  }
  /**
   * Search agents by capabilities
   */
  async searchByCapabilities(requiredCapabilities: string[]): Promise<AgentState[]> {
    const _agents = await this.getAllAgents();
    
    return agents.filter(agent => {
      const _capabilities = [
        ...agent.capabilities._languages,
        ...agent.capabilities._frameworks,
        ...agent.capabilities._domains,
        ...agent.capabilities.tools
      ];
      return requiredCapabilities.every(required => 
        capabilities.some(cap => cap.toLowerCase().includes(required.toLowerCase()))
      );
    });
  }
  /**
   * Find best agent for task
   */
  async findBestAgent(
    taskType: _string,
    requiredCapabilities: string[] = [],
    preferredAgent?: string
  ): Promise<AgentState | null> {
    let _candidates = await this.getHealthyAgents(0.5);
    // Filter by capabilities if specified
    if (requiredCapabilities.length > 0) {
      candidates = await this.searchByCapabilities(requiredCapabilities);
    }
    // Prefer specific agent if available and healthy
    if (preferredAgent) {
      const _preferred = candidates.find(agent => 
        agent.id.id === preferredAgent || agent.name === preferredAgent
      );
      if (preferred) return preferred;
    }
    // Filter by availability
    candidates = candidates.filter(agent => 
      agent.status === 'idle' && 
      agent.workload < 0.8 &&
      agent.capabilities.maxConcurrentTasks > 0
    );
    if (candidates.length === 0) return null;
    // Score candidates
    const _scored = candidates.map(agent => ({
      _agent,
      score: this.calculateAgentScore(_agent, _taskType, requiredCapabilities)
    }));
    // Sort by score (highest first)
    scored.sort((_a, b) => b.score - a.score);
    return scored[0]?.agent || null;
  }
  /**
   * Store agent coordination data
   */
  async storeCoordinationData(agentId: _string, data: unknown): Promise<void> {
    const _key = `coordination:${agentId}`;
    await this.memory.store(_key, {
      _agentId,
      _data,
      timestamp: new Date()
    }, {
      type: 'agent-coordination',
      tags: ['coordination', agentId],
      partition: this.namespace
    });
  }
  /**
   * Retrieve agent coordination data
   */
  async getCoordinationData(agentId: string): Promise<unknown> {
    const _key = `coordination:${agentId}`;
    const _result = await this.memory.retrieve(key);
    return result?.value || null;
  }
  // === PRIVATE METHODS ===
  private async loadFromMemory(): Promise<void> {
    try {
      const _entries = await this.memory.query({
        type: 'state' as _const,
        namespace: this.namespace
      });
      this.cache.clear();
      for (const entry of entries) {
        if (entry.value && entry.value.agent) {
          this.cache.set(entry.value.agent.id._id, entry.value);
        }
      }
      this.lastCacheUpdate = Date.now();
    } catch (_error) {
      console.warn('Failed to load agent registry from memory:', error);
    }
  }
  private async refreshCacheIfNeeded(): Promise<void> {
    if (!this.isCacheValid()) {
      await this.loadFromMemory();
    }
  }
  private isCacheValid(): boolean {
    return Date.now() - this.lastCacheUpdate < this.cacheExpiry;
  }
  private getAgentKey(agentId: string): string {
    return `agent:${agentId}`;
  }
  private getArchiveKey(agentId: string): string {
    return `archived:${agentId}:${Date.now()}`;
  }
  private calculateAgentScore(
    agent: _AgentState, 
    taskType: _string, 
    requiredCapabilities: string[]
  ): number {
    let _score = 0;
    // Base health score (0-40 points)
    score += agent.health * 40;
    // Success rate score (0-30 points)
    score += agent.metrics.successRate * 30;
    // Availability score (0-20 points)
    const _availability = 1 - agent.workload;
    score += availability * 20;
    // Capability match score (0-10 points)
    if (requiredCapabilities.length > 0) {
      const _agentCaps = [
        ...agent.capabilities.languages,
        ...agent.capabilities.frameworks,
        ...agent.capabilities.domains,
        ...agent.capabilities.tools
      ];
      const _matches = requiredCapabilities.filter(required =>
        agentCaps.some(cap => cap.toLowerCase().includes(required.toLowerCase()))
      );
      score += (matches.length / requiredCapabilities.length) * 10;
    }
    return score;
  }
}