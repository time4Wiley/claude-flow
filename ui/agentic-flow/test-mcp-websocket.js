/**
 * Test script for MCP WebSocket client
 * Run this to verify WebSocket connection to MCP server
 */

// Direct test without importing TypeScript module
import WebSocket from 'ws';

class SimpleMCPTestClient {
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
      console.log(`📢 Notification: ${message.method}`, message.params);
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

      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`Request timeout: ${method}`));
        }
      }, 30000);
    });
  }

  async initialize() {
    const result = await this.sendRequest('initialize', {
      protocolVersion: '0.1.0',
      capabilities: { tools: {}, resources: {}, prompts: {} },
      clientInfo: { name: 'test-client', version: '1.0.0' }
    });
    return result;
  }

  async listTools() {
    const result = await this.sendRequest('tools/list');
    return result.tools || [];
  }

  async callTool(name, args = {}) {
    const result = await this.sendRequest('tools/call', {
      name,
      arguments: args
    });
    return result;
  }

  close() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

function getMCPWebSocketClient(config) {
  return new SimpleMCPTestClient(config?.url);
}

async function testMCPWebSocket() {
  console.log('🔌 Testing MCP WebSocket Client...\n');

  const client = getMCPWebSocketClient({
    url: 'ws://localhost:3008'
  });

  // Setup event handlers
  client.on('connected', () => {
    console.log('✅ Connected to MCP WebSocket server');
  });

  client.on('disconnected', () => {
    console.log('❌ Disconnected from MCP WebSocket server');
  });

  client.on('initialized', (result) => {
    console.log('✅ MCP initialized:', result);
  });

  client.on('error', (error) => {
    console.error('❌ WebSocket error:', error);
  });

  client.on('stream', ({ streamId, data }) => {
    console.log('📊 Stream data:', streamId, data);
  });

  try {
    // Connect to WebSocket
    console.log('Connecting to ws://localhost:3008...');
    await client.connect();
    
    // Initialize MCP
    console.log('\nInitializing MCP protocol...');
    const initResult = await client.initialize();
    console.log('Initialization result:', JSON.stringify(initResult, null, 2));
    
    // List available tools
    console.log('\nListing available tools...');
    const tools = await client.listTools();
    console.log(`Found ${tools.length} tools:`);
    tools.slice(0, 5).forEach(tool => {
      console.log(`  - ${tool.name}: ${tool.description || 'No description'}`);
    });
    if (tools.length > 5) {
      console.log(`  ... and ${tools.length - 5} more`);
    }
    
    // Test a simple tool call
    console.log('\nTesting swarm_status tool...');
    const result = await client.callTool('swarm_status', {});
    console.log('Tool result:', JSON.stringify(result, null, 2));
    
    // Test with streaming
    console.log('\nTesting tool with potential streaming...');
    client.onStream('test-stream', (data) => {
      console.log('Stream chunk:', data);
    });
    
    const streamResult = await client.callTool('swarm_init', {
      topology: 'mesh',
      maxAgents: 3
    });
    console.log('Stream result:', JSON.stringify(streamResult, null, 2));
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    // Disconnect after tests
    setTimeout(() => {
      console.log('\nDisconnecting...');
      client.disconnect();
      process.exit(0);
    }, 2000);
  }
}

// Run the test
testMCPWebSocket().catch(console.error);