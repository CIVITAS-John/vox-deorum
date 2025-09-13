/**
 * External function registration endpoints for the Bridge Service
 */

import { Router, Request, Response } from 'express';
import { createLogger } from '../utils/logger.js';
import { handleAPIError } from '../utils/api.js';
import { externalManager } from '../services/external-manager.js';
import { ExternalFunctionRegistration } from '../types/external.js';
import { gameMutexManager } from '../utils/mutex.js';

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
 * POST /external/pause - Pause the game
 */
router.post('/pause', async (_req: Request, res: Response) => {
  await handleAPIError(res, '/external/pause', async () => {
    const result = await gameMutexManager.pauseGame();
    return {
      success: result
    };
  });
});

/**
 * POST /external/resume - Resume the game
 */
router.post('/resume', async (_req: Request, res: Response) => {
  await handleAPIError(res, '/external/resume', async () => {
    const result = await gameMutexManager.resumeGame();
    return {
      success: result
    };
  });
});

export default router;