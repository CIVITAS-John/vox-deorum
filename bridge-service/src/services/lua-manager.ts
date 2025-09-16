/**
 * Lua Manager - Handles Lua function execution and registry management
 */

import { createLogger } from '../utils/logger.js';
import { dllConnector } from './dll-connector.js';
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
} from '../types/lua.js';
import { ErrorCode, respondError } from '../types/api.js';

const logger = createLogger('LuaManager');

/**
 * Lua Manager class for handling Lua operations
 */
export class LuaManager {
  private registeredFunctions: Map<string, LuaFunction> = new Map();

  constructor() {
    // Listen for function registry updates from DLL
    dllConnector.on('lua_register', (message: LuaRegisterMessage) => {
      this.registerFunction(message.function, message.description);
    });
    
    dllConnector.on('lua_unregister', (message: { function: string }) => {
      this.unregisterFunction(message.function);
    });
    
    dllConnector.on('lua_clear', () => {
      this.clearRegistry();
    });
  }

  /**
   * Call a Lua function
   */
  public async callFunction<T>(request: LuaCallRequest): Promise<LuaResponse<T>> {
    logger.debug(`Calling Lua function: ${request.function}`);
    const message: LuaCallMessage = {
      type: 'lua_call',
      function: request.function,
      args: request.args
    };
    const result = await dllConnector.send<T>(message);
    return result;
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
  public async executeScript<T = any>(request: LuaExecuteRequest): Promise<LuaResponse<T>> {
    // Basic script validation
    if (!request.script || typeof request.script !== 'string') {
      return respondError(ErrorCode.INVALID_SCRIPT);
    }

    const message: LuaExecuteMessage = {
      type: 'lua_execute',
      script: request.script
    };

    const result = await dllConnector.send<T>(message);
    return result;
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
    logger.info('Clearing all registered functions');
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