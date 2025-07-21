import { Agent } from '@mastra/core';
import { BaseAgent } from '../core/agent.base';
import { AgentType } from '../types';
// Note: Tools are imported separately to avoid circular dependencies

/**
 * Create a Mastra agent from an agentic-flow agent
 */
export function createMastraAgent(agenticFlowAgent: BaseAgent): Agent {
  const agentType = agenticFlowAgent.getType();
  const agentName = agenticFlowAgent.getName();
  
  // Map agent types to appropriate models
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
  
  const model = modelMapping[agentType] || { provider: 'openai', name: 'gpt-4' };
  
  // Generate instructions based on agent capabilities
  const capabilities = agenticFlowAgent.getCapabilities();
  const instructions = `You are ${agentName}, an ${agentType} agent with the following capabilities:
${capabilities.map(cap => `- ${cap.name}: ${cap.description}`).join('\n')}

Your role is to work within the agentic-flow system to accomplish tasks assigned to you.
You should collaborate with other agents and use the available tools to complete your objectives.`;
  
  // Tools will be assigned after creation to avoid circular dependencies
  const tools = [];
  
  return new Agent({
    name: agentName.toLowerCase().replace(/\s+/g, '-'),
    description: `${agentType} agent: ${agentName}`,
    model,
    instructions,
    tools,
  });
}

/**
 * Pre-defined Mastra agents for common agentic-flow patterns
 */
export const researcherAgent = new Agent({
  name: 'researcher',
  description: 'Research agent for information gathering and analysis',
  model: {
    provider: 'openai',
    name: 'gpt-4-turbo',
  },
  instructions: `You are a research agent specialized in:
    - Gathering information from various sources
    - Analyzing and synthesizing data
    - Identifying patterns and insights
    - Providing comprehensive research reports
    - Fact-checking and verification`,
  tools: [],
});

export const architectAgent = new Agent({
  name: 'architect',
  description: 'Architecture agent for system design and planning',
  model: {
    provider: 'anthropic',
    name: 'claude-3-opus-20240229',
  },
  instructions: `You are an architecture agent responsible for:
    - Designing system architectures
    - Creating technical specifications
    - Planning implementation strategies
    - Evaluating technology choices
    - Ensuring scalability and performance`,
  tools: [],
});

export const coderAgent = new Agent({
  name: 'coder',
  description: 'Coding agent for implementation and development',
  model: {
    provider: 'openai',
    name: 'gpt-4-turbo',
  },
  instructions: `You are a coding agent specialized in:
    - Writing clean, efficient code
    - Implementing features and functionality
    - Following best practices and patterns
    - Debugging and problem-solving
    - Code optimization and refactoring`,
  tools: [],
});

export const testerAgent = new Agent({
  name: 'tester',
  description: 'Testing agent for quality assurance',
  model: {
    provider: 'openai',
    name: 'gpt-4',
  },
  instructions: `You are a testing agent focused on:
    - Writing comprehensive test cases
    - Performing unit and integration testing
    - Identifying bugs and issues
    - Ensuring code quality
    - Test automation and coverage`,
  tools: [],
});

export const reviewerAgent = new Agent({
  name: 'reviewer',
  description: 'Review agent for code and design review',
  model: {
    provider: 'anthropic',
    name: 'claude-3-sonnet-20240229',
  },
  instructions: `You are a review agent responsible for:
    - Conducting thorough code reviews
    - Ensuring adherence to standards
    - Identifying potential improvements
    - Providing constructive feedback
    - Validating architectural decisions`,
  tools: [],
});

export const monitorAgent = new Agent({
  name: 'monitor',
  description: 'Monitoring agent for system observation',
  model: {
    provider: 'openai',
    name: 'gpt-3.5-turbo',
  },
  instructions: `You are a monitoring agent tasked with:
    - Observing system performance
    - Tracking agent activities
    - Identifying anomalies
    - Generating alerts and reports
    - Ensuring system health`,
  tools: [],
});

// Create coordinator and executor agents similar to the main index
export const coordinatorMastraAgent = new Agent({
  name: 'coordinator',
  description: 'Coordinator agent for team management and task delegation',
  model: {
    provider: 'anthropic',
    name: 'claude-3-sonnet-20240229',
  },
  instructions: `You are a coordinator agent responsible for:
    - Forming teams of agents for complex goals
    - Breaking down complex goals into manageable sub-goals
    - Delegating tasks to appropriate agents or teams
    - Monitoring team performance and adjusting strategies
    - Resolving conflicts between agents`,
  tools: [],
});

export const executorMastraAgent = new Agent({
  name: 'executor',
  description: 'Executor agent for task execution and implementation',
  model: {
    provider: 'anthropic',
    name: 'claude-3-sonnet-20240229',
  },
  instructions: `You are an executor agent responsible for:
    - Executing assigned tasks
    - Implementing solutions based on specifications
    - Reporting progress and results
    - Handling errors and retries
    - Collaborating with other agents`,
  tools: [],
});

// Export all predefined agents
export const mastraAgents = {
  coordinator: coordinatorMastraAgent,
  executor: executorMastraAgent,
  researcher: researcherAgent,
  architect: architectAgent,
  coder: coderAgent,
  tester: testerAgent,
  reviewer: reviewerAgent,
  monitor: monitorAgent,
};