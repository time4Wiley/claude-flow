import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFile } from 'fs/promises';
import chalk from 'chalk';

// Import Mastra integration
import { createMastraAgent } from '../mastra/agents.js';
import { BaseAgent } from '../core/agent.base.js';
import { AgentType } from '../types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface UIServerOptions {
  port?: number;
  host?: string;
  mcpServerUrl?: string;
  hiveMindUrl?: string;
  vitePort?: number;
}

export class UIServer {
  private app: express.Application;
  private server: any;
  private wss: WebSocketServer;
  private options: Required<UIServerOptions>;
  private hiveMindClients: Set<any> = new Set();

  constructor(options: UIServerOptions = {}) {
    this.options = {
      port: options.port || 8080,
      host: options.host || 'localhost',
      mcpServerUrl: options.mcpServerUrl || 'http://localhost:3000',
      hiveMindUrl: options.hiveMindUrl || 'ws://localhost:8080',
      vitePort: options.vitePort || 5173,
    };

    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    // Parse JSON bodies
    this.app.use(express.json());

    // CORS for development
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');
      
      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
      } else {
        next();
      }
    });

    // Proxy MCP server requests
    this.app.use('/mcp', createProxyMiddleware({
      target: this.options.mcpServerUrl,
      changeOrigin: true,
      pathRewrite: {
        '^/mcp': '', // Remove /mcp prefix when forwarding
      },
      onError: (err, req, res) => {
        console.error(chalk.red('MCP proxy error:'), err);
        res.status(502).json({ error: 'MCP server unavailable' });
      },
    }));

    // Serve static files from UI console
    const consolePath = join(__dirname, 'console');
    this.app.use('/console', express.static(consolePath));

    // Proxy Vite dev server in development
    if (process.env.NODE_ENV !== 'production') {
      this.app.use('/', createProxyMiddleware({
        target: `http://localhost:${this.options.vitePort}`,
        changeOrigin: true,
        ws: true,
        logLevel: 'error',
      }));
    }
  }

  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        services: {
          express: 'running',
          websocket: this.wss ? 'running' : 'stopped',
          mcp: 'proxied',
          vite: process.env.NODE_ENV !== 'production' ? 'proxied' : 'n/a',
        },
      });
    });

    // Mastra agent endpoints
    this.app.get('/api/agents', async (req, res) => {
      try {
        // This would integrate with the actual agent system
        const agents = [
          { id: 'coordinator-1', type: 'coordinator', status: 'active' },
          { id: 'researcher-1', type: 'researcher', status: 'idle' },
          { id: 'coder-1', type: 'coder', status: 'busy' },
        ];
        res.json({ agents });
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch agents' });
      }
    });

    this.app.post('/api/agents/spawn', async (req, res) => {
      try {
        const { type, name, capabilities } = req.body;
        
        // Create a mock agent for now
        const agent = {
          id: `${type}-${Date.now()}`,
          type,
          name: name || `${type} Agent`,
          capabilities: capabilities || [],
          status: 'starting',
        };

        // In real implementation, this would create actual agents
        console.log(chalk.cyan(`Spawning ${agent.type} agent: ${agent.name}`));
        
        res.json({ agent });
      } catch (error) {
        res.status(500).json({ error: 'Failed to spawn agent' });
      }
    });

    // HiveMind communication endpoint
    this.app.get('/api/hivemind/status', (req, res) => {
      res.json({
        connected: this.hiveMindClients.size,
        status: 'active',
      });
    });
  }

  private setupWebSocket(): void {
    this.wss = new WebSocketServer({ server: this.server });

    this.wss.on('connection', (ws, req) => {
      console.log(chalk.green('New WebSocket connection'));
      
      this.hiveMindClients.add(ws);

      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message.toString());
          this.handleHiveMindMessage(ws, data);
        } catch (error) {
          console.error(chalk.red('Invalid WebSocket message:'), error);
        }
      });

      ws.on('close', () => {
        this.hiveMindClients.delete(ws);
        console.log(chalk.yellow('WebSocket connection closed'));
      });

      ws.on('error', (error) => {
        console.error(chalk.red('WebSocket error:'), error);
      });

      // Send initial connection confirmation
      ws.send(JSON.stringify({
        type: 'connected',
        timestamp: new Date().toISOString(),
      }));
    });
  }

  private handleHiveMindMessage(ws: any, data: any): void {
    const { type, payload } = data;

    switch (type) {
      case 'agent-update':
        // Broadcast agent updates to all connected clients
        this.broadcast({
          type: 'agent-update',
          payload,
        }, ws);
        break;

      case 'task-update':
        // Broadcast task updates
        this.broadcast({
          type: 'task-update',
          payload,
        }, ws);
        break;

      case 'swarm-status':
        // Send current swarm status
        ws.send(JSON.stringify({
          type: 'swarm-status',
          payload: {
            agents: Array.from(this.hiveMindClients).length,
            timestamp: new Date().toISOString(),
          },
        }));
        break;

      default:
        console.log(chalk.gray(`Unknown message type: ${type}`));
    }
  }

  private broadcast(message: any, exclude?: any): void {
    const messageStr = JSON.stringify(message);
    this.hiveMindClients.forEach((client) => {
      if (client !== exclude && client.readyState === 1) {
        client.send(messageStr);
      }
    });
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = createServer(this.app);
        this.setupWebSocket();

        this.server.listen(this.options.port, this.options.host, () => {
          console.log(chalk.green(`✨ UI Server running at http://${this.options.host}:${this.options.port}`));
          console.log(chalk.gray(`WebSocket endpoint: ws://${this.options.host}:${this.options.port}`));
          console.log(chalk.gray(`MCP proxy: ${this.options.mcpServerUrl} -> /mcp`));
          if (process.env.NODE_ENV !== 'production') {
            console.log(chalk.gray(`Vite proxy: http://localhost:${this.options.vitePort} -> /`));
          }
          resolve();
        });

        this.server.on('error', (error: any) => {
          console.error(chalk.red('Server error:'), error);
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      // Close all WebSocket connections
      this.hiveMindClients.forEach((client) => {
        client.close();
      });

      // Close WebSocket server
      if (this.wss) {
        this.wss.close(() => {
          console.log(chalk.yellow('WebSocket server closed'));
        });
      }

      // Close HTTP server
      if (this.server) {
        this.server.close(() => {
          console.log(chalk.yellow('HTTP server closed'));
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

// Standalone server startup
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new UIServer({
    port: parseInt(process.env.PORT || '8080'),
    host: process.env.HOST || 'localhost',
    mcpServerUrl: process.env.MCP_SERVER_URL,
    hiveMindUrl: process.env.HIVE_MIND_URL,
  });

  server.start().catch((error) => {
    console.error(chalk.red('Failed to start server:'), error);
    process.exit(1);
  });

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log(chalk.yellow('\nShutting down server...'));
    await server.stop();
    process.exit(0);
  });
}