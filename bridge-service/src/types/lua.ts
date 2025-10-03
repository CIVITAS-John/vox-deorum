/**
 * Type definitions for Lua-related operations
 */

import { APIResponse } from "./api.js";
import { IPCMessage } from "./event.js";

/**
 * Request to call a Lua function
 */
export interface LuaCallRequest {
  function: string;
  args: any;
}

/**
 * IPC message for Lua function call
 */
export interface LuaCallMessage extends IPCMessage {
  type: 'lua_call';
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
 * IPC message for Lua script execution
 */
export interface LuaExecuteMessage extends IPCMessage {
  type: 'lua_execute';
  script: string;
}

/**
 * Response from a Lua operation
 */
export interface LuaResponse<T = any> extends APIResponse<T> { }

/**
 * IPC response from Lua operation
 */
export interface LuaResponseMessage<T = any> extends IPCMessage, LuaResponse<T> {
  type: 'lua_response';
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
export interface LuaFunction extends LuaFunctionMetadata{
  registeredAt: Date;
}

/**
 * Metadata for a registering Lua function
 */
export interface LuaFunctionMetadata {
  function: string;
  description?: string;
}

/**
 * IPC message for Lua function registration
 */
export interface LuaRegisterMessage extends IPCMessage, LuaFunctionMetadata {
  type: 'lua_register';
}
