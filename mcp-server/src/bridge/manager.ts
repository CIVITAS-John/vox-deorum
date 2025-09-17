/**
 * BridgeManager handles all communication with the Bridge Service
 * Provides stateless APIs for HTTP REST and SSE interactions
 */

import { EventEmitter } from 'events';
import { EventSource } from 'eventsource'
import { createLogger } from '../utils/logger.js';
import { config } from '../utils/config.js';
import { LuaFunction } from './lua-function.js';
import { HttpClient, HttpError } from './http-client.js';
import { setTimeout as sleep } from 'node:timers/promises';

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
 * Queued Lua function call request
 */
interface QueuedLuaCall {
  functionName: string;
  args: any[];
  resolve: (value: LuaResponse) => void;
  reject: (error: any) => void;
  timestamp: number;
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
  private httpClient: HttpClient;
  private luaCallQueue: QueuedLuaCall[] = [];
  private queueProcessorRunning: boolean = false;

  /**
   * Create a new BridgeManager instance
   */
  constructor(baseUrl?: string) {
    super();
    this.baseUrl = baseUrl || config.bridge?.url || 'http://127.0.0.1:5000';
    this.luaFunctions = new Map();
    this.httpClient = new HttpClient(this.baseUrl);
    logger.info(`BridgeManager initialized with URL: ${this.baseUrl}`);

    // Start the queue processor loop
    this.startQueueProcessorLoop();
  }

  /**
   * Check if the Bridge Service is healthy and connected
   */
  public async checkHealth(): Promise<HealthResponse> {
    try {
      const response = await this.httpClient.get<any>('/health');
      const data = response.result as HealthResponse;
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
      const data = await this.httpClient.post<LuaResponse>('/lua/execute', { script }, { fast: true });

      if (!data.success) {
        logger.error('Lua script execution failed: ' + (JSON.stringify(data)), data.error);
      }

      return data;
    } catch (error: any) {
      logger.error('Failed to execute Lua script:', error);
      return {
        success: false,
        error: {
          code: error instanceof HttpError ? error.code : 'NETWORK_ERROR',
          message: error.message || 'Failed to communicate with Bridge Service',
        },
      };
    }
  }

  /**
   * Call a registered Lua function through Bridge Service (queued)
   */
  public async callLuaFunction(functionName: string, args: any[]): Promise<LuaResponse> {
    // Immediately reject if DLL is not connected
    if (!this.isDllConnected) {
      return {
        success: false,
        error: {
          code: 'DLL_DISCONNECTED',
          message: 'DLL is not connected'
        }
      };
    }

    return new Promise((resolve, reject) => {
      this.luaCallQueue.push({
        functionName,
        args,
        resolve,
        reject,
        timestamp: Date.now()
      });
    });
  }

  /**
   * Start the async queue processor loop
   */
  private async startQueueProcessorLoop(): Promise<void> {
    if (this.queueProcessorRunning) return;
    this.queueProcessorRunning = true;

    while (this.queueProcessorRunning) {
      if (!this.isDllConnected) {
        // Drop all pending calls when DLL disconnects
        this.dropAllPendingCalls('DLL disconnected');
        // Wait before checking again
        await sleep(200);
        continue;
      }

      if (this.luaCallQueue.length === 0) {
        // No items in queue, wait
        await sleep(50);
        continue;
      }

      // Process a batch
      await this.processBatch();
    }
    logger.info(`The queue processor has completed.`);
  }

