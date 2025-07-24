#!/usr/bin/env node
/**
 * Startup script for MCP WebSocket Server
 * Can be used standalone or integrated with the main server
 */

import MCPWebSocketServer from './mcp-websocket-server.js';

// Parse command line arguments
const args = process.argv.slice(2);
const port = args.includes('--port') ? parseInt(args[args.indexOf('--port') + 1]) : 3008;
const verbose = args.includes('--verbose') || args.includes('-v');

console.log('🚀 Starting MCP WebSocket Server...');
if (verbose) {
  console.log(`📋 Configuration:
  - Port: ${port}
  - Verbose: ${verbose}
  - Node version: ${process.version}
  - Platform: ${process.platform}
`);
}

const server = new MCPWebSocketServer(port);

// Enhanced logging if verbose
if (verbose) {
  server.on('notification', (data) => {
    console.log(`📢 Notification from ${data.connectionId}: ${data.method}`);
  });
}

// Handle graceful shutdown
const shutdown = (signal: string) => {
  console.log(`\n📴 Received ${signal}, shutting down gracefully...`);
  
  const stats = server.getStats();
  console.log(`📊 Final stats: ${stats.connections} connections, ${stats.activeProcesses} active processes`);
  
  server.stop();
  
  // Force exit after 10 seconds
  setTimeout(() => {
    console.log('⚠️ Force exit after timeout');
    process.exit(1);
  }, 10000);
  
  process.exit(0);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Log stats periodically if verbose
if (verbose) {
  setInterval(() => {
    const stats = server.getStats();
    if (stats.connections > 0 || stats.activeProcesses > 0) {
      console.log(`📊 MCP Server Stats: ${stats.connections} connections, ${stats.activeProcesses} active processes`);
    }
  }, 30000); // Every 30 seconds
}

console.log(`✅ MCP WebSocket Server running on port ${port}`);
console.log('🔗 Connect to ws://localhost:3008');
console.log('📚 87 claude-flow tools available');
console.log('⏹️ Press Ctrl+C to stop');

export default server;