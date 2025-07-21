/**
 * Distributed Agent Registry with Consensus
 * 
 * Implements a distributed registry for agent discovery and management
 * using Raft consensus algorithm for consistency across regions
 */

import { EventEmitter } from 'events';
import { Raft, RaftNode } from '@raft/core';
import * as etcd3 from 'etcd3';
import { ConsulService } from 'consul';
import { Redis } from 'ioredis';
import { v4 as uuidv4 } from 'uuid';

export interface AgentRegistration {
  id: string;
  namespace: string;
  type: string;
  capabilities: string[];
  endpoint: string;
  region: string;
  zone: string;
  metadata: Record<string, any>;
  health: AgentHealth;
  registeredAt: Date;
  lastHeartbeat: Date;
  version: string;
}

export interface AgentHealth {
  status: 'healthy' | 'unhealthy' | 'degraded' | 'unknown';
  lastCheck: Date;
  checks: HealthCheck[];
}

export interface HealthCheck {
  name: string;
  status: 'passing' | 'warning' | 'critical';
  message?: string;
  lastUpdated: Date;
}

export interface RegistryConfig {
  nodeId: string;
  peers: string[];
  etcdEndpoints: string[];
  consulEndpoints: string[];
  redisCluster: string[];
  region: string;
  zone: string;
  replicationFactor: number;
}

export class DistributedAgentRegistry extends EventEmitter {
  private raft: Raft;
  private etcd: etcd3.Etcd3;
  private consul: ConsulService;
  private redis: Redis.Cluster;
  private agents: Map<string, AgentRegistration> = new Map();
  private healthCheckInterval: NodeJS.Timer;
  private syncInterval: NodeJS.Timer;

  constructor(private config: RegistryConfig) {
    super();
    this.initializeBackends();
    this.setupConsensus();
    this.startHealthChecking();
    this.startSynchronization();
  }

  /**
   * Initialize storage backends
   */
  private initializeBackends(): void {
    // Initialize etcd for consistent key-value storage
    this.etcd = new etcd3.Etcd3({
      hosts: this.config.etcdEndpoints,
      auth: {
        username: process.env.ETCD_USERNAME,
        password: process.env.ETCD_PASSWORD
      }
    });

    // Initialize Consul for service discovery
    this.consul = new ConsulService({
      host: this.config.consulEndpoints[0].split(':')[0],
      port: this.config.consulEndpoints[0].split(':')[1],
      secure: true
    });

    // Initialize Redis cluster for caching
    this.redis = new Redis.Cluster(
      this.config.redisCluster.map(endpoint => {
        const [host, port] = endpoint.split(':');
        return { host, port: parseInt(port) };
      }),
      {
        enableReadyCheck: true,
        maxRetriesPerRequest: 3,
        retryDelayOnFailover: 100,
        slotsRefreshTimeout: 2000
      }
    );
  }

  /**
   * Setup Raft consensus
   */
  private setupConsensus(): void {
    const raftNode: RaftNode = {
      id: this.config.nodeId,
      address: `${this.config.nodeId}.registry.agentic-flow.cluster.local:7000`
    };

    const peers = this.config.peers.map(peerId => ({
      id: peerId,
      address: `${peerId}.registry.agentic-flow.cluster.local:7000`
    }));

    this.raft = new Raft({
      node: raftNode,
      peers,
      electionTimeout: [150, 300],
      heartbeatInterval: 50,
      snapshotInterval: 30000,
      logDir: '/data/raft/logs',
      stateDir: '/data/raft/state'
    });

    // Handle Raft events
    this.raft.on('leader', () => {
      this.emit('consensus:leader', { nodeId: this.config.nodeId });
      this.performLeaderDuties();
    });

    this.raft.on('follower', () => {
      this.emit('consensus:follower', { nodeId: this.config.nodeId });
    });

    this.raft.on('candidate', () => {
      this.emit('consensus:candidate', { nodeId: this.config.nodeId });
    });

    // Apply state machine commands
    this.raft.on('apply', (entry: any) => {
      this.applyRegistryCommand(entry);
    });

    this.raft.start();
  }

