/**
 * API Utilities
 *
 * @module bridge-service/utils/api
 *
 * @description
 * Utility functions for API request/response handling and error management.
 */

import { Response } from 'express';
import { APIResponse, ErrorCode, respondError } from '../types/api.js';

/**
 * Error handler wrapper for API endpoints
 *
 * @function handleAPIError
 *
 * @description
 * Wraps API endpoint handlers with automatic error handling and response formatting.
 * Catches any errors thrown by the action function and returns a standardized error response.
 *
 * @param res - Express response object
 * @param url - Endpoint URL (for error logging)
 * @param action - Async function that performs the endpoint logic
 * @returns Promise that resolves when response is sent
 *
 * @example
 * ```typescript
 * router.get('/health', async (req, res) => {
 *   await handleAPIError(res, '/health', async () => {
 *     const health = getHealthStatus();
 *     return respondSuccess(health);
 *   });
 * });
 * ```
 */
export async function handleAPIError(res: Response, url: string, action: () => Promise<APIResponse | any>): Promise<void> {
  try {
    const result = await action();
    res.status(200).json(result);
  } catch (error: any) {
    res.status(500).json(
      respondError(ErrorCode.INTERNAL_ERROR, 
                  `Error in ${url} while ${action.name}`, 
                  error.message));
  }
}