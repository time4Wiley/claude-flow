/**
 * WebSocket-Enabled MCP Tools Bridge
 * Provides real-time MCP tool execution via WebSocket connection
 */

import { getWebSocket, SwarmWebSocket } from './websocket';

export interface MCPTool {
  name: string;
  description: string;
  parameters: any;
  category: ToolCategory;
}

export type ToolCategory = 
  | 'coordination'
  | 'monitoring'
  | 'memory'
  | 'neural'
  | 'github'
  | 'system'
  | 'workflow'
  | 'daa'
  | 'sparc';

export interface ToolExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
  executionTime: number;
  metadata?: {
    tokenUsage?: number;
    memoryUsage?: number;
    agentId?: string;
    timestamp?: string;
  };
}

export interface ToolExecutionOptions {
  timeout?: number;
  retryCount?: number;
  cacheResult?: boolean;
  trackMetrics?: boolean;
  onProgress?: (progress: any) => void;
}

/**
 * WebSocket MCP Tools Bridge Class
 */
export class MCPBridgeWebSocket {
  private ws: SwarmWebSocket;
  private toolCache = new Map<string, MCPTool>();
  private executionHistory: Array<{
    tool: string;
    timestamp: Date;
    duration: number;
    success: boolean;
  }> = [];
  private activeExecutions = new Map<string, {
    toolName: string;
    startTime: number;
    onProgress?: (progress: any) => void;
  }>();

  constructor() {
    this.ws = getWebSocket({
      url: 'localhost',
      port: 3001,
      autoConnect: true
    });

    // Set up WebSocket event handlers
    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    // Handle tool execution responses
    this.ws.on('mcp:tool:response', (data: any) => {
      const executionId = data.executionId;
      const execution = this.activeExecutions.get(executionId);
      
      if (execution) {
        const executionTime = Date.now() - execution.startTime;
        
        // Track execution history
        this.executionHistory.push({
          tool: execution.toolName,
          timestamp: new Date(),
          duration: executionTime,
          success: data.success
        });

        // Clean up
        this.activeExecutions.delete(executionId);
      }
    });

    // Handle streaming progress updates
    this.ws.on('mcp:tool:progress', (data: any) => {
      const execution = this.activeExecutions.get(data.executionId);
      if (execution && execution.onProgress) {
        execution.onProgress(data.progress);
      }
    });

    // Handle tool discovery response
    this.ws.on('mcp:tools:list', (data: any) => {
      if (data.tools) {
        // Update tool cache
        data.tools.forEach((tool: MCPTool) => {
          this.toolCache.set(tool.name, tool);
        });
      }
    });
  }

  /**
   * Ensure WebSocket is connected
   */
  private async ensureConnected(): Promise<void> {
    if (!this.ws.isConnected()) {
      await this.ws.connect();
    }
  }

