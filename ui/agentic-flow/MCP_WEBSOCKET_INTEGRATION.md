# MCP WebSocket Client Integration

## Overview

This document describes the real, functional WebSocket client implementation for the Model Context Protocol (MCP) that replaces the previous CLI-based approach.

## Architecture

### 1. MCP WebSocket Client (`mcp-websocket-client.ts`)

A fully functional WebSocket client that implements:

- **JSON-RPC 2.0 Protocol**: Complete implementation with request/response handling
- **Real WebSocket Connection**: Uses browser WebSocket API to connect to `ws://localhost:3008`
- **MCP Protocol Support**: Implements initialize, list tools, and call tool operations
- **Streaming Support**: Handles streaming responses from MCP tools
- **Automatic Reconnection**: Intelligent reconnection with exponential backoff
- **Error Handling**: Comprehensive error handling and recovery
- **Event-Driven Architecture**: EventEmitter pattern for UI integration

### 2. Enhanced MCP Bridge (`mcp-bridge.ts`)

Updated to use WebSocket client with HTTP fallback:

- **WebSocket First**: Attempts WebSocket connection on initialization
- **HTTP Fallback**: Falls back to HTTP API if WebSocket fails
- **Real Tool Loading**: Dynamically loads tools from MCP server
- **Connection Status**: Tracks and reports WebSocket connection status
- **Parameter Validation**: Validates tool parameters before execution

### 3. UI Integration (`MCPTools.tsx`)

Enhanced with WebSocket status indicators:

- **Connection Status**: Visual indicator showing WebSocket vs HTTP mode
- **Real-time Updates**: Updates connection status every second
- **Error Handling**: Shows connection errors and fallback mode
- **Dynamic Tool Loading**: Loads real tools from MCP server

## WebSocket Client Features

### Connection Management

```typescript
// Connect to MCP server
await client.connect();

// Initialize MCP protocol
const initResult = await client.initialize();

// Check connection status
const isConnected = client.isConnected();

// Get connection state
const state = client.getConnectionState(); // 'connected' | 'connecting' | 'disconnected' | 'reconnecting'
```

### Tool Operations

```typescript
// List all available tools
const tools = await client.listTools();

// Execute a tool
const result = await client.callTool('swarm_init', {
  topology: 'mesh',
  maxAgents: 5
});
```

### Streaming Support

```typescript
// Register streaming handler
client.onStream('stream-id', (data) => {
  console.log('Stream data:', data);
});

// Execute tool that may stream
const result = await client.callTool('long_running_task', params);
```

### Event Handling

```typescript
// Connection events
client.on('connected', () => console.log('Connected to MCP'));
client.on('disconnected', () => console.log('Disconnected'));
client.on('reconnecting', (attempt) => console.log(`Reconnecting attempt ${attempt}`));

// Protocol events
client.on('initialized', (result) => console.log('MCP initialized:', result));
client.on('stream', ({ streamId, data }) => console.log('Stream:', streamId, data));
client.on('progress', (progress) => console.log('Progress:', progress));
client.on('log', (log) => console.log('Log:', log));
client.on('error', (error) => console.error('Error:', error));
```

## JSON-RPC 2.0 Implementation

### Request Format

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "swarm_init",
    "arguments": {
      "topology": "mesh",
      "maxAgents": 5
    }
  }
}
```

### Response Format

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{\"swarmId\": \"mesh-001\", \"agents\": 5, \"status\": \"initialized\"}"
      }
    ]
  }
}
```

### Error Format

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32602,
    "message": "Invalid params",
    "data": "Missing required parameter: topology"
  }
}
```

## Configuration

### WebSocket Client Config

```typescript
const client = getMCPWebSocketClient({
  url: 'ws://localhost:3008',           // MCP server URL
  reconnectInterval: 5000,              // Reconnect delay (ms)
  maxReconnectAttempts: 10,             // Max reconnection attempts
  requestTimeout: 30000                 // Request timeout (ms)
});
```

### MCP Bridge Integration

The MCP Bridge automatically:

1. **Initializes WebSocket**: Attempts WebSocket connection on startup
2. **Loads Real Tools**: Fetches actual tool definitions from MCP server
3. **Handles Fallback**: Falls back to HTTP if WebSocket unavailable
4. **Tracks Status**: Monitors connection health and reports to UI

## Error Handling

### Connection Errors

- **Initial Connection Failure**: Falls back to HTTP mode
- **Connection Lost**: Attempts automatic reconnection
- **Timeout Errors**: Fails gracefully with timeout message
- **Protocol Errors**: Reports JSON-RPC errors to user

### Tool Execution Errors

- **Parameter Validation**: Validates parameters before sending
- **Execution Errors**: Reports tool execution failures
- **Network Errors**: Handles network connectivity issues
- **Server Errors**: Reports MCP server errors

## Testing

### Test Script

Run the test script to verify WebSocket functionality:

```bash
cd ui/agentic-flow
node test-mcp-websocket.js
```

Expected output:
```
🔌 Testing MCP WebSocket Client...

Connecting to ws://localhost:3008...
✅ Connected to MCP WebSocket server

Initializing MCP protocol...
✅ MCP initialized: {...}

Listing available tools...
Found 71 tools:
  - swarm_init: Initialize swarm topology
  - agent_spawn: Spawn specialized agent
  ...

Testing swarm_status tool...
Tool result: {...}

Disconnecting...
```

## Performance Benefits

### WebSocket Advantages

1. **Lower Latency**: Direct WebSocket connection eliminates HTTP overhead
2. **Real-time Updates**: Streaming responses for long-running operations
3. **Connection Persistence**: Reduces connection setup time
4. **Bidirectional Communication**: Enables server-initiated updates

### Fallback Reliability

1. **Graceful Degradation**: Falls back to HTTP if WebSocket fails
2. **Automatic Recovery**: Attempts reconnection when WebSocket available
3. **Status Transparency**: UI shows current connection mode
4. **Zero Downtime**: Seamless fallback without user interruption

## Development Notes

### Adding New Features

1. **New Tool Support**: Tools are loaded dynamically from MCP server
2. **Streaming Handlers**: Add streaming support for new tool types
3. **Event Handlers**: Extend event system for new MCP notifications
4. **Error Handling**: Add specific error handling for new scenarios

### Debugging

1. **Console Logs**: Comprehensive logging for connection and tool execution
2. **Connection Status**: Real-time status indicators in UI
3. **Error Messages**: Detailed error reporting with context
4. **Test Script**: Standalone testing for WebSocket functionality

## Security Considerations

1. **Local Connections**: WebSocket connects to localhost only
2. **Parameter Validation**: Validates all tool parameters
3. **Error Sanitization**: Sanitizes error messages before display
4. **Timeout Protection**: Prevents hanging requests with timeouts

## Future Enhancements

1. **Authentication**: Add authentication for remote MCP servers
2. **Compression**: WebSocket message compression for large payloads
3. **Multiplexing**: Multiple concurrent tool executions
4. **Caching**: Intelligent caching of tool results
5. **Metrics**: Detailed performance and usage metrics

---

This WebSocket client provides a robust, real-time connection to MCP servers while maintaining backward compatibility through HTTP fallback. The implementation follows MCP protocol specifications and provides a solid foundation for future enhancements.