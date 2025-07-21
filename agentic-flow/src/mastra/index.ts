import { Mastra } from '@mastra/core';
import { mastraAgents } from './agents';
import { mastraTools } from './tools';
import { mastraWorkflows } from './workflows';
import { WorkflowEngine } from '../workflows/workflow-engine';
import { AgentManager } from '../lib/agent-manager';
import { MessageBus } from '../communication/message-bus';

// Create Mastra instance with agentic-flow integration
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
  
  // Configure database (optional)
  db: {
    provider: 'sqlite',
    uri: process.env.DATABASE_URL || 'sqlite:./data/mastra.db',
  },
});

// Register all Mastra agents
Object.values(mastraAgents).forEach(agent => {
  mastra.registerAgent(agent);
});

// Register all Mastra tools
Object.values(mastraTools).forEach(tool => {
  mastra.registerTool(tool);
});

// Register all Mastra workflows
Object.values(mastraWorkflows).forEach(workflow => {
  mastra.registerWorkflow(workflow);
});

// Export utility functions for integration
export const initializeMastraIntegration = async () => {
  console.log('🚀 Initializing Mastra integration with agentic-flow...');
  
  try {
    // Initialize core agentic-flow components
    const messageBus = MessageBus.getInstance();
    const agentManager = new AgentManager();
    const workflowEngine = new WorkflowEngine();
    
    // Start the workflow engine
    console.log('📋 Starting workflow engine...');
    await workflowEngine.start();
    
    // Initialize message bus subscriptions for Mastra integration
    console.log('📨 Setting up message bus subscriptions...');
    messageBus.subscribe('mastra.*', async (message) => {
      console.log('📥 Received Mastra message:', {
        type: message.type,
        sender: message.senderId,
        timestamp: message.timestamp
      });
    });
    
    // Subscribe to workflow events
    messageBus.subscribe('workflow.*', async (message) => {
      console.log('🔄 Workflow event:', {
        type: message.type,
        payload: message.payload
      });
    });
    
    // Subscribe to agent events
    messageBus.subscribe('agent.*', async (message) => {
      console.log('🤖 Agent event:', {
        type: message.type,
        agentId: message.payload?.agentId || 'unknown'
      });
    });
    
    // Initialize periodic health monitoring
    console.log('🏥 Setting up health monitoring...');
    setInterval(async () => {
      try {
        const healthData = {
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          agents: (await agentManager.listAgents()).length
        };
        
        await messageBus.publish({
          type: 'system.health.check',
          senderId: 'mastra-integration',
          recipientId: 'system-monitor',
          payload: healthData,
          timestamp: new Date(),
          priority: 'low'
        });
      } catch (error) {
        console.error('❌ Health check failed:', error.message);
      }
    }, 60000); // Every minute
    
    console.log('✅ Mastra integration initialized successfully');
    console.log(`🌐 Mastra UI will be available at: http://localhost:${mastra.config.server?.port || 4111}`);
    
    return {
      status: 'success',
      message: 'Mastra integration initialized',
      ui_url: `http://localhost:${mastra.config.server?.port || 4111}`,
      agents: Object.keys(mastraAgents),
      tools: Object.keys(mastraTools),
      workflows: Object.keys(mastraWorkflows)
    };
    
  } catch (error) {
    console.error('❌ Failed to initialize Mastra integration:', error);
    throw error;
  }
};

// Export components for external use
export * from './agents';
export * from './tools';
export * from './workflows';

// Export the configured mastra instance
export default mastra;
