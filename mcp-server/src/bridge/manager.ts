/**
 * BridgeManager handles all communication with the Bridge Service
 * Provides stateless APIs for HTTP REST and SSE interactions
 */

import { EventEmitter } from 'events';
import { EventSource } from 'eventsource'
import { createLogger } from '../utils/logger.js';
import { config } from '../utils/config.js';
import { LuaFunction } from './lua-function.js';

const logger = createLogger('BridgeManager');

/**
 * Response from Bridge Service Lua calls
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
 * Health check response from Bridge Service
 */
export interface HealthResponse {
  success: boolean;
  dll_connected: boolean;
  uptime: number;
  version: string;
}

/**
 * SSE event from Bridge Service
 */
export interface GameEvent {
  type: string;
  payload: any;
  timestamp: string;
}

/**
 * Manager for Bridge Service communication
 */
export class BridgeManager extends EventEmitter {
  private baseUrl: string;
  private luaFunctions: Map<string, LuaFunction>;
  private sseConnection: EventSource | null = null;
  private connectionRetryTimeout: NodeJS.Timeout | null = null;
  private isDllConnected: boolean = false;

  /**
   * Create a new BridgeManager instance
   */
  constructor(baseUrl?: string) {
    super();
    this.baseUrl = baseUrl || config.bridge?.url || 'http://localhost:8080';
    this.luaFunctions = new Map();
    logger.info(`BridgeManager initialized with URL: ${this.baseUrl}`);
  }

  /**
   * Check if the Bridge Service is healthy and connected
   */
  public async checkHealth(): Promise<HealthResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      if (!response.ok) {
        throw new Error(`Health check failed with status ${response.status}`);
      }
      const data = await response.json() as HealthResponse;
      this.isDllConnected = data.dll_connected;
      return data;
    } catch (error: any) {
      logger.error('Health check failed:', error);
      this.isDllConnected = false;
      throw error;
    }
  }

  /**
   * Execute raw Lua script through Bridge Service
   */
  public async executeLuaScript(script: string): Promise<LuaResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/lua/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ script }),
      });

      const data = await response.json() as LuaResponse;
      
      if (!data) {
        throw new Error(`Lua function call failed with status ${response.status}: ${JSON.stringify(data)}`);
      }

      if (!data.success) {
        logger.error('Lua script execution failed: ' + (JSON.stringify(data)), data.error);
      }
      
      return data;
    } catch (error: any) {
      logger.error('Failed to execute Lua script:', error);
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: error.message || 'Failed to communicate with Bridge Service',
        },
      };
    }
  }

  /**
   * Call a registered Lua function through Bridge Service
   */
  public async callLuaFunction(functionName: string, args: any[]): Promise<LuaResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/lua/call`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          function: functionName,
          args: args,
        }),
      });

      const data = await response.json() as LuaResponse;
      
      if (!data) {
        throw new Error(`Lua function call failed with status ${response.status}: ${JSON.stringify(data)}`);
      }

      if (!data.success) {
        logger.error(`Lua function ${functionName} failed: ${JSON.stringify(data)}`, data.error);
      }
      
      return data;
    } catch (error: any) {
      logger.error(`Failed to call Lua function ${functionName}:`, error);
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: error.message || 'Failed to communicate with Bridge Service',
        },
      };
    }
  }

  /**
   * Add a LuaFunction to the knowledge of the manager
   */
  public addFunction(func: LuaFunction): void {
    this.luaFunctions.set(func.name, func);
    logger.debug(`Added function: ${func.name}`);
  }

  /**
   * Get a registered LuaFunction by name
   */
  public getFunction(name: string): LuaFunction | undefined {
    return this.luaFunctions.get(name);
  }

  /**
   * Reset all registered functions (mark as unregistered)
   */
  public resetFunctions(): void {
    logger.info('Resetting all registered functions');
    this.luaFunctions.forEach(func => {
      func.resetRegistration();
    });
  }

  /**
   * Connect to SSE stream for game events
   */
  public connectSSE(): void {
    if (this.sseConnection) {
      this.sseConnection.close();
    }

    try {
      logger.info('Connecting to SSE stream');
      this.sseConnection = new EventSource(`${this.baseUrl}/events`);

      this.sseConnection.onopen = () => {
        logger.info('SSE connection established');
        this.emit('connected');
        this.clearRetryTimeout();
      };

      this.sseConnection.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as GameEvent;
          this.emit('gameEvent', data);
          logger.debug('Received SSE event: ' + data.type, data);
        } catch (error) {
          logger.error('Failed to parse SSE event:', error);
        }
      };

      this.sseConnection.onerror = (error) => {
        logger.error('SSE connection error:', error);
        this.emit('disconnected');
        this.scheduleReconnect();
      };
    } catch (error) {
      logger.error('Failed to create SSE connection:', error);
      this.scheduleReconnect();
    }
  }

  /**
   * Schedule SSE reconnection with exponential backoff
   */
  private scheduleReconnect(): void {
    this.clearRetryTimeout();
    const delay = 1000; // Start with 5 second delay
    logger.info(`Scheduling SSE reconnection in ${delay}ms`);
    this.connectionRetryTimeout = setTimeout(() => {
      this.connectSSE();
    }, delay);
  }

  /**
   * Clear reconnection timeout
   */
  private clearRetryTimeout(): void {
    if (this.connectionRetryTimeout) {
      clearTimeout(this.connectionRetryTimeout);
      this.connectionRetryTimeout = null;
    }
  }

  /**
   * Disconnect from SSE stream
   */
  public disconnectSSE(): void {
    this.clearRetryTimeout();
    if (this.sseConnection) {
      this.sseConnection.close();
      this.sseConnection = null;
      logger.info('SSE connection closed');
    }
  }

  /**
   * Get DLL connection status
   */
  public get dllConnected(): boolean {
    return this.isDllConnected;
  }

  /**
   * Shutdown the manager
   */
  public shutdown(): void {
    logger.info('Shutting down BridgeManager');
    this.disconnectSSE();
    this.resetFunctions();
    this.removeAllListeners();
  }
}