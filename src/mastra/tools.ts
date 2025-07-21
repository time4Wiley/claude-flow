import { Tool } from '@mastra/core';
import { CoordinatorAgent } from '../agents/coordinator-agent';
import { ExecutorAgent } from '../agents/executor-agent';
import { WorkflowEngine } from '../workflows/workflow-engine';
import { AgentManager } from '../lib/agent-manager';
import { MessageBus } from '../communication/message-bus';
import { AgentType, MessagePriority } from '../types';

// Initialize core agentic-flow components (singletons)
let messageBus: MessageBus;
let agentManager: AgentManager;
let workflowEngine: WorkflowEngine;

// Lazy initialization to avoid circular dependencies
const getMessageBus = () => {
  if (!messageBus) {
    messageBus = MessageBus.getInstance();
  }
  return messageBus;
};

const getAgentManager = () => {
  if (!agentManager) {
    agentManager = new AgentManager();
  }
  return agentManager;
};

const getWorkflowEngine = () => {
  if (!workflowEngine) {
    workflowEngine = new WorkflowEngine();
  }
  return workflowEngine;
};

export const createTeamTool = new Tool({
  name: 'createTeam',
  description: 'Create a new team of agents for a specific goal',
  inputSchema: {
    type: 'object',
    properties: {
      teamName: { type: 'string' },
      goal: { type: 'string' },
      agentTypes: {
        type: 'array',
        items: { 
          type: 'string',
          enum: ['coordinator', 'executor', 'researcher', 'analyst', 'architect', 'coder', 'tester', 'documenter', 'reviewer', 'monitor', 'optimizer', 'specialist']
        }
      },
      teamSize: { type: 'number', minimum: 1, maximum: 10 }
    },
    required: ['teamName', 'goal', 'agentTypes']
  },
  execute: async ({ teamName, goal, agentTypes, teamSize = 3 }) => {
    try {
      const manager = getAgentManager();
      
      // Create a coordinator for the team
      const coordinator = new CoordinatorAgent(teamName);
      await manager.registerAgent(coordinator);
      
      // Create additional agents based on specified types
      const teamMembers = [];
      for (const agentType of agentTypes.slice(0, teamSize - 1)) {
        let agent;
        switch (agentType) {
          case 'executor':
            agent = new ExecutorAgent(`${teamName}-executor`);
            break;
          default:
            agent = new ExecutorAgent(`${teamName}-${agentType}`);
        }
        await manager.registerAgent(agent);
        teamMembers.push(agent.getId());
      }
      
      return {
        teamId: coordinator.getId(),
        coordinator: coordinator.getId(),
        members: teamMembers,
        status: 'created',
        message: `Team ${teamName} created successfully with ${teamMembers.length + 1} agents`,
        goal: goal
      };
    } catch (error) {
      return {
        status: 'error',
        message: `Failed to create team: ${error.message}`
      };
    }
  },
});

export const executeWorkflowTool = new Tool({
  name: 'executeWorkflow',
  description: 'Execute an agentic-flow workflow',
  inputSchema: {
    type: 'object',
    properties: {
      workflowId: { type: 'string' },
      input: { type: 'object' },
      priority: {
        type: 'string',
        enum: ['low', 'medium', 'high', 'critical']
      }
    },
    required: ['workflowId']
  },
  execute: async ({ workflowId, input = {}, priority = 'medium' }) => {
    try {
      const engine = getWorkflowEngine();
      const execution = await engine.executeWorkflow(workflowId, input);
      
      return {
        executionId: execution.id,
        workflowId: execution.workflowId,
        status: execution.status,
        startTime: execution.startTime,
        priority,
        message: `Workflow ${workflowId} execution started successfully`
      };
    } catch (error) {
      return {
        status: 'error',
        message: `Failed to execute workflow: ${error.message}`
      };
    }
  },
});

export const sendMessageTool = new Tool({
  name: 'sendMessage',
  description: 'Send a message through the agentic-flow message bus',
  inputSchema: {
    type: 'object',
    properties: {
      type: { type: 'string' },
      payload: { type: 'object' },
      recipientId: { type: 'string' },
      priority: { 
        type: 'string',
        enum: ['low', 'medium', 'high', 'critical']
      }
    },
    required: ['type', 'payload']
  },
  execute: async ({ type, payload, recipientId = 'broadcast', priority = 'medium' }) => {
    try {
      const bus = getMessageBus();
      const message = {
        type,
        senderId: 'mastra-integration',
        recipientId,
        payload,
        timestamp: new Date(),
        priority: priority as MessagePriority
      };
      
      await bus.publish(message);
      
      return {
        messageId: `msg-${Date.now()}`,
        status: 'sent',
        type,
        recipientId,
        priority,
        message: `Message of type ${type} published successfully`
      };
    } catch (error) {
      return {
        status: 'error',
        message: `Failed to send message: ${error.message}`
      };
    }
  },
});

