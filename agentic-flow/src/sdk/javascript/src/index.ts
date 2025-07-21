/**
 * Agentic Flow JavaScript/TypeScript SDK
 * 
 * Official SDK for interacting with the Agentic Flow API
 * 
 * @example
 * ```typescript
 * import { AgenticFlowClient } from '@agentic-flow/sdk';
 * 
 * const client = new AgenticFlowClient({
 *   apiKey: 'your-api-key',
 *   baseUrl: 'https://api.agenticflow.dev/v1'
 * });
 * 
 * // Create an agent
 * const agent = await client.agents.create({
 *   name: 'My Agent',
 *   type: 'executor',
 *   capabilities: ['data-processing', 'analysis']
 * });
 * 
 * // Start the agent
 * await client.agents.start(agent.id);
 * ```
 */

export { AgenticFlowClient } from './client';
export { AgentResource } from './resources/agents';
export { WorkflowResource } from './resources/workflows';
export { GoalResource } from './resources/goals';
export { MessageResource } from './resources/messages';
export { WebhookResource } from './resources/webhooks';
export { PluginResource } from './resources/plugins';

// Export types
export * from './types';

// Export errors
export * from './errors';

// Export utilities
export { EventEmitter } from './utils/event-emitter';
export { WebSocketClient } from './utils/websocket';

// Version
export const VERSION = '1.0.0';