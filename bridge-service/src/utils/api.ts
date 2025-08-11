import { Response } from 'express';
import { APIResponse, ErrorCode, respondError } from '../types/api';

/**
 * Simple error handler for API endpoints
 */
export async function handleAPIError(res: Response, url: string, action: () => Promise<APIResponse | any>): Promise<void> {
  try {
    const result = await action();
    if (result.success === false) {
      res.status(500).json(result);
    } else {
      res.status(200).json(result);
    }
  } catch (error: any) {
    res.status(500).json(
      respondError(ErrorCode.INTERNAL_ERROR, 
                  `Error in ${url} while ${action.name}`, 
                  error.message));
  }
}