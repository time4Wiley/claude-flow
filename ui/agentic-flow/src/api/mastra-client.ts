/**
 * Mastra Client Integration
 * Integrates with Mastra agents from src/mastra/agents.ts
 */

import { Agent } from '@mastra/core';
import { 
  createMastraAgent, 
  mastraAgents,
  researcherAgent,
  architectAgent,
  coderAgent,
  testerAgent,
  reviewerAgent,
  monitorAgent
} from '../../src/mastra/agents';
import { BaseAgent } from '../../src/core/agent.base';
import { AgentType, AgentCapability } from '../../src/hive-mind/types';

export interface MastraAgentInfo {
  name: string;
  type: string;
  description: string;
  model: {
    provider: string;
    name: string;
  };
  capabilities: string[];
}

export interface MastraExecutionOptions {
  timeout?: number;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface MastraExecutionResult {
  success: boolean;
  response?: string;
  error?: string;
  metadata?: {
    tokensUsed?: number;
    executionTime?: number;
    model?: string;
  };
}

/**
 * Mastra Client for agent management and execution
 */
export class MastraClient {
  private agents: Map<string, Agent>;
  private agentMetadata: Map<string, MastraAgentInfo>;
  
  constructor() {
    this.agents = new Map();
    this.agentMetadata = new Map();
    this.initializeDefaultAgents();
  }

  /**
   * Initialize default Mastra agents
   */
  private initializeDefaultAgents(): void {
    // Register pre-defined agents
    const defaultAgents: Array<[string, Agent, MastraAgentInfo]> = [
      ['researcher', researcherAgent, {
        name: 'researcher',
        type: 'researcher',
        description: 'Research agent for information gathering and analysis',
        model: { provider: 'openai', name: 'gpt-4-turbo' },
        capabilities: [
          'information_gathering',
          'pattern_recognition',
          'knowledge_synthesis'
        ]
      }],
      ['architect', architectAgent, {
        name: 'architect',
        type: 'architect',
        description: 'Architecture agent for system design and planning',
        model: { provider: 'anthropic', name: 'claude-3-opus-20240229' },
        capabilities: [
          'system_design',
          'architecture_patterns',
          'integration_planning'
        ]
      }],
      ['coder', coderAgent, {
        name: 'coder',
        type: 'coder',
        description: 'Coding agent for implementation and development',
        model: { provider: 'openai', name: 'gpt-4-turbo' },
        capabilities: [
          'code_generation',
          'refactoring',
          'debugging'
        ]
      }],
      ['tester', testerAgent, {
        name: 'tester',
        type: 'tester',
        description: 'Testing agent for quality assurance',
        model: { provider: 'openai', name: 'gpt-4' },
        capabilities: [
          'test_generation',
          'quality_assurance',
          'edge_case_detection'
        ]
      }],
      ['reviewer', reviewerAgent, {
        name: 'reviewer',
        type: 'reviewer',
        description: 'Review agent for code and design review',
        model: { provider: 'anthropic', name: 'claude-3-sonnet-20240229' },
        capabilities: [
          'code_review',
          'standards_enforcement',
          'best_practices'
        ]
      }],
      ['monitor', monitorAgent, {
        name: 'monitor',
        type: 'monitor',
        description: 'Monitoring agent for system observation',
        model: { provider: 'openai', name: 'gpt-3.5-turbo' },
        capabilities: [
          'system_monitoring',
          'health_checks',
          'alerting'
        ]
      }]
    ];

    for (const [name, agent, metadata] of defaultAgents) {
      this.agents.set(name, agent);
      this.agentMetadata.set(name, metadata);
    }
  }

