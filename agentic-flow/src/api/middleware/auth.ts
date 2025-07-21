import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { createHash } from 'crypto';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
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
    }
  }
}

// Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const API_KEY_PREFIX = 'af_';

// In-memory store for demo (use Redis or database in production)
const apiKeys = new Map<string, {
  id: string;
  name: string;
  hashedKey: string;
  scopes: string[];
  rateLimit: number;
  createdAt: Date;
}>();

// Initialize some demo API keys
async function initializeApiKeys() {
  const demoKey = `${API_KEY_PREFIX}demo_${generateRandomString(32)}`;
  const hashedKey = await hashApiKey(demoKey);
  
  apiKeys.set(hashedKey, {
    id: 'demo-key-001',
    name: 'Demo API Key',
    hashedKey,
    scopes: ['read:agents', 'write:agents', 'read:workflows'],
    rateLimit: 100,
    createdAt: new Date(),
  });
  
  console.log(`Demo API Key: ${demoKey}`);
}

// Hash API key for storage
async function hashApiKey(apiKey: string): Promise<string> {
  return createHash('sha256').update(apiKey).digest('hex');
}

// Generate random string
function generateRandomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Verify JWT token
function verifyJWT(token: string): any {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

// Auth middleware
export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    // Check for API key in header
    const apiKey = req.headers['x-api-key'] as string;
    if (apiKey) {
      const hashedKey = await hashApiKey(apiKey);
      const keyData = apiKeys.get(hashedKey);
      
      if (keyData) {
        req.apiKey = {
          id: keyData.id,
          name: keyData.name,
          scopes: keyData.scopes,
        };
        return next();
      }
    }
    
    // Check for Bearer token
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = verifyJWT(token);
      
      if (decoded) {
        req.user = {
          id: decoded.id,
          email: decoded.email,
          role: decoded.role,
        };
        return next();
      }
    }
    
    // No valid authentication found
    res.status(401).json({
      error: 'unauthorized',
      message: 'Authentication required. Please provide a valid API key or JWT token.',
    });
  } catch (error) {
    res.status(500).json({
      error: 'auth_error',
      message: 'Authentication error occurred',
    });
  }
}

// Scope checking middleware factory
export function requireScopes(...requiredScopes: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.user) {
      // JWT users have all scopes for now
      return next();
    }
    
    if (req.apiKey) {
      const hasAllScopes = requiredScopes.every(scope => 
        req.apiKey!.scopes.includes(scope)
      );
      
      if (hasAllScopes) {
        return next();
      }
    }
    
    res.status(403).json({
      error: 'insufficient_permissions',
      message: `This operation requires the following scopes: ${requiredScopes.join(', ')}`,
    });
  };
}

// Generate JWT token
export function generateJWT(user: { id: string; email: string; role: string }): string {
  return jwt.sign(user, JWT_SECRET, { expiresIn: '24h' });
}

// Create new API key
export async function createApiKey(name: string, scopes: string[]): Promise<string> {
  const apiKey = `${API_KEY_PREFIX}${generateRandomString(32)}`;
  const hashedKey = await hashApiKey(apiKey);
  
  apiKeys.set(hashedKey, {
    id: `key_${generateRandomString(16)}`,
    name,
    hashedKey,
    scopes,
    rateLimit: 1000,
    createdAt: new Date(),
  });
  
  return apiKey;
}

// Revoke API key
export async function revokeApiKey(apiKey: string): Promise<boolean> {
  const hashedKey = await hashApiKey(apiKey);
  return apiKeys.delete(hashedKey);
}

// List API keys (without revealing the actual keys)
export function listApiKeys(): Array<{
  id: string;
  name: string;
  scopes: string[];
  createdAt: Date;
}> {
  return Array.from(apiKeys.values()).map(key => ({
    id: key.id,
    name: key.name,
    scopes: key.scopes,
    createdAt: key.createdAt,
  }));
}

// Initialize API keys on startup
initializeApiKeys();