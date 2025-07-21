import { Router, Request, Response } from 'express';
import { requireScopes } from '../middleware/auth';
import { validateRequest, prioritySchema } from '../middleware/validation';
import { GoalEngine } from '../../goal-engine/goal-engine';
import { z } from 'zod';
import { businessMetrics } from '../middleware/metrics';

const router = Router();

// Validation schemas
const createGoalSchema = z.object({
  description: z.string().min(1).max(1000),
  priority: prioritySchema.optional(),
  constraints: z.record(z.any()).optional(),
});

const assignGoalSchema = z.object({
  agentId: z.string().uuid(),
});

const updateGoalStatusSchema = z.object({
  status: z.enum(['pending', 'analyzing', 'executing', 'completed', 'failed']),
});

// POST /goals - Parse and create a goal
router.post('/',
  requireScopes('write:goals'),
  validateRequest(createGoalSchema),
  async (req: Request, res: Response) => {
    try {
      const { description, priority, constraints } = req.body;
      
      // Create goal engine with user context
      const goalEngine = new GoalEngine(
        req.user?.id || req.apiKey?.id || 'system'
      );
      
      const goal = await goalEngine.parseGoal(description, {
        priority: priority || 'medium',
        constraints,
      });
      
      // Update metrics
      businessMetrics.goalsProcessed.inc({ 
        priority: priority || 'medium', 
        status: 'created' 
      });
      
      res.status(201).json({
        id: goal.id,
        description: goal.description,
        priority: goal.priority,
        status: goal.status,
        parsedIntent: goal.parsedIntent,
        subtasks: goal.subtasks,
        createdAt: goal.createdAt,
      });
    } catch (error) {
      res.status(400).json({
        error: 'goal_parsing_failed',
        message: 'Failed to parse and create goal',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

// GET /goals - List goals
router.get('/', requireScopes('read:goals'), async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;
    const status = req.query.status as string;
    const priority = req.query.priority as string;
    const agentId = req.query.agentId as string;
    
    const goalEngine = new GoalEngine('system');
    const goals = await goalEngine.listGoals({
      limit,
      offset,
      status,
      priority,
      agentId,
    });
    
    res.json({
      goals,
      totalCount: goals.length,
    });
  } catch (error) {
    res.status(500).json({
      error: 'internal_error',
      message: 'Failed to list goals',
    });
  }
});

// GET /goals/:goalId - Get goal details
router.get('/:goalId', requireScopes('read:goals'), async (req: Request, res: Response) => {
  try {
    const goalEngine = new GoalEngine('system');
    const goal = await goalEngine.getGoal(req.params.goalId);
    
    if (!goal) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Goal not found',
      });
    }
    
    res.json({
      id: goal.id,
      description: goal.description,
      priority: goal.priority,
      status: goal.status,
      parsedIntent: goal.parsedIntent,
      subtasks: goal.subtasks,
      assignedAgent: goal.assignedAgent,
      createdAt: goal.createdAt,
      updatedAt: goal.updatedAt,
      completedAt: goal.completedAt,
    });
  } catch (error) {
    res.status(500).json({
      error: 'internal_error',
      message: 'Failed to get goal',
    });
  }
});

// POST /goals/:goalId/assign - Assign goal to agent
router.post('/:goalId/assign',
  requireScopes('write:goals'),
  validateRequest(assignGoalSchema),
  async (req: Request, res: Response) => {
    try {
      const { agentId } = req.body;
      const goalEngine = new GoalEngine('system');
      
      const goal = await goalEngine.getGoal(req.params.goalId);
      if (!goal) {
        return res.status(404).json({
          error: 'not_found',
          message: 'Goal not found',
        });
      }
      
      await goalEngine.assignGoal(req.params.goalId, agentId);
      
      res.json({
        id: goal.id,
        description: goal.description,
        priority: goal.priority,
        status: goal.status,
        assignedAgent: agentId,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      res.status(400).json({
        error: 'assignment_failed',
        message: 'Failed to assign goal',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

// PATCH /goals/:goalId/status - Update goal status
router.patch('/:goalId/status',
  requireScopes('write:goals'),
  validateRequest(updateGoalStatusSchema),
  async (req: Request, res: Response) => {
    try {
      const { status } = req.body;
      const goalEngine = new GoalEngine('system');
      
      const goal = await goalEngine.getGoal(req.params.goalId);
      if (!goal) {
        return res.status(404).json({
          error: 'not_found',
          message: 'Goal not found',
        });
      }
      
      await goalEngine.updateGoalStatus(req.params.goalId, status);
      
      // Update metrics
      businessMetrics.goalsProcessed.inc({ 
        priority: goal.priority, 
        status 
      });
      
      res.json({
        id: goal.id,
        description: goal.description,
        priority: goal.priority,
        status,
        updatedAt: new Date().toISOString(),
        ...(status === 'completed' && { completedAt: new Date().toISOString() }),
      });
    } catch (error) {
      res.status(400).json({
        error: 'update_failed',
        message: 'Failed to update goal status',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

// DELETE /goals/:goalId - Cancel/delete goal
router.delete('/:goalId', requireScopes('write:goals'), async (req: Request, res: Response) => {
  try {
    const goalEngine = new GoalEngine('system');
    const success = await goalEngine.cancelGoal(req.params.goalId);
    
    if (!success) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Goal not found',
      });
    }
    
    res.status(204).send();
  } catch (error) {
    res.status(500).json({
      error: 'delete_failed',
      message: 'Failed to delete goal',
    });
  }
});

// GET /goals/:goalId/progress - Get goal progress
router.get('/:goalId/progress', requireScopes('read:goals'), async (req: Request, res: Response) => {
  try {
    const goalEngine = new GoalEngine('system');
    const progress = await goalEngine.getGoalProgress(req.params.goalId);
    
    if (!progress) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Goal not found',
      });
    }
    
    res.json({
      goalId: req.params.goalId,
      overall: progress.overall,
      subtasks: progress.subtasks,
      timeline: progress.timeline,
      estimatedCompletion: progress.estimatedCompletion,
    });
  } catch (error) {
    res.status(500).json({
      error: 'internal_error',
      message: 'Failed to get goal progress',
    });
  }
});

// GET /goals/analytics - Get goal analytics
router.get('/analytics', requireScopes('read:goals'), async (req: Request, res: Response) => {
  try {
    const goalEngine = new GoalEngine('system');
    const analytics = await goalEngine.getAnalytics();
    
    res.json({
      totalGoals: analytics.total,
      byStatus: analytics.byStatus,
      byPriority: analytics.byPriority,
      averageCompletionTime: analytics.averageCompletionTime,
      successRate: analytics.successRate,
      trendsLastWeek: analytics.trendsLastWeek,
    });
  } catch (error) {
    res.status(500).json({
      error: 'internal_error',
      message: 'Failed to get goal analytics',
    });
  }
});

export { router as goalsRouter };