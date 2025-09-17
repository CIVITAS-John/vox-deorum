/**
 * External function registration endpoints for the Bridge Service
 */

import { Router, Request, Response } from 'express';
import { createLogger } from '../utils/logger.js';
import { handleAPIError } from '../utils/api.js';
import { externalManager } from '../services/external-manager.js';
import { ExternalFunctionRegistration } from '../types/external.js';
import { gameMutexManager, MaxCivs } from '../utils/mutex.js';

const logger = createLogger('ExternalRoutes');
const router = Router();

/**
 * POST /external/register - Register an external function
 */
router.post('/register', async (req: Request, res: Response) => {
  await handleAPIError(res, '/external/register', async () => {
    const registration: ExternalFunctionRegistration = req.body;
    logger.info(`Registering external function: ${registration.name}`);
    
    // Let the manager handle all validation and error responses
    const result = await externalManager.registerFunction(registration);
    
    return result;
  });
});

/**
 * DELETE /external/register/:name - Unregister an external function
 */
router.delete('/register/:name', async (req: Request, res: Response) => {
  await handleAPIError(res, '/external/register/:name', async () => {
    const functionName = req.params.name;
    logger.info(`Unregistering external function: ${functionName}`);
    
    const result = await externalManager.unregisterFunction(functionName);
    return result;
  });
});

/**
 * GET /external/functions - List all registered external functions
 */
router.get('/functions', async (_req: Request, res: Response) => {
  await handleAPIError(res, '/external/functions', async () => {
    logger.info('Fetching registered external functions');
    const result = externalManager.getFunctions();
    return result;
  });
});

/**
 * POST /external/pause - Pause the game (manual operation)
 */
router.post('/pause', async (_req: Request, res: Response) => {
  await handleAPIError(res, '/external/pause', async () => {
    const result = gameMutexManager.pauseGame(true); // Mark as external/manual pause
    return {
      success: result
    };
  });
});

/**
 * POST /external/resume - Resume the game (manual operation)
 */
router.post('/resume', async (_req: Request, res: Response) => {
  await handleAPIError(res, '/external/resume', async () => {
    const result = gameMutexManager.resumeGame(true); // Mark as external/manual resume
    return {
      success: result
    };
  });
});

/**
 * POST /external/pause-player/:id - Register a player for auto-pause
 */
router.post('/pause-player/:id', async (req: Request, res: Response) => {
  await handleAPIError(res, '/external/pause-player/:id', async () => {
    const playerId = parseInt(req.params.id);
    if (isNaN(playerId) || playerId < 0 || playerId >= MaxCivs) {
      return {
        success: false,
        error: 'Invalid player ID'
      };
    }

    const result = gameMutexManager.registerPausedPlayer(playerId);
    return {
      success: result,
      pausedPlayers: gameMutexManager.getPausedPlayers()
    };
  });
});

/**
 * DELETE /external/pause-player/:id - Unregister a player from auto-pause
 */
router.delete('/pause-player/:id', async (req: Request, res: Response) => {
  await handleAPIError(res, '/external/pause-player/:id', async () => {
    const playerId = parseInt(req.params.id);
    if (isNaN(playerId) || playerId < 0 || playerId >= 63) {
      return {
        success: false,
        error: 'Invalid player ID'
      };
    }

    const result = gameMutexManager.unregisterPausedPlayer(playerId);
    return {
      success: result,
      pausedPlayers: gameMutexManager.getPausedPlayers()
    };
  });
});

/**
 * GET /external/paused-players - Get list of paused players
 */
router.get('/paused-players', async (_req: Request, res: Response) => {
  await handleAPIError(res, '/external/paused-players', async () => {
    return {
      success: true,
      pausedPlayers: gameMutexManager.getPausedPlayers(),
      isGamePaused: gameMutexManager.isGamePaused()
    };
  });
});

/**
 * DELETE /external/paused-players - Clear all paused players
 */
router.delete('/paused-players', async (_req: Request, res: Response) => {
  await handleAPIError(res, '/external/paused-players', async () => {
    gameMutexManager.clearPausedPlayers();
    return {
      success: true,
      pausedPlayers: []
    };
  });
});

export default router;