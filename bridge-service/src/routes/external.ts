/**
 * External function registration endpoints for the Bridge Service
 */

import { Router, Request, Response } from 'express';
import { createLogger } from '../utils/logger';
import { externalManager } from '../services/external-manager';
import { ExternalFunctionRegistration } from '../types/external';
import { 
  APIResponse, 
  ErrorCode,
  RegistrationResponse,
  UnregistrationResponse
} from '../types/api';

const logger = createLogger('ExternalRoutes');
const router = Router();

/**
 * POST /external/register - Register an external function
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const registration: ExternalFunctionRegistration = req.body;
    
    // Validate required fields
    if (!registration.name || typeof registration.name !== 'string') {
      const errorResponse: APIResponse = {
        success: false,
        error: {
          code: ErrorCode.INVALID_ARGUMENTS,
          message: 'Missing or invalid function name',
          details: 'name must be a non-empty string'
        }
      };
      return res.status(400).json(errorResponse);
    }

    if (!registration.url || typeof registration.url !== 'string') {
      const errorResponse: APIResponse = {
        success: false,
        error: {
          code: ErrorCode.INVALID_ARGUMENTS,
          message: 'Missing or invalid function URL',
          details: 'url must be a non-empty string'
        }
      };
      return res.status(400).json(errorResponse);
    }

    if (typeof registration.async !== 'boolean') {
      const errorResponse: APIResponse = {
        success: false,
        error: {
          code: ErrorCode.INVALID_ARGUMENTS,
          message: 'Missing or invalid async flag',
          details: 'async must be a boolean'
        }
      };
      return res.status(400).json(errorResponse);
    }

    // Optional fields validation
    if (registration.timeout !== undefined && (!Number.isInteger(registration.timeout) || registration.timeout <= 0)) {
      const errorResponse: APIResponse = {
        success: false,
        error: {
          code: ErrorCode.INVALID_ARGUMENTS,
          message: 'Invalid timeout value',
          details: 'timeout must be a positive integer (milliseconds)'
        }
      };
      return res.status(400).json(errorResponse);
    }

    if (registration.description !== undefined && typeof registration.description !== 'string') {
      const errorResponse: APIResponse = {
        success: false,
        error: {
          code: ErrorCode.INVALID_ARGUMENTS,
          message: 'Invalid description',
          details: 'description must be a string'
        }
      };
      return res.status(400).json(errorResponse);
    }

    logger.info(`Registering external function: ${registration.name}`);
    const result = await externalManager.registerFunction(registration);

    const response: APIResponse<RegistrationResponse> = {
      success: true,
      result
    };
    
    res.status(201).json(response);
  } catch (error: any) {
    logger.error('Error in /external/register:', error);
    const errorResponse: APIResponse = {
      success: false,
      error: {
        code: ErrorCode.INTERNAL_ERROR,
        message: error.message || 'Failed to register external function',
        details: error.stack
      }
    };
    res.status(400).json(errorResponse);
  }
});

/**
 * DELETE /external/register/:name - Unregister an external function
 */
router.delete('/register/:name', async (req: Request, res: Response) => {
  try {
    const functionName = req.params.name;
    
    if (!functionName || typeof functionName !== 'string') {
      const errorResponse: APIResponse = {
        success: false,
        error: {
          code: ErrorCode.INVALID_ARGUMENTS,
          message: 'Missing or invalid function name',
          details: 'Function name must be provided in the URL path'
        }
      };
      return res.status(400).json(errorResponse);
    }

    logger.info(`Unregistering external function: ${functionName}`);
    const result = await externalManager.unregisterFunction(functionName);

    const response: APIResponse<UnregistrationResponse> = {
      success: true,
      result
    };
    
    res.status(200).json(response);
  } catch (error: any) {
    logger.error('Error in /external/register/:name:', error);
    const errorResponse: APIResponse = {
      success: false,
      error: {
        code: ErrorCode.INTERNAL_ERROR,
        message: error.message || 'Failed to unregister external function',
        details: error.stack
      }
    };
    res.status(404).json(errorResponse);
  }
});

/**
 * GET /external/functions - List all registered external functions
 */
router.get('/functions', (req: Request, res: Response) => {
  try {
    logger.info('Fetching registered external functions');
    const functionList = externalManager.getFunctions();
    
    const response: APIResponse = {
      success: true,
      result: functionList
    };
    
    res.status(200).json(response);
  } catch (error: any) {
    logger.error('Error in /external/functions:', error);
    const errorResponse: APIResponse = {
      success: false,
      error: {
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Failed to get external function list',
        details: error.message
      }
    };
    res.status(500).json(errorResponse);
  }
});

export default router;