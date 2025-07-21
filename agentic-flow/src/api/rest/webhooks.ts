import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { requireScopes } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { WebhookManager } from '../../webhooks/webhook-manager';
import { z } from 'zod';
import { businessMetrics } from '../middleware/metrics';

const router = Router();
const webhookManager = new WebhookManager();

// Validation schemas
const createWebhookSchema = z.object({
  url: z.string().url(),
  events: z.array(z.string()).min(1),
  secret: z.string().min(16).optional(),
});

const updateWebhookSchema = z.object({
  url: z.string().url().optional(),
  events: z.array(z.string()).min(1).optional(),
  secret: z.string().min(16).optional(),
});

// GET /webhooks - List webhook subscriptions
router.get('/', requireScopes('read:webhooks'), async (req: Request, res: Response) => {
  try {
    const webhooks = await webhookManager.listWebhooks();
    
    res.json({
      webhooks,
      totalCount: webhooks.length,
    });
  } catch (error) {
    res.status(500).json({
      error: 'internal_error',
      message: 'Failed to list webhooks',
    });
  }
});

// POST /webhooks - Create webhook subscription
router.post('/',
  requireScopes('write:webhooks'),
  validateRequest(createWebhookSchema),
  async (req: Request, res: Response) => {
    try {
      const { url, events, secret } = req.body;
      
      const webhook = await webhookManager.createWebhook({
        url,
        events,
        secret: secret || webhookManager.generateSecret(),
      });
      
      res.status(201).json({
        id: webhook.id,
        url: webhook.url,
        events: webhook.events,
        active: webhook.active,
        secret: webhook.secret,
        createdAt: webhook.createdAt,
      });
    } catch (error) {
      res.status(400).json({
        error: 'create_failed',
        message: 'Failed to create webhook',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

// GET /webhooks/:webhookId - Get webhook details
router.get('/:webhookId', requireScopes('read:webhooks'), async (req: Request, res: Response) => {
  try {
    const webhook = await webhookManager.getWebhook(req.params.webhookId);
    
    if (!webhook) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Webhook not found',
      });
    }
    
    res.json({
      id: webhook.id,
      url: webhook.url,
      events: webhook.events,
      active: webhook.active,
      secret: webhook.secret,
      createdAt: webhook.createdAt,
      lastTriggered: webhook.lastTriggered,
      deliveryStats: webhook.deliveryStats,
    });
  } catch (error) {
    res.status(500).json({
      error: 'internal_error',
      message: 'Failed to get webhook',
    });
  }
});

// PATCH /webhooks/:webhookId - Update webhook
router.patch('/:webhookId',
  requireScopes('write:webhooks'),
  validateRequest(updateWebhookSchema),
  async (req: Request, res: Response) => {
    try {
      const webhook = await webhookManager.updateWebhook(req.params.webhookId, req.body);
      
      if (!webhook) {
        return res.status(404).json({
          error: 'not_found',
          message: 'Webhook not found',
        });
      }
      
      res.json({
        id: webhook.id,
        url: webhook.url,
        events: webhook.events,
        active: webhook.active,
        secret: webhook.secret,
        createdAt: webhook.createdAt,
        updatedAt: webhook.updatedAt,
      });
    } catch (error) {
      res.status(400).json({
        error: 'update_failed',
        message: 'Failed to update webhook',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

// DELETE /webhooks/:webhookId - Delete webhook
router.delete('/:webhookId', requireScopes('write:webhooks'), async (req: Request, res: Response) => {
  try {
    const success = await webhookManager.deleteWebhook(req.params.webhookId);
    
    if (!success) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Webhook not found',
      });
    }
    
    res.status(204).send();
  } catch (error) {
    res.status(500).json({
      error: 'delete_failed',
      message: 'Failed to delete webhook',
    });
  }
});

// POST /webhooks/:webhookId/toggle - Enable/disable webhook
router.post('/:webhookId/toggle',
  requireScopes('write:webhooks'),
  validateRequest(z.object({
    active: z.boolean(),
  })),
  async (req: Request, res: Response) => {
    try {
      const { active } = req.body;
      const webhook = await webhookManager.toggleWebhook(req.params.webhookId, active);
      
      if (!webhook) {
        return res.status(404).json({
          error: 'not_found',
          message: 'Webhook not found',
        });
      }
      
      res.json({
        id: webhook.id,
        active: webhook.active,
        updatedAt: webhook.updatedAt,
      });
    } catch (error) {
      res.status(500).json({
        error: 'toggle_failed',
        message: 'Failed to toggle webhook',
      });
    }
  }
);

// POST /webhooks/:webhookId/test - Test webhook delivery
router.post('/:webhookId/test', requireScopes('write:webhooks'), async (req: Request, res: Response) => {
  try {
    const webhook = await webhookManager.getWebhook(req.params.webhookId);
    
    if (!webhook) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Webhook not found',
      });
    }
    
    const testEvent = {
      id: uuidv4(),
      type: 'webhook.test',
      timestamp: new Date().toISOString(),
      data: {
        message: 'This is a test webhook delivery',
        webhookId: webhook.id,
      },
    };
    
    const result = await webhookManager.deliverWebhook(webhook, testEvent);
    
    res.json({
      success: result.success,
      statusCode: result.statusCode,
      duration: result.duration,
      response: result.response,
      error: result.error,
    });
  } catch (error) {
    res.status(500).json({
      error: 'test_failed',
      message: 'Failed to test webhook',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /webhooks/:webhookId/deliveries - Get webhook delivery history
router.get('/:webhookId/deliveries', requireScopes('read:webhooks'), async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;
    
    const deliveries = await webhookManager.getWebhookDeliveries(req.params.webhookId, {
      limit,
      offset,
    });
    
    res.json({
      deliveries,
      totalCount: deliveries.length,
    });
  } catch (error) {
    res.status(500).json({
      error: 'internal_error',
      message: 'Failed to get webhook deliveries',
    });
  }
});

// POST /webhooks/:webhookId/deliveries/:deliveryId/retry - Retry failed delivery
router.post('/:webhookId/deliveries/:deliveryId/retry', 
  requireScopes('write:webhooks'), 
  async (req: Request, res: Response) => {
    try {
      const result = await webhookManager.retryDelivery(
        req.params.webhookId,
        req.params.deliveryId
      );
      
      if (!result) {
        return res.status(404).json({
          error: 'not_found',
          message: 'Webhook or delivery not found',
        });
      }
      
      // Update metrics
      businessMetrics.webhooksDelivered.inc({ 
        event_type: 'retry',
        status: result.success ? 'success' : 'failed'
      });
      
      res.json({
        success: result.success,
        statusCode: result.statusCode,
        duration: result.duration,
        timestamp: result.timestamp,
      });
    } catch (error) {
      res.status(500).json({
        error: 'retry_failed',
        message: 'Failed to retry webhook delivery',
      });
    }
  }
);

// GET /webhooks/events - List available webhook events
router.get('/events', requireScopes('read:webhooks'), async (req: Request, res: Response) => {
  try {
    const events = webhookManager.getAvailableEvents();
    
    res.json({
      events,
      totalCount: events.length,
    });
  } catch (error) {
    res.status(500).json({
      error: 'internal_error',
      message: 'Failed to list webhook events',
    });
  }
});

export { router as webhooksRouter };