/**
 * API Types and Response Helpers
 *
 * @module bridge-service/types/api
 *
 * @description
 * Type definitions and helper functions for standardized API responses across
 * the Bridge Service. All API endpoints use the APIResponse format for consistency.
 */

/**
 * Standard API response format
 *
 * @interface APIResponse
 * @template T - Type of the result data
 *
 * @property success - Whether the operation succeeded
 * @property result - Result data if successful
 * @property error - Error details if unsuccessful
 *
 * @example
 * ```typescript
 * // Success response
 * const response: APIResponse<number> = {
 *   success: true,
 *   result: 42
 * };
 *
 * // Error response
 * const errorResponse: APIResponse = {
 *   success: false,
 *   error: {
 *     code: 'INVALID_ARGUMENTS',
 *     message: 'Missing required parameter',
 *     details: 'Parameter "playerId" is required'
 *   }
 * };
 * ```
 */
export interface APIResponse<T = any> {
  success: boolean;
  result?: T;
  error?: {
    code: ErrorCode | string;
    message: string;
    details?: string;
  };
}

/**
 * Health check response format
 *
 * @interface HealthCheckResponse
 * @extends APIResponse
 *
 * @description
 * Specialized response format for health check endpoints.
 * Includes service health status, DLL connection, and uptime information.
 *
 * @property dll_connected - Whether DLL connection is established
 * @property uptime - Service uptime in seconds
 * @property version - Service version string
 */
export interface HealthCheckResponse extends APIResponse {
  dll_connected: boolean;
  uptime: number;
  version?: string;
}

/**
 * Error codes used in API responses
 *
 * @enum ErrorCode
 *
 * @description
 * Standardized error codes used throughout the Bridge Service API.
 * Each code has an associated default error message.
 *
 * @example
 * ```typescript
 * import { ErrorCode, respondError } from './types/api.js';
 *
 * // Use error codes in responses
 * return respondError(ErrorCode.DLL_DISCONNECTED);
 * // Returns: { success: false, error: { code: 'DLL_DISCONNECTED', message: 'Lost connection to DLL' } }
 * ```
 */
export enum ErrorCode {
  DLL_DISCONNECTED = 'DLL_DISCONNECTED',
  LUA_EXECUTION_ERROR = 'LUA_EXECUTION_ERROR',
  CALL_TIMEOUT = 'CALL_TIMEOUT',
  CALL_FAILED = 'CALL_FAILED',
  INVALID_FUNCTION = 'INVALID_FUNCTION',
  INVALID_SCRIPT = 'INVALID_SCRIPT',
  INVALID_ARGUMENTS = 'INVALID_ARGUMENTS',
  NETWORK_ERROR = 'NETWORK_ERROR',
  SERIALIZATION_ERROR = 'SERIALIZATION_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  NOT_FOUND = 'NOT_FOUND'
}

/**
 * Default error messages for each error code
 */
const DEFAULT_ERROR_MESSAGES: Record<ErrorCode, string> = {
  [ErrorCode.DLL_DISCONNECTED]: 'Lost connection to DLL',
  [ErrorCode.LUA_EXECUTION_ERROR]: 'Error executing Lua script',
  [ErrorCode.CALL_TIMEOUT]: 'Function call timed out',
  [ErrorCode.CALL_FAILED]: 'Function call failed',
  [ErrorCode.INVALID_FUNCTION]: 'Invalid function name or signature',
  [ErrorCode.INVALID_SCRIPT]: 'Invalid Lua script provided',
  [ErrorCode.INVALID_ARGUMENTS]: 'Invalid or missing arguments',
  [ErrorCode.NETWORK_ERROR]: 'Network communication error',
  [ErrorCode.SERIALIZATION_ERROR]: 'Failed to serialize/deserialize data',
  [ErrorCode.INTERNAL_ERROR]: 'Internal server error',
  [ErrorCode.NOT_FOUND]: 'Resource not found'
};

/**
 * Creates an error API response
 *
 * @function respondError
 *
 * @description
 * Helper function to create a standardized error response.
 * Automatically generates a default message if not provided based on the error code.
 *
 * @param code - Error code from the ErrorCode enum
 * @param message - Optional custom error message (defaults to code-specific message)
 * @param details - Optional additional error details
 * @returns APIResponse object with success: false
 *
 * @example
 * ```typescript
 * // With default message
 * return respondError(ErrorCode.INVALID_ARGUMENTS);
 *
 * // With custom message
 * return respondError(
 *   ErrorCode.INVALID_ARGUMENTS,
 *   'Player ID must be between 0 and 63',
 *   'Received playerId: -1'
 * );
 * ```
 */
export function respondError(
  code: ErrorCode,
  message?: string,
  details?: string
): APIResponse {
  return {
    success: false,
    error: {
      code,
      message: message || DEFAULT_ERROR_MESSAGES[code] || 'An error occurred',
      details
    }
  };
}

/**
 * Creates a success API response
 *
 * @function respondSuccess
 * @template T - Type of the result data
 *
 * @description
 * Helper function to create a standardized success response.
 *
 * @param result - Optional result data to include in the response
 * @returns APIResponse object with success: true
 *
 * @example
 * ```typescript
 * // Simple success
 * return respondSuccess();
 *
 * // Success with data
 * return respondSuccess({ turn: 42, era: 'Medieval' });
 * ```
 */
export function respondSuccess<T = any>(result?: T): APIResponse<T> {
  return {
    success: true,
    result
  };
}