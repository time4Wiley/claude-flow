import { Router, Request, Response } from 'express';
import { requireScopes } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { PluginManager } from '../../plugins/plugin-manager';
import { z } from 'zod';

const router = Router();
const pluginManager = new PluginManager();

// Validation schemas
const installPluginSchema = z.object({
  source: z.string().min(1),
  configuration: z.record(z.any()).optional(),
});

const updatePluginConfigSchema = z.object({
  configuration: z.record(z.any()),
});

// GET /plugins - List installed plugins
router.get('/', requireScopes('read:plugins'), async (req: Request, res: Response) => {
  try {
    const enabled = req.query.enabled === 'true' ? true : 
                   req.query.enabled === 'false' ? false : 
                   undefined;
    
    const plugins = await pluginManager.listPlugins({ enabled });
    
    res.json({
      plugins,
      totalCount: plugins.length,
    });
  } catch (error) {
    res.status(500).json({
      error: 'internal_error',
      message: 'Failed to list plugins',
    });
  }
});

// POST /plugins - Install a plugin
router.post('/',
  requireScopes('write:plugins'),
  validateRequest(installPluginSchema),
  async (req: Request, res: Response) => {
    try {
      const { source, configuration } = req.body;
      
      const plugin = await pluginManager.installPlugin({
        source,
        configuration,
      });
      
      res.status(201).json({
        id: plugin.id,
        name: plugin.name,
        version: plugin.version,
        description: plugin.description,
        enabled: plugin.enabled,
        configuration: plugin.configuration,
        capabilities: plugin.capabilities,
      });
    } catch (error) {
      res.status(400).json({
        error: 'install_failed',
        message: 'Failed to install plugin',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

// GET /plugins/:pluginId - Get plugin details
router.get('/:pluginId', requireScopes('read:plugins'), async (req: Request, res: Response) => {
  try {
    const plugin = await pluginManager.getPlugin(req.params.pluginId);
    
    if (!plugin) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Plugin not found',
      });
    }
    
    res.json({
      id: plugin.id,
      name: plugin.name,
      version: plugin.version,
      description: plugin.description,
      enabled: plugin.enabled,
      configuration: plugin.configuration,
      capabilities: plugin.capabilities,
      metadata: plugin.metadata,
      stats: plugin.stats,
    });
  } catch (error) {
    res.status(500).json({
      error: 'internal_error',
      message: 'Failed to get plugin',
    });
  }
});

// DELETE /plugins/:pluginId - Uninstall a plugin
router.delete('/:pluginId', requireScopes('write:plugins'), async (req: Request, res: Response) => {
  try {
    const success = await pluginManager.uninstallPlugin(req.params.pluginId);
    
    if (!success) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Plugin not found',
      });
    }
    
    res.status(204).send();
  } catch (error) {
    res.status(500).json({
      error: 'uninstall_failed',
      message: 'Failed to uninstall plugin',
    });
  }
});

// POST /plugins/:pluginId/enable - Enable a plugin
router.post('/:pluginId/enable', requireScopes('write:plugins'), async (req: Request, res: Response) => {
  try {
    const plugin = await pluginManager.enablePlugin(req.params.pluginId);
    
    if (!plugin) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Plugin not found',
      });
    }
    
    res.json({
      id: plugin.id,
      enabled: plugin.enabled,
      message: 'Plugin enabled successfully',
    });
  } catch (error) {
    res.status(500).json({
      error: 'enable_failed',
      message: 'Failed to enable plugin',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// POST /plugins/:pluginId/disable - Disable a plugin
router.post('/:pluginId/disable', requireScopes('write:plugins'), async (req: Request, res: Response) => {
  try {
    const plugin = await pluginManager.disablePlugin(req.params.pluginId);
    
    if (!plugin) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Plugin not found',
      });
    }
    
    res.json({
      id: plugin.id,
      enabled: plugin.enabled,
      message: 'Plugin disabled successfully',
    });
  } catch (error) {
    res.status(500).json({
      error: 'disable_failed',
      message: 'Failed to disable plugin',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// PATCH /plugins/:pluginId/config - Update plugin configuration
router.patch('/:pluginId/config',
  requireScopes('write:plugins'),
  validateRequest(updatePluginConfigSchema),
  async (req: Request, res: Response) => {
    try {
      const { configuration } = req.body;
      
      const plugin = await pluginManager.updatePluginConfig(
        req.params.pluginId,
        configuration
      );
      
      if (!plugin) {
        return res.status(404).json({
          error: 'not_found',
          message: 'Plugin not found',
        });
      }
      
      res.json({
        id: plugin.id,
        configuration: plugin.configuration,
        message: 'Plugin configuration updated successfully',
      });
    } catch (error) {
      res.status(400).json({
        error: 'config_update_failed',
        message: 'Failed to update plugin configuration',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

// POST /plugins/:pluginId/execute - Execute plugin action
router.post('/:pluginId/execute',
  requireScopes('execute:plugins'),
  validateRequest(z.object({
    action: z.string(),
    parameters: z.record(z.any()).optional(),
  })),
  async (req: Request, res: Response) => {
    try {
      const { action, parameters } = req.body;
      
      const result = await pluginManager.executePlugin(
        req.params.pluginId,
        action,
        parameters
      );
      
      if (!result) {
        return res.status(404).json({
          error: 'not_found',
          message: 'Plugin or action not found',
        });
      }
      
      res.json({
        pluginId: req.params.pluginId,
        action,
        result,
        executedAt: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        error: 'execution_failed',
        message: 'Failed to execute plugin action',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

// GET /plugins/available - List available plugins from registry
router.get('/available', requireScopes('read:plugins'), async (req: Request, res: Response) => {
  try {
    const category = req.query.category as string;
    const search = req.query.search as string;
    
    const plugins = await pluginManager.searchAvailablePlugins({
      category,
      search,
    });
    
    res.json({
      plugins,
      totalCount: plugins.length,
    });
  } catch (error) {
    res.status(500).json({
      error: 'internal_error',
      message: 'Failed to search available plugins',
    });
  }
});

// POST /plugins/:pluginId/verify - Verify plugin integrity
router.post('/:pluginId/verify', requireScopes('write:plugins'), async (req: Request, res: Response) => {
  try {
    const verification = await pluginManager.verifyPlugin(req.params.pluginId);
    
    if (!verification) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Plugin not found',
      });
    }
    
    res.json({
      pluginId: req.params.pluginId,
      valid: verification.valid,
      signature: verification.signature,
      checksums: verification.checksums,
      verifiedAt: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      error: 'verification_failed',
      message: 'Failed to verify plugin',
    });
  }
});

export { router as pluginsRouter };