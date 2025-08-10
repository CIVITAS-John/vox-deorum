/**
 * External Manager - Handles external function registration and execution
 */

import { v4 as uuidv4 } from 'uuid';
import axios, { AxiosError } from 'axios';
import { createLogger } from '../utils/logger';
import { dllConnector } from './dll-connector';
import { 
  ExternalFunctionRegistration,
  ExternalFunction,
  ExternalCallRequest,
  ExternalFunctionList 
} from '../types/external';
import { ErrorCode } from '../types/api';

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
  public async registerFunction(registration: ExternalFunctionRegistration): Promise<{ registered: boolean; luaFunction?: string }> {
    logger.info(`Registering external function: ${registration.name}`);

    // Validate registration
    const validationError = this.validateRegistration(registration);
    if (validationError) {
      throw new Error(validationError);
    }

    const externalFunction: ExternalFunction = {
      name: registration.name,
      url: registration.url,
      async: registration.async,
      timeout: registration.timeout || 5000,
      description: registration.description,
      registeredAt: new Date()
    };

    // Store function registration
    this.registeredFunctions.set(registration.name, externalFunction);

    try {
      // Notify DLL about the registration
      if (dllConnector.isConnected()) {
        dllConnector.sendNoWait({
          type: 'external_register',
          name: registration.name,
          async: registration.async
        });
      }

      logger.info(`Successfully registered external function: ${registration.name}`);
      return {
        registered: true,
        luaFunction: registration.name
      };
    } catch (error) {
      // Remove from local registry if DLL registration fails
      this.registeredFunctions.delete(registration.name);
      logger.error(`Failed to register function with DLL: ${registration.name}`, error);
      throw error;
    }
  }

  /**
   * Unregister an external function
   */
  public async unregisterFunction(name: string): Promise<{ unregistered: boolean }> {
    logger.info(`Unregistering external function: ${name}`);

    if (!this.registeredFunctions.has(name)) {
      throw new Error(`Function '${name}' is not registered`);
    }

    // Remove from local registry
    this.registeredFunctions.delete(name);

    try {
      // Notify DLL about the unregistration
      if (dllConnector.isConnected()) {
        dllConnector.sendNoWait({
          type: 'external_unregister',
          name
        });
      }

      logger.info(`Successfully unregistered external function: ${name}`);
      return { unregistered: true };
    } catch (error) {
      logger.error(`Error notifying DLL about unregistration: ${name}`, error);
      // Still return success since local unregistration succeeded
      return { unregistered: true };
    }
  }

  /**
   * Get list of registered external functions
   */
  public getFunctions(): ExternalFunctionList {
    return {
      functions: Array.from(this.registeredFunctions.values())
    };
  }

  /**
   * Handle external function call from Lua/DLL
   */
  private async handleExternalCall(data: any): Promise<void> {
    const { function: functionName, args, id, async: isAsync } = data;
    logger.info(`Handling external call: ${functionName} (${isAsync ? 'async' : 'sync'})`);

    const externalFunction = this.registeredFunctions.get(functionName);
    if (!externalFunction) {
      const error = {
        code: ErrorCode.INVALID_FUNCTION,
        message: `External function '${functionName}' is not registered`
      };
      
      this.sendExternalResponse(id, false, undefined, error);
      return;
    }

    try {
      // Execute the external function call
      const result = await this.executeExternalCall(externalFunction, args);
      
      // Send success response back to DLL
      this.sendExternalResponse(id, true, result);
    } catch (error: any) {
      logger.error(`External function call failed: ${functionName}`, error);
      
      let errorCode = ErrorCode.EXTERNAL_CALL_FAILED;
      let errorMessage = `External function call failed: ${functionName}`;
      
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        errorCode = ErrorCode.NETWORK_ERROR;
        errorMessage = `Network error calling external function: ${functionName}`;
      } else if (error.name === 'TimeoutError') {
        errorCode = ErrorCode.EXTERNAL_CALL_TIMEOUT;
        errorMessage = `External function call timed out: ${functionName}`;
      }

      this.sendExternalResponse(id, false, undefined, {
        code: errorCode,
        message: errorMessage
      });
    }
  }

  /**
   * Execute external function call via HTTP
   */
  private async executeExternalCall(externalFunction: ExternalFunction, args: any): Promise<any> {
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
          'User-Agent': 'VoxPopuli-BridgeService/1.0'
        }
      });

      if (response.status >= 200 && response.status < 300) {
        const result = response.data;
        logger.debug(`External function success:`, result);
        
        // Handle different response formats
        if (result && typeof result === 'object' && 'result' in result) {
          return result.result;
        }
        return result;
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error: any) {
      if (error.code === 'ECONNABORTED') {
        const timeoutError = new Error(`Request timeout after ${externalFunction.timeout}ms`);
        timeoutError.name = 'TimeoutError';
        throw timeoutError;
      }
      
      if (error instanceof AxiosError) {
        const status = error.response?.status;
        const statusText = error.response?.statusText;
        const data = error.response?.data;
        
        throw new Error(`HTTP ${status || 'Error'}: ${statusText || error.message}${data ? ` - ${JSON.stringify(data)}` : ''}`);
      }
      
      throw error;
    }
  }

  /**
   * Send external function response back to DLL
   */
  private sendExternalResponse(id: string, success: boolean, result?: any, error?: any): void {
    try {
      dllConnector.sendNoWait({
        type: 'external_response',
        id,
        success,
        result,
        error
      });
    } catch (err) {
      logger.error('Failed to send external response:', err);
    }
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
      try {
        dllConnector.sendNoWait({
          type: 'external_register',
          name: func.name,
          async: func.async
        });
      } catch (error) {
        logger.error(`Failed to re-register function: ${func.name}`, error);
      }
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