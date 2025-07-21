# Agentic Flow Python SDK

Official Python SDK for the Agentic Flow API. Build autonomous AI agent systems with ease.

## Installation

```bash
pip install agentic-flow
```

## Requirements

- Python 3.8+
- httpx
- pydantic >= 2.0
- websockets

## Quick Start

```python
from agentic_flow import AsyncAgenticFlowClient, AgentType

# Async client (recommended)
async with AsyncAgenticFlowClient(api_key="your-api-key") as client:
    # Create an agent
    agent = await client.agents.create(
        name="Data Processor",
        type=AgentType.EXECUTOR,
        capabilities=["data-processing", "analysis"]
    )
    
    # Start the agent
    await client.agents.start(agent.id)
    
    # Create a goal
    goal = await client.goals.create(
        description="Analyze sales data from Q4 2023 and generate report",
        priority="high"
    )
    
    # Assign goal to agent
    await client.goals.assign(goal.id, agent.id)
```

### Synchronous Client

```python
from agentic_flow import AgenticFlowClient, AgentType

# Synchronous client
with AgenticFlowClient(api_key="your-api-key") as client:
    # Create an agent
    agent = client.agents.create(
        name="Data Processor",
        type=AgentType.EXECUTOR,
        capabilities=["data-processing", "analysis"]
    )
    
    # Start the agent
    client.agents.start(agent.id)
```

## Authentication

The SDK supports two authentication methods:

### API Key Authentication

```python
# Via parameter
client = AsyncAgenticFlowClient(api_key="af_your_api_key_here")

# Via environment variable
# Set AGENTIC_FLOW_API_KEY=af_your_api_key_here
client = AsyncAgenticFlowClient()
```

### JWT Token Authentication

```python
client = AsyncAgenticFlowClient(access_token="your-jwt-token")
```

## Core Resources

### Agents

Manage autonomous agents:

```python
# Create an agent
agent = await client.agents.create(
    name="My Agent",
    type=AgentType.COORDINATOR,
    capabilities=["planning", "delegation"],
    configuration={
        "max_concurrent_tasks": 5,
        "timeout": 30000
    }
)

# List agents
agents = await client.agents.list(
    limit=20,
    status=AgentStatus.ACTIVE,
    type=AgentType.EXECUTOR
)

# Update agent
agent = await client.agents.update(
    agent.id,
    name="Updated Agent Name",
    capabilities=["planning", "delegation", "monitoring"]
)

# Start/stop agent
await client.agents.start(agent.id)
await client.agents.stop(agent.id)

# Get agent metrics
metrics = await client.agents.get_metrics(agent.id)

# Wait for agent to be ready
agent = await client.agents.wait_for_status(
    agent.id,
    AgentStatus.ACTIVE,
    timeout=30.0
)
```

### Workflows

Create and execute workflows:

```python
from agentic_flow import WorkflowStepType

# Create a workflow
workflow = await client.workflows.create(
    name="Data Processing Pipeline",
    description="Process and analyze data files",
    steps=[
        {
            "name": "Load Data",
            "type": WorkflowStepType.AGENT,
            "action": "load_data",
            "parameters": {"source": "s3://bucket/data.csv"}
        },
        {
            "name": "Process Data",
            "type": WorkflowStepType.AGENT,
            "action": "process",
            "dependencies": ["Load Data"]
        },
        {
            "name": "Generate Report",
            "type": WorkflowStepType.AGENT,
            "action": "report",
            "dependencies": ["Process Data"]
        }
    ]
)

# Execute workflow
execution = await client.workflows.execute(
    workflow.id,
    parameters={
        "output_format": "pdf",
        "include_charts": True
    }
)

# Wait for completion
result = await client.workflows.wait_for_execution(
    workflow.id,
    execution.id,
    timeout=300.0  # 5 minutes
)
```

### Goals

Natural language goal processing:

```python
from agentic_flow import Priority

# Create goal from natural language
goal = await client.goals.create(
    description="Analyze customer feedback from last month and identify top 3 issues",
    priority=Priority.HIGH,
    constraints={
        "deadline": "2024-01-15",
        "data_source": "customer_feedback_db"
    }
)

# Track progress
progress = await client.goals.get_progress(goal.id)
print(f"Goal is {progress['overall']}% complete")

# Wait for completion
completed_goal = await client.goals.wait_for_completion(
    goal.id,
    timeout=600.0  # 10 minutes
)
```

### Messages

Inter-agent communication:

```python
from agentic_flow import MessageType, Priority

# Send message between agents
message = await client.messages.send(
    from_agent="coordinator-agent",
    to_agent="executor-agent",
    type=MessageType.TASK,
    content={
        "action": "process_file",
        "parameters": {
            "file_id": "12345",
            "operations": ["validate", "transform", "store"]
        }
    },
    priority=Priority.HIGH
)

# Broadcast to multiple agents
broadcast = await client.messages.broadcast(
    from_agent="coordinator",
    recipients=["agent-1", "agent-2", "agent-3"],
    type=MessageType.EVENT,
    content={
        "event": "configuration_update",
        "data": {"setting": "value"}
    }
)

# List messages
messages = await client.messages.list(
    agent_id="agent-id",
    type=MessageType.TASK,
    since="2024-01-01T00:00:00Z"
)
```

### Webhooks

