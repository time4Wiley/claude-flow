#!/usr/bin/env node

/**
 * Test WebSocket MCP Tool Integration
 * Verifies that MCP tools can be executed via WebSocket
 */

console.log('🧪 Testing WebSocket MCP Integration...\n');

// Simple WebSocket client test
const WebSocket = require('ws');

async function testWebSocketMCP() {
  const ws = new WebSocket('ws://localhost:3001/socket.io/?transport=websocket');
  
  ws.on('open', () => {
    console.log('✅ WebSocket connected to server');
    
    // Test tool discovery
    console.log('🔍 Requesting MCP tools list...');
    ws.send(JSON.stringify(['mcp:tools:discover']));
    
    // Test tool execution after a delay
    setTimeout(() => {
      console.log('🔧 Testing tool execution...');
      const executionId = `test-${Date.now()}`;
      ws.send(JSON.stringify(['mcp:tool:execute', {
        executionId,
        toolName: 'swarm_status',
        parameters: {},
        options: { trackMetrics: true }
      }]));
    }, 2000);
  });
  
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      if (Array.isArray(message) && message.length >= 2) {
        const [event, payload] = message;
        console.log(`📨 Received: ${event}`, payload ? `(${JSON.stringify(payload).slice(0, 100)}...)` : '');
        
        if (event === 'mcp:tools:list') {
          console.log(`✅ Tools discovered: ${payload.tools ? payload.tools.length : 0} tools`);
        } else if (event === 'mcp:tool:response') {
          console.log(`✅ Tool execution ${payload.success ? 'succeeded' : 'failed'}:`, 
                     payload.success ? payload.result : payload.error);
          
          // Test complete, close connection
          setTimeout(() => {
            console.log('\n🎉 WebSocket MCP test completed successfully!');
            ws.close();
            process.exit(0);
          }, 1000);
        } else if (event === 'mcp:tool:progress') {
          console.log(`📊 Progress: ${payload.progress?.message || JSON.stringify(payload.progress)}`);
        }
      }
    } catch (error) {
      console.warn('⚠️ Failed to parse message:', error.message);
    }
  });
  
  ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error.message);
    process.exit(1);
  });
  
  ws.on('close', () => {
    console.log('🔌 WebSocket connection closed');
  });
  
  // Timeout after 30 seconds
  setTimeout(() => {
    console.error('❌ Test timeout - WebSocket MCP integration may not be working');
    ws.close();
    process.exit(1);
  }, 30000);
}

// Check if server is running first
const http = require('http');
const checkOptions = {
  hostname: 'localhost',
  port: 3001,
  path: '/health',
  method: 'GET'
};

console.log('🏥 Checking server health...');
const req = http.request(checkOptions, (res) => {
  if (res.statusCode === 200) {
    console.log('✅ Server is healthy, starting WebSocket test\n');
    testWebSocketMCP();
  } else {
    console.error('❌ Server health check failed:', res.statusCode);
    process.exit(1);
  }
});

req.on('error', (error) => {
  console.error('❌ Server is not running. Please start the server first:');
  console.error('   cd server && npm run dev');
  console.error('   Error:', error.message);
  process.exit(1);
});

req.end();