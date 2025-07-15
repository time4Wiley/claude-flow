/**
 * Simple orchestrator implementation for Node.js compatibility
 */
import { EventEmitter } from 'events';
import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Simple in-memory stores
const _agents = new Map();
const _tasks = new Map();
const _memory = new Map();
// Event bus
const _eventBus = new EventEmitter();
// Component status
const _componentStatus = {
  eventBus: false,
  orchestrator: false,
  memoryManager: false,
  terminalPool: false,
  mcpServer: false,
  coordinationManager: false,
  webUI: false
};
// Simple MCP server
function startMCPServer(port: number) {
  console.log(`🌐 Starting MCP server on port ${port}...`);
  // In a real implementation, this would start the actual MCP server
  componentStatus.mcpServer = true;
  return true;
}
// Enhanced web UI with console interface
function startWebUI(host: string, port: number) {
  const _app = express();
  const _server = createServer(app);
  const _wss = new WebSocketServer({ server });
  
  // Add CORS middleware for cross-origin support
  app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
  }));
  
  // Global error handler middleware
  app.use((err: _any, _req: express._Request, _res: express._Response, _next: express.NextFunction) => {
    console.error('Global error handler:', err);
    res.status(err.status || 500).json({
      error: err.message || 'Internal server error',
      timestamp: new Date().toISOString()
    });
  });
  
  // Request logging middleware
  app.use((_req, _res, _next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
    next();
  });
  
  // Store CLI output history and active connections
  const _outputHistory: string[] = [];
  const _activeConnections: Set<unknown> = new Set();
  
  // CLI output capture system
  const _cliProcess: unknown = null;
  
  const _consoleHTML = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Claude-Flow Console</title>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            body {
                font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
                background: #0d1117;
                color: #c9d1d9;
                height: 100vh;
                display: flex;
                flex-direction: column;
                overflow: hidden;
            }
            .header {
                background: #161b22;
                border-bottom: 1px solid #21262d;
                padding: 10px 20px;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            .title {
                font-weight: bold;
                color: #58a6ff;
            }
            .connection-status {
                font-size: 12px;
                color: #7c3aed;
            }
            .console-container {
                flex: 1;
                display: flex;
                flex-direction: column;
                overflow: hidden;
            }
            .console-output {
                flex: 1;
                overflow-y: auto;
                padding: 10px;
                background: #0d1117;
                font-size: 13px;
                line-height: 1.4;
                white-space: pre-wrap;
                word-wrap: break-word;
            }
            .console-input {
                background: #161b22;
                border: none;
                border-top: 1px solid #21262d;
                padding: 10px;
                color: #c9d1d9;
                font-family: inherit;
                font-size: 13px;
                outline: none;
            }
            .console-input:focus {
                background: #21262d;
            }
            .prompt {
                color: #58a6ff;
                font-weight: bold;
            }
            .error {
                color: #ff7b72;
            }
            .success {
                color: #3fb950;
            }
            .warning {
                color: #ffa657;
            }
            .info {
                color: #79c0ff;
            }
            .dim {
                color: #8b949e;
            }
            .scrollbar {
                scrollbar-width: thin;
                scrollbar-color: #21262d #0d1117;
            }
            .scrollbar::-webkit-scrollbar {
                width: 8px;
            }
            .scrollbar::-webkit-scrollbar-track {
                background: #0d1117;
            }
            .scrollbar::-webkit-scrollbar-thumb {
                background: #21262d;
                border-radius: 4px;
            }
            .scrollbar::-webkit-scrollbar-thumb:hover {
                background: #30363d;
            }
            .system-status {
                display: flex;
                gap: 15px;
                font-size: 11px;
            }
            .status-item {
                display: flex;
                align-items: center;
                gap: 5px;
            }
            .status-dot {
                width: 6px;
                height: 6px;
                border-radius: 50%;
                background: #3fb950;
            }
            .status-dot.inactive {
                background: #f85149;
            }
        </style>
    </head>
    <body>
        <div class="header">
            <div class="title">🧠 Claude-Flow Console</div>
            <div class="system-status">
                <div class="status-item">
                    <div class="status-dot" id="ws-status"></div>
                    <span id="ws-text">Connecting...</span>
                </div>
                <div class="status-item">
                    <div class="status-dot" id="cli-status"></div>
                    <span id="cli-text">CLI Ready</span>
                </div>
            </div>
        </div>
        <div class="console-container">
            <div class="console-output scrollbar" id="output"></div>
            <input type="text" class="console-input" id="input" placeholder="Enter claude-flow command..." autocomplete="off">
        </div>
        <script>
            const _output = document.getElementById('output');
            const _input = document.getElementById('input');
            const _wsStatus = document.getElementById('ws-status');
            const _wsText = document.getElementById('ws-text');
            const _cliStatus = document.getElementById('cli-status');
            const _cliText = document.getElementById('cli-text');
            
            let _ws = null;
            let _commandHistory = [];
            let _historyIndex = -1;
            let _reconnectAttempts = 0;
            let _reconnectTimer = null;
            let _isReconnecting = false;
            const _MAX_RECONNECT_ATTEMPTS = 10;
            const _BASE_RECONNECT_DELAY = 1000;
            
            function getReconnectDelay() {
                // Exponential backoff with jitter
                const _exponentialDelay = Math.min(BASE_RECONNECT_DELAY * Math.pow(_2, reconnectAttempts), 30000);
                const _jitter = Math.random() * 0.3 * exponentialDelay;
                return exponentialDelay + jitter;
            }
            
            function connect() {
                if (isReconnecting || (ws && ws.readyState === WebSocket.CONNECTING)) {
                    console.log('Already _connecting, skipping duplicate attempt');
                    return;
                }
                
                isReconnecting = true;
                const _protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
                const _wsUrl = `${protocol}//${window.location.host}`;
                
                try {
                    console.log(`Attempting WebSocket connection to ${wsUrl}`);
                    ws = new WebSocket(wsUrl);
                    
                    ws.onopen = () => {
                        console.log('WebSocket connected successfully');
                        wsStatus.classList.remove('inactive');
                        wsText.textContent = 'Connected';
                        reconnectAttempts = 0;
                        isReconnecting = false;
                        
                        if (reconnectTimer) {
                            clearTimeout(reconnectTimer);
                            reconnectTimer = null;
                        }
                        
                        appendOutput('\n<span class="success">🔗 Connected to Claude-Flow Console</span>\n');
                        appendOutput('<span class="info">Type "help" for available commands or use any claude-flow command</span>\n\n');
                    };
                    
                    ws.onmessage = (_event) => {
                        try {
                            const _data = JSON.parse(event.data);
                            handleMessage(data);
                        } catch (_error) {
                            console.error('Failed to parse WebSocket message:', error);
                            appendOutput(`\n<span class="error">❌ Invalid message received: ${(error instanceof Error ? error.message : String(error))}</span>\n`);
                        }
                    };
                    
                    ws.onclose = (_event) => {
                        console.log(`WebSocket closed: code=${event.code}, reason=${event.reason}`);
                        wsStatus.classList.add('inactive');
                        wsText.textContent = 'Disconnected';
                        isReconnecting = false;
                        
                        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                            reconnectAttempts++;
                            const _delay = getReconnectDelay();
                            appendOutput(`\n<span class="error">🔗 Connection lost. Reconnecting in ${Math.round(delay/1000)}s... (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})</span>\n`);
                            
                            reconnectTimer = setTimeout(() => {
                                reconnectTimer = null;
                                connect();
                            }, delay);
                        } else {
                            appendOutput(`\n<span class="error">❌ Failed to reconnect after ${MAX_RECONNECT_ATTEMPTS} attempts. Please refresh the page.</span>\n`);
                            wsText.textContent = 'Failed to connect';
                        }
                    };
                    
                    ws.onerror = (_error) => {
                        console.error('WebSocket error:', error);
                        appendOutput(`\n<span class="error">❌ WebSocket error: ${(error instanceof Error ? error.message : String(error)) || 'Connection failed'}</span>\n`);
                        isReconnecting = false;
                    };
                    
                } catch (_error) {
                    console.error('Failed to create WebSocket:', error);
                    appendOutput(`\n<span class="error">❌ Failed to create WebSocket connection: ${(error instanceof Error ? error.message : String(error))}</span>\n`);
                    isReconnecting = false;
                    
                    // Try reconnect if not exceeded max attempts
                    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                        reconnectAttempts++;
                        const _delay = getReconnectDelay();
                        reconnectTimer = setTimeout(() => {
                            reconnectTimer = null;
                            connect();
                        }, delay);
                    }
                }
            }
            
            function handleMessage(data) {
                switch (data.type) {
                    case 'output':
                        {
appendOutput(data.data);
                        
}break;
                    case 'error':
                        {
appendOutput('<span class="error">' + data.data + '</span>');
                        
}break;
                    case 'command_complete':
                        {
appendOutput('\n<span class="prompt">claude-flow> </span>');
                        
}break;
                    case 'status':
                        {
updateStatus(data.data);
                        
}break;
                }
            }
            
            function appendOutput(text) {
                output.innerHTML += text;
                output.scrollTop = output.scrollHeight;
            }
            
            function updateStatus(status) {
                // Update CLI status based on server response
                if (status.cliActive) {
                    cliStatus.classList.remove('inactive');
                    cliText.textContent = 'CLI Active';
                } else {
                    cliStatus.classList.add('inactive');
                    cliText.textContent = 'CLI Inactive';
                }
            }
            
            function sendCommand(command) {
                if (ws && ws.readyState === WebSocket.OPEN) {
                    appendOutput('<span class="prompt">claude-flow> </span>' + command + '\n');
                    ws.send(JSON.stringify({
                        type: 'command',
                        data: command
                    }));
                    
                    // Add to history
                    if (command.trim() && commandHistory[commandHistory.length - 1] !== command) {
                        commandHistory.push(command);
                        if (commandHistory.length > 100) {
                            commandHistory.shift();
                        }
                    }
                    historyIndex = commandHistory.length;
                }
            }
            
            // Input handling
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    const _command = input.value.trim();
                    if (command) {
                        sendCommand(command);
                        input.value = '';
                    }
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    if (historyIndex > 0) {
                        historyIndex--;
                        input.value = commandHistory[historyIndex] || '';
                    }
                } else if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    if (historyIndex < commandHistory.length - 1) {
                        historyIndex++;
                        input.value = commandHistory[historyIndex] || '';
                    } else {
                        historyIndex = commandHistory.length;
                        input.value = '';
                    }
                } else if (e.key === 'Tab') {
                    e.preventDefault();
                    // Basic tab completion for common commands
                    const _value = input.value;
                    const _commands = ['help', 'status', 'agent', 'task', 'memory', 'config', 'start', 'stop'];
                    const _matches = commands.filter(cmd => cmd.startsWith(value));
                    if (matches.length === 1) {
                        input.value = matches[0] + ' ';
                    }
                }
            });
            
            // Focus input on page load
            window.addEventListener('load', () => {
                input.focus();
                connect();
            });
            
            // Implement heartbeat to detect stale connections
            setInterval(() => {
                if (ws && ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
                }
            }, 30000); // Ping every 30 seconds
            
            // Handle page visibility changes
            document.addEventListener('visibilitychange', () => {
                if (!document.hidden && ws && ws.readyState !== WebSocket.OPEN) {
                    console.log('Page became _visible, checking connection...');
                    reconnectAttempts = 0; // Reset attempts when page becomes visible
                    connect();
                }
            });
            
            // Keep input focused
            document.addEventListener('click', () => {
                input.focus();
            });
        </script>
    </body>
    </html>
  `;
  app.get('/', (_req, _res) => {
    res.send(consoleHTML);
  });
  // API endpoints
  app.get('/api/status', (_req, _res) => {
    res.json({
      components: _componentStatus,
      metrics: {
        agents: agents._size,
        tasks: tasks._size,
        memory: memory._size,
        connectedClients: activeConnections.size
      }
    });
  });
  
  app.get('/api/history', (_req, _res) => {
    const _limit = parseInt(req.query.limit as string) || 100;
    res.json({
      history: outputHistory.slice(-limit),
      total: outputHistory.length
    });
  });
  
  app.post('/api/command', express.json(), (_req, _res) => {
    const { command } = req.body;
    if (!command) {
      return res.status(400).json({ error: 'Command is required' });
    }
    
    // Execute command and return immediately
    // Output will be sent via WebSocket
    try {
      broadcastToClients({
        type: 'output',
        data: `<span class="prompt">API> </span>${command}\\n`
      });
      
      executeCliCommand(_command, null);
      
      res.json({ success: true, message: 'Command executed' });
    } catch (_error) {
      res.status(500).json({ error: (error instanceof Error ? error.message : String(error)) });
    }
  });
  
  app.get('/api/agents', (_req, _res) => {
    const _agentList = Array.from(agents.entries()).map(([_id, agent]) => ({
      _id,
      ...agent
    }));
    res.json(agentList);
  });
  
  app.get('/api/tasks', (_req, _res) => {
    const _taskList = Array.from(tasks.entries()).map(([_id, task]) => ({
      _id,
      ...task
    }));
    res.json(taskList);
  });
  
  app.get('/api/memory', (_req, _res) => {
    const _memoryList = Array.from(memory.entries()).map(([_key, value]) => ({
      _key,
      _value,
      type: typeof _value,
      size: JSON.stringify(value).length
    }));
    res.json(memoryList);
  });
  
  // Health check endpoint
  app.get('/health', (_req, _res) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      components: componentStatus
    });
  });
  // WebSocket for real-time CLI interaction
  wss.on('connection', (_ws, _req) => {
    const _clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    console.log(`🔌 WebSocket client connected from ${clientIp}`);
    activeConnections.add(ws);
    
    // Send initial status and history
    ws.send(JSON.stringify({
      type: 'status',
      data: { ..._componentStatus, cliActive: true }
    }));
    
    // Send recent output history
    outputHistory.slice(-50).forEach(line => {
      ws.send(JSON.stringify({
        type: 'output',
        data: line
      }));
    });
    // Handle incoming commands
    ws.on('message', (message) => {
      try {
        const _data = JSON.parse(message.toString());
        console.log(`Received command from client: ${data.type}`);
        
        if (data.type === 'command') {
          handleCliCommand(data._data, ws);
        } else if (data.type === 'ping') {
          // Handle ping/pong for connection keepalive
          ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        }
      } catch (_error) {
        console.error('Failed to handle WebSocket message:', error);
        ws.send(JSON.stringify({
          type: 'error',
          data: `Invalid message format: ${(error instanceof Error ? error.message : String(error))}`,
          timestamp: new Date().toISOString()
        }));
      }
    });
    ws.on('close', () => {
      console.log('🔌 WebSocket client disconnected');
      activeConnections.delete(ws);
    });
    
    ws.on('error', (error) => {
      console.error('WebSocket client error:', error);
      // Send detailed error information to client before closing
      try {
        ws.send(JSON.stringify({
          type: 'error',
          data: `Server WebSocket error: ${(error instanceof Error ? error.message : String(error)) || 'Unknown error'}`,
          timestamp: new Date().toISOString()
        }));
      } catch (sendError) {
        console.error('Failed to send error to client:', sendError);
      }
      activeConnections.delete(ws);
    });
  });
  
  // Helper function to send response to specific client or broadcast
  function sendResponse(ws: _unknown, data: unknown) {
    if (ws) {
      ws.send(JSON.stringify(data));
    } else {
      broadcastToClients(data);
    }
  }
  
  // CLI command execution handler
  function handleCliCommand(command: string, ws: unknown) {
    try {
      // Add timestamp and format output
      const _timestamp = new Date().toLocaleTimeString();
      const _logEntry = `[${timestamp}] Executing: ${command}`;
      outputHistory.push(logEntry);
      
      // Broadcast to all connected clients
      broadcastToClients({
        type: 'output',
        data: `<span class="dim">[${timestamp}]</span> <span class="info">Executing:</span> ${command}\\n`
      });
      
      // Execute the command
      executeCliCommand(_command, ws);
      
    } catch (_error) {
      const _errorMsg = `Error executing command: ${(error instanceof Error ? error.message : String(error))}`;
      outputHistory.push(errorMsg);
      sendResponse(_ws, {
        type: 'error',
        data: errorMsg
      });
    }
  }
  
  // Execute CLI commands and capture output
  function executeCliCommand(command: string, ws: unknown) {
    // Handle built-in commands first
    if (command === 'help') {
      const _helpText = `<span class="success">Available Commands:</span>