  /**
   * Get all available MCP tools via WebSocket
   */
  async getAvailableTools(): Promise<MCPTool[]> {
    await this.ensureConnected();

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Tool discovery timeout'));
      }, 10000);

      // Listen for tool list response
      const handleResponse = (data: any) => {
        clearTimeout(timeout);
        this.ws.off('mcp:tools:list', handleResponse);
        
        if (data.tools) {
          resolve(data.tools);
        } else {
          reject(new Error('No tools received'));
        }
      };

      this.ws.once('mcp:tools:list', handleResponse);

      // Request tool list
      this.ws.getClient().emit('mcp:tools:discover');
    });
  }

  /**
   * Validate parameters for a tool
   */
  async validateParameters(toolName: string, parameters: any): Promise<{ valid: boolean; errors?: string[] }> {
    const cleanToolName = toolName.replace(/^mcp__claude-flow__/, '');
    const tool = this.toolCache.get(cleanToolName);
    
    if (!tool) {
      // Try to fetch tools if not in cache
      await this.getAvailableTools();
      const refreshedTool = this.toolCache.get(cleanToolName);
      
      if (!refreshedTool) {
        return {
          valid: false,
          errors: [`Unknown tool: ${cleanToolName}`]
        };
      }
    }

    const errors: string[] = [];
    
    // Validate required parameters
    if (tool && tool.parameters) {
      for (const [paramName, paramDef] of Object.entries(tool.parameters)) {
        const paramConfig = paramDef as any;
        
        // Check if parameter is required
        if (!paramConfig.optional && paramConfig.default === undefined && !(paramName in parameters)) {
          errors.push(`Missing required parameter: ${paramName}`);
        }
        
        // Validate parameter type
        if (paramName in parameters) {
          const value = parameters[paramName];
          const expectedType = paramConfig.type;
          
          if (expectedType === 'string' && typeof value !== 'string') {
            errors.push(`Parameter ${paramName} must be a string`);
          } else if (expectedType === 'number' && typeof value !== 'number') {
            errors.push(`Parameter ${paramName} must be a number`);
          } else if (expectedType === 'boolean' && typeof value !== 'boolean') {
            errors.push(`Parameter ${paramName} must be a boolean`);
          } else if (expectedType === 'array' && !Array.isArray(value)) {
            errors.push(`Parameter ${paramName} must be an array`);
          }
          
          // Validate enum values
          if (paramConfig.enum && !paramConfig.enum.includes(value)) {
            errors.push(`Parameter ${paramName} must be one of: ${paramConfig.enum.join(', ')}`);
          }
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * Execute an MCP tool via WebSocket
   */
  async executeTool(
    toolName: string, 
    parameters: any, 
    options: ToolExecutionOptions = {}
  ): Promise<ToolExecutionResult> {
    await this.ensureConnected();
    
    const startTime = Date.now();
    const executionId = `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const cleanToolName = toolName.replace(/^mcp__claude-flow__/, '');

    // Store execution metadata
    this.activeExecutions.set(executionId, {
      toolName: cleanToolName,
      startTime,
      onProgress: options.onProgress
    });

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.activeExecutions.delete(executionId);
        reject(new Error(`Tool execution timeout: ${toolName}`));
      }, options.timeout || 30000);

      // Set up response handler
      const handleResponse = (data: any) => {
        if (data.executionId === executionId) {
          clearTimeout(timeout);
          this.ws.off('mcp:tool:response', handleResponse);
          
          const executionTime = Date.now() - startTime;
          
          // Track execution history
          this.executionHistory.push({
            tool: toolName,
            timestamp: new Date(),
            duration: executionTime,
            success: data.success
          });

          // Clean up
          this.activeExecutions.delete(executionId);

          // Resolve with result
          if (data.success) {
            resolve({
              success: true,
              data: data.result,
              executionTime,
              metadata: {
                agentId: data.agentId,
                timestamp: new Date().toISOString(),
                tokenUsage: data.tokenUsage
              }
            });
          } else {
            resolve({
              success: false,
              error: data.error || 'Tool execution failed',
              executionTime
            });
          }
        }
      };

      // Listen for response
      this.ws.on('mcp:tool:response', handleResponse);

      // Send tool execution request
      this.ws.getClient().emit('mcp:tool:execute', {
        executionId,
        toolName: cleanToolName,
        parameters,
        options: {
          trackMetrics: options.trackMetrics,
          cacheResult: options.cacheResult
        }
      });
    });
  }

  /**
   * Get tool by name
   */
  async getTool(name: string): Promise<MCPTool | undefined> {
    if (this.toolCache.has(name)) {
      return this.toolCache.get(name);
    }
    
    // Try to fetch tools if not in cache
    await this.getAvailableTools();
    return this.toolCache.get(name);
  }

  /**
   * Get tools by category
   */
  async getToolsByCategory(category: ToolCategory): Promise<MCPTool[]> {
    if (this.toolCache.size === 0) {
      await this.getAvailableTools();
    }
    
    const tools: MCPTool[] = [];
    this.toolCache.forEach(tool => {
      if (tool.category === category) {
        tools.push(tool);
      }
    });
    
    return tools;
  }

  /**
   * Search tools by keyword
   */
  async searchTools(keyword: string): Promise<MCPTool[]> {
    if (this.toolCache.size === 0) {
      await this.getAvailableTools();
    }
    
    const lowerKeyword = keyword.toLowerCase();
    const tools: MCPTool[] = [];
    
    this.toolCache.forEach(tool => {
      if (
        tool.name.toLowerCase().includes(lowerKeyword) ||
        tool.description.toLowerCase().includes(lowerKeyword)
      ) {
        tools.push(tool);
      }
    });
    
    return tools;
  }

  /**
   * Get execution history
   */
  getExecutionHistory(limit?: number): Array<{
    tool: string;
    timestamp: Date;
    duration: number;
    success: boolean;
  }> {
    if (limit) {
      return this.executionHistory.slice(-limit);
    }
    return [...this.executionHistory];
  }

  /**
   * Clear execution history
   */
  clearExecutionHistory(): void {
    this.executionHistory = [];
  }

  /**
   * Get tool statistics
   */
  getToolStatistics(): Record<string, {
    totalExecutions: number;
    successRate: number;
    avgExecutionTime: number;
  }> {
    const stats: Record<string, any> = {};
    
    for (const execution of this.executionHistory) {
      if (!stats[execution.tool]) {
        stats[execution.tool] = {
          totalExecutions: 0,
          successCount: 0,
          totalTime: 0
        };
      }
      
      stats[execution.tool].totalExecutions++;
      if (execution.success) {
        stats[execution.tool].successCount++;
      }
      stats[execution.tool].totalTime += execution.duration;
    }
    
    // Calculate final statistics
    const finalStats: Record<string, any> = {};
    for (const [tool, data] of Object.entries(stats)) {
      finalStats[tool] = {
        totalExecutions: data.totalExecutions,
        successRate: data.successCount / data.totalExecutions,
        avgExecutionTime: data.totalTime / data.totalExecutions
      };
    }
    
    return finalStats;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.ws.isConnected();
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect(): void {
    this.ws.disconnect();
  }
}

// Singleton instance
let mcpBridgeWS: MCPBridgeWebSocket | null = null;

/**
 * Get or create WebSocket MCP Bridge instance
 */
export function getMCPBridgeWebSocket(): MCPBridgeWebSocket {
  if (!mcpBridgeWS) {
    mcpBridgeWS = new MCPBridgeWebSocket();
  }
  return mcpBridgeWS;
}