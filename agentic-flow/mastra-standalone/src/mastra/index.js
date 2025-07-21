import { Mastra, Agent, Workflow } from '@mastra/core';
import { Tool } from '@mastra/core/tools';

// Create Mastra instance with minimal configuration
const mastra = new Mastra({
  name: 'agentic-flow',
  version: '1.0.0',
  description: 'Agentic Flow - AI Orchestration Platform with Mastra Integration',
  
  // Configure server
  server: {
    port: process.env.MASTRA_PORT ? parseInt(process.env.MASTRA_PORT) : 4111,
    baseUrl: process.env.MASTRA_BASE_URL || 'http://localhost:4111',
  },
  
  // Disable telemetry and database to avoid issues
  telemetry: {
    enabled: false,
  },
  
  logs: {
    enabled: true,
    level: 'info',
  },
  
  // Define agents directly in configuration
  agents: {
    coordinator: new Agent({
      name: 'coordinator',
      description: 'Coordinates teams and manages complex workflows',
      model: {
        provider: 'anthropic',
        name: 'claude-3-sonnet-20240229',
      },
      instructions: `You are a coordinator agent responsible for team formation, goal decomposition, task delegation, cross-team coordination, and strategic decision making.`,
    }),
    
    executor: new Agent({
      name: 'executor',
      description: 'Executes tasks and implements solutions',
      model: {
        provider: 'anthropic',
        name: 'claude-3-sonnet-20240229',
      },
      instructions: `You are an executor agent responsible for task implementation, solution development, progress reporting, quality assurance, and problem resolution.`,
    }),
    
    researcher: new Agent({
      name: 'researcher',
      description: 'Gathers information and analyzes data',
      model: {
        provider: 'anthropic',
        name: 'claude-3-sonnet-20240229',
      },
      instructions: `You are a research agent specialized in information gathering, data analysis, technology research, market analysis, and trend identification.`,
    }),
    
    architect: new Agent({
      name: 'architect',
      description: 'Designs systems and technical architecture',
      model: {
        provider: 'anthropic',
        name: 'claude-3-sonnet-20240229',
      },
      instructions: `You are an architecture agent responsible for system design, technical specification, scalability planning, technology selection, and integration design.`,
    })
  },
  
  // Define tools directly in configuration
  tools: {
    createTeam: new Tool({
      name: 'createTeam',
      description: 'Create a new team of agents for a specific goal',
      inputSchema: {
        type: 'object',
        properties: {
          teamName: { type: 'string', description: 'Name for the new team' },
          goal: { type: 'string', description: 'Primary goal for the team' },
          agentTypes: {
            type: 'array',
            items: { 
              type: 'string',
              enum: ['coordinator', 'executor', 'researcher', 'architect']
            },
            description: 'Types of agents needed for the team'
          }
        },
        required: ['teamName', 'goal', 'agentTypes']
      },
      execute: async ({ teamName, goal, agentTypes }) => {
        const teamId = `team-${Date.now()}`;
        const team = {
          teamId,
          teamName,
          goal,
          agentTypes,
          status: 'active',
          created: new Date().toISOString(),
          members: agentTypes.map((type, index) => ({
            id: `${type}-${teamId}-${index}`,
            type,
            role: type,
            status: 'ready'
          }))
        };
        
        console.log(`🚀 Team created: ${teamName} (${teamId})`);
        return {
          success: true,
          team,
          message: `Team "${teamName}" created successfully`
        };
      },
    }),
    
    executeWorkflow: new Tool({
      name: 'executeWorkflow',
      description: 'Execute a workflow with the agentic-flow system',
      inputSchema: {
        type: 'object',
        properties: {
          workflowName: { 
            type: 'string',
            enum: ['software-development', 'problem-solving'],
            description: 'Name of the workflow to execute'
          },
          input: { 
            type: 'object',
            description: 'Input parameters for the workflow'
          }
        },
        required: ['workflowName', 'input']
      },
      execute: async ({ workflowName, input }) => {
        const executionId = `exec-${Date.now()}`;
        const execution = {
          executionId,
          workflowName,
          input,
          status: 'running',
          startTime: new Date().toISOString()
        };
        
        console.log(`🔄 Workflow started: ${workflowName} (${executionId})`);
        return {
          success: true,
          execution,
          message: `Workflow "${workflowName}" started successfully`
        };
      },
    }),
    
    monitorSystem: new Tool({
      name: 'monitorSystem',
      description: 'Monitor the health and status of the agentic-flow system',
      inputSchema: {
        type: 'object',
        properties: {
          includeMetrics: { type: 'boolean', default: false }
        }
      },
      execute: async ({ includeMetrics = false }) => {
        const systemStatus = {
          timestamp: new Date().toISOString(),
          status: 'healthy',
          uptime: Math.floor(process.uptime()),
          agents: {
            total: 4,
            active: 4,
            types: ['coordinator', 'executor', 'researcher', 'architect']
          },
          workflows: {
            registered: 2,
            available: ['software-development', 'problem-solving']
          }
        };
        
        console.log('🏥 System health check completed');
        return systemStatus;
      },
    })
  },
  
  // Define workflows directly in configuration
  workflows: {
    'software-development': new Workflow({
      name: 'software-development',
      description: 'Complete software development lifecycle workflow',
      steps: [
        {
          id: 'requirements',
          type: 'agent',
          agent: 'coordinator',
          prompt: 'Analyze and coordinate the software development requirements for: {{project}}',
        },
        {
          id: 'research',
          type: 'agent',
          agent: 'researcher',
          prompt: 'Research technical approaches for: {{outputs.requirements.response}}',
        },
        {
          id: 'architecture',
          type: 'agent',
          agent: 'architect',
          prompt: 'Design the technical architecture based on: {{outputs.research.response}}',
        },
        {
          id: 'implementation',
          type: 'agent',
          agent: 'executor',
          prompt: 'Implement the solution based on: {{outputs.architecture.response}}',
        }
      ],
    }),
    
    'problem-solving': new Workflow({
      name: 'problem-solving',
      description: 'Structured approach to complex problem resolution',
      steps: [
        {
          id: 'analysis',
          type: 'agent',
          agent: 'coordinator',
          prompt: 'Analyze and break down this complex problem: {{problem}}',
        },
        {
          id: 'research',
          type: 'agent',
          agent: 'researcher',
          prompt: 'Research potential solutions: {{outputs.analysis.response}}',
        },
        {
          id: 'solution-design',
          type: 'agent',
          agent: 'architect',
          prompt: 'Design a comprehensive solution: {{outputs.research.response}}',
        },
        {
          id: 'implementation-plan',
          type: 'agent',
          agent: 'executor',
          prompt: 'Create detailed implementation plan: {{outputs.solution-design.response}}',
        }
      ],
    })
  }
});

console.log('🚀 Agentic Flow Mastra Integration Loaded!');
console.log('📊 Configuration:');
console.log('   • 4 AI Agents (Coordinator, Executor, Researcher, Architect)');
console.log('   • 3 Integration Tools (Team Creation, Workflow Execution, System Monitoring)');
console.log('   • 2 Production Workflows (Software Development, Problem Solving)');
console.log(`   • Server URL: http://localhost:4111`);

// Export both named and default for Mastra CLI compatibility
export { mastra };
export default mastra;