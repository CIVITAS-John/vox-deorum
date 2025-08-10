/**
 * Type definitions for Lua-related operations
 */

/**
 * Request to call a Lua function
 */
export interface LuaCallRequest {
  function: string;
  args: any;
}

/**
 * Request to execute raw Lua script
 */
export interface LuaExecuteRequest {
  script: string;
}

/**
 * Batch request for multiple Lua function calls
 */
export type LuaBatchRequest = LuaCallRequest[];

/**
 * Response from a Lua operation
 */
export interface LuaResponse {
  success: boolean;
  result?: any;
  error?: {
    code: string;
    message: string;
    details?: string;
  };
}

/**
 * Batch response for multiple Lua operations
 */
export type LuaBatchResponse = LuaResponse[];

/**
 * List of available Lua functions
 */
export interface LuaFunctionList {
  functions: string[];
}

/**
 * Registered Lua function metadata
 */
export interface LuaFunction {
  name: string;
  description?: string;
  registeredAt: Date;
}

/**
 * IPC message for Lua function call
 */
export interface LuaCallMessage {
  type: 'lua_call';
  function: string;
  args: any;
  id: string;
}

/**
 * IPC message for Lua script execution
 */
export interface LuaExecuteMessage {
  type: 'lua_execute';
  script: string;
  id: string;
}

/**
 * IPC response from Lua operation
 */
export interface LuaResponseMessage {
  type: 'lua_response';
  id: string;
  success: boolean;
  result?: any;
  error?: {
    code: string;
    message: string;
    details?: string;
  };
}