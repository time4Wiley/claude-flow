import { GraphQLResolveInfo } from 'graphql';
import { AgentManager } from '../../lib/agent-manager';
import { WorkflowEngine } from '../../lib/workflow-engine';
import { GoalEngine } from '../../goal-engine/goal-engine';
import { MessageBus } from '../../communication/message-bus';
import { Context } from './context';
import { GraphQLError } from 'graphql';
import { v4 as uuidv4 } from 'uuid';

const agentManager = new AgentManager();
const workflowEngine = new WorkflowEngine();
const messageBus = new MessageBus();

// Helper function to check authentication
function requireAuth(context: Context) {
  if (!context.user && !context.apiKey) {
    throw new GraphQLError('Authentication required', {
      extensions: { code: 'UNAUTHENTICATED' },
    });
  }
}

// Helper function to check scopes
function requireScopes(context: Context, scopes: string[]) {
  requireAuth(context);
  
  if (context.user) {
    // JWT users have all scopes for now
    return;
  }
  
  if (context.apiKey) {
    const hasAllScopes = scopes.every(scope => 
      context.apiKey!.scopes.includes(scope)
    );
    
    if (!hasAllScopes) {
      throw new GraphQLError('Insufficient permissions', {
        extensions: { 
          code: 'FORBIDDEN',
          requiredScopes: scopes,
        },
      });
    }
  }
}

