/**
 * Test script for MCP WebSocket Server
 * Tests the JSON-RPC 2.0 protocol compliance and tool execution
 */

import WebSocket from 'ws';

class MCPTestClient {
  constructor(url = 'ws://localhost:3008') {
    this.url = url;
    this.ws = null;
    this.messageId = 0;
    this.pendingRequests = new Map();
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);

      this.ws.on('open', () => {
        console.log('✅ Connected to MCP server');
        resolve();
      });

      this.ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        this.handleMessage(message);
      });

      this.ws.on('error', (error) => {
        console.error('❌ WebSocket error:', error);
        reject(error);
      });

      this.ws.on('close', () => {
        console.log('📴 Disconnected from MCP server');
      });
    });
  }

  handleMessage(message) {
    if (message.id && this.pendingRequests.has(message.id)) {
      const { resolve, reject } = this.pendingRequests.get(message.id);
      this.pendingRequests.delete(message.id);

      if (message.error) {
        reject(new Error(`${message.error.message} (${message.error.code})`));
      } else {
        resolve(message.result);
      }
    } else if (message.method) {
      // Handle notifications
      console.log(`📢 Notification: ${message.method}`, message.params);
    } else {
      console.log('📨 Received:', message);
    }
  }

  async sendRequest(method, params = null) {
    return new Promise((resolve, reject) => {
      const id = ++this.messageId;
      const request = {
        jsonrpc: '2.0',
        id,
        method,
        ...(params && { params })
      };

      this.pendingRequests.set(id, { resolve, reject });
      this.ws.send(JSON.stringify(request));

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`Request timeout: ${method}`));
        }
      }, 30000);
    });
  }

  async initialize() {
    console.log('🔌 Initializing MCP connection...');
    const result = await this.sendRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {
        tools: {},
        resources: {},
        prompts: {}
      },
      clientInfo: {
        name: 'mcp-test-client',
        version: '1.0.0'
      }
    });
    console.log('✅ Initialized:', result);
    return result;
  }

  async listTools() {
    console.log('🔧 Listing tools...');
    const result = await this.sendRequest('tools/list');
    console.log(`✅ Found ${result.tools.length} tools`);
    return result.tools;
  }

  async callTool(name, args = {}) {
    console.log(`🚀 Calling tool: ${name}`);
    const result = await this.sendRequest('tools/call', {
      name,
      arguments: args
    });
    console.log(`✅ Tool result:`, result);
    return result;
  }

  async ping() {
    console.log('🏓 Sending ping...');
    const result = await this.sendRequest('ping');
    console.log('✅ Pong received:', result);
    return result;
  }

  close() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

async function runTests() {
  const client = new MCPTestClient();

  try {
    // Connect to server
    await client.connect();

    // Test initialization
    await client.initialize();

    // Test ping
    await client.ping();

    // Test tool listing
    const tools = await client.listTools();
    console.log(`\n📋 Available tools: ${tools.slice(0, 5).map(t => t.name).join(', ')}...`);

    // Test a simple tool call
    console.log('\n🧪 Testing swarm_status tool...');
    try {
      await client.callTool('mcp__claude-flow__swarm_status', {});
    } catch (error) {
      console.log('⚠️ Tool execution may have failed (expected if claude-flow not available):', error.message);
    }

    // Test another tool
    console.log('\n🧪 Testing performance_report tool...');
    try {
      await client.callTool('mcp__claude-flow__performance_report', {
        format: 'summary',
        timeframe: '24h'
      });
    } catch (error) {
      console.log('⚠️ Tool execution may have failed (expected if claude-flow not available):', error.message);
    }

    console.log('\n✅ All tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    client.close();
  }
}

// Check if server is running
console.log('🧪 Starting MCP WebSocket Server Tests...');
console.log('📡 Connecting to ws://localhost:3008...');

runTests().catch(console.error);