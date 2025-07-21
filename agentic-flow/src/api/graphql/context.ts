import { Request } from 'express';
import { PubSub } from 'graphql-subscriptions';
import { GoalEngine } from '../../goal-engine/goal-engine';

// Create a PubSub instance for subscriptions
const pubsub = new PubSub();

export interface Context {
  req: Request;
  user?: {
    id: string;
    email: string;
    role: string;
  };
  apiKey?: {
    id: string;
    name: string;
    scopes: string[];
  };
  pubsub: PubSub;
  goalEngine: GoalEngine;
}

export async function createContext({ req }: { req: Request }): Promise<Context> {
  // Extract authentication from request (already done by middleware)
  const user = req.user;
  const apiKey = req.apiKey;
  
  // Create goal engine with appropriate user context
  const goalEngine = new GoalEngine(
    user?.id || apiKey?.id || 'anonymous'
  );
  
  return {
    req,
    user,
    apiKey,
    pubsub,
    goalEngine,
  };
}