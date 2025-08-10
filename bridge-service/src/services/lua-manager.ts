/**
 * Lua Manager - Handles Lua function execution and registry management
 */

import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../utils/logger';
import { dllConnector } from './dll-connector';
import { 
  LuaCallRequest, 
  LuaExecuteRequest, 
  LuaResponse, 
  LuaBatchRequest,
  LuaBatchResponse,
  LuaFunction 
} from '../types/lua';
import { ErrorCode } from '../types/api';

const logger = createLogger('LuaManager');

/**
 * Lua Manager class for handling Lua operations
 */
export class LuaManager {
  private registeredFunctions: Map<string, LuaFunction> = new Map();
  private functionListCache?: string[];
  private cacheTimeout?: NodeJS.Timeout;
  private readonly cacheLifetime = 60000; // 1 minute cache

  constructor() {
    // Listen for function registry updates from DLL
    dllConnector.on('function_registry_update', (functions: string[]) => {
      this.updateFunctionRegistry(functions);
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
      const id = uuidv4();
      const result = await dllConnector.send({
        type: 'lua_call',
        function: request.function,
        args: request.args,
        id
      });

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
      
      // Stop batch execution if DLL disconnects
      if (!dllConnector.isConnected()) {
        // Fill remaining with errors
        while (responses.length < requests.length) {
          responses.push({
            success: false,
            error: {
              code: ErrorCode.DLL_DISCONNECTED,
              message: 'DLL disconnected during batch execution',
              details: 'Connection lost while processing batch'
            }
          });
        }
        break;
      }
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
      const id = uuidv4();
      const result = await dllConnector.send({
        type: 'lua_execute',
        script: request.script,
        id
      });

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
  public async getFunctions(): Promise<string[]> {
    // Return cached list if available
    if (this.functionListCache) {
      return this.functionListCache;
    }

    if (!dllConnector.isConnected()) {
      logger.warn('Cannot get function list - not connected to DLL');
      return [];
    }

    try {
      // Request function list from DLL
      const id = uuidv4();
      const result = await dllConnector.send({
        type: 'lua_call',
        function: '__get_registered_functions',
        args: [],
        id
      }, 5000); // Shorter timeout for metadata call

      if (Array.isArray(result)) {
        this.functionListCache = result;
        
        // Clear cache after timeout
        if (this.cacheTimeout) {
          clearTimeout(this.cacheTimeout);
        }
        this.cacheTimeout = setTimeout(() => {
          this.functionListCache = undefined;
        }, this.cacheLifetime);

        return result;
      }

      // Fallback to local registry if special function not available
      return Array.from(this.registeredFunctions.keys());
    } catch (error) {
      logger.error('Failed to get function list:', error);
      // Return local registry as fallback
      return Array.from(this.registeredFunctions.keys());
    }
  }

  /**
   * Register a Lua function locally (called by DLL)
   */
  public registerFunction(name: string, description?: string): void {
    logger.info(`Registering Lua function: ${name}`);
    
    this.registeredFunctions.set(name, {
      name,
      description,
      registeredAt: new Date()
    });

    // Clear cache when registry changes
    this.functionListCache = undefined;
  }

  /**
   * Update function registry from DLL
   */
  private updateFunctionRegistry(functions: string[]): void {
    logger.info(`Updating function registry with ${functions.length} functions`);
    
    // Clear existing registry
    this.registeredFunctions.clear();
    
    // Add functions to registry
    for (const func of functions) {
      this.registeredFunctions.set(func, {
        name: func,
        registeredAt: new Date()
      });
    }

    // Update cache
    this.functionListCache = functions;
  }

  /**
   * Clear all caches
   */
  public clearCache(): void {
    this.functionListCache = undefined;
    if (this.cacheTimeout) {
      clearTimeout(this.cacheTimeout);
      this.cacheTimeout = undefined;
    }
  }

  /**
   * Get manager statistics
   */
  public getStats(): {
    registeredFunctions: number;
    cacheActive: boolean;
  } {
    return {
      registeredFunctions: this.registeredFunctions.size,
      cacheActive: !!this.functionListCache
    };
  }
}

// Export singleton instance
export const luaManager = new LuaManager();
export default luaManager;