export const resolvers = {
  Query: {
    // Agent queries
    agent: async (_: any, { id }: { id: string }, context: Context) => {
      requireScopes(context, ['read:agents']);
      const agent = await agentManager.getAgent(id);
      if (!agent) {
        throw new GraphQLError('Agent not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }
      return agent;
    },
    
    agents: async (_: any, args: any, context: Context) => {
      requireScopes(context, ['read:agents']);
      const { limit = 20, offset = 0, type, status } = args;
      
      const result = await agentManager.listAgents({
        limit,
        offset,
        type,
        status,
      });
      
      return {
        edges: result.items.map((agent, index) => ({
          node: agent,
          cursor: Buffer.from(`${offset + index}`).toString('base64'),
        })),
        pageInfo: {
          hasNextPage: result.hasMore,
          hasPreviousPage: offset > 0,
          startCursor: offset > 0 ? Buffer.from(`${offset}`).toString('base64') : null,
          endCursor: result.items.length > 0 
            ? Buffer.from(`${offset + result.items.length - 1}`).toString('base64') 
            : null,
        },
        totalCount: result.total,
      };
    },
    
    // Workflow queries
    workflow: async (_: any, { id }: { id: string }, context: Context) => {
      requireScopes(context, ['read:workflows']);
      const workflow = await workflowEngine.getWorkflow(id);
      if (!workflow) {
        throw new GraphQLError('Workflow not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }
      return workflow;
    },
    
    workflows: async (_: any, args: any, context: Context) => {
      requireScopes(context, ['read:workflows']);
      const { limit = 20, offset = 0, status } = args;
      
      const result = await workflowEngine.listWorkflows({
        limit,
        offset,
        status,
      });
      
      return {
        edges: result.items.map((workflow, index) => ({
          node: workflow,
          cursor: Buffer.from(`${offset + index}`).toString('base64'),
        })),
        pageInfo: {
          hasNextPage: result.hasMore,
          hasPreviousPage: offset > 0,
          startCursor: offset > 0 ? Buffer.from(`${offset}`).toString('base64') : null,
          endCursor: result.items.length > 0 
            ? Buffer.from(`${offset + result.items.length - 1}`).toString('base64') 
            : null,
        },
        totalCount: result.total,
      };
    },
    
    // Goal queries
    goal: async (_: any, { id }: { id: string }, context: Context) => {
      requireScopes(context, ['read:goals']);
      const goal = await context.goalEngine.getGoal(id);
      if (!goal) {
        throw new GraphQLError('Goal not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }
      return goal;
    },
    
    goals: async (_: any, args: any, context: Context) => {
      requireScopes(context, ['read:goals']);
      const { limit = 20, offset = 0, status, priority, agentId } = args;
      
      const goals = await context.goalEngine.listGoals({
        limit,
        offset,
        status,
        priority,
        agentId,
      });
      
      return goals;
    },
    
    // Message queries
    messages: async (_: any, args: any, context: Context) => {
      requireScopes(context, ['read:messages']);
      const { limit = 20, offset = 0, agentId, type } = args;
      
      const messages = await messageBus.getMessages({
        limit,
        offset,
        agentId,
        type,
      });
      
      return {
        edges: messages.items.map((message, index) => ({
          node: message,
          cursor: Buffer.from(`${offset + index}`).toString('base64'),
        })),
        pageInfo: {
          hasNextPage: messages.hasMore,
          hasPreviousPage: offset > 0,
          startCursor: offset > 0 ? Buffer.from(`${offset}`).toString('base64') : null,
          endCursor: messages.items.length > 0 
            ? Buffer.from(`${offset + messages.items.length - 1}`).toString('base64') 
            : null,
        },
        totalCount: messages.total,
      };
    },
    
    // System queries
    systemHealth: async (_: any, __: any, context: Context) => {
      requireAuth(context);
      
      return {
        status: 'healthy',
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0',
        checks: [
          {
            name: 'Database',
            status: 'healthy',
            message: 'Connected',
          },
          {
            name: 'MessageBus',
            status: 'healthy',
            message: 'Active',
          },
          {
            name: 'AgentManager',
            status: 'healthy',
            message: `${await agentManager.getActiveAgentCount()} active agents`,
          },
        ],
      };
    },
    
    metrics: async (_: any, __: any, context: Context) => {
      requireScopes(context, ['read:metrics']);
      
      return {
        activeAgents: await agentManager.getActiveAgentCount(),
        totalWorkflows: await workflowEngine.getTotalWorkflowCount(),
        executingWorkflows: await workflowEngine.getExecutingWorkflowCount(),
        pendingGoals: await context.goalEngine.getPendingGoalCount(),
        messageQueueSize: await messageBus.getQueueSize(),
        averageResponseTime: 42.5, // Mock data
        requestsPerMinute: 250, // Mock data
      };
    },
  },
  
  Mutation: {
    // Agent mutations
    createAgent: async (_: any, { input }: any, context: Context) => {
      requireScopes(context, ['write:agents']);
      
      const agent = await agentManager.createAgent({
        name: input.name,
        type: input.type.toLowerCase(),
        capabilities: input.capabilities,
        configuration: input.configuration,
      });
      
      return agent;
    },
    
    updateAgent: async (_: any, { id, input }: any, context: Context) => {
      requireScopes(context, ['write:agents']);
      
      const agent = await agentManager.getAgent(id);
      if (!agent) {
        throw new GraphQLError('Agent not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }
      
      if (input.name) {
        await agent.setName(input.name);
      }
      
      if (input.capabilities) {
        await agent.setCapabilities(input.capabilities);
      }
      
      if (input.configuration) {
        await agent.updateConfiguration(input.configuration);
      }
      
      return agent;
    },
    
    deleteAgent: async (_: any, { id }: { id: string }, context: Context) => {
      requireScopes(context, ['write:agents']);
      
      const success = await agentManager.deleteAgent(id);
      if (!success) {
        throw new GraphQLError('Agent not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }
      
      return true;
    },
    
    startAgent: async (_: any, { id }: { id: string }, context: Context) => {
      requireScopes(context, ['write:agents']);
      
      const agent = await agentManager.getAgent(id);
      if (!agent) {
        throw new GraphQLError('Agent not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }
      
      await agent.start();
      return agent;
    },
    
    stopAgent: async (_: any, { id }: { id: string }, context: Context) => {
      requireScopes(context, ['write:agents']);
      
      const agent = await agentManager.getAgent(id);
      if (!agent) {
        throw new GraphQLError('Agent not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }
      
      await agent.stop();
      return agent;
    },
    
    // Workflow mutations
    createWorkflow: async (_: any, { input }: any, context: Context) => {
      requireScopes(context, ['write:workflows']);
      
      const workflow = await workflowEngine.createWorkflow({
        name: input.name,
        description: input.description,
        steps: input.steps,
      });
      
      return workflow;
    },
    
    executeWorkflow: async (_: any, { id, parameters }: any, context: Context) => {
      requireScopes(context, ['execute:workflows']);
      
      const workflow = await workflowEngine.getWorkflow(id);
      if (!workflow) {
        throw new GraphQLError('Workflow not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }
      
      const execution = await workflowEngine.executeWorkflow(id, parameters);
      return execution;
    },
    
    // Goal mutations
    createGoal: async (_: any, { input }: any, context: Context) => {
      requireScopes(context, ['write:goals']);
      
      const goalEngine = new GoalEngine(context.user?.id || context.apiKey?.id || 'system');
      const goal = await goalEngine.parseGoal(input.description, {
        priority: input.priority,
        constraints: input.constraints,
      });
      
      return goal;
    },
    
    // Message mutations
    sendMessage: async (_: any, { input }: any, context: Context) => {
      requireScopes(context, ['write:messages']);
      
      const message = await messageBus.sendMessage({
        id: uuidv4(),
        from: input.from,
        to: input.to,
        type: input.type.toLowerCase(),
        content: input.content,
        priority: input.priority || 'medium',
        timestamp: new Date(),
      });
      
      return message;
    },
  },
  
  Subscription: {
    // Agent subscriptions
    agentStatusChanged: {
      subscribe: (_: any, { agentId }: any, context: Context) => {
        requireScopes(context, ['read:agents']);
        return context.pubsub.asyncIterator(['AGENT_STATUS_CHANGED']);
      },
    },
    
    // Message subscriptions
    messageReceived: {
      subscribe: (_: any, { agentId }: any, context: Context) => {
        requireScopes(context, ['read:messages']);
        return context.pubsub.asyncIterator([`MESSAGE_RECEIVED_${agentId}`]);
      },
    },
  },
  
  // Field resolvers
  Agent: {
    metrics: async (parent: any) => {
      return parent.getMetrics();
    },
    
    goals: async (parent: any, _: any, context: Context) => {
      return context.goalEngine.getGoalsByAgent(parent.getId());
    },
    
    messages: async (parent: any, args: any) => {
      const { limit = 20, offset = 0 } = args;
      return messageBus.getMessagesByAgent(parent.getId(), { limit, offset });
    },
  },
  
  Workflow: {
    executions: async (parent: any, args: any) => {
      const { limit = 20 } = args;
      return workflowEngine.getWorkflowExecutions(parent.id, { limit });
    },
  },
  
  Goal: {
    assignedAgent: async (parent: any) => {
      if (!parent.assignedAgentId) return null;
      return agentManager.getAgent(parent.assignedAgentId);
    },
  },
  
  Message: {
    from: async (parent: any) => {
      return agentManager.getAgent(parent.from);
    },
    
    to: async (parent: any) => {
      return agentManager.getAgent(parent.to);
    },
  },
  
  // Custom scalars
  DateTime: {
    serialize: (value: any) => value.toISOString(),
    parseValue: (value: any) => new Date(value),
    parseLiteral: (ast: any) => {
      if (ast.kind === 'StringValue') {
        return new Date(ast.value);
      }
      return null;
    },
  },
  
  JSON: {
    serialize: (value: any) => value,
    parseValue: (value: any) => value,
    parseLiteral: (ast: any) => {
      switch (ast.kind) {
        case 'StringValue':
        case 'BooleanValue':
          return ast.value;
        case 'IntValue':
        case 'FloatValue':
          return parseFloat(ast.value);
        case 'ObjectValue': {
          const value: any = {};
          ast.fields.forEach((field: any) => {
            value[field.name.value] = resolvers.JSON.parseLiteral(field.value);
          });
          return value;
        }
        case 'ListValue':
          return ast.values.map((val: any) => resolvers.JSON.parseLiteral(val));
        default:
          return null;
      }
    },
  },
};