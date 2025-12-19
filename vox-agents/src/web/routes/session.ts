/**
 * @module web/routes/session
 *
 * API routes for game session management.
 * Provides endpoints for starting, stopping, and monitoring game sessions.
 */

import { Router, Request, Response } from 'express';
import { sessionRegistry } from '../../infra/session-registry.js';
import { StrategistSession } from '../../strategist/strategist-session.js';
import { SessionConfig, StrategistSessionConfig } from '../../types/config.js';
import { createLogger } from '../../utils/logger.js';
import fs from 'fs/promises';
import path from 'path';

const logger = createLogger('webui:session-routes');

/**
 * Create session management routes.
 */
export function createSessionRoutes(): Router {
  const router = Router();

  /**
   * GET /api/session/status
   * Get the current session status.
   */
  router.get('/status', (_req: Request, res: Response) => {
    try {
      const session = sessionRegistry.getActive();

      res.json({
        active: !!session,
        session: session?.getStatus()
      });
    } catch (error) {
      logger.error('Failed to get session status', { error });
      res.status(500).json({ error: 'Failed to get session status' });
    }
  });

  /**
   * GET /api/session/configs
   * List available configuration files from the configs directory.
   */
  router.get('/configs', async (_req: Request, res: Response): Promise<Response> => {
    try {
      const configDir = path.join(process.cwd(), 'configs');

      // Check if configs directory exists
      try {
        await fs.access(configDir);
      } catch {
        return res.json({ configs: [] });
      }

      const files = await fs.readdir(configDir);

      // Filter and parse JSON config files
      const configs: SessionConfig[] = await Promise.all(
        files
          .filter(f => f.endsWith('.json'))
          .map(async filename => {
            try {
              const filePath = path.join(configDir, filename);
              const content = await fs.readFile(filePath, 'utf-8');
              return JSON.parse(content);
            } catch (error) {
              logger.warn(`Failed to parse config file ${filename}:`, error);
              return undefined;
            }
          })
          .filter(c => c)
      );

      return res.json({ configs });
    } catch (error) {
      logger.error('Failed to list configs', { error });
      return res.status(500).json({ error: 'Failed to list configurations' });
    }
  });

  /**
   * POST /api/session/start
   * Start a new game session with the specified configuration.
   *
   * Request body:
   * - config: SessionConfig - The session configuration object
   */
  router.post('/start', async (req: Request, res: Response): Promise<Response> => {
    const { config } = req.body;

    if (!config) {
      return res.status(400).json({ error: 'Config object required' });
    }

    // Check for existing session
    if (sessionRegistry.hasActiveSession()) {
      return res.status(400).json({ error: 'A session is already active' });
    }

    try {
      // Ensure config has the required type
      if (!config.type) {
        config.type = 'strategist';
      }

      // Validate it's a StrategistSessionConfig
      const strategistConfig = config as StrategistSessionConfig;

      // Validate required fields
      if (!strategistConfig.llmPlayers || typeof strategistConfig.llmPlayers !== 'object') {
        return res.status(400).json({ error: 'Config must include llmPlayers configuration' });
      }

      // Create and start session
      const session = new StrategistSession(strategistConfig);

      // Start in background - don't await
      session.start().catch(error => {
        logger.error('Session failed to start', { error });
        // Session will unregister itself on error
      });

      // Return session info immediately
      return res.json({
        sessionId: session.id,
        status: session.getStatus()
      });
    } catch (error) {
      logger.error('Failed to start session', { error });
      return res.status(500).json({ error: `Failed to start session: ${(error as Error).message}` });
    }
  });

  /**
   * POST /api/session/save
   * Save a session configuration to a local file.
   *
   * Request body:
   * - filename: string - The filename to save as (without .json extension)
   * - config: SessionConfig - The configuration object to save
   */
  router.post('/save', async (req: Request, res: Response): Promise<Response> => {
    const { filename, config } = req.body;

    if (!filename) {
      return res.status(400).json({ error: 'Filename required' });
    }

    if (!config) {
      return res.status(400).json({ error: 'Config object required' });
    }

    // Sanitize filename - remove path characters and ensure .json extension
    const sanitizedName = filename.replace(/[\/\\:*?"<>|]/g, '_');
    const finalFilename = sanitizedName.endsWith('.json') ? sanitizedName : `${sanitizedName}.json`;

    try {
      // Ensure configs directory exists
      const configDir = path.join(process.cwd(), 'configs');
      try {
        await fs.access(configDir);
      } catch {
        await fs.mkdir(configDir, { recursive: true });
      }

      // Validate the config has minimum required fields
      if (!config.type) {
        config.type = 'strategist';
      }

      // Additional validation for strategist configs
      if (config.type === 'strategist') {
        const strategistConfig = config as StrategistSessionConfig;
        if (!strategistConfig.llmPlayers || typeof strategistConfig.llmPlayers !== 'object') {
          return res.status(400).json({ error: 'Strategist config must include llmPlayers configuration' });
        }
      }

      // Write the config file
      const configPath = path.join(configDir, finalFilename);
      await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');

      logger.info(`Saved configuration to ${finalFilename}`);

      return res.json({
        success: true,
        filename: finalFilename,
        path: configPath
      });
    } catch (error) {
      logger.error('Failed to save config', { error });
      return res.status(500).json({ error: `Failed to save configuration: ${(error as Error).message}` });
    }
  });

  /**
   * DELETE /api/session/config/:filename
   * Delete a saved configuration file.
   *
   * URL params:
   * - filename: string - The config filename to delete (with or without .json extension)
   */
  router.delete('/config/:filename', async (req: Request, res: Response): Promise<Response> => {
    const { filename } = req.params;

    if (!filename) {
      return res.status(400).json({ error: 'Filename required' });
    }

    // Sanitize filename - remove path characters and ensure .json extension
    const sanitizedName = filename.replace(/[\/\\:*?"<>|]/g, '_');
    const finalFilename = sanitizedName.endsWith('.json') ? sanitizedName : `${sanitizedName}.json`;

    try {
      const configDir = path.join(process.cwd(), 'configs');
      const configPath = path.join(configDir, finalFilename);

      // Check if file exists
      try {
        await fs.access(configPath);
      } catch {
        return res.status(404).json({ error: `Config file not found: ${finalFilename}` });
      }

      // Delete the file
      await fs.unlink(configPath);

      logger.info(`Deleted configuration file: ${finalFilename}`);

      return res.json({
        success: true,
        message: `Configuration ${finalFilename} deleted successfully`
      });
    } catch (error) {
      logger.error('Failed to delete config', { error });
      return res.status(500).json({ error: `Failed to delete configuration: ${(error as Error).message}` });
    }
  });

  /**
   * POST /api/session/stop
   * Stop the currently active session.
   */
  router.post('/stop', async (_req: Request, res: Response): Promise<Response> => {
    const session = sessionRegistry.getActive();

    if (!session) {
      return res.status(404).json({ error: 'No active session' });
    }

    try {
      logger.info(`Stopping session ${session.id}`);

      // Stop the session (this will unregister it)
      await session.stop();

      return res.json({
        success: true,
        message: 'Session stopped successfully'
      });
    } catch (error) {
      logger.error('Failed to stop session', { error });
      return res.status(500).json({ error: `Failed to stop session: ${(error as Error).message}` });
    }
  });

  return router;
}

// Export default for consistency with other route modules
export default createSessionRoutes();