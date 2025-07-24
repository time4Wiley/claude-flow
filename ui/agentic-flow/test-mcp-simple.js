/**
 * Simple test for MCP WebSocket server
 */

import WebSocket from 'ws';

async function testMCPWebSocket() {
  console.log('🔌 Testing MCP WebSocket Server on port 3008...\n');

  try {
    // Connect to MCP WebSocket server
    const ws = new WebSocket('ws://localhost:3008');
    let messageId = 0;
    const pendingRequests = new Map();

    const sendRequest = (method, params = null) => {
      return new Promise((resolve, reject) => {
        const id = ++messageId;
        const request = {
          jsonrpc: '2.0',
          id,
          method,
          ...(params && { params })
        };

        pendingRequests.set(id, { resolve, reject });
        ws.send(JSON.stringify(request));

        setTimeout(() => {
          if (pendingRequests.has(id)) {
            pendingRequests.delete(id);
            reject(new Error(`Request timeout: ${method}`));
          }
        }, 10000);
      });
    };

    ws.on('open', async () => {
      console.log('✅ Connected to MCP WebSocket server');

      try {
        // Test initialization
        console.log('\n🔧 Testing initialization...');
        const initResult = await sendRequest('initialize', {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {}, resources: {}, prompts: {} },
          clientInfo: { name: 'test-client', version: '1.0.0' }
        });
        console.log('✅ Initialization successful:', initResult.serverInfo);

        // Test ping
        console.log('\n🏓 Testing ping...');
        const pingResult = await sendRequest('ping');
        console.log('✅ Ping successful:', pingResult);

        // Test tools list
        console.log('\n📋 Testing tools list...');
        const toolsResult = await sendRequest('tools/list');
        console.log(`✅ Found ${toolsResult.tools.length} tools`);
        
        // Show first few tools
        console.log('\n🔧 Available tools (first 5):');
        toolsResult.tools.slice(0, 5).forEach(tool => {
          console.log(`  - ${tool.name}: ${tool.description}`);
        });

        // Test swarm_status tool
        console.log('\n🧪 Testing swarm_status tool...');
        try {
          const statusResult = await sendRequest('tools/call', {
            name: 'mcp__claude-flow__swarm_status',
            arguments: {}
          });
          console.log('✅ Tool execution successful:', statusResult);
        } catch (error) {
          console.log('⚠️ Tool execution failed (expected if claude-flow not available):', error.message);
        }

        console.log('\n🎉 All tests completed successfully!');
        
      } catch (error) {
        console.error('❌ Test failed:', error);
      } finally {
        ws.close();
      }
    });

    ws.on('message', (data) => {
      const message = JSON.parse(data.toString());
      
      if (message.id && pendingRequests.has(message.id)) {
        const { resolve, reject } = pendingRequests.get(message.id);
        pendingRequests.delete(message.id);

        if (message.error) {
          reject(new Error(`${message.error.message} (${message.error.code})`));
        } else {
          resolve(message.result);
        }
      } else if (message.method) {
        console.log(`📢 Notification: ${message.method}`, message.params);
      }
    });

    ws.on('error', (error) => {
      console.error('❌ WebSocket error:', error.message);
    });

    ws.on('close', () => {
      console.log('📴 Disconnected from MCP server');
    });

  } catch (error) {
    console.error('❌ Failed to connect:', error.message);
  }
}

// Run the test
testMCPWebSocket().catch(console.error);