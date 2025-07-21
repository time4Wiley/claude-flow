import { Mastra, Agent, Tool, Workflow } from '@mastra/core';

// Create Mastra instance with minimal configuration to avoid dependency issues
export const mastra = new Mastra({
  name: 'agentic-flow',
  version: '1.0.0',
  description: 'Agentic Flow - AI Orchestration Platform with Mastra Integration',
  
  // Configure server settings
  server: {
    port: process.env.MASTRA_PORT ? parseInt(process.env.MASTRA_PORT) : 4111,
    baseUrl: process.env.MASTRA_BASE_URL || 'http://localhost:4111',
  },
  
  // Configure telemetry (disabled to avoid configuration issues)
  telemetry: {
    enabled: false,
  },
  
  // Configure logs
  logs: {
    enabled: true,
    level: 'info',
  },
});

// Define basic agents for the agentic-flow system
const coordinatorAgent = new Agent({
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

const executorAgent = new Agent({
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

const researcherAgent = new Agent({
  name: 'researcher',
  description: 'Research agent for information gathering and analysis',
  model: {
    provider: 'anthropic',
    name: 'claude-3-sonnet-20240229',
  },
  instructions: `You are a research agent specialized in:
    - Gathering information from various sources
    - Analyzing and synthesizing data
    - Identifying patterns and insights
    - Providing comprehensive research reports
    - Fact-checking and verification`,
  tools: [],
});

const architectAgent = new Agent({
  name: 'architect',
  description: 'Architecture agent for system design and planning',
  model: {
    provider: 'anthropic',
    name: 'claude-3-sonnet-20240229',
  },
  instructions: `You are an architecture agent responsible for:
    - Designing system architectures
    - Creating technical specifications
    - Planning implementation strategies
    - Evaluating technology choices
    - Ensuring scalability and performance`,
  tools: [],
});

// Define basic tools for agentic-flow integration (without complex dependencies)
const createTeamTool = new Tool({
  name: 'createTeam',
  description: 'Create a new team of agents for a specific goal',
  inputSchema: {
    type: 'object',
    properties: {
      teamName: { type: 'string' },
      goal: { type: 'string' },
      agentTypes: {
        type: 'array',
        items: { type: 'string' }
      },
      teamSize: { type: 'number', minimum: 1, maximum: 10 }
    },
    required: ['teamName', 'goal', 'agentTypes']
  },
  execute: async ({ teamName, goal, agentTypes, teamSize = 3 }) => {
    // Simplified implementation without agentic-flow dependencies
    return {
      teamId: `team-${Date.now()}`,
      teamName,
      goal,
      agentTypes,
      teamSize,
      status: 'created',
      message: `Team ${teamName} created successfully with ${agentTypes.length} agent types`,
      timestamp: new Date().toISOString(),
      members: agentTypes.map(type => ({ 
        id: `${type}-${Date.now()}`, 
        type, 
        status: 'ready' 
      }))
    };
  },
});

const sendMessageTool = new Tool({
  name: 'sendMessage',
  description: 'Send a message through the agentic-flow message system',
  inputSchema: {
    type: 'object',
    properties: {
      type: { type: 'string' },
      message: { type: 'string' },
      recipientId: { type: 'string' },
      priority: { 
        type: 'string',
        enum: ['low', 'medium', 'high', 'critical']
      }
    },
    required: ['type', 'message']
  },
  execute: async ({ type, message, recipientId = 'broadcast', priority = 'medium' }) => {
    // Simplified message handling
    const messageData = {
      messageId: `msg-${Date.now()}`,
      type,
      message,
      recipientId,
      priority,
      status: 'sent',
      timestamp: new Date().toISOString(),
      sender: 'mastra-integration'
    };
    
    // Log the message (in a real implementation, this would integrate with the message bus)
    console.log('📨 Message sent:', messageData);
    
    return messageData;
  },
});

const executeWorkflowTool = new Tool({
  name: 'executeWorkflow',
  description: 'Execute an agentic-flow workflow',
  inputSchema: {
    type: 'object',
    properties: {
      workflowName: { type: 'string' },
      input: { type: 'object' },
      priority: {
        type: 'string',
        enum: ['low', 'medium', 'high', 'critical']
      }
    },
    required: ['workflowName']
  },
  execute: async ({ workflowName, input = {}, priority = 'medium' }) => {
    // Simplified workflow execution
    const executionData = {
      executionId: `exec-${Date.now()}`,
      workflowName,
      input,
      priority,
      status: 'started',
      startTime: new Date().toISOString(),
      message: `Workflow ${workflowName} execution started successfully`
    };
    
    console.log('🔄 Workflow executed:', executionData);
    
    return executionData;
  },
});

const monitorSystemTool = new Tool({
  name: 'monitorSystem',
  description: 'Monitor the agentic-flow system health and performance',
  inputSchema: {
    type: 'object',
    properties: {
      includeDetails: { type: 'boolean' }
    }
  },
  execute: async ({ includeDetails = false }) => {
    const systemStatus = {
      timestamp: new Date().toISOString(),
      status: 'healthy',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      agents: {
        total: 4,
        active: 4,
        idle: 0,
        types: ['coordinator', 'executor', 'researcher', 'architect']
      },
      workflows: {
        registered: 3,
        running: 0,
        completed: 0,
      },
      tools: {
        registered: 4,
        available: 4
      }
    };
    
    if (includeDetails) {
      systemStatus['details'] = {
        nodejs_version: process.version,
        platform: process.platform,
        cpu_usage: process.cpuUsage(),
        environment: process.env.NODE_ENV || 'development'
      };
    }
    
    console.log('🏥 System monitored:', systemStatus);
    
    return systemStatus;
  },
});

// Define comprehensive workflows
const softwareDevelopmentWorkflow = new Workflow({
  name: 'softwareDevelopment',
  description: 'Complete software development workflow with research, architecture, coding, testing, and review',
  steps: [
    {
      id: 'coordinate',
      type: 'agent',
      agent: coordinatorAgent,
      prompt: `Coordinate the software development for: {{requirement}}
      
      Please provide:
      1. Project breakdown and task assignment
      2. Team coordination strategy
      3. Timeline and milestones
      4. Risk assessment`,
    },
    {
      id: 'research',
      type: 'agent',
      agent: researcherAgent,
      prompt: `Research the following requirement: {{requirement}}
      
      Based on the coordination plan: {{outputs.coordinate.response}}
      
      Please provide:
      1. Technical feasibility analysis
      2. Similar solutions or patterns
      3. Technology recommendations
      4. Implementation approaches`,
    },
    {
      id: 'architect',
      type: 'agent',
      agent: architectAgent,
      prompt: `Design the architecture for: {{requirement}}
      
      Research findings: {{outputs.research.response}}
      Coordination plan: {{outputs.coordinate.response}}
      
      Please provide:
      1. System architecture design
      2. Component specifications
      3. Database design
      4. API specifications
      5. Scalability considerations`,
    },
    {
      id: 'implement',
      type: 'agent',
      agent: executorAgent,
      prompt: `Implement the solution based on:
      
      Requirement: {{requirement}}
      Architecture: {{outputs.architect.response}}
      Research: {{outputs.research.response}}
      
      Please provide:
      1. Implementation code
      2. Configuration files
      3. Documentation
      4. Deployment instructions`,
    },
    {
      id: 'notify-completion',
      type: 'tool',
      tool: sendMessageTool,
      input: {
        type: 'workflow.completed',
        message: 'Software development workflow completed for: {{requirement}}',
        priority: 'high'
      }
    }
  ],
});

const problemSolvingWorkflow = new Workflow({
  name: 'problemSolving',
  description: 'Structured problem-solving workflow',
  steps: [
    {
      id: 'analyze-problem',
      type: 'agent',
      agent: coordinatorAgent,
      prompt: 'Analyze and break down this problem: {{problem}}',
    },
    {
      id: 'research-solutions',
      type: 'agent',
      agent: researcherAgent,
      prompt: 'Research potential solutions for: {{outputs.analyze-problem.response}}',
    },
    {
      id: 'design-solution',
      type: 'agent',
      agent: architectAgent,
      prompt: 'Design a comprehensive solution based on: {{outputs.research-solutions.response}}',
    },
    {
      id: 'implement-solution',
      type: 'agent',
      agent: executorAgent,
      prompt: 'Implement the solution: {{outputs.design-solution.response}}',
    },
    {
      id: 'notify-solution',
      type: 'tool',
      tool: sendMessageTool,
      input: {
        type: 'solution.ready',
        message: 'Problem solved: {{problem}}',
        priority: 'high'
      }
    }
  ],
});

// Register all components
mastra.registerAgent(coordinatorAgent);
mastra.registerAgent(executorAgent);
mastra.registerAgent(researcherAgent);
mastra.registerAgent(architectAgent);

mastra.registerTool(createTeamTool);
mastra.registerTool(sendMessageTool);
mastra.registerTool(executeWorkflowTool);
mastra.registerTool(monitorSystemTool);

mastra.registerWorkflow(softwareDevelopmentWorkflow);
mastra.registerWorkflow(problemSolvingWorkflow);

console.log('🚀 Mastra configuration loaded with agentic-flow integration');
console.log('📊 Registered components:', {
  agents: 4,
  tools: 4,
  workflows: 2,
  server_url: `http://localhost:${mastra.config.server?.port || 4111}`
});

export default mastra;