/**
 * Type definitions for API request/response operations
 */

/**
 * Standard API success response
 */
export interface APISuccessResponse<T = any> {
  success: true;
  result: T;
}

/**
 * Standard API error response
 */
export interface APIErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: string;
  };
}

/**
 * Combined API response type
 */
export type APIResponse<T = any> = APISuccessResponse<T> | APIErrorResponse;

/**
 * Health check response
 */
export interface HealthCheckResponse {
  status: 'ok' | 'error';
  dll_connected: boolean;
  uptime: number;
  version?: string;
}

/**
 * Registration success response
 */
export interface RegistrationResponse {
  registered: boolean;
  luaFunction?: string;
}

/**
 * Unregistration success response
 */
export interface UnregistrationResponse {
  unregistered: boolean;
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

/**
 * Type union for all IPC message types
 */
export type IPCMessage = 
  | { type: 'lua_call'; function: string; args: any; id: string }
  | { type: 'lua_execute'; script: string; id: string }
  | { type: 'lua_response'; id: string; success: boolean; result?: any; error?: any }
  | { type: 'external_call'; function: string; args: any; id: string; async: boolean }
  | { type: 'external_response'; id: string; success: boolean; result?: any; error?: any }
  | { type: 'external_register'; name: string; async: boolean }
  | { type: 'external_unregister'; name: string }
  | { type: 'game_event'; event: string; payload: any; timestamp: string };