  /**
   * Process a single batch of queued calls
   */
  private async processBatch(): Promise<void> {
    // Extract a batch from the queue
    const batch = this.luaCallQueue.splice(0, Math.min(50, this.luaCallQueue.length));

    if (batch.length === 0) return;

    try {
      logger.info(`Batch executing ${batch.length} Lua calls, ${this.luaCallQueue.length} remaining...`);
      const response = await this.httpClient.post<any>('/lua/batch', batch.map(call => ({
        function: call.functionName,
        args: call.args
      })));

      if (response.success && response.result?.results) {
        const results = response.result.results;

        // Match results to original calls
        batch.forEach((call, index) => {
          if (index < results.length) {
            call.resolve(results[index]);
          } else {
            // Shouldn't happen, but handle missing result
            call.resolve({
              success: false,
              error: {
                code: 'BATCH_ERROR',
                message: 'Missing result from batch call'
              }
            });
          }
        });
      } else {
        // Batch failed entirely
        batch.forEach(call => {
          call.resolve({
            success: false,
            error: {
              code: 'BATCH_ERROR',
              message: response.error?.message || 'Batch execution failed'
            }
          });
        });
      }
    } catch (error: any) {
      logger.error('Failed to execute batch Lua calls:', error);

      // Resolve all calls with error
      batch.forEach(call => {
        call.resolve({
          success: false,
          error: {
            code: error instanceof HttpError ? error.code : 'NETWORK_ERROR',
            message: error.message || 'Failed to communicate with Bridge Service',
          },
        });
      });
    }
  }

  /**
   * Drop all pending calls with an error
   */
  private dropAllPendingCalls(reason: string): void {
    if (this.luaCallQueue.length === 0) return;

    logger.warn(`Dropping ${this.luaCallQueue.length} pending Lua calls: ${reason}`);

    const error = {
      success: false,
      error: {
        code: 'QUEUE_DROPPED',
        message: reason
      }
    };

    this.luaCallQueue.forEach(call => {
      call.resolve(error);
    });

    this.luaCallQueue = [];
  }
  
  /**
   * Add a LuaFunction to the knowledge of the manager
   */
  public addFunction(func: LuaFunction): void {
    this.luaFunctions.set(func.name, func);
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
    if (this.luaFunctions.size == 0) return;
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
          if (data.type == "dll_status") {
            if (!data.payload.status && this.dllConnected)
              this.resetFunctions();
            if (this.isDllConnected != data.payload.status) {
              this.isDllConnected = data.payload.status;
              logger.warn("DLL connected status changed: " + this.isDllConnected);
            }
          } 
          this.emit('gameEvent', data);
          // logger.debug('Received SSE event: ' + data.type, data);
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
   * Pause the game through Bridge Service
   */
  public async pauseGame(): Promise<boolean> {
    try {
      const data = await this.httpClient.post<any>('/external/pause', undefined, { fast: true });
      logger.debug('Game pause requested: ' + data.success);
      return data.success === true;
    } catch (error: any) {
      logger.error('Failed to pause game:', error);
      return false;
    }
  }

  /**
   * Resume the game through Bridge Service
   */
  public async resumeGame(): Promise<boolean> {
    try {
      const data = await this.httpClient.post<any>('/external/resume', undefined, { fast: true });
      logger.debug('Game resume requested: ' + data.success);
      return data.success === true;
    } catch (error: any) {
      logger.error('Failed to resume game:', error);
      return false;
    }
  }

  /**
   * Register a player for auto-pause when it's their turn
   */
  public async pausePlayer(playerId: number): Promise<boolean> {
    try {
      await this.httpClient.post(`/external/pause-player/${playerId}`, undefined, { fast: true });
      logger.info(`Player ${playerId} registered for auto-pause`);
      return true;
    } catch (error: any) {
      logger.warn(`Failed to register player ${playerId} for auto-pause:`, error);
      return false;
    }
  }

  /**
   * Unregister a player from auto-pause (resume)
   */
  public async resumePlayer(playerId: number): Promise<boolean> {
    try {
      await this.httpClient.delete(`/external/pause-player/${playerId}`, { fast: true });
      logger.info(`Player ${playerId} unregistered from auto-pause`);
      return true;
    } catch (error: any) {
      logger.error(`Failed to unregister player ${playerId} from auto-pause:`, error);
      return false;
    }
  }

  /**
   * Shutdown the manager
   */
  public async shutdown(): Promise<void> {
    logger.info('Shutting down BridgeManager');

    // Stop queue processor
    this.queueProcessorRunning = false;

    // Drop all pending queue items
    this.dropAllPendingCalls('BridgeManager shutting down');

    this.disconnectSSE();
    this.resetFunctions();
    this.removeAllListeners();
    await this.httpClient.shutdown();
  }
}