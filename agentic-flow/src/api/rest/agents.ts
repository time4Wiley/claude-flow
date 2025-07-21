import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { requireScopes } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { AgentManager } from '../../lib/agent-manager';
import { z } from 'zod';

const router = Router();
const agentManager = new AgentManager();

// Validation schemas
const createAgentSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['coordinator', 'executor', 'specialized']),
  capabilities: z.array(z.string()).optional(),
  configuration: z.record(z.any()).optional(),
});

const updateAgentSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  capabilities: z.array(z.string()).optional(),
  configuration: z.record(z.any()).optional(),
});

// GET /agents - List all agents
router.get('/', requireScopes('read:agents'), async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;
    const status = req.query.status as string;
    const type = req.query.type as string;
    
    const agents = await agentManager.listAgents({
      limit,
      offset,
      status,
      type,
    });
    
    res.json({
      agents: agents.items,
      totalCount: agents.total,
      nextOffset: agents.hasMore ? offset + limit : undefined,
    });
  } catch (error) {
    res.status(500).json({
      error: 'internal_error',
      message: 'Failed to list agents',
    });
  }
});

// POST /agents - Create a new agent
router.post('/', 
  requireScopes('write:agents'),
  validateRequest(createAgentSchema),
  async (req: Request, res: Response) => {
    try {
      const { name, type, capabilities, configuration } = req.body;
      
      const agent = await agentManager.createAgent({
        name,
        type,
        capabilities,
        configuration,
      });
      
      res.status(201).json({
        id: agent.getId(),
        name: agent.getName(),
        type: agent.getType(),
        status: agent.getStatus(),
        capabilities: agent.getCapabilities(),
        configuration: agent.getConfiguration(),
        metrics: agent.getMetrics(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      res.status(400).json({
        error: 'create_failed',
        message: 'Failed to create agent',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

// GET /agents/:agentId - Get agent details
router.get('/:agentId', requireScopes('read:agents'), async (req: Request, res: Response) => {
  try {
    const agent = await agentManager.getAgent(req.params.agentId);
    
    if (!agent) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Agent not found',
      });
    }
    
    res.json({
      id: agent.getId(),
      name: agent.getName(),
      type: agent.getType(),
      status: agent.getStatus(),
      capabilities: agent.getCapabilities(),
      configuration: agent.getConfiguration(),
      metrics: agent.getMetrics(),
      createdAt: agent.getCreatedAt(),
      updatedAt: agent.getUpdatedAt(),
    });
  } catch (error) {
    res.status(500).json({
      error: 'internal_error',
      message: 'Failed to get agent',
    });
  }
});

// PATCH /agents/:agentId - Update agent configuration
router.patch('/:agentId',
  requireScopes('write:agents'),
  validateRequest(updateAgentSchema),
  async (req: Request, res: Response) => {
    try {
      const agent = await agentManager.getAgent(req.params.agentId);
      
      if (!agent) {
        return res.status(404).json({
          error: 'not_found',
          message: 'Agent not found',
        });
      }
      
      const { name, capabilities, configuration } = req.body;
      
      if (name) {
        await agent.setName(name);
      }
      
      if (capabilities) {
        await agent.setCapabilities(capabilities);
      }
      
      if (configuration) {
        await agent.updateConfiguration(configuration);
      }
      
      res.json({
        id: agent.getId(),
        name: agent.getName(),
        type: agent.getType(),
        status: agent.getStatus(),
        capabilities: agent.getCapabilities(),
        configuration: agent.getConfiguration(),
        metrics: agent.getMetrics(),
        createdAt: agent.getCreatedAt(),
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      res.status(400).json({
        error: 'update_failed',
        message: 'Failed to update agent',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

// DELETE /agents/:agentId - Delete an agent
router.delete('/:agentId', requireScopes('write:agents'), async (req: Request, res: Response) => {
  try {
    const success = await agentManager.deleteAgent(req.params.agentId);
    
    if (!success) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Agent not found',
      });
    }
    
    res.status(204).send();
  } catch (error) {
    res.status(500).json({
      error: 'delete_failed',
      message: 'Failed to delete agent',
    });
  }
});

// POST /agents/:agentId/start - Start an agent
router.post('/:agentId/start', requireScopes('write:agents'), async (req: Request, res: Response) => {
  try {
    const agent = await agentManager.getAgent(req.params.agentId);
    
    if (!agent) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Agent not found',
      });
    }
    
    if (agent.getStatus() === 'active') {
      return res.status(409).json({
        error: 'already_running',
        message: 'Agent is already running',
      });
    }
    
    await agent.start();
    
    res.json({
      id: agent.getId(),
      name: agent.getName(),
      type: agent.getType(),
      status: agent.getStatus(),
      capabilities: agent.getCapabilities(),
      configuration: agent.getConfiguration(),
      metrics: agent.getMetrics(),
      createdAt: agent.getCreatedAt(),
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      error: 'start_failed',
      message: 'Failed to start agent',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// POST /agents/:agentId/stop - Stop an agent
router.post('/:agentId/stop', requireScopes('write:agents'), async (req: Request, res: Response) => {
  try {
    const agent = await agentManager.getAgent(req.params.agentId);
    
    if (!agent) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Agent not found',
      });
    }
    
    await agent.stop();
    
    res.json({
      id: agent.getId(),
      name: agent.getName(),
      type: agent.getType(),
      status: agent.getStatus(),
      capabilities: agent.getCapabilities(),
      configuration: agent.getConfiguration(),
      metrics: agent.getMetrics(),
      createdAt: agent.getCreatedAt(),
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      error: 'stop_failed',
      message: 'Failed to stop agent',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /agents/:agentId/metrics - Get agent metrics
router.get('/:agentId/metrics', requireScopes('read:agents'), async (req: Request, res: Response) => {
  try {
    const agent = await agentManager.getAgent(req.params.agentId);
    
    if (!agent) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Agent not found',
      });
    }
    
    const metrics = await agent.getDetailedMetrics();
    
    res.json({
      agentId: req.params.agentId,
      metrics,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      error: 'metrics_failed',
      message: 'Failed to get agent metrics',
    });
  }
});

// GET /agents/:agentId/logs - Get agent logs
router.get('/:agentId/logs', requireScopes('read:agents'), async (req: Request, res: Response) => {
  try {
    const agent = await agentManager.getAgent(req.params.agentId);
    
    if (!agent) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Agent not found',
      });
    }
    
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 1000);
    const since = req.query.since as string;
    
    const logs = await agent.getLogs({ limit, since });
    
    res.json({
      agentId: req.params.agentId,
      logs,
      count: logs.length,
    });
  } catch (error) {
    res.status(500).json({
      error: 'logs_failed',
      message: 'Failed to get agent logs',
    });
  }
});

export { router as agentsRouter };