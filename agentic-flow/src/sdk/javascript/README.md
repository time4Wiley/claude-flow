# Agentic Flow JavaScript/TypeScript SDK

Official JavaScript/TypeScript SDK for the Agentic Flow API. Build autonomous AI agent systems with ease.

## Installation

```bash
npm install @agentic-flow/sdk
# or
yarn add @agentic-flow/sdk
# or
pnpm add @agentic-flow/sdk
```

## Quick Start

```typescript
import { AgenticFlowClient } from '@agentic-flow/sdk';

// Initialize the client
const client = new AgenticFlowClient({
  apiKey: 'your-api-key',
  baseUrl: 'https://api.agenticflow.dev/v1' // Optional, this is the default
});

// Create an agent
const agent = await client.agents.create({
  name: 'Data Processor',
  type: 'executor',
  capabilities: ['data-processing', 'analysis']
});

// Start the agent
await client.agents.start(agent.id);

// Create a goal
const goal = await client.goals.create({
  description: 'Analyze sales data from Q4 2023 and generate report',
  priority: 'high'
});

// Assign goal to agent
await client.goals.assign(goal.id, agent.id);
```

## Authentication

The SDK supports two authentication methods:

### API Key Authentication

```typescript
const client = new AgenticFlowClient({
  apiKey: 'af_your_api_key_here'
});
```

### JWT Token Authentication

```typescript
const client = new AgenticFlowClient({
  accessToken: 'your-jwt-token'
});
```

## Core Resources

### Agents

Manage autonomous agents:

```typescript
// Create an agent
const agent = await client.agents.create({
  name: 'My Agent',
  type: 'coordinator',
  capabilities: ['planning', 'delegation'],
  configuration: {
    maxConcurrentTasks: 5,
    timeout: 30000
  }
});

// List agents
const agents = await client.agents.list({
  limit: 20,
  status: 'active',
  type: 'executor'
});

// Update agent
await client.agents.update(agent.id, {
  name: 'Updated Agent Name',
  capabilities: ['planning', 'delegation', 'monitoring']
});

// Start/stop agent
await client.agents.start(agent.id);
await client.agents.stop(agent.id);

// Get agent metrics
const metrics = await client.agents.getMetrics(agent.id);
```

### Workflows

Create and execute workflows:

```typescript
// Create a workflow
const workflow = await client.workflows.create({
  name: 'Data Processing Pipeline',
  description: 'Process and analyze data files',
  steps: [
    {
      name: 'Load Data',
      type: 'agent',
      action: 'load_data',
      parameters: { source: 's3://bucket/data.csv' }
    },
    {
      name: 'Process Data',
      type: 'agent',
      action: 'process',
      dependencies: ['Load Data']
    },
    {
      name: 'Generate Report',
      type: 'agent',
      action: 'report',
      dependencies: ['Process Data']
    }
  ]
});

// Execute workflow
const execution = await client.workflows.execute(workflow.id, {
  parameters: {
    outputFormat: 'pdf',
    includeCharts: true
  }
});

// Wait for completion
const result = await client.workflows.waitForExecution(
  workflow.id,
  execution.id,
  { timeout: 300000 } // 5 minutes
);
```

### Goals

Natural language goal processing:

```typescript
// Create goal from natural language
const goal = await client.goals.create({
  description: 'Analyze customer feedback from last month and identify top 3 issues',
  priority: 'high',
  constraints: {
    deadline: '2024-01-15',
    dataSource: 'customer_feedback_db'
  }
});

// Track progress
const progress = await client.goals.getProgress(goal.id);
console.log(`Goal is ${progress.overall}% complete`);

// Wait for completion
const completedGoal = await client.goals.waitForCompletion(goal.id, {
  timeout: 600000 // 10 minutes
});
```

### Messages

Inter-agent communication:

```typescript
// Send message between agents
const message = await client.messages.send({
  from: 'coordinator-agent',
  to: 'executor-agent',
  type: 'task',
  content: {
    action: 'process_file',
    parameters: {
      fileId: '12345',
      operations: ['validate', 'transform', 'store']
    }
  },
  priority: 'high'
});

// Broadcast to multiple agents
await client.messages.broadcast({
  from: 'coordinator',
  recipients: ['agent-1', 'agent-2', 'agent-3'],
  type: 'event',
  content: {
    event: 'configuration_update',
    data: { setting: 'value' }
  }
});

// List messages
const messages = await client.messages.list({
  agentId: 'agent-id',
  type: 'task',
  since: '2024-01-01T00:00:00Z'
});
```

### Webhooks

Real-time event notifications:

