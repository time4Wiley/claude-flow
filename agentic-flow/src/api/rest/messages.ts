import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { requireScopes } from '../middleware/auth';
import { validateRequest, prioritySchema } from '../middleware/validation';
import { MessageBus } from '../../communication/message-bus';
import { z } from 'zod';
import { businessMetrics } from '../middleware/metrics';

const router = Router();
const messageBus = new MessageBus();

// Validation schemas
const sendMessageSchema = z.object({
  from: z.string().uuid(),
  to: z.string().uuid(),
  type: z.enum(['task', 'result', 'query', 'response', 'event']),
  content: z.record(z.any()),
  priority: prioritySchema.optional(),
});

// POST /messages - Send a message between agents
router.post('/',
  requireScopes('write:messages'),
  validateRequest(sendMessageSchema),
  async (req: Request, res: Response) => {
    try {
      const { from, to, type, content, priority } = req.body;
      
      const message = {
        id: uuidv4(),
        from,
        to,
        type,
        content,
        priority: priority || 'medium',
        timestamp: new Date(),
      };
      
      await messageBus.sendMessage(message);
      
      // Update metrics
      businessMetrics.messagesExchanged.inc({ type });
      
      res.json({
        id: message.id,
        from: message.from,
        to: message.to,
        type: message.type,
        content: message.content,
        priority: message.priority,
        timestamp: message.timestamp.toISOString(),
        deliveredAt: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        error: 'send_failed',
        message: 'Failed to send message',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

// GET /messages - List messages
router.get('/', requireScopes('read:messages'), async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;
    const agentId = req.query.agentId as string;
    const type = req.query.type as string;
    const since = req.query.since as string;
    
    const messages = await messageBus.getMessages({
      limit,
      offset,
      agentId,
      type,
      since: since ? new Date(since) : undefined,
    });
    
    res.json({
      messages: messages.items,
      totalCount: messages.total,
      nextOffset: messages.hasMore ? offset + limit : undefined,
    });
  } catch (error) {
    res.status(500).json({
      error: 'internal_error',
      message: 'Failed to list messages',
    });
  }
});

// GET /messages/:messageId - Get message details
router.get('/:messageId', requireScopes('read:messages'), async (req: Request, res: Response) => {
  try {
    const message = await messageBus.getMessage(req.params.messageId);
    
    if (!message) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Message not found',
      });
    }
    
    res.json({
      id: message.id,
      from: message.from,
      to: message.to,
      type: message.type,
      content: message.content,
      priority: message.priority,
      timestamp: message.timestamp,
      deliveredAt: message.deliveredAt,
      readAt: message.readAt,
    });
  } catch (error) {
    res.status(500).json({
      error: 'internal_error',
      message: 'Failed to get message',
    });
  }
});

// POST /messages/:messageId/read - Mark message as read
router.post('/:messageId/read', requireScopes('write:messages'), async (req: Request, res: Response) => {
  try {
    const message = await messageBus.getMessage(req.params.messageId);
    
    if (!message) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Message not found',
      });
    }
    
    await messageBus.markAsRead(req.params.messageId);
    
    res.json({
      id: message.id,
      readAt: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      error: 'update_failed',
      message: 'Failed to mark message as read',
    });
  }
});

// POST /messages/broadcast - Broadcast message to multiple agents
router.post('/broadcast',
  requireScopes('write:messages'),
  validateRequest(z.object({
    from: z.string().uuid(),
    recipients: z.array(z.string().uuid()).min(1),
    type: z.enum(['task', 'result', 'query', 'response', 'event']),
    content: z.record(z.any()),
    priority: prioritySchema.optional(),
  })),
  async (req: Request, res: Response) => {
    try {
      const { from, recipients, type, content, priority } = req.body;
      
      const messages = await Promise.all(
        recipients.map(async (to: string) => {
          const message = {
            id: uuidv4(),
            from,
            to,
            type,
            content,
            priority: priority || 'medium',
            timestamp: new Date(),
          };
          
          await messageBus.sendMessage(message);
          return message;
        })
      );
      
      // Update metrics
      businessMetrics.messagesExchanged.inc({ type }, recipients.length);
      
      res.json({
        broadcast: {
          id: uuidv4(),
          from,
          recipients,
          messageCount: messages.length,
          messages: messages.map(m => ({
            id: m.id,
            to: m.to,
            timestamp: m.timestamp.toISOString(),
          })),
        },
      });
    } catch (error) {
      res.status(500).json({
        error: 'broadcast_failed',
        message: 'Failed to broadcast message',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

// GET /messages/queue/status - Get message queue status
router.get('/queue/status', requireScopes('read:messages'), async (req: Request, res: Response) => {
  try {
    const status = await messageBus.getQueueStatus();
    
    res.json({
      queueSize: status.size,
      processing: status.processing,
      failed: status.failed,
      throughput: status.throughput,
      averageLatency: status.averageLatency,
    });
  } catch (error) {
    res.status(500).json({
      error: 'internal_error',
      message: 'Failed to get queue status',
    });
  }
});

// DELETE /messages/:messageId - Delete a message
router.delete('/:messageId', requireScopes('write:messages'), async (req: Request, res: Response) => {
  try {
    const success = await messageBus.deleteMessage(req.params.messageId);
    
    if (!success) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Message not found',
      });
    }
    
    res.status(204).send();
  } catch (error) {
    res.status(500).json({
      error: 'delete_failed',
      message: 'Failed to delete message',
    });
  }
});

export { router as messagesRouter };