  /**
   * Create a Mastra agent from an agentic-flow agent
   */
  async createAgent(agenticFlowAgent: BaseAgent): Promise<string> {
    const mastraAgent = createMastraAgent(agenticFlowAgent);
    const agentName = agenticFlowAgent.getName().toLowerCase().replace(/\s+/g, '-');
    
    // Store agent
    this.agents.set(agentName, mastraAgent);
    
    // Store metadata
    this.agentMetadata.set(agentName, {
      name: agentName,
      type: agenticFlowAgent.getType(),
      description: `${agenticFlowAgent.getType()} agent: ${agenticFlowAgent.getName()}`,
      model: this.getModelForAgentType(agenticFlowAgent.getType()),
      capabilities: agenticFlowAgent.getCapabilities().map(c => c.name)
    });
    
    return agentName;
  }

  /**
   * Get model configuration for agent type
   */
  private getModelForAgentType(agentType: AgentType): { provider: string; name: string } {
    const modelMapping: Record<AgentType, { provider: string; name: string }> = {
      [AgentType.COORDINATOR]: { provider: 'anthropic', name: 'claude-3-opus-20240229' },
      [AgentType.EXECUTOR]: { provider: 'anthropic', name: 'claude-3-sonnet-20240229' },
      [AgentType.RESEARCHER]: { provider: 'openai', name: 'gpt-4-turbo' },
      [AgentType.ANALYST]: { provider: 'anthropic', name: 'claude-3-sonnet-20240229' },
      [AgentType.ARCHITECT]: { provider: 'anthropic', name: 'claude-3-opus-20240229' },
      [AgentType.CODER]: { provider: 'openai', name: 'gpt-4-turbo' },
      [AgentType.TESTER]: { provider: 'openai', name: 'gpt-4' },
      [AgentType.DOCUMENTER]: { provider: 'openai', name: 'gpt-4' },
      [AgentType.REVIEWER]: { provider: 'anthropic', name: 'claude-3-sonnet-20240229' },
      [AgentType.MONITOR]: { provider: 'openai', name: 'gpt-3.5-turbo' },
      [AgentType.OPTIMIZER]: { provider: 'anthropic', name: 'claude-3-opus-20240229' },
      [AgentType.SPECIALIST]: { provider: 'anthropic', name: 'claude-3-opus-20240229' },
    };
    
    return modelMapping[agentType] || { provider: 'openai', name: 'gpt-4' };
  }

  /**
   * Get all available agents
   */
  getAvailableAgents(): MastraAgentInfo[] {
    return Array.from(this.agentMetadata.values());
  }

  /**
   * Get agent by name
   */
  getAgent(name: string): Agent | undefined {
    return this.agents.get(name);
  }

  /**
   * Get agent metadata
   */
  getAgentInfo(name: string): MastraAgentInfo | undefined {
    return this.agentMetadata.get(name);
  }

  /**
   * Execute agent with task
   */
  async executeAgent(
    agentName: string, 
    task: string, 
    options: MastraExecutionOptions = {}
  ): Promise<MastraExecutionResult> {
    const startTime = Date.now();
    
    try {
      const agent = this.agents.get(agentName);
      if (!agent) {
        throw new Error(`Agent not found: ${agentName}`);
      }

      // Execute agent with task
      // Note: This is a simplified version. In real implementation,
      // you would use Mastra's execution API
      const response = await this.executeAgentTask(agent, task, options);
      
      const executionTime = Date.now() - startTime;
      
      return {
        success: true,
        response,
        metadata: {
          executionTime,
          model: this.agentMetadata.get(agentName)?.model.name,
          tokensUsed: this.estimateTokens(task, response)
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          executionTime: Date.now() - startTime
        }
      };
    }
  }

  /**
   * Execute agent task (placeholder for actual Mastra execution)
   */
  private async executeAgentTask(
    agent: Agent, 
    task: string, 
    options: MastraExecutionOptions
  ): Promise<string> {
    // This is a placeholder. In real implementation, you would:
    // 1. Use Mastra's execution API
    // 2. Pass the task to the agent
    // 3. Handle streaming if options.stream is true
    // 4. Apply temperature and maxTokens settings
    
    // For now, return a mock response
    return `Agent ${agent.name} is processing task: ${task}`;
  }

  /**
   * Estimate token usage
   */
  private estimateTokens(input: string, output: string): number {
    // Simple estimation: ~4 characters per token
    return Math.ceil((input.length + output.length) / 4);
  }