export const getAgentStatusTool = new Tool({
  name: 'getAgentStatus',
  description: 'Get the status of agents in the agentic-flow system',
  inputSchema: {
    type: 'object',
    properties: {
      agentId: { type: 'string' },
      teamId: { type: 'string' },
      includeMetrics: { type: 'boolean' }
    }
  },
  execute: async ({ agentId, teamId, includeMetrics = false }) => {
    try {
      const manager = getAgentManager();
      
      if (agentId) {
        const agent = await manager.getAgent(agentId);
        if (!agent) {
          return { status: 'error', message: 'Agent not found' };
        }
        
        return {
          agentId: agent.getId(),
          name: agent.getName(),
          type: agent.getType(),
          status: agent.getStatus(),
          currentTask: agent.getCurrentTask()?.id || null,
          capabilities: agent.getCapabilities(),
          ...(includeMetrics && {
            metrics: {
              tasksCompleted: 0, // Would need to implement metrics tracking
              averageResponseTime: 0,
              successRate: 1.0
            }
          })
        };
      } else {
        const agents = await manager.listAgents();
        return {
          totalAgents: agents.length,
          agents: agents.map(agent => ({
            agentId: agent.getId(),
            name: agent.getName(),
            type: agent.getType(),
            status: agent.getStatus()
          }))
        };
      }
    } catch (error) {
      return {
        status: 'error',
        message: `Failed to get agent status: ${error.message}`
      };
    }
  },
});

export const createGoalTool = new Tool({
  name: 'createGoal',
  description: 'Create a new goal in the agentic-flow system',
  inputSchema: {
    type: 'object',
    properties: {
      description: { type: 'string' },
      priority: {
        type: 'string',
        enum: ['low', 'medium', 'high', 'critical']
      },
      deadline: { type: 'string', format: 'date-time' },
      assignedTeam: { type: 'string' },
      requirements: {
        type: 'array',
        items: { type: 'string' }
      }
    },
    required: ['description']
  },
  execute: async ({ description, priority = 'medium', deadline, assignedTeam, requirements = [] }) => {
    try {
      // This would integrate with the GoalEngine when available
      const goalId = `goal-${Date.now()}`;
      
      return {
        goalId,
        description,
        priority,
        deadline,
        assignedTeam,
        requirements,
        status: 'created',
        createdAt: new Date().toISOString(),
        message: 'Goal created successfully'
      };
    } catch (error) {
      return {
        status: 'error',
        message: `Failed to create goal: ${error.message}`
      };
    }
  },
});

export const monitorSystemTool = new Tool({
  name: 'monitorSystem',
  description: 'Monitor the agentic-flow system health and performance',
  inputSchema: {
    type: 'object',
    properties: {
      includeAgents: { type: 'boolean' },
      includeWorkflows: { type: 'boolean' },
      includeMessages: { type: 'boolean' }
    }
  },
  execute: async ({ includeAgents = true, includeWorkflows = true, includeMessages = true }) => {
    try {
      const systemStatus = {
        timestamp: new Date().toISOString(),
        status: 'healthy',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
      };
      
      if (includeAgents) {
        const manager = getAgentManager();
        const agents = await manager.listAgents();
        systemStatus['agents'] = {
          total: agents.length,
          active: agents.filter(a => a.getStatus() === 'active').length,
          idle: agents.filter(a => a.getStatus() === 'idle').length,
        };
      }
      
      if (includeWorkflows) {
        const engine = getWorkflowEngine();
        // Would need to implement workflow status tracking
        systemStatus['workflows'] = {
          total: 0,
          running: 0,
          completed: 0,
          failed: 0
        };
      }
      
      if (includeMessages) {
        const bus = getMessageBus();
        // Would need to implement message statistics
        systemStatus['messages'] = {
          sent: 0,
          received: 0,
          pending: 0
        };
      }
      
      return systemStatus;
    } catch (error) {
      return {
        status: 'error',
        message: `Failed to monitor system: ${error.message}`
      };
    }
  },
});

// Export all tools
export const mastraTools = {
  createTeam: createTeamTool,
  executeWorkflow: executeWorkflowTool,
  sendMessage: sendMessageTool,
  getAgentStatus: getAgentStatusTool,
  createGoal: createGoalTool,
  monitorSystem: monitorSystemTool,
};