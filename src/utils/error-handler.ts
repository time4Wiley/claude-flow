/**
 * Utility for proper error handling in TypeScript
 */

import { getErrorMessage as getErrorMsg, getErrorStack as getErrorStk, isError as isErr } from './type-guards.js';

export class AppError extends Error {
  constructor(
    message: string,
    public code?: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'AppError';
    Object.setPrototypeOf(_this, AppError.prototype);
  }
}

// Re-export from type-guards for backward compatibility
export const _isError = isErr;
export const _getErrorMessage = getErrorMsg;
export const _getErrorStack = getErrorStk;

export function handleError(error: _unknown, context?: string): never {
  const _message = getErrorMessage(error);
  const _stack = getErrorStack(error);
  
  console.error(`Error${context ? ` in ${context}` : ''}: ${message}`);
  if (stack && process.env.NODE_ENV === 'development') {
    console.error('Stack trace:', stack);
  }
  
  process.exit(1);
}