  /**
   * Create agent from type and capabilities
   */
  async createCustomAgent(config: {
    name: string;
    type: AgentType;
    capabilities: AgentCapability[];
    instructions?: string;
  }): Promise<string> {
    const model = this.getModelForAgentType(config.type);
    
    const agent = new Agent({
      name: config.name.toLowerCase().replace(/\s+/g, '-'),
      description: `${config.type} agent: ${config.name}`,
      model,
      instructions: config.instructions || this.generateInstructions(config.type, config.capabilities),
      tools: [] // Tools will be assigned based on capabilities
    });
    
    // Store agent
    this.agents.set(agent.name, agent);
    
    // Store metadata
    this.agentMetadata.set(agent.name, {
      name: agent.name,
      type: config.type,
      description: agent.description || '',
      model,
      capabilities: config.capabilities
    });
    
    return agent.name;
  }

  /**
   * Generate instructions based on type and capabilities
   */
  private generateInstructions(type: AgentType, capabilities: AgentCapability[]): string {
    const capabilityDescriptions = capabilities.map(cap => `- ${cap}`).join('\n');
    
    return `You are a ${type} agent with the following capabilities:
${capabilityDescriptions}

Your role is to work within the agentic-flow system to accomplish tasks assigned to you.
You should collaborate with other agents and use the available tools to complete your objectives.

Focus on:
1. Understanding the task requirements
2. Breaking down complex tasks into manageable steps
3. Collaborating with other agents when needed
4. Providing clear and actionable outputs
5. Maintaining high quality standards`;
  }

  /**
   * Get agents by type
   */
  getAgentsByType(type: string): MastraAgentInfo[] {
    return Array.from(this.agentMetadata.values())
      .filter(agent => agent.type === type);
  }

  /**
   * Get agents by capability
   */
  getAgentsByCapability(capability: string): MastraAgentInfo[] {
    return Array.from(this.agentMetadata.values())
      .filter(agent => agent.capabilities.includes(capability));
  }

  /**
   * Delete agent
   */
  deleteAgent(name: string): boolean {
    const deleted = this.agents.delete(name);
    if (deleted) {
      this.agentMetadata.delete(name);
    }
    return deleted;
  }

  /**
   * Clear all custom agents (keep default ones)
   */
  clearCustomAgents(): void {
    const defaultAgentNames = ['researcher', 'architect', 'coder', 'tester', 'reviewer', 'monitor'];
    
    for (const [name] of this.agents) {
      if (!defaultAgentNames.includes(name)) {
        this.agents.delete(name);
        this.agentMetadata.delete(name);
      }
    }
  }

  /**
   * Execute multiple agents in parallel
   */
  async executeAgentsParallel(
    tasks: Array<{ agentName: string; task: string }>,
    options: MastraExecutionOptions = {}
  ): Promise<MastraExecutionResult[]> {
    const promises = tasks.map(({ agentName, task }) => 
      this.executeAgent(agentName, task, options)
    );
    
    return Promise.all(promises);
  }

  /**
   * Execute agents in sequence
   */
  async executeAgentsSequential(
    tasks: Array<{ agentName: string; task: string }>,
    options: MastraExecutionOptions = {}
  ): Promise<MastraExecutionResult[]> {
    const results: MastraExecutionResult[] = [];
    
    for (const { agentName, task } of tasks) {
      const result = await this.executeAgent(agentName, task, options);
      results.push(result);
      
      // Stop on error if needed
      if (!result.success && !options.continueOnError) {
        break;
      }
    }
    
    return results;
  }
}

// Singleton instance
let mastraClient: MastraClient | null = null;

/**
 * Get or create Mastra client instance
 */
export function getMastraClient(): MastraClient {
  if (!mastraClient) {
    mastraClient = new MastraClient();
  }
  return mastraClient;
}

// Export types for convenience
export type { Agent } from '@mastra/core';
export { mastraAgents } from '../../src/mastra/agents';