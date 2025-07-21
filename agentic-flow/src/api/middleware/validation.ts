import { Request, Response, NextFunction } from 'express';
import { z, ZodError, ZodSchema } from 'zod';

/**
 * Middleware factory for request validation using Zod schemas
 */
export function validateRequest<T extends ZodSchema>(schema: T) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate request body
      const validated = await schema.parseAsync(req.body);
      req.body = validated;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
        }));
        
        res.status(400).json({
          error: 'validation_error',
          message: 'Request validation failed',
          details: {
            errors,
          },
        });
      } else {
        res.status(500).json({
          error: 'internal_error',
          message: 'An unexpected error occurred during validation',
        });
      }
    }
  };
}

/**
 * Middleware factory for query parameter validation
 */
export function validateQuery<T extends ZodSchema>(schema: T) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = await schema.parseAsync(req.query);
      req.query = validated as any;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
        }));
        
        res.status(400).json({
          error: 'validation_error',
          message: 'Query parameter validation failed',
          details: {
            errors,
          },
        });
      } else {
        res.status(500).json({
          error: 'internal_error',
          message: 'An unexpected error occurred during validation',
        });
      }
    }
  };
}

/**
 * Middleware factory for path parameter validation
 */
export function validateParams<T extends ZodSchema>(schema: T) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = await schema.parseAsync(req.params);
      req.params = validated as any;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
        }));
        
        res.status(400).json({
          error: 'validation_error',
          message: 'Path parameter validation failed',
          details: {
            errors,
          },
        });
      } else {
        res.status(500).json({
          error: 'internal_error',
          message: 'An unexpected error occurred during validation',
        });
      }
    }
  };
}

// Common validation schemas
export const paginationSchema = z.object({
  limit: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().min(1).max(100)).optional(),
  offset: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().min(0)).optional(),
});

export const uuidSchema = z.string().uuid();

export const apiKeySchema = z.string().regex(/^af_[A-Za-z0-9]{32}$/);

export const dateTimeSchema = z.string().datetime();

export const prioritySchema = z.enum(['low', 'medium', 'high', 'critical']);

export const statusSchema = z.enum(['pending', 'active', 'completed', 'failed', 'cancelled']);