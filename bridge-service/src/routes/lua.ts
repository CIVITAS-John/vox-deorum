/**
 * Lua execution endpoints for the Bridge Service
 */

import { Router, Request, Response } from 'express';
import { createLogger } from '../utils/logger.js';
import { handleAPIError } from '../utils/api.js';
import { luaManager } from '../services/lua-manager.js';
import { 
  LuaCallRequest, 
  LuaExecuteRequest, 
  LuaBatchRequest 
} from '../types/lua.js';
import { respondError, respondSuccess, ErrorCode } from '../types/api.js';

const logger = createLogger('LuaRoutes');
const router = Router();

/**
 * POST /lua/call - Execute a Lua function
 */
router.post('/call', async (req: Request, res: Response) => {
  await handleAPIError(res, '/lua/call', async () => {
    const request: LuaCallRequest = req.body;
    
    // Basic validation - let manager handle detailed validation
    if (!request.function) {
      return respondError(
        ErrorCode.INVALID_ARGUMENTS,
        'Missing function name'
      );
    }

    // Default args if not provided
    if (request.args === undefined) {
      request.args = {};
    }

    logger.info(`Lua function call: ${request.function}`);
    const result = await luaManager.callFunction(request);
    
    return result;
  });
});

/**
 * POST /lua/batch - Execute multiple Lua functions
 */
router.post('/batch', async (req: Request, res: Response) => {
  await handleAPIError(res, '/lua/batch', async () => {
    const requests: LuaBatchRequest = req.body;
    
    // Basic validation
    if (!Array.isArray(requests) || requests.length === 0) {
      return respondError(
        ErrorCode.INVALID_ARGUMENTS,
        'Request body must be a non-empty array of function calls'
      );
    }

    // Ensure args is defined for all requests
    requests.forEach(request => {
      if (request.args === undefined) {
        request.args = {};
      }
    });

    logger.info(`Lua batch call with ${requests.length} functions`);
    const results = await luaManager.callBatch(requests);

    return respondSuccess({ results });
  });
});

/**
 * POST /lua/execute - Execute raw Lua script
 */
router.post('/execute', async (req: Request, res: Response) => {
  await handleAPIError(res, '/lua/execute', async () => {
    const request: LuaExecuteRequest = req.body;
    
    // Basic validation - let manager handle detailed validation
    if (!request.script) {
      return respondError(
        ErrorCode.INVALID_SCRIPT,
        'Missing Lua script'
      );
    }

    logger.info(`Lua script execution: ${request.script.substring(0, 200)}${request.script.length > 200 ? '...' : ''}`);

    const result = await luaManager.executeScript(request);
    return result;
  });
});

/**
 * GET /lua/functions - List available Lua functions
 */
router.get('/functions', async (_req: Request, res: Response) => {
  await handleAPIError(res, '/lua/functions', async () => {
    logger.info('Fetching available Lua functions');
    const functions = luaManager.getFunctions();
    
    return respondSuccess({ functions });
  });
});

export default router;