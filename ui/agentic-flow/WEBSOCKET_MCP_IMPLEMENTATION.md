# WebSocket MCP Tool Implementation

## Overview

This implementation replaces HTTP/CLI-based MCP tool execution with real-time WebSocket communication for better performance and streaming capabilities.

## Architecture

### Frontend Components

1. **MCPBridgeWebSocket** (`src/api/mcp-bridge-websocket.ts`)
   - Replaces the HTTP-based MCP bridge
   - Uses WebSocket for real-time communication
   - Supports streaming progress updates
   - Provides connection status monitoring

2. **MCPToolsWebSocket** (`src/components/mcp/MCPToolsWebSocket.tsx`)
   - Updated UI component with WebSocket integration
   - Shows real-time connection status
   - Displays streaming execution progress
   - Enhanced error handling and retry logic

3. **Socket Client** (`src/api/socket-client.ts`)
   - Browser-compatible Socket.IO client
   - Handles WebSocket connection management
   - Provides event-based communication
   - Auto-reconnection with exponential backoff

### Backend Components

1. **WebSocket Server** (`server/websocket.ts`)
   - Enhanced with MCP tool execution handlers
   - Supports tool discovery via WebSocket
   - Streams execution progress in real-time
   - Manages concurrent tool executions

2. **MCP Handler** (`server/mcp-handler.ts`)
   - Interfaces with real Claude Flow MCP server
   - Queues and manages tool executions
   - Provides streaming progress updates
   - Handles tool validation and error recovery

## Key Features

### Real-time Tool Execution
- Tools execute via WebSocket instead of HTTP requests
- Progress updates stream in real-time
- Connection status is always visible
- Automatic reconnection on disconnect

### Enhanced User Experience
- Visual connection indicators (WiFi icons)
- Streaming progress display during execution
- Retry buttons for failed connections
- Real-time tool availability updates

### Performance Benefits
- Lower latency than HTTP polling
- Persistent connections reduce overhead
- Streaming reduces perceived execution time
- Better error recovery and resilience

## WebSocket Events

### Client → Server

| Event | Description | Parameters |
|-------|-------------|------------|
| `mcp:tools:discover` | Request available tools | None |
| `mcp:tool:execute` | Execute a tool | `{executionId, toolName, parameters, options}` |
| `subscribe:swarm` | Subscribe to swarm updates | `{swarmId}` |
| `subscribe:agent` | Subscribe to agent updates | `{agentId}` |

### Server → Client

| Event | Description | Payload |
|-------|-------------|---------|
| `mcp:tools:list` | Available tools response | `{tools, timestamp}` |
| `mcp:tool:progress` | Execution progress update | `{executionId, progress}` |
| `mcp:tool:response` | Final execution result | `{executionId, success, result, error, executionTime}` |
| `connected` | WebSocket connection established | `{socketId, timestamp, server, version}` |

## Connection Flow

1. **Initial Connection**
   ```
   Client → Server: WebSocket connection
   Server → Client: 'connected' event with server info
   ```

2. **Tool Discovery**
   ```
   Client → Server: 'mcp:tools:discover'
   Server → Client: 'mcp:tools:list' with available tools
   ```

3. **Tool Execution**
   ```
   Client → Server: 'mcp:tool:execute' with parameters
   Server → Client: 'mcp:tool:progress' (multiple updates)
   Server → Client: 'mcp:tool:response' with final result
   ```

## Error Handling

### Connection Errors
- Automatic reconnection with exponential backoff
- Visual connection status indicators
- Manual retry buttons
- Graceful degradation to static tool lists

### Execution Errors
- Detailed error messages with context
- Retry capabilities for failed executions
- Progress tracking even for failed operations
- Timeout handling with configurable limits

## Configuration

### Client Configuration
```typescript
const webSocketConfig = {
  url: 'localhost',
  port: 3001,
  autoConnect: true,
  reconnectInterval: 5000,
  maxReconnectAttempts: 10
}
```

### Server Configuration
```typescript
const mcpConfig = {
  command: 'npx',
  args: ['claude-flow@alpha', 'mcp', 'start'],
  timeout: 30000,
  maxConcurrentTools: 5
}
```

## Testing

### Manual Testing
1. Start the backend server: `cd server && npm run dev`
2. Start the frontend: `cd .. && npm run dev`
3. Navigate to `/mcp-tools` in the browser
4. Verify connection status shows "WebSocket Connected"
5. Test tool discovery and execution

### Automated Testing
```bash
# Test WebSocket MCP integration
node test-websocket-mcp.js
```

## Migration Guide

### From HTTP to WebSocket

1. **Replace MCP Bridge Import**
   ```typescript
   // Before
   import { MCPBridge } from '../api/mcp-bridge'
   
   // After
   import { getMCPBridgeWebSocket } from '../api/mcp-bridge-websocket'
   ```

2. **Update Component Usage**
   ```typescript
   // Before
   const mcpBridge = new MCPBridge()
   
   // After
   const mcpBridge = getMCPBridgeWebSocket()
   ```

3. **Handle Connection Status**
   ```typescript
   // Check connection before executing tools
   if (!mcpBridge.isConnected()) {
     throw new Error('WebSocket not connected')
   }
   ```

4. **Add Progress Handlers**
   ```typescript
   await mcpBridge.executeTool(toolName, params, {
     onProgress: (progress) => {
       console.log('Progress:', progress)
     }
   })
   ```

## Benefits Over HTTP Implementation

1. **Real-time Updates**: Immediate feedback vs polling
2. **Lower Latency**: Persistent connections vs request overhead
3. **Better UX**: Connection status and progress indicators
4. **Streaming Support**: Progress updates during long operations
5. **Resilience**: Auto-reconnection and error recovery
6. **Scalability**: More efficient resource usage

## Future Enhancements

1. **Tool Caching**: Cache frequently used tools client-side
2. **Offline Support**: Queue operations when disconnected
3. **Multiplexing**: Multiple concurrent tool executions
4. **Authentication**: Secure WebSocket connections
5. **Rate Limiting**: Prevent tool execution abuse
6. **Metrics**: Detailed performance and usage analytics