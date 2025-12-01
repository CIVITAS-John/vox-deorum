/**
 * Lua Manager Service
 *
 * @module bridge-service/services/lua-manager
 *
 * @description
 * Manages Lua function execution and registry. Handles single calls, batch operations,
 * and raw script execution. Maintains a local registry of available Lua functions
 * synchronized with the DLL.
 *
 * @example
 * ```typescript
 * import { luaManager } from './services/lua-manager.js';
 *
 * // Call a Lua function
 * const result = await luaManager.callFunction({
 *   function: 'Game.GetGameTurn',
 *   args: {}
 * });
 *
 * // Execute batch of calls
 * const results = await luaManager.callBatch([
 *   { function: 'Game.GetGameTurn', args: {} },
 *   { function: 'Game.GetCurrentEra', args: {} }
 * ]);
 * ```
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
 *
 * @class LuaManager
 *
 * @description
 * Service class that manages all Lua-related operations including function calls,
 * batch execution, script execution, and function registry management.
 * Listens to DLL events for registry updates.
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
   *
   * @template T - Type of the expected response data
   * @param request - Lua function call request
   * @returns Promise resolving to Lua response
   *
   * @example
   * ```typescript
   * const response = await luaManager.callFunction({
   *   function: 'Players[0]:GetCivilizationShortDescription',
   *   args: {}
   * });
   * ```
   */
  public async callFunction<T>(request: LuaCallRequest): Promise<LuaResponse<T>> {
    logger.debug(`Calling Lua function: ${request.function}`);
    const message: LuaCallMessage = {
      type: 'lua_call',
      function: request.function,
      args: request.args
    };
    const result = await dllConnector.send<T>(message);
    if (!result.success) {
      logger.warn(`Calling Lua function failed: ${result.error?.message ?? "unknown"}`);
    }
    return result;
  }

  /**
   * Execute a batch of Lua function calls
   *
   * @description
   * Executes multiple Lua function calls in a single batch operation.
   * This is more efficient than individual calls when you need to execute
   * multiple functions (reduces IPC overhead).
   *
   * @param requests - Array of Lua function call requests
   * @returns Promise resolving to array of Lua responses
   *
   * @example
   * ```typescript
   * const results = await luaManager.callBatch([
   *   { function: 'Game.GetGameTurn', args: {} },
   *   { function: 'Game.GetCurrentEra', args: {} },
   *   { function: 'Players[0]:GetGold', args: {} }
   * ]);
   * ```
   */
  public async callBatch(requests: LuaBatchRequest): Promise<LuaBatchResponse> {
    logger.info(`Executing batch of ${requests.length} Lua calls`);

    // Prepare all messages for batch sending
    const messages: LuaCallMessage[] = requests.map(request => ({
      type: 'lua_call',
      function: request.function,
      args: request.args
    }));

    // Send all messages in a single batch
    const responses = await dllConnector.sendBatch<any>(messages);

    logger.info(`Executed batch of ${requests.length} Lua calls`);
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