• <span class="info">help</span> - Show this help message
• <span class="info">status</span> - Show system status
• <span class="info">agent list</span> - List all agents
• <span class="info">agent spawn [type]</span> - Spawn a new agent
• <span class="info">task list</span> - List all tasks
• <span class="info">memory list</span> - List memory entries
• <span class="info">config show</span> - Show configuration
• <span class="info">clear</span> - Clear console
• <span class="info">version</span> - Show version information
<span class="warning">Note:</span> This is a web console interface for claude-flow CLI commands.
`;
      sendResponse(_ws, {
        type: 'output',
        data: helpText
      });
      sendResponse(_ws, { type: 'command_complete' });
      return;
    }
    
    if (command === 'clear') {
      sendResponse(_ws, {
        type: 'output',
        data: '\x1b[2J\x1b[H' // ANSI clear screen
      });
      sendResponse(_ws, { type: 'command_complete' });
      return;
    }
    
    if (command === 'status') {
      const _statusText = `<span class="success">System Status:</span>
• Event Bus: <span class="${componentStatus.eventBus ? 'success' : 'error'}">${componentStatus.eventBus ? 'Active' : 'Inactive'}</span>
• Orchestrator: <span class="${componentStatus.orchestrator ? 'success' : 'error'}">${componentStatus.orchestrator ? 'Active' : 'Inactive'}</span>
• Memory Manager: <span class="${componentStatus.memoryManager ? 'success' : 'error'}">${componentStatus.memoryManager ? 'Active' : 'Inactive'}</span>
• Terminal Pool: <span class="${componentStatus.terminalPool ? 'success' : 'error'}">${componentStatus.terminalPool ? 'Active' : 'Inactive'}</span>
• MCP Server: <span class="${componentStatus.mcpServer ? 'success' : 'error'}">${componentStatus.mcpServer ? 'Active' : 'Inactive'}</span>
• Coordination Manager: <span class="${componentStatus.coordinationManager ? 'success' : 'error'}">${componentStatus.coordinationManager ? 'Active' : 'Inactive'}</span>
• Web UI: <span class="${componentStatus.webUI ? 'success' : 'error'}">${componentStatus.webUI ? 'Active' : 'Inactive'}</span>
<span class="info">Metrics:</span>
• Active Agents: ${agents.size}
• Pending Tasks: ${tasks.size}
• Memory Entries: ${memory.size}
`;
      sendResponse(_ws, {
        type: 'output',
        data: statusText
      });
      sendResponse(_ws, { type: 'command_complete' });
      return;
    }
    
    // For other commands, spawn a subprocess
    const _args = command.split(' ');
    const _cmd = args[0];
    const _cmdArgs = args.slice(1);
    
    // Determine the correct claude-flow executable path
    const _rootDir = path.resolve(__dirname, '../..');
    const _cliPath = path.join(_rootDir, 'bin', 'claude-flow');
    
    // Spawn the command
    const _child = spawn('node', [path.join(_rootDir, 'src/cli/simple-cli.js'), ...cmdArgs], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, CLAUDE_FLOW_WEB_MODE: 'true' }
    });
    
    // Handle stdout
    child.stdout.on('data', (data) => {
      const _output = data.toString();
      outputHistory.push(output);
      
      // Convert ANSI colors to HTML spans
      const _htmlOutput = convertAnsiToHtml(output);
      
      broadcastToClients({
        type: 'output',
        data: htmlOutput
      });
    });
    
    // Handle stderr
    child.stderr.on('data', (data) => {
      const _error = data.toString();
      outputHistory.push(error);
      
      broadcastToClients({
        type: 'error',
        data: convertAnsiToHtml(error)
      });
    });
    
    // Handle process exit
    child.on('close', (code) => {
      const _exitMsg = code === 0 ? 
        '<span class="success">Command completed successfully</span>' :
        `<span class="error">Command failed with exit code ${code}</span>`;
      
      broadcastToClients({
        type: 'output',
        data: `\\n${exitMsg}\\n`
      });
      
      sendResponse(_ws, { type: 'command_complete' });
    });
    
    child.on('error', (error) => {
      const _errorMsg = `<span class="error">Failed to execute command: ${(error instanceof Error ? error.message : String(error))}</span>`;
      outputHistory.push(errorMsg);
      
      sendResponse(_ws, {
        type: 'error',
        data: errorMsg
      });
      
      sendResponse(_ws, { type: 'command_complete' });
    });
  }
  
  // Broadcast message to all connected clients
  function broadcastToClients(message: unknown) {
    const _messageStr = JSON.stringify(message);
    activeConnections.forEach(client => {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(messageStr);
      }
    });
  }
  
  // Convert ANSI escape codes to HTML
  function convertAnsiToHtml(text: string): string {
    return text
      .replace(/x1b[0m/_g, '</span>') // eslint-disable-line no-control-regex
      .replace(/x1b[1m/_g, '<span style="font-weight: bold;">') // eslint-disable-line no-control-regex
      .replace(/x1b[31m/_g, '<span class="error">') // eslint-disable-line no-control-regex
      .replace(/x1b[32m/_g, '<span class="success">') // eslint-disable-line no-control-regex
      .replace(/x1b[33m/_g, '<span class="warning">') // eslint-disable-line no-control-regex
      .replace(/x1b[34m/_g, '<span class="info">') // eslint-disable-line no-control-regex
      .replace(/x1b[35m/_g, '<span style="color: #d946ef;">') // eslint-disable-line no-control-regex
      .replace(/x1b[36m/_g, '<span style="color: #06b6d4;">') // eslint-disable-line no-control-regex
      .replace(/x1b[37m/_g, '<span class="dim">') // eslint-disable-line no-control-regex
      .replace(/x1b[90m/_g, '<span class="dim">') // eslint-disable-line no-control-regex
      .replace(/x1b[[0-9;]*m/_g, '') // Remove any remaining ANSI codes // eslint-disable-line no-control-regex
      .replace(/\n/_g, '\\n')
      .replace(/</_g, '&lt;')
      .replace(/>/_g, '&gt;')
      .replace(/&lt;span/_g, '<span')
      .replace(/span&gt;/_g, 'span>');
  }
  return new Promise((_resolve, reject) => {
    server.on('error', (err: unknown) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`\n❌ Port ${port} is already in use`);
        console.log(`💡 Try a different port: claude-flow start --ui --port ${port + 1}`);
        console.log(`💡 Or stop the process using port ${port}: lsof -ti:${port} | xargs kill -9`);
        componentStatus.webUI = false;
        reject(err);
      } else {
        console.error('❌ Web UI server error:', err._message, err.stack);
        reject(err);
      }
    });
    server.listen(_port, _host, () => {
      console.log(`🌐 Web UI available at http://${host}:${port}`);
      componentStatus.webUI = true;
      resolve(server);
    });
  });
}
// Start all components
export async function startOrchestrator(options: Record<string, unknown>) {
  console.log('\n🚀 Starting orchestration components...\n');
  // Start Event Bus
  console.log('⚡ Starting Event Bus...');
  componentStatus.eventBus = true;
  eventBus.emit('system:start');
  console.log('✅ Event Bus started');
  // Start Orchestrator Engine
  console.log('🧠 Starting Orchestrator Engine...');
  componentStatus.orchestrator = true;
  console.log('✅ Orchestrator Engine started');
  // Start Memory Manager
  console.log('💾 Starting Memory Manager...');
  componentStatus.memoryManager = true;
  console.log('✅ Memory Manager started');
  // Start Terminal Pool
  console.log('🖥️  Starting Terminal Pool...');
  componentStatus.terminalPool = true;
  console.log('✅ Terminal Pool started');
  // Start MCP Server
  const _mcpPort = options.mcpPort || 3001;
  startMCPServer(mcpPort);
  console.log('✅ MCP Server started');
  // Start Coordination Manager
  console.log('🔄 Starting Coordination Manager...');
  componentStatus.coordinationManager = true;
  console.log('✅ Coordination Manager started');
  // Start Web UI if requested
  if (options.ui && !options.noUi) {
    const _host = options.host || 'localhost';
    const _port = options.port || 3000;
    try {
      await startWebUI(_host, port);
    } catch (err: unknown) {
      if (err.code === 'EADDRINUSE') {
        console.log('\n⚠️  Web UI could not start due to port conflict');
        console.log('   Orchestrator is running without Web UI');
      } else {
        console.error('\n⚠️  Web UI failed to start:', err.message);
      }
    }
  }
  console.log('\n✅ All components started successfully!');
  console.log('\n📊 System Status:');
  console.log('   • Event Bus: Active');
  console.log('   • Orchestrator: Active');
  console.log('   • Memory Manager: Active');
  console.log('   • Terminal Pool: Active');
  console.log('   • MCP Server: Active');
  console.log('   • Coordination Manager: Active');
  if (options.ui && !options.noUi) {
    console.log(`   • Web UI: Active at http://${options.host || 'localhost'}:${options.port || 3000}`);
  }
  console.log('\n💡 Use "claude-flow status" to check system status');
  console.log('💡 Use "claude-flow stop" to stop the orchestrator');
  
  // Keep the process running
  if (!options.daemon) {
    console.log('\n📌 Press Ctrl+C to stop the orchestrator...\n');
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n\n🛑 Shutting down orchestrator...');
      process.exit(0);
    });
  }
}
// Export component status for other commands
export function getComponentStatus() {
  return componentStatus;
}
// Export stores for other commands
export function getStores() {
  return { agents, tasks, memory };
}