/**
 * Lua execution endpoints for the Bridge Service
 */

import { Router, Request, Response } from 'express';
import { createLogger } from '../utils/logger';
import { luaManager } from '../services/lua-manager';
import { 
  LuaCallRequest, 
  LuaExecuteRequest, 
  LuaBatchRequest 
} from '../types/lua';
import { 
  APIResponse, 
  ErrorCode 
} from '../types/api';

const logger = createLogger('LuaRoutes');
const router = Router();

/**
 * POST /lua/call - Execute a Lua function
 */
router.post('/call', async (req: Request, res: Response) => {
  try {
    const request: LuaCallRequest = req.body;
    
    // Validate request
    if (!request.function || typeof request.function !== 'string') {
      const errorResponse: APIResponse = {
        success: false,
        error: {
          code: ErrorCode.INVALID_ARGUMENTS,
          message: 'Missing or invalid function name',
          details: 'function must be a non-empty string'
        }
      };
      return res.status(400).json(errorResponse);
    }

    // args can be any type, defaults to empty object if not provided
    if (request.args === undefined) {
      request.args = {};
    }

    logger.info(`Lua function call: ${request.function}`);
    const result = await luaManager.callFunction(request);

    const response: APIResponse = result.success 
      ? { success: true, result: result.result }
      : { success: false, error: result.error! };

    const statusCode = result.success ? 200 : 500;
    res.status(statusCode).json(response);
  } catch (error: any) {
    logger.error('Error in /lua/call:', error);
    const errorResponse: APIResponse = {
      success: false,
      error: {
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Internal server error',
        details: error.message
      }
    };
    res.status(500).json(errorResponse);
  }
});

/**
 * POST /lua/batch - Execute multiple Lua functions
 */
router.post('/batch', async (req: Request, res: Response) => {
  try {
    const requests: LuaBatchRequest = req.body;
    
    // Validate batch request
    if (!Array.isArray(requests)) {
      const errorResponse: APIResponse = {
        success: false,
        error: {
          code: ErrorCode.INVALID_ARGUMENTS,
          message: 'Request body must be an array of function calls',
          details: 'Expected array of {function: string, args: any} objects'
        }
      };
      return res.status(400).json(errorResponse);
    }

    if (requests.length === 0) {
      const errorResponse: APIResponse = {
        success: false,
        error: {
          code: ErrorCode.INVALID_ARGUMENTS,
          message: 'Batch request cannot be empty',
          details: 'Provide at least one function call'
        }
      };
      return res.status(400).json(errorResponse);
    }

    // Validate individual requests
    for (let i = 0; i < requests.length; i++) {
      const request = requests[i];
      if (!request.function || typeof request.function !== 'string') {
        const errorResponse: APIResponse = {
          success: false,
          error: {
            code: ErrorCode.INVALID_ARGUMENTS,
            message: `Invalid function name at index ${i}`,
            details: 'Each request must have a non-empty function string'
          }
        };
        return res.status(400).json(errorResponse);
      }
      
      // Ensure args is defined
      if (request.args === undefined) {
        request.args = {};
      }
    }

    logger.info(`Lua batch call with ${requests.length} functions`);
    const results = await luaManager.callBatch(requests);

    // Return the batch response directly
    res.status(200).json(results);
  } catch (error: any) {
    logger.error('Error in /lua/batch:', error);
    const errorResponse: APIResponse = {
      success: false,
      error: {
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Internal server error',
        details: error.message
      }
    };
    res.status(500).json(errorResponse);
  }
});

/**
 * POST /lua/execute - Execute raw Lua script
 */
router.post('/execute', async (req: Request, res: Response) => {
  try {
    const request: LuaExecuteRequest = req.body;
    
    // Validate request
    if (!request.script || typeof request.script !== 'string') {
      const errorResponse: APIResponse = {
        success: false,
        error: {
          code: ErrorCode.INVALID_SCRIPT,
          message: 'Missing or invalid Lua script',
          details: 'script must be a non-empty string'
        }
      };
      return res.status(400).json(errorResponse);
    }

    logger.info('Lua script execution');
    logger.debug('Script:', request.script.substring(0, 200) + (request.script.length > 200 ? '...' : ''));
    
    const result = await luaManager.executeScript(request);

    const response: APIResponse = result.success 
      ? { success: true, result: result.result }
      : { success: false, error: result.error! };

    const statusCode = result.success ? 200 : 500;
    res.status(statusCode).json(response);
  } catch (error: any) {
    logger.error('Error in /lua/execute:', error);
    const errorResponse: APIResponse = {
      success: false,
      error: {
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Internal server error',
        details: error.message
      }
    };
    res.status(500).json(errorResponse);
  }
});

/**
 * GET /lua/functions - List available Lua functions
 */
router.get('/functions', async (req: Request, res: Response) => {
  try {
    logger.info('Fetching available Lua functions');
    const functions = await luaManager.getFunctions();
    
    const response: APIResponse = {
      success: true,
      result: { functions }
    };
    
    res.status(200).json(response);
  } catch (error: any) {
    logger.error('Error in /lua/functions:', error);
    const errorResponse: APIResponse = {
      success: false,
      error: {
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Failed to get function list',
        details: error.message
      }
    };
    res.status(500).json(errorResponse);
  }
});

export default router;