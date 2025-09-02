/**
 * LuaFunction encapsulates a Lua function with lazy registration
 * Handles automatic registration and retry on errors
 */

import { createLogger } from '../utils/logger.js';
import { MCPServer } from '../server.js';
import type { LuaResponse } from './manager.js';

const logger = createLogger('LuaFunction');

/**
 * Represents a Lua function that can be registered and executed
 */
export class LuaFunction {
  public readonly name: string;
  public readonly script: string;
  private _registered: boolean = false;

  /**
   * Create a new LuaFunction
   */
  constructor(name: string, script: string) {
    this.name = name;
    this.script = script;
  }

  /**
   * Check if the function is registered
   */
  public get registered(): boolean {
    return this._registered;
  }

  /**
   * Register the function with the Bridge Service
   */
  public async register(): Promise<boolean> {
    logger.info(`Registering function: ${this.name}`);
    
    // Create registration script that defines the function
    const registrationScript = `
      Game.RegisterFunction("${this.name}", ${this.script})
      return true
    `;

    const response = await MCPServer.getInstance().getBridgeManager().executeLuaScript(registrationScript);
    
    if (response.success) {
      this._registered = true;
      logger.info(`Successfully registered function: ${this.name}`);
      return true;
    } else {
      logger.error(`Failed to register function ${this.name}:`, response.error);
      return false;
    }
  }

  /**
   * Execute the function with given arguments
   */
  public async execute(...args: any[]): Promise<LuaResponse> {
    var bridgeManager = MCPServer.getInstance().getBridgeManager();
    // Try to register with the manager if not already done
    if (!this._registered) await this.register();

    // Try to execute the function
    let response = await bridgeManager.callLuaFunction(this.name, args);

    // If failed due to unregistered function, try to register and retry
    if (!response.success && response.error?.code === 'INVALID_FUNCTION') {
      logger.info(`Function ${this.name} not registered, attempting registration`);
      
      // Try to register
      const registered = await this.register();
      
      if (registered) {
        // Retry the execution
        logger.info(`Retrying execution of ${this.name} after registration`);
        response = await bridgeManager.callLuaFunction(this.name, args);
      } else {
        return {
          success: false,
          error: {
            code: 'REGISTRATION_FAILED',
            message: `Failed to register function ${this.name}`,
          },
        };
      }
    }
    
    return response;
  }

  /**
   * Reset the registration state
   */
  public resetRegistration(): void {
    this._registered = false;
    logger.debug(`Reset registration for function: ${this.name}`);
  }
}