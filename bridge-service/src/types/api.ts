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
  EXTERNAL_CALL_TIMEOUT = 'EXTERNAL_CALL_TIMEOUT',
  EXTERNAL_CALL_FAILED = 'EXTERNAL_CALL_FAILED',
  INVALID_FUNCTION = 'INVALID_FUNCTION',
  INVALID_SCRIPT = 'INVALID_SCRIPT',
  INVALID_ARGUMENTS = 'INVALID_ARGUMENTS',
  NETWORK_ERROR = 'NETWORK_ERROR',
  SERIALIZATION_ERROR = 'SERIALIZATION_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR'
}