```typescript
// Create webhook
const webhook = await client.webhooks.create({
  url: 'https://your-app.com/webhook',
  events: [
    'agent.created',
    'agent.status_changed',
    'workflow.completed',
    'goal.completed'
  ],
  secret: 'your-webhook-secret'
});

// Test webhook
const testResult = await client.webhooks.test(webhook.id);

// Get delivery history
const deliveries = await client.webhooks.getDeliveries(webhook.id, {
  limit: 50
});

// Validate webhook signature (in your webhook handler)
app.post('/webhook', (req, res) => {
  const signature = req.headers['x-webhook-signature'];
  const isValid = client.webhooks.validateSignature(
    req.body,
    signature,
    'your-webhook-secret'
  );
  
  if (!isValid) {
    return res.status(401).send('Invalid signature');
  }
  
  // Process webhook event
  console.log('Received event:', req.body);
  res.status(200).send('OK');
});
```

### Plugins

Extend functionality with plugins:

```typescript
// Install plugin
const plugin = await client.plugins.install({
  source: 'npm:agentic-flow-slack',
  configuration: {
    webhookUrl: 'https://hooks.slack.com/services/...'
  }
});

// Enable/disable plugin
await client.plugins.enable(plugin.id);
await client.plugins.disable(plugin.id);

// Execute plugin action
const result = await client.plugins.execute(plugin.id, {
  action: 'send_message',
  parameters: {
    channel: '#notifications',
    text: 'Task completed successfully!'
  }
});

// Search available plugins
const available = await client.plugins.searchAvailable({
  category: 'communication'
});
```

## Real-time Events

The SDK supports WebSocket connections for real-time events:

```typescript
// Listen for agent events
client.on('agent:status_changed', (event) => {
  console.log(`Agent ${event.agentId} status: ${event.status}`);
});

// Listen for workflow events
client.on('workflow:completed', (event) => {
  console.log(`Workflow ${event.workflowId} completed`);
  console.log('Results:', event.results);
});

// Listen for goal events
client.on('goal:created', (event) => {
  console.log(`New goal: ${event.goal.description}`);
});

// Subscribe to specific agent
client.agents.subscribe('agent-id');

// Unsubscribe when done
client.agents.unsubscribe('agent-id');
```

## Error Handling

The SDK provides typed errors for better error handling:

```typescript
import { 
  AgenticFlowError,
  APIError,
  AuthenticationError,
  RateLimitError,
  ValidationError,
  NotFoundError
} from '@agentic-flow/sdk';

try {
  await client.agents.create({ name: '', type: 'invalid' });
} catch (error) {
  if (error instanceof ValidationError) {
    console.error('Validation failed:', error.errors);
  } else if (error instanceof AuthenticationError) {
    console.error('Authentication failed:', error.message);
  } else if (error instanceof RateLimitError) {
    console.error(`Rate limited. Retry after ${error.retryAfter} seconds`);
  } else if (error instanceof APIError) {
    console.error(`API error ${error.statusCode}: ${error.message}`);
  }
}
```

## Advanced Usage

### Custom Headers

```typescript
const client = new AgenticFlowClient({
  apiKey: 'your-api-key',
  headers: {
    'X-Custom-Header': 'value'
  }
});
```

### Request Options

```typescript
// Override timeout for specific request
const agent = await client.agents.create(
  { name: 'Agent', type: 'executor' },
  { 
    timeout: 60000, // 60 seconds
    maxRetries: 5,
    headers: {
      'X-Request-ID': 'custom-id'
    }
  }
);
```

### Disable WebSocket

```typescript
const client = new AgenticFlowClient({
  apiKey: 'your-api-key',
  enableWebSocket: false // Disable real-time events
});
```

### Health Check

```typescript
const health = await client.getHealth();
console.log('API Status:', health.status);
```

## TypeScript Support

The SDK is written in TypeScript and provides comprehensive type definitions:

```typescript
import type {
  Agent,
  Workflow,
  Goal,
  Message,
  CreateAgentRequest,
  AgentType,
  AgentStatus,
  Priority
} from '@agentic-flow/sdk';

// All types are fully typed
const createAgent = async (data: CreateAgentRequest): Promise<Agent> => {
  return await client.agents.create(data);
};
```

## Examples

See the [examples](./examples) directory for more detailed examples:

- [Basic Agent Management](./examples/01-basic-agents.ts)
- [Workflow Orchestration](./examples/02-workflows.ts)
- [Natural Language Goals](./examples/03-goals.ts)
- [Agent Communication](./examples/04-messaging.ts)
- [Webhooks Integration](./examples/05-webhooks.ts)
- [Plugin System](./examples/06-plugins.ts)
- [Real-time Events](./examples/07-realtime-events.ts)
- [Error Handling](./examples/08-error-handling.ts)

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## License

MIT License - see [LICENSE](LICENSE) for details.

## Support

- 📚 [Documentation](https://docs.agenticflow.dev)
- 💬 [Discord Community](https://discord.gg/agenticflow)
- 🐛 [Issue Tracker](https://github.com/agentic-flow/sdk-javascript/issues)
- 📧 [Email Support](mailto:support@agenticflow.dev)