# Mastra Integration with Agentic Flow

This document describes the comprehensive integration between Mastra and the Agentic Flow system, providing a unified AI orchestration platform with visual workflow management.

## 🎯 Overview

The Mastra integration brings several key capabilities to Agentic Flow:

- **Visual Workflow Designer**: Create and manage workflows through a web-based UI
- **Agent Management**: Manage AI agents with different specializations
- **Tool Integration**: Access Agentic Flow capabilities through Mastra tools
- **Real-time Monitoring**: Monitor system health and agent performance
- **Multi-LLM Support**: Work with various language model providers

## 🏗️ Architecture

The integration consists of several key components:

### 1. Mastra Configuration (`src/mastra/index.ts`)
- Main Mastra instance configuration
- Server settings and port configuration
- Telemetry and logging configuration
- Component registration

### 2. Agent Definitions (`src/mastra/agents.ts`)
- Coordinator agents for team management
- Executor agents for task implementation
- Research agents for information gathering
- Specialized agents (architect, coder, tester, etc.)

### 3. Tool Definitions (`src/mastra/tools.ts`)
- `createTeam`: Create teams of agents for specific goals
- `executeWorkflow`: Execute Agentic Flow workflows
- `sendMessage`: Send messages through the message bus
- `getAgentStatus`: Monitor agent performance
- `createGoal`: Create new goals in the system
- `monitorSystem`: System health monitoring

### 4. Workflow Definitions (`src/mastra/workflows.ts`)
- `softwareDevelopment`: Complete SDLC workflow
- `problemSolution`: Problem analysis and solution design
- `agentCoordination`: Multi-agent coordination patterns
- `systemMonitoring`: Health monitoring and reporting

## 🚀 Getting Started

### Prerequisites

- Node.js 16+ installed
- Agentic Flow project set up
- Environment variables configured (API keys, etc.)

### Installation

The Mastra integration is already included in the Agentic Flow project. To start the Mastra UI:

```bash
# From the agentic-flow directory
npx mastra dev
```

The UI will be available at `http://localhost:4111` by default.

### Environment Variables

Set these environment variables for optimal configuration:

```bash
# Mastra Configuration
MASTRA_PORT=4111
MASTRA_BASE_URL=http://localhost:4111
DATABASE_URL=sqlite:./data/mastra.db

# AI Model Configuration
ANTHROPIC_API_KEY=your_anthropic_key
OPENAI_API_KEY=your_openai_key
GOOGLE_API_KEY=your_google_key
```

## 🎮 Using the Integration

### 1. Creating Teams

Use the `createTeam` tool to form agent teams:

```typescript
const teamResult = await mastra.executeTool('createTeam', {
  teamName: 'dev-team-alpha',
  goal: 'Build a REST API for user management',
  agentTypes: ['coordinator', 'architect', 'coder', 'tester'],
  teamSize: 4
});
```

### 2. Running Workflows

Execute pre-defined workflows:

```typescript
const workflowResult = await mastra.executeWorkflow('softwareDevelopment', {
  requirement: 'Create a user authentication system',
  priority: 'high',
  deadline: '2024-01-31'
});
```

### 3. Agent Communication

Send messages between agents:

```typescript
await mastra.executeTool('sendMessage', {
  type: 'task.assignment',
  message: 'Please review the authentication implementation',
  priority: 'high'
});
```

## 🔧 Available Workflows

### Software Development Workflow
Comprehensive workflow covering:
- Research and analysis
- Architecture design
- Implementation
- Testing
- Code review
- Deployment planning

### Problem Solution Workflow
Structured problem-solving approach:
- Problem decomposition
- Solution design
- Implementation planning
- Risk assessment
- Success metrics

### Agent Coordination Workflow
Multi-agent coordination patterns:
- Task distribution
- Parallel execution
- Result aggregation
- Performance monitoring

### System Monitoring Workflow
Health and performance monitoring:
- System status checks
- Agent utilization analysis
- Performance bottleneck identification
- Alert generation

## 🛠️ Available Tools

### Core Tools

| Tool Name | Description | Use Case |
|-----------|-------------|----------|
| `createTeam` | Form agent teams | Multi-agent task coordination |
| `executeWorkflow` | Run Agentic Flow workflows | Process automation |
| `sendMessage` | Inter-agent messaging | Communication and coordination |
| `getAgentStatus` | Agent monitoring | Performance tracking |
| `createGoal` | Goal management | Task planning |
| `monitorSystem` | System health checks | Maintenance and monitoring |

### Integration Benefits

1. **Visual Management**: Manage complex agent workflows through a visual interface
2. **Scalability**: Handle large-scale multi-agent operations
3. **Monitoring**: Real-time visibility into system performance
4. **Flexibility**: Easy configuration and customization
5. **Reliability**: Built-in error handling and recovery

## 📊 Monitoring and Analytics

The integration provides comprehensive monitoring capabilities:

### Agent Metrics
- Task completion rates
- Response times
- Success rates
- Resource utilization

### System Metrics
- Memory usage
- CPU utilization
- Message queue status
- Workflow execution times

### Business Metrics
- Goal achievement rates
- Time-to-completion
- Quality scores
- Cost analysis

## 🔒 Security Considerations

- API keys are handled securely through environment variables
- All agent communications are logged for audit purposes
- Role-based access control for different agent types
- Secure message passing between agents

## 🚨 Troubleshooting

### Common Issues

**Mastra UI not starting:**
```bash
# Clear the cache and restart
rm -rf .mastra
npx mastra dev
```

**Import errors:**
- Ensure all dependencies are installed: `npm install`
- Check that paths are correctly configured

**Agent communication failures:**
- Verify message bus is initialized
- Check network connectivity
- Review agent status logs

### Debugging

Enable detailed logging:
```bash
DEBUG=mastra:* npx mastra dev
```

## 🎯 Future Enhancements

Planned improvements include:

1. **Enhanced UI Components**: More interactive workflow builders
2. **Advanced Analytics**: Machine learning-powered insights
3. **Integration Plugins**: Support for more external systems
4. **Performance Optimizations**: Improved scalability
5. **Security Features**: Enhanced authentication and authorization

## 📚 API Reference

### Mastra Instance Methods

```typescript
// Register components
mastra.registerAgent(agent)
mastra.registerTool(tool)
mastra.registerWorkflow(workflow)

// Execute components
await mastra.executeWorkflow(name, input)
await mastra.executeTool(name, input)
await mastra.executeAgent(name, prompt)
```

### Configuration Options

```typescript
const mastra = new Mastra({
  name: 'agentic-flow',
  version: '1.0.0',
  server: {
    port: 4111,
    baseUrl: 'http://localhost:4111'
  },
  telemetry: { enabled: false },
  logs: { enabled: true, level: 'info' },
  db: {
    provider: 'sqlite',
    uri: 'sqlite:./data/mastra.db'
  }
});
```

## 🤝 Contributing

To contribute to the Mastra integration:

1. Fork the repository
2. Create a feature branch
3. Implement your changes
4. Add tests and documentation
5. Submit a pull request

## 📄 License

This integration is part of the Agentic Flow project and follows the same licensing terms.

---

*For more information about Mastra, visit: https://mastra.ai*
*For Agentic Flow documentation, see: [../README.md](../README.md)*