  /**
   * Register a new agent
   */
  public async registerAgent(registration: Omit<AgentRegistration, 'registeredAt' | 'lastHeartbeat'>): Promise<string> {
    const agentId = registration.id || uuidv4();
    const fullRegistration: AgentRegistration = {
      ...registration,
      id: agentId,
      registeredAt: new Date(),
      lastHeartbeat: new Date()
    };

    // Propose to Raft for consensus
    const command = {
      type: 'REGISTER_AGENT',
      data: fullRegistration
    };

    await this.raft.propose(command);

    // Cache in Redis for fast lookups
    await this.cacheAgent(fullRegistration);

    // Register with Consul for service discovery
    await this.registerWithConsul(fullRegistration);

    // Store in etcd for persistence
    await this.storeInEtcd(fullRegistration);

    this.emit('agent:registered', { agent: fullRegistration });
    return agentId;
  }

  /**
   * Deregister an agent
   */
  public async deregisterAgent(agentId: string): Promise<void> {
    const command = {
      type: 'DEREGISTER_AGENT',
      data: { agentId }
    };

    await this.raft.propose(command);

    // Remove from all backends
    await Promise.all([
      this.removeFromCache(agentId),
      this.deregisterFromConsul(agentId),
      this.removeFromEtcd(agentId)
    ]);

    this.emit('agent:deregistered', { agentId });
  }

