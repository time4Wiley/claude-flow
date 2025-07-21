import WebSocket from 'ws';
import { EventEmitter } from 'eventemitter3';
import { WebSocketError } from '../errors';

export interface WebSocketOptions {
  headers?: Record<string, string>;
  reconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  pingInterval?: number;
}

export class WebSocketClient extends EventEmitter {
  private ws?: WebSocket;
  private url: string;
  private options: Required<WebSocketOptions>;
  private reconnectAttempts = 0;
  private pingTimer?: NodeJS.Timeout;
  private reconnectTimer?: NodeJS.Timeout;
  
  constructor(url: string, options: WebSocketOptions = {}) {
    super();
    
    this.url = url;
    this.options = {
      headers: options.headers || {},
      reconnect: options.reconnect ?? true,
      reconnectInterval: options.reconnectInterval || 5000,
      maxReconnectAttempts: options.maxReconnectAttempts || 10,
      pingInterval: options.pingInterval || 30000,
    };
  }
  
  /**
   * Connect to WebSocket server
   */
  connect(): void {
    try {
      this.ws = new WebSocket(this.url, {
        headers: this.options.headers,
      });
      
      this.ws.on('open', this.handleOpen.bind(this));
      this.ws.on('message', this.handleMessage.bind(this));
      this.ws.on('close', this.handleClose.bind(this));
      this.ws.on('error', this.handleError.bind(this));
      this.ws.on('pong', this.handlePong.bind(this));
      
    } catch (error) {
      this.emit('error', new WebSocketError(
        `Failed to connect to WebSocket: ${error instanceof Error ? error.message : 'Unknown error'}`
      ));
    }
  }
  
  /**
   * Send a message to the server
   */
  send(event: string, data: any): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new WebSocketError('WebSocket is not connected');
    }
    
    const message = JSON.stringify({
      event,
      data,
      timestamp: new Date().toISOString(),
    });
    
    this.ws.send(message);
  }
  
  /**
   * Close the WebSocket connection
   */
  close(): void {
    this.options.reconnect = false; // Disable auto-reconnect
    
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = undefined;
    }
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
    
    if (this.ws) {
      this.ws.close();
      this.ws = undefined;
    }
  }
  
  /**
   * Get WebSocket ready state
   */
  get readyState(): number {
    return this.ws?.readyState || WebSocket.CLOSED;
  }
  
  /**
   * Check if WebSocket is connected
   */
  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
  
  private handleOpen(): void {
    this.reconnectAttempts = 0;
    this.emit('connect');
    
    // Start ping timer
    this.startPingTimer();
  }
  
  private handleMessage(data: WebSocket.Data): void {
    try {
      const message = JSON.parse(data.toString());
      
      // Handle different message types
      if (message.event) {
        this.emit(message.event, message.data);
      } else if (message.type) {
        // Legacy format support
        this.emit(message.type, message);
      }
      
    } catch (error) {
      this.emit('error', new WebSocketError(
        `Failed to parse WebSocket message: ${error instanceof Error ? error.message : 'Unknown error'}`
      ));
    }
  }
  
  private handleClose(code: number, reason: string): void {
    this.emit('disconnect', { code, reason });
    
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = undefined;
    }
    
    // Attempt reconnection if enabled
    if (this.options.reconnect && this.reconnectAttempts < this.options.maxReconnectAttempts) {
      this.reconnectAttempts++;
      
      this.emit('reconnecting', {
        attempt: this.reconnectAttempts,
        maxAttempts: this.options.maxReconnectAttempts,
      });
      
      this.reconnectTimer = setTimeout(() => {
        this.connect();
      }, this.options.reconnectInterval);
    }
  }
  
  private handleError(error: Error): void {
    this.emit('error', new WebSocketError(
      `WebSocket error: ${error.message}`
    ));
  }
  
  private handlePong(): void {
    this.emit('pong');
  }
  
  private startPingTimer(): void {
    this.pingTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.ping();
      }
    }, this.options.pingInterval);
  }
}