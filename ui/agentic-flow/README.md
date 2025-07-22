# Agentic Flow UI

A modern web-based interface for Claude Flow, featuring Mastra integration, real-time swarm monitoring, and visual orchestration capabilities.

## Features

- **Real-time Agent Monitoring**: Track agent status, performance, and task execution
- **Visual Swarm Orchestration**: See and control agent swarms with an intuitive interface
- **MCP Tool Management**: Direct integration with MCP server for tool execution
- **HiveMind WebSocket**: Real-time communication between agents and UI
- **Mastra Integration**: Seamless integration with Mastra agents and workflows
- **Performance Analytics**: Monitor token usage, execution times, and resource consumption

## Quick Start

### Using the CLI

```bash
# Launch UI on default port (5173)
npx claude-flow ui

# Launch with custom options
npx claude-flow ui --port 8080 --open

# Launch with orchestrator
npx claude-flow start --vite
```

### Development Mode

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Architecture

### Frontend (React + Vite)

- **Components**: Modular React components for each UI element
- **State Management**: Zustand for global state
- **Real-time Updates**: WebSocket integration for live data
- **Visualization**: Chart.js and Three.js for data visualization

### Backend Integration

- **Express Server**: Proxy and API endpoints (`src/ui/server.ts`)
- **WebSocket Server**: Real-time HiveMind communication
- **MCP Proxy**: Forward requests to MCP server
- **Mastra Wrappers**: Integration with agentic-flow agents

## UI Components

### Dashboard
- System overview and health metrics
- Active agent count and status
- Task queue and execution progress
- Resource utilization graphs

### Swarm Manager
- Visual representation of agent topology
- Drag-and-drop agent spawning
- Real-time task distribution view
- Performance heatmaps

### MCP Tools
- Interactive tool testing interface
- Request/response history
- Tool documentation viewer
- Performance metrics per tool

### Agent Inspector
- Detailed agent information
- Task history and logs
- Performance metrics
- Memory usage visualization

## API Endpoints

### Agent Management
- `GET /api/agents` - List all agents
- `POST /api/agents/spawn` - Create new agent
- `DELETE /api/agents/:id` - Terminate agent
- `GET /api/agents/:id/metrics` - Get agent metrics

### Swarm Control
- `GET /api/swarm/status` - Get swarm status
- `POST /api/swarm/init` - Initialize swarm
- `PUT /api/swarm/topology` - Update topology

### HiveMind WebSocket

Connect to `ws://localhost:8080` for real-time updates:

```javascript
const ws = new WebSocket('ws://localhost:8080');

// Listen for updates
ws.on('message', (data) => {
  const { type, payload } = JSON.parse(data);
  // Handle different message types
});

// Send commands
ws.send(JSON.stringify({
  type: 'agent-update',
  payload: { agentId: 'agent-123', status: 'busy' }
}));
```

## Configuration

### Environment Variables

```bash
# Server configuration
PORT=8080                    # UI server port
HOST=localhost              # UI server host
MCP_SERVER_URL=http://localhost:3000  # MCP server URL
HIVE_MIND_URL=ws://localhost:8080    # WebSocket URL
VITE_PORT=5173             # Vite dev server port
NODE_ENV=development       # Environment mode
```

### Vite Configuration

See `vite.config.ts` for build and development settings.

## Mastra Integration

The UI integrates with Mastra agents through wrapper functions:

```typescript
import { createMastraAgent } from '../../src/mastra/agents';
import { BaseAgent } from '../../src/core/agent.base';

// Create Mastra-compatible agent
const agent = createMastraAgent(baseAgent);
```

## Development

### Adding New Components

1. Create component in `src/components/`
2. Add to appropriate section (dashboard, swarm, mcp, shared)
3. Update routing if needed
4. Add tests in `__tests__/`

### WebSocket Events

- `agent-update`: Agent status changes
- `task-update`: Task progress updates
- `swarm-status`: Swarm topology changes
- `metric-update`: Performance metrics

### State Management

Using Zustand stores in `src/stores/`:
- `agentStore`: Agent state and operations
- `swarmStore`: Swarm configuration and status
- `mcpStore`: MCP tool state
- `uiStore`: UI preferences and settings

## Production Build

```bash
# Build the UI
npm run build

# Preview production build
npm run preview

# Deploy (example with pm2)
pm2 start npm --name "claude-flow-ui" -- run preview
```

## Troubleshooting

### Common Issues

1. **Port already in use**: Change port with `--port` flag
2. **WebSocket connection failed**: Ensure orchestrator is running
3. **MCP proxy errors**: Check MCP server is accessible
4. **Build errors**: Clear node_modules and reinstall

### Debug Mode

Enable debug logging:
```bash
DEBUG=claude-flow:* npm run dev
```

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## License

Part of Claude Flow - see main repository for license details.