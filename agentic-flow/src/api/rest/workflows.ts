import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { requireScopes } from '../middleware/auth';
import { validateRequest, validateQuery, paginationSchema } from '../middleware/validation';
import { WorkflowEngine } from '../../lib/workflow-engine';
import { z } from 'zod';
import { businessMetrics } from '../middleware/metrics';

const router = Router();
const workflowEngine = new WorkflowEngine();

// Validation schemas
const createWorkflowSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  steps: z.array(z.object({
    name: z.string(),
    type: z.enum(['agent', 'condition', 'parallel', 'sequential']),
    action: z.string(),
    parameters: z.record(z.any()).optional(),
    dependencies: z.array(z.string()).optional(),
  })).min(1),
});

const executeWorkflowSchema = z.object({
  parameters: z.record(z.any()).optional(),
});

// GET /workflows - List workflows
router.get('/', 
  requireScopes('read:workflows'),
  validateQuery(paginationSchema),
  async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;
      const status = req.query.status as string;
      
      const workflows = await workflowEngine.listWorkflows({
        limit,
        offset,
        status,
      });
      
      res.json({
        workflows: workflows.items,
        totalCount: workflows.total,
        nextOffset: workflows.hasMore ? offset + limit : undefined,
      });
    } catch (error) {
      res.status(500).json({
        error: 'internal_error',
        message: 'Failed to list workflows',
      });
    }
  }
);

// POST /workflows - Create a new workflow
router.post('/',
  requireScopes('write:workflows'),
  validateRequest(createWorkflowSchema),
  async (req: Request, res: Response) => {
    try {
      const { name, description, steps } = req.body;
      
      const workflow = await workflowEngine.createWorkflow({
        name,
        description,
        steps,
      });
      
      res.status(201).json({
        id: workflow.id,
        name: workflow.name,
        description: workflow.description,
        status: workflow.status,
        steps: workflow.steps,
        createdAt: workflow.createdAt,
        updatedAt: workflow.updatedAt,
      });
    } catch (error) {
      res.status(400).json({
        error: 'create_failed',
        message: 'Failed to create workflow',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

// GET /workflows/:workflowId - Get workflow details
router.get('/:workflowId', requireScopes('read:workflows'), async (req: Request, res: Response) => {
  try {
    const workflow = await workflowEngine.getWorkflow(req.params.workflowId);
    
    if (!workflow) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Workflow not found',
      });
    }
    
    res.json({
      id: workflow.id,
      name: workflow.name,
      description: workflow.description,
      status: workflow.status,
      steps: workflow.steps,
      createdAt: workflow.createdAt,
      updatedAt: workflow.updatedAt,
      executions: await workflowEngine.getWorkflowExecutions(workflow.id, { limit: 5 }),
    });
  } catch (error) {
    res.status(500).json({
      error: 'internal_error',
      message: 'Failed to get workflow',
    });
  }
});

// PATCH /workflows/:workflowId - Update workflow
router.patch('/:workflowId',
  requireScopes('write:workflows'),
  validateRequest(createWorkflowSchema.partial()),
  async (req: Request, res: Response) => {
    try {
      const workflow = await workflowEngine.getWorkflow(req.params.workflowId);
      
      if (!workflow) {
        return res.status(404).json({
          error: 'not_found',
          message: 'Workflow not found',
        });
      }
      
      const updated = await workflowEngine.updateWorkflow(req.params.workflowId, req.body);
      
      res.json({
        id: updated.id,
        name: updated.name,
        description: updated.description,
        status: updated.status,
        steps: updated.steps,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      });
    } catch (error) {
      res.status(400).json({
        error: 'update_failed',
        message: 'Failed to update workflow',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

// DELETE /workflows/:workflowId - Delete workflow
router.delete('/:workflowId', requireScopes('write:workflows'), async (req: Request, res: Response) => {
  try {
    const success = await workflowEngine.deleteWorkflow(req.params.workflowId);
    
    if (!success) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Workflow not found',
      });
    }
    
    res.status(204).send();
  } catch (error) {
    res.status(500).json({
      error: 'delete_failed',
      message: 'Failed to delete workflow',
    });
  }
});

// POST /workflows/:workflowId/execute - Execute workflow
router.post('/:workflowId/execute',
  requireScopes('execute:workflows'),
  validateRequest(executeWorkflowSchema),
  async (req: Request, res: Response) => {
    try {
      const workflow = await workflowEngine.getWorkflow(req.params.workflowId);
      
      if (!workflow) {
        return res.status(404).json({
          error: 'not_found',
          message: 'Workflow not found',
        });
      }
      
      const execution = await workflowEngine.executeWorkflow(
        req.params.workflowId,
        req.body.parameters
      );
      
      // Update metrics
      businessMetrics.workflowsExecuted.inc({ status: 'started' });
      
      res.json({
        id: execution.id,
        workflowId: execution.workflowId,
        status: execution.status,
        startedAt: execution.startedAt,
        completedAt: execution.completedAt,
        results: execution.results,
      });
    } catch (error) {
      businessMetrics.workflowsExecuted.inc({ status: 'failed' });
      
      res.status(500).json({
        error: 'execution_failed',
        message: 'Failed to execute workflow',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

// GET /workflows/:workflowId/executions - Get workflow executions
router.get('/:workflowId/executions', 
  requireScopes('read:workflows'),
  validateQuery(paginationSchema),
  async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;
      
      const executions = await workflowEngine.getWorkflowExecutions(
        req.params.workflowId,
        { limit, offset }
      );
      
      res.json({
        executions,
        totalCount: executions.length,
      });
    } catch (error) {
      res.status(500).json({
        error: 'internal_error',
        message: 'Failed to get workflow executions',
      });
    }
  }
);

// GET /workflows/:workflowId/executions/:executionId - Get execution details
router.get('/:workflowId/executions/:executionId', 
  requireScopes('read:workflows'),
  async (req: Request, res: Response) => {
    try {
      const execution = await workflowEngine.getExecution(
        req.params.workflowId,
        req.params.executionId
      );
      
      if (!execution) {
        return res.status(404).json({
          error: 'not_found',
          message: 'Execution not found',
        });
      }
      
      res.json(execution);
    } catch (error) {
      res.status(500).json({
        error: 'internal_error',
        message: 'Failed to get execution details',
      });
    }
  }
);

// POST /workflows/:workflowId/executions/:executionId/cancel - Cancel execution
router.post('/:workflowId/executions/:executionId/cancel',
  requireScopes('execute:workflows'),
  async (req: Request, res: Response) => {
    try {
      const success = await workflowEngine.cancelExecution(
        req.params.workflowId,
        req.params.executionId
      );
      
      if (!success) {
        return res.status(404).json({
          error: 'not_found',
          message: 'Execution not found or already completed',
        });
      }
      
      res.json({
        message: 'Execution cancelled successfully',
      });
    } catch (error) {
      res.status(500).json({
        error: 'cancel_failed',
        message: 'Failed to cancel execution',
      });
    }
  }
);

// GET /workflows/templates - Get workflow templates
router.get('/templates',
  requireScopes('read:workflows'),
  async (req: Request, res: Response) => {
    try {
      const templates = await workflowEngine.getTemplates();
      
      res.json({
        templates,
        totalCount: templates.length,
      });
    } catch (error) {
      res.status(500).json({
        error: 'internal_error',
        message: 'Failed to get workflow templates',
      });
    }
  }
);

export { router as workflowsRouter };