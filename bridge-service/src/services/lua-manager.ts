/**
 * Lua Manager - Handles Lua function execution and registry management
 */

import { createLogger } from '../utils/logger';
import { dllConnector } from './dll-connector';
import { 
  LuaCallRequest, 
  LuaExecuteRequest, 
  LuaResponse, 
  LuaBatchRequest,
  LuaBatchResponse,
  LuaFunction,
  LuaRegisterMessage,
  LuaCallMessage,
  LuaExecuteMessage 
} from '../types/lua';
import { ErrorCode } from '../types/api';

const logger = createLogger('LuaManager');

/**
 * Lua Manager class for handling Lua operations
 */
export class LuaManager {
  private registeredFunctions: Map<string, LuaFunction> = new Map();

  constructor() {
    // Listen for individual function registrations from DLL
    dllConnector.on('lua_register', (message: LuaRegisterMessage) => {
      this.registerFunction(message.function, message.description);
    });
  }

  /**
   * Call a Lua function
   */
  public async callFunction(request: LuaCallRequest): Promise<LuaResponse> {
    logger.info(`Calling Lua function: ${request.function}`);

    if (!dllConnector.isConnected()) {
      return {
        success: false,
        error: {
          code: ErrorCode.DLL_DISCONNECTED,
          message: 'Not connected to game DLL',
          details: 'The bridge service has lost connection to the game'
        }
      };
    }

    try {
      const message: LuaCallMessage = {
        type: 'lua_call',
        function: request.function,
        args: request.args
      };
      const result = await dllConnector.send(message);

      return {
        success: true,
        result
      };
    } catch (error: any) {
      logger.error(`Failed to call Lua function ${request.function}:`, error);
      
      return {
        success: false,
        error: {
          code: ErrorCode.LUA_EXECUTION_ERROR,
          message: `Failed to execute Lua function: ${request.function}`,
          details: error.message || String(error)
        }
      };
    }
  }

  /**
   * Execute a batch of Lua function calls
   */
  public async callBatch(requests: LuaBatchRequest): Promise<LuaBatchResponse> {
    logger.info(`Executing batch of ${requests.length} Lua calls`);

    const responses: LuaBatchResponse = [];

    // Execute calls sequentially to maintain order
    for (const request of requests) {
      const response = await this.callFunction(request);
      responses.push(response);
    }

    return responses;
  }

  /**
   * Execute raw Lua script
   */
  public async executeScript(request: LuaExecuteRequest): Promise<LuaResponse> {
    logger.info('Executing Lua script');
    logger.debug('Script:', request.script);

    if (!dllConnector.isConnected()) {
      return {
        success: false,
        error: {
          code: ErrorCode.DLL_DISCONNECTED,
          message: 'Not connected to game DLL',
          details: 'The bridge service has lost connection to the game'
        }
      };
    }

    // Basic script validation
    if (!request.script || typeof request.script !== 'string') {
      return {
        success: false,
        error: {
          code: ErrorCode.INVALID_SCRIPT,
          message: 'Invalid Lua script',
          details: 'Script must be a non-empty string'
        }
      };
    }

    try {
      const message: LuaExecuteMessage = {
        type: 'lua_execute',
        script: request.script
      };
      const result = await dllConnector.send(message);

      return {
        success: true,
        result
      };
    } catch (error: any) {
      logger.error('Failed to execute Lua script:', error);
      
      return {
        success: false,
        error: {
          code: ErrorCode.LUA_EXECUTION_ERROR,
          message: 'Failed to execute Lua script',
          details: error.message || String(error)
        }
      };
    }
  }

  /**
   * Get list of available Lua functions
   */
  public getFunctions(): string[] {
    return Array.from(this.registeredFunctions.keys());
  }

  /**
   * Register a Lua function locally (called by DLL)
   */
  public registerFunction(functionName: string, description?: string): void {
    logger.info(`Registering Lua function: ${functionName}`);
    
    this.registeredFunctions.set(functionName, {
      function: functionName,
      description,
      registeredAt: new Date()
    });
  }

  /**
   * Unregister a Lua function locally
   */
  public unregisterFunction(functionName: string): boolean {
    logger.info(`Unregistering Lua function: ${functionName}`);
    
    const existed = this.registeredFunctions.has(functionName);
    this.registeredFunctions.delete(functionName);
    
    return existed;
  }

  /**
   * Clear function registry
   */
  public clearRegistry(): void {
    this.registeredFunctions.clear();
  }

  /**
   * Get manager statistics
   */
  public getStats(): {
    registeredFunctions: number;
  } {
    return {
      registeredFunctions: this.registeredFunctions.size
    };
  }
}

// Export singleton instance
export const luaManager = new LuaManager();
export default luaManager;