  /**
   * Update agent health status
   */
  public async updateAgentHealth(agentId: string, health: AgentHealth): Promise<void> {
    const agent = await this.getAgent(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    const command = {
      type: 'UPDATE_AGENT_HEALTH',
      data: { agentId, health }
    };

    await this.raft.propose(command);

    // Update cache
    agent.health = health;
    agent.lastHeartbeat = new Date();
    await this.cacheAgent(agent);

    // Update Consul health check
    await this.updateConsulHealth(agentId, health);

    this.emit('agent:health_updated', { agentId, health });
  }

  /**
   * Get agent by ID
   */
  public async getAgent(agentId: string): Promise<AgentRegistration | null> {
    // Try cache first
    const cached = await this.redis.get(`agent:${agentId}`);
    if (cached) {
      return JSON.parse(cached);
    }

    // Fall back to etcd
    const stored = await this.etcd.get(`/agents/${agentId}`);
    if (stored) {
      const agent = JSON.parse(stored);
      await this.cacheAgent(agent);
      return agent;
    }

    return null;
  }

  /**
   * Find agents by capability
   */
  public async findAgentsByCapability(capability: string): Promise<AgentRegistration[]> {
    // Use Consul for capability-based discovery
    const services = await this.consul.health.service(capability, { passing: true });
    
    const agents: AgentRegistration[] = [];
    for (const service of services) {
      const agentId = service.Service.ID;
      const agent = await this.getAgent(agentId);
      if (agent && agent.capabilities.includes(capability)) {
        agents.push(agent);
      }
    }

    return agents;
  }

  /**
   * Find agents by region
   */
  public async findAgentsByRegion(region: string): Promise<AgentRegistration[]> {
    const pattern = `/agents/region/${region}/*`;
    const keys = await this.etcd.getAll().prefix(pattern).keys();
    
    const agents: AgentRegistration[] = [];
    for (const key of keys) {
      const agentId = key.split('/').pop();
      if (agentId) {
        const agent = await this.getAgent(agentId);
        if (agent) {
          agents.push(agent);
        }
      }
    }

    return agents;
  }

  /**
   * Get all healthy agents
   */
  public async getHealthyAgents(): Promise<AgentRegistration[]> {
    const allAgents = await this.getAllAgents();
    return allAgents.filter(agent => agent.health.status === 'healthy');
  }

  /**
   * Get registry statistics
   */
  public async getStatistics(): Promise<RegistryStatistics> {
    const allAgents = await this.getAllAgents();
    
    const stats: RegistryStatistics = {
      totalAgents: allAgents.length,
      healthyAgents: allAgents.filter(a => a.health.status === 'healthy').length,
      unhealthyAgents: allAgents.filter(a => a.health.status === 'unhealthy').length,
      degradedAgents: allAgents.filter(a => a.health.status === 'degraded').length,
      agentsByType: {},
      agentsByRegion: {},
      agentsByCapability: {},
      consensusState: this.raft.state,
      nodeId: this.config.nodeId,
      isLeader: this.raft.isLeader()
    };

    // Group by type
    allAgents.forEach(agent => {
      stats.agentsByType[agent.type] = (stats.agentsByType[agent.type] || 0) + 1;
      stats.agentsByRegion[agent.region] = (stats.agentsByRegion[agent.region] || 0) + 1;
      
      agent.capabilities.forEach(cap => {
        stats.agentsByCapability[cap] = (stats.agentsByCapability[cap] || 0) + 1;
      });
    });

    return stats;
  }

  /**
   * Private helper methods
   */
  
  private async getAllAgents(): Promise<AgentRegistration[]> {
    const agents: AgentRegistration[] = [];
    const keys = await this.etcd.getAll().prefix('/agents/').keys();
    
    for (const key of keys) {
      if (!key.includes('/region/') && !key.includes('/capability/')) {
        const value = await this.etcd.get(key);
        if (value) {
          agents.push(JSON.parse(value));
        }
      }
    }
    
    return agents;
  }

  private async cacheAgent(agent: AgentRegistration): Promise<void> {
    const key = `agent:${agent.id}`;
    const ttl = 300; // 5 minutes
    await this.redis.setex(key, ttl, JSON.stringify(agent));
  }

  private async removeFromCache(agentId: string): Promise<void> {
    await this.redis.del(`agent:${agentId}`);
  }

  private async registerWithConsul(agent: AgentRegistration): Promise<void> {
    const registration = {
      ID: agent.id,
      Name: agent.type,
      Tags: [
        ...agent.capabilities,
        `region:${agent.region}`,
        `zone:${agent.zone}`,
        `version:${agent.version}`
      ],
      Address: agent.endpoint.split(':')[0],
      Port: parseInt(agent.endpoint.split(':')[1]) || 80,
      Check: {
        HTTP: `http://${agent.endpoint}/health`,
        Interval: '10s',
        Timeout: '5s'
      }
    };

    await this.consul.agent.service.register(registration);
  }

  private async deregisterFromConsul(agentId: string): Promise<void> {
    await this.consul.agent.service.deregister(agentId);
  }

  private async updateConsulHealth(agentId: string, health: AgentHealth): Promise<void> {
    const status = health.status === 'healthy' ? 'passing' : 
                   health.status === 'degraded' ? 'warning' : 'critical';
    
    await this.consul.agent.check.update({
      id: `service:${agentId}`,
      status
    });
  }

  private async storeInEtcd(agent: AgentRegistration): Promise<void> {
    const promises = [
      // Store main agent record
      this.etcd.put(`/agents/${agent.id}`).value(JSON.stringify(agent)),
      
      // Store region index
      this.etcd.put(`/agents/region/${agent.region}/${agent.id}`).value(''),
      
      // Store capability indices
      ...agent.capabilities.map(cap => 
        this.etcd.put(`/agents/capability/${cap}/${agent.id}`).value('')
      )
    ];

    await Promise.all(promises);
  }

  private async removeFromEtcd(agentId: string): Promise<void> {
    const agent = await this.getAgent(agentId);
    if (!agent) return;

    const promises = [
      // Remove main record
      this.etcd.delete(`/agents/${agentId}`),
      
      // Remove region index
      this.etcd.delete(`/agents/region/${agent.region}/${agentId}`),
      
      // Remove capability indices
      ...agent.capabilities.map(cap => 
        this.etcd.delete(`/agents/capability/${cap}/${agentId}`)
      )
    ];

    await Promise.all(promises);
  }

  private applyRegistryCommand(entry: any): void {
    const { type, data } = entry;

    switch (type) {
      case 'REGISTER_AGENT':
        this.agents.set(data.id, data);
        break;
      case 'DEREGISTER_AGENT':
        this.agents.delete(data.agentId);
        break;
      case 'UPDATE_AGENT_HEALTH':
        const agent = this.agents.get(data.agentId);
        if (agent) {
          agent.health = data.health;
          agent.lastHeartbeat = new Date();
        }
        break;
    }
  }

  private performLeaderDuties(): void {
    // Leader-specific tasks
    this.startGarbageCollection();
    this.startHealthReconciliation();
    this.startCrossRegionSync();
  }

  private startHealthChecking(): void {
    this.healthCheckInterval = setInterval(async () => {
      const agents = await this.getAllAgents();
      
      for (const agent of agents) {
        const timeSinceHeartbeat = Date.now() - agent.lastHeartbeat.getTime();
        
        if (timeSinceHeartbeat > 60000) { // 1 minute
          await this.updateAgentHealth(agent.id, {
            status: 'unhealthy',
            lastCheck: new Date(),
            checks: [{
              name: 'heartbeat',
              status: 'critical',
              message: 'No heartbeat received',
              lastUpdated: new Date()
            }]
          });
        }
      }
    }, 30000); // Every 30 seconds
  }

  private startSynchronization(): void {
    this.syncInterval = setInterval(async () => {
      if (!this.raft.isLeader()) return;

      // Sync with other regions
      await this.syncWithPeerRegions();
    }, 60000); // Every minute
  }

  private async syncWithPeerRegions(): Promise<void> {
    // Implementation for cross-region synchronization
    this.emit('registry:sync:started');
    
    try {
      // Get peer region endpoints from configuration
      const peerRegions = await this.getPeerRegions();
      
      for (const region of peerRegions) {
        await this.syncWithRegion(region);
      }
      
      this.emit('registry:sync:completed');
    } catch (error) {
      this.emit('registry:sync:failed', { error });
    }
  }

  private async getPeerRegions(): Promise<string[]> {
    // Return configured peer regions
    return ['us-west-2', 'eu-west-1', 'ap-southeast-1'];
  }

  private async syncWithRegion(region: string): Promise<void> {
    // Implement region-specific sync logic
    // This would typically involve API calls to peer registries
  }

  private startGarbageCollection(): void {
    setInterval(async () => {
      const agents = await this.getAllAgents();
      const now = Date.now();
      
      for (const agent of agents) {
        const age = now - agent.lastHeartbeat.getTime();
        
        if (age > 300000) { // 5 minutes
          await this.deregisterAgent(agent.id);
          this.emit('agent:garbage_collected', { agentId: agent.id });
        }
      }
    }, 120000); // Every 2 minutes
  }

  private startHealthReconciliation(): void {
    setInterval(async () => {
      // Reconcile health status across all backends
      const agents = await this.getAllAgents();
      
      for (const agent of agents) {
        const consulHealth = await this.getConsulHealth(agent.id);
        
        if (consulHealth !== agent.health.status) {
          await this.reconcileHealth(agent.id, consulHealth);
        }
      }
    }, 30000); // Every 30 seconds
  }

  private async getConsulHealth(agentId: string): Promise<string> {
    try {
      const health = await this.consul.health.service(agentId);
      return health[0]?.Status || 'unknown';
    } catch {
      return 'unknown';
    }
  }

  private async reconcileHealth(agentId: string, consulStatus: string): Promise<void> {
    // Reconcile health status discrepancies
    const agent = await this.getAgent(agentId);
    if (agent) {
      agent.health.status = consulStatus as any;
      await this.updateAgentHealth(agentId, agent.health);
    }
  }

  /**
   * Cleanup resources
   */
  public async shutdown(): Promise<void> {
    clearInterval(this.healthCheckInterval);
    clearInterval(this.syncInterval);
    
    await Promise.all([
      this.raft.stop(),
      this.etcd.close(),
      this.redis.disconnect()
    ]);
    
    this.emit('registry:shutdown');
  }
}

export interface RegistryStatistics {
  totalAgents: number;
  healthyAgents: number;
  unhealthyAgents: number;
  degradedAgents: number;
  agentsByType: Record<string, number>;
  agentsByRegion: Record<string, number>;
  agentsByCapability: Record<string, number>;
  consensusState: string;
  nodeId: string;
  isLeader: boolean;
}