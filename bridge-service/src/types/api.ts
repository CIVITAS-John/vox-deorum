/**
 * Type definitions for general API request/responses
 */

/**
 * Standard API response
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
 * Health check response
 */
export interface HealthCheckResponse extends APIResponse {
  dll_connected: boolean;
  uptime: number;
  version?: string;
}

/**
 * Error codes used in API responses
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
  INTERNAL_ERROR = 'INTERNAL_ERROR'
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
  [ErrorCode.INTERNAL_ERROR]: 'Internal server error'
};

/**
 * Creates an error APIResponse with the specified error details
 * Automatically generates a default message if not provided
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
 * Creates a success APIResponse with the specified result
 */
export function respondSuccess<T = any>(result?: T): APIResponse<T> {
  return {
    success: true,
    result
  };
}