Real-time event notifications:

```python
# Create webhook
webhook = await client.webhooks.create(
    url="https://your-app.com/webhook",
    events=[
        "agent.created",
        "agent.status_changed",
        "workflow.completed",
        "goal.completed"
    ],
    secret="your-webhook-secret"
)

# Test webhook
test_result = await client.webhooks.test(webhook.id)

# Get delivery history
deliveries = await client.webhooks.get_deliveries(
    webhook.id,
    limit=50
)

# Validate webhook signature (in your webhook handler)
from agentic_flow import WebhookValidator

validator = WebhookValidator("your-webhook-secret")

# In your webhook handler
def handle_webhook(request):
    signature = request.headers.get("X-Webhook-Signature")
    
    if not validator.validate(request.body, signature):
        return {"error": "Invalid signature"}, 401
    
    # Process webhook event
    event = request.json()
    print(f"Received event: {event['type']}")
    return {"status": "ok"}, 200
```

### Plugins

Extend functionality with plugins:

```python
# Install plugin
plugin = await client.plugins.install(
    source="npm:agentic-flow-slack",
    configuration={
        "webhook_url": "https://hooks.slack.com/services/..."
    }
)

# Enable/disable plugin
await client.plugins.enable(plugin.id)
await client.plugins.disable(plugin.id)

# Execute plugin action
result = await client.plugins.execute(
    plugin.id,
    action="send_message",
    parameters={
        "channel": "#notifications",
        "text": "Task completed successfully!"
    }
)

# Search available plugins
available = await client.plugins.search_available(
    category="communication"
)
```

## Real-time Events

The SDK supports WebSocket connections for real-time events:

```python
# Enable WebSocket when creating client
async with AsyncAgenticFlowClient(
    api_key="your-api-key",
    enable_websocket=True
) as client:
    # Subscribe to events
    await client.subscribe_to_agent("agent-id")
    
    # Listen for events
    async for event in client.events():
        if event.type == "agent.status_changed":
            print(f"Agent {event.data['agent_id']} status: {event.data['status']}")
        elif event.type == "workflow.completed":
            print(f"Workflow {event.data['workflow_id']} completed")
        elif event.type == "goal.created":
            print(f"New goal: {event.data['goal']['description']}")
```

## Error Handling

The SDK provides typed exceptions for better error handling:

```python
from agentic_flow import (
    AgenticFlowError,
    APIError,
    AuthenticationError,
    RateLimitError,
    ValidationError,
    NotFoundError,
)

try:
    agent = await client.agents.create(name="", type="invalid")
except ValidationError as e:
    print(f"Validation failed: {e.errors}")
except AuthenticationError:
    print("Authentication failed - check your API key")
except RateLimitError as e:
    print(f"Rate limited - retry after {e.retry_after} seconds")
except APIError as e:
    print(f"API error {e.status_code}: {e.message}")
except AgenticFlowError as e:
    print(f"SDK error: {e}")
```

## Advanced Usage

### Custom Headers

```python
client = AsyncAgenticFlowClient(
    api_key="your-api-key",
    headers={
        "X-Custom-Header": "value"
    }
)
```

### Request Options

```python
# Override timeout for specific request
agent = await client.agents.create(
    name="Agent",
    type=AgentType.EXECUTOR,
    timeout=60.0  # 60 seconds
)
```

### Custom Base URL

```python
client = AsyncAgenticFlowClient(
    api_key="your-api-key",
    base_url="https://custom-api.agenticflow.dev/v1"
)
```

### Connection Pooling

The SDK automatically manages connection pooling for optimal performance.

### Retry Configuration

```python
client = AsyncAgenticFlowClient(
    api_key="your-api-key",
    max_retries=5,  # Retry failed requests up to 5 times
)
```

## Type Hints

The SDK is fully typed with Python type hints:

```python
from agentic_flow import (
    Agent,
    Workflow,
    Goal,
    Message,
    CreateAgentRequest,
    AgentType,
    AgentStatus,
    Priority,
)

def create_agent(client: AsyncAgenticFlowClient, name: str) -> Agent:
    return client.agents.create(
        name=name,
        type=AgentType.EXECUTOR
    )
```

## Examples

See the [examples](./examples) directory for more detailed examples:

- [Basic Agent Management](./examples/01_basic_agents.py)
- [Workflow Orchestration](./examples/02_workflows.py)
- [Natural Language Goals](./examples/03_goals.py)
- [Agent Communication](./examples/04_messaging.py)
- [Webhooks Integration](./examples/05_webhooks.py)
- [Plugin System](./examples/06_plugins.py)
- [Real-time Events](./examples/07_realtime_events.py)
- [Error Handling](./examples/08_error_handling.py)

## Testing

Run tests with pytest:

```bash
# Install dev dependencies
pip install -e ".[dev]"

# Run tests
pytest

# Run with coverage
pytest --cov=agentic_flow

# Run type checking
mypy src/agentic_flow
```

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## License

MIT License - see [LICENSE](LICENSE) for details.

## Support

- 📚 [Documentation](https://docs.agenticflow.dev)
- 💬 [Discord Community](https://discord.gg/agenticflow)
- 🐛 [Issue Tracker](https://github.com/agentic-flow/sdk-python/issues)
- 📧 [Email Support](mailto:support@agenticflow.dev)