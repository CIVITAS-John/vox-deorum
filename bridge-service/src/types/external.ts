/**
 * Type definitions for external function operations
 */

/**
 * External function registration request
 */
export interface ExternalFunctionRegistration {
  name: string;
  url: string;
  async: boolean;
  timeout?: number;
  description?: string;
}

/**
 * Registered external function details
 */
export interface ExternalFunction {
  name: string;
  url: string;
  async: boolean;
  timeout: number;
  description?: string;
  registeredAt: Date;
}

/**
 * List of registered external functions
 */
export interface ExternalFunctionList {
  functions: ExternalFunction[];
}

/**
 * External function call from Lua
 */
export interface ExternalCallRequest {
  args: any;
  id: string;
}

/**
 * External function response
 */
export interface ExternalCallResponse {
  result?: any;
  error?: {
    code: string;
    message: string;
  };
}

/**
 * IPC message for external function call
 */
export interface ExternalCallMessage {
  type: 'external_call';
  function: string;
  args: any;
  id: string;
  async: boolean;
}

/**
 * IPC message for external function response
 */
export interface ExternalResponseMessage {
  type: 'external_response';
  id: string;
  success: boolean;
  result?: any;
  error?: {
    code: string;
    message: string;
  };
}

/**
 * IPC message for external function registration
 */
export interface ExternalRegisterMessage {
  type: 'external_register';
  name: string;
  async: boolean;
}

/**
 * IPC message for external function unregistration
 */
export interface ExternalUnregisterMessage {
  type: 'external_unregister';
  name: string;
}