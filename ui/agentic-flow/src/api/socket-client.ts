/**
 * Socket.IO Client for Real-time WebSocket Communication
 */

// Simple event emitter for browser compatibility
class SocketIOClient {
  private ws: WebSocket | null = null;
  private events: Map<string, Array<(data: any) => void>> = new Map();
  private connected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 3000;
  private url: string;

  constructor(url: string) {
    this.url = url;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Convert HTTP URL to WebSocket URL
        const wsUrl = this.url.replace('http://', 'ws://').replace('https://', 'wss://') + '/socket.io/?transport=websocket';
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          this.connected = true;
          this.reconnectAttempts = 0;
          this.emit('connected');
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
          } catch (error) {
            console.warn('Failed to parse WebSocket message:', error);
          }
        };

        this.ws.onclose = () => {
          this.connected = false;
          this.emit('disconnected');
          this.attemptReconnect();
        };

        this.ws.onerror = (error) => {
          this.emit('error', error);
          reject(error);
        };

        // Timeout for connection
        setTimeout(() => {
          if (!this.connected) {
            reject(new Error('Connection timeout'));
          }
        }, 10000);
      } catch (error) {
        reject(error);
      }
    });
  }

  private handleMessage(data: any) {
    // Simple Socket.IO protocol simulation
    if (Array.isArray(data) && data.length >= 2) {
      const [eventName, eventData] = data;
      this.emit(eventName, eventData);
    } else if (data.type && data.data) {
      this.emit(data.type, data.data);
    } else {
      this.emit('message', data);
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => {
        console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
        this.connect();
      }, this.reconnectDelay);
    }
  }

  emit(event: string, data?: any): void {
    if (this.connected && this.ws) {
      // Send as Socket.IO-style message
      const message = JSON.stringify([event, data]);
      this.ws.send(message);
    }
    
    // Also emit locally
    const handlers = this.events.get(event);
    if (handlers) {
      handlers.forEach(handler => handler(data));
    }
  }

  on(event: string, handler: (data: any) => void): void {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }
    this.events.get(event)!.push(handler);
  }

  off(event: string, handler: (data: any) => void): void {
    const handlers = this.events.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }
}

// Mock HiveMind client that uses our Socket.IO client
export class HiveMindClient {
  private socket: SocketIOClient;
  private config: any;

  constructor(config: any = {}) {
    this.config = {
      url: config.url || 'localhost',
      port: config.port || 3001,
      ...config
    };
    
    const serverUrl = `http://${this.config.url}:${this.config.port}`;
    this.socket = new SocketIOClient(serverUrl);

    // Set up event forwarding
    this.socket.on('connected', () => {
      if (this.config.onConnect) this.config.onConnect();
    });

    this.socket.on('disconnected', () => {
      if (this.config.onDisconnect) this.config.onDisconnect();
    });

    this.socket.on('error', (error: Error) => {
      if (this.config.onError) this.config.onError(error);
    });

    this.socket.on('message', (message: any) => {
      if (this.config.onMessage) this.config.onMessage(message);
    });
  }

  async connect(): Promise<void> {
    return await this.socket.connect();
  }

  disconnect(): void {
    this.socket.disconnect();
  }

  isConnected(): boolean {
    return this.socket.isConnected();
  }

  emit(event: string, data?: any): void {
    this.socket.emit(event, data);
  }

  on(event: string, handler: (data: any) => void): void {
    this.socket.on(event, handler);
  }

  off(event: string, handler: (data: any) => void): void {
    this.socket.off(event, handler);
  }

  // MCP-specific methods
  subscribeToSwarm(swarmId: string, callback: (data: any) => void) {
    this.on(`swarm:${swarmId}:update`, callback);
    this.emit('subscribe:swarm', { swarmId });
    return () => {
      this.off(`swarm:${swarmId}:update`, callback);
      this.emit('unsubscribe:swarm', { swarmId });
    };
  }

  subscribeToAgent(agentId: string, callback: (data: any) => void) {
    this.on(`agent:${agentId}:update`, callback);
    this.emit('subscribe:agent', { agentId });
    return () => {
      this.off(`agent:${agentId}:update`, callback);
      this.emit('unsubscribe:agent', { agentId });
    };
  }

  subscribeToTask(taskId: string, callback: (data: any) => void) {
    this.on(`task:${taskId}:update`, callback);
    this.emit('subscribe:task', { taskId });
    return () => {
      this.off(`task:${taskId}:update`, callback);
      this.emit('unsubscribe:task', { taskId });
    };
  }

  // Mock methods for compatibility
  async storeMemory(key: string, value: any, namespace?: string, ttl?: number): Promise<void> {
    return new Promise((resolve) => {
      this.emit('memory:store', { key, value, namespace, ttl });
      resolve();
    });
  }
}

// Singleton instance
let hiveMindClient: HiveMindClient | null = null;

export function getHiveMindClient(config?: any): HiveMindClient {
  if (!hiveMindClient) {
    hiveMindClient = new HiveMindClient(config);
  }
  return hiveMindClient;
}