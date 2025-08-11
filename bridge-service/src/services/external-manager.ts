/**
 * External Manager - Handles external function registration and execution
 */

import { v4 as uuidv4 } from 'uuid';
import axios, { AxiosError } from 'axios';
import { createLogger } from '../utils/logger.js';
import { dllConnector } from './dll-connector.js';
import { 
  ExternalFunctionRegistration,
  ExternalFunction,
  ExternalCallRequest,
  ExternalFunctionList, 
  ExternalCallResponse
} from '../types/external.js';
import { APIResponse, ErrorCode, respondSuccess, respondError } from '../types/api.js';

const logger = createLogger('ExternalManager');

/**
 * External Manager class for handling external function operations
 */
export class ExternalManager {
  private registeredFunctions: Map<string, ExternalFunction> = new Map();

  constructor() {
    // Listen for external function calls from DLL
    dllConnector.on('external_call', (data) => {
      this.handleExternalCall(data);
    });
  }

  /**
   * Register an external function
   */
  public async registerFunction(registration: ExternalFunctionRegistration): Promise<APIResponse<any>> {
    logger.info(`Registering external function: ${registration.name}`);

    // Validate registration
    const validationError = this.validateRegistration(registration);
    if (validationError) {
      return respondError(ErrorCode.INVALID_ARGUMENTS, validationError);
    }

    const externalFunction: ExternalFunction = {
      name: registration.name,
      url: registration.url,
      async: registration.async,
      timeout: registration.timeout || 5000,
      description: registration.description,
      registeredAt: new Date()
    };

    // Notify DLL about the registration
    var response = dllConnector.sendNoWait({
      type: 'external_register',
      name: registration.name,
      async: registration.async
    } as any);
    
    // Store function registration
    this.registeredFunctions.set(registration.name, externalFunction);

    logger.info(`Successfully registered external function: ${registration.name}`);
    return response;
  }

  /**
   * Unregister an external function
   */
  public async unregisterFunction(name: string): Promise<APIResponse<any>> {
    logger.info(`Unregistering external function: ${name}`);

    if (!this.registeredFunctions.has(name)) {
      return respondError(ErrorCode.INVALID_FUNCTION, `Function '${name}' is not registered`);
    }

    // Remove from local registry
    this.registeredFunctions.delete(name);

    // Notify DLL about the unregistration
    dllConnector.sendNoWait({
      type: 'external_unregister',
      name
    } as any);

    logger.info(`Successfully unregistered external function: ${name}`);
    return respondSuccess({ });
  }

  /**
   * Get list of registered external functions
   */
  public getFunctions(): APIResponse<ExternalFunctionList> {
    return respondSuccess({
      functions: Array.from(this.registeredFunctions.values())
    });
  }

  /**
   * Handle external function call from Lua/DLL
   */
  private async handleExternalCall(data: any): Promise<void> {
    const { function: functionName, args, id, async: isAsync } = data;
    logger.info(`Handling external call: ${functionName} (${isAsync ? 'async' : 'sync'})`);
    // Check if function is registered
    const externalFunction = this.registeredFunctions.get(functionName);
    if (!externalFunction) {
      this.sendExternalResponse(id, respondError(
        ErrorCode.INVALID_FUNCTION,
        `External function '${functionName}' is not registered`
      ));
      return;
    }

    // Execute the external function call
    const result = await this.executeExternalCall(externalFunction, args);

    // Send success response back to DLL
    this.sendExternalResponse(id, result);
  }

  /**
   * Execute external function call via HTTP
   */
  private async executeExternalCall<T>(externalFunction: ExternalFunction, args: any): Promise<ExternalCallResponse<T>> {
    const request: ExternalCallRequest = {
      args,
      id: uuidv4()
    };

    try {
      logger.debug(`Calling external function: ${externalFunction.url}`, request);
      
      const response = await axios.post(externalFunction.url, request, {
        timeout: externalFunction.timeout,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'VoxDeorum-BridgeService/1.0'
        }
      });

      if (response.status >= 200 && response.status < 300) {
        const result = response.data;
        logger.debug(`External function success:`, result);
        return result;
      } else {
        return respondError(ErrorCode.CALL_FAILED, 
          `External function call ${externalFunction.name} failed with status ${response.status}: ${response.statusText}`, 
          response.data ? JSON.stringify(response.data) : undefined);
      }
    } catch (error: any) {
      if (error.code === 'ECONNABORTED') {
        return respondError(ErrorCode.CALL_TIMEOUT,
          `External function call ${externalFunction.name} timed out after ${externalFunction.timeout}ms`);
      }
      
      if (error instanceof AxiosError) {
        const status = error.response?.status;
        const statusText = error.response?.statusText;
        const data = error.response?.data;
        return respondError(ErrorCode.NETWORK_ERROR,
          `External function call ${externalFunction.name} failed with status ${status}: ${statusText ?? error.message}`, 
          data ? JSON.stringify(data) : undefined);
      }

      return respondError(ErrorCode.INTERNAL_ERROR,
        `Unexpected error calling external function ${externalFunction.name}`, 
        error.message);
    }
  }

  /**
   * Send external function response back to DLL
   */
  private sendExternalResponse(id: string, response: APIResponse<any>): void {
    dllConnector.sendNoWait({
      type: 'external_response',
      id,
      ...response
    });
  }

  /**
   * Validate external function registration
   */
  private validateRegistration(registration: ExternalFunctionRegistration): string | null {
    if (!registration.name || typeof registration.name !== 'string') {
      return 'Function name must be a non-empty string';
    }

    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(registration.name)) {
      return 'Function name must be a valid identifier (letters, numbers, underscores only)';
    }

    if (!registration.url || typeof registration.url !== 'string') {
      return 'Function URL must be a non-empty string';
    }

    try {
      new URL(registration.url);
    } catch {
      return 'Function URL must be a valid URL';
    }

    if (typeof registration.async !== 'boolean') {
      return 'async field must be a boolean';
    }

    if (registration.timeout !== undefined && (!Number.isInteger(registration.timeout) || registration.timeout <= 0)) {
      return 'timeout must be a positive integer (milliseconds)';
    }

    if (this.registeredFunctions.has(registration.name)) {
      return `Function '${registration.name}' is already registered`;
    }

    return null;
  }

  /**
   * Re-register all functions with DLL (called after reconnection)
   */
  public reregisterAll(): void {
    logger.info('Re-registering all external functions with DLL');
    for (const func of this.registeredFunctions.values()) {
      dllConnector.sendNoWait({
        type: 'external_register',
        name: func.name,
        async: func.async
      } as any);
      logger.debug(`Re-registered function: ${func.name}`);
    }
  }

  /**
   * Get manager statistics
   */
  public getStats(): {
    registeredFunctions: number;
    functionNames: string[];
  } {
    return {
      registeredFunctions: this.registeredFunctions.size,
      functionNames: Array.from(this.registeredFunctions.keys())
    };
  }
}

// Export singleton instance
export const externalManager = new ExternalManager();
export default externalManager;