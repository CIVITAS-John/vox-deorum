/**
 * Bridge Service - Main orchestration class for the Vox Deorum Bridge Service
 */

import { EventEmitter } from 'events';
import { createLogger } from './utils/logger.js';
import { config } from './utils/config.js';
import { dllConnector } from './services/dll-connector.js';
import { luaManager } from './services/lua-manager.js';
import { externalManager } from './services/external-manager.js';
import { eventPipe } from './services/event-pipe.js';
import { HealthCheckResponse } from './types/api.js';

const logger = createLogger('BridgeService');

/**
 * Bridge Service class for coordinating all service components
 */
export class BridgeService extends EventEmitter {
  private startTime: Date;
  private isRunning: boolean = false;

  constructor() {
    super();
    this.startTime = new Date();
  }

  /**
   * Start the bridge service
   */
  public async start(): Promise<void> {
    logger.info('Starting Bridge Service...');
    this.isRunning = true;

    // Connect to DLL
    await dllConnector.connect();

    // Start event pipe if enabled
    await eventPipe.start();

    this.emit('started');
  }

  /**
   * Stop the bridge service
   */
  public async shutdown(): Promise<void> {
    if (!this.isRunning) return;
    logger.info('Shutting down Bridge Service...');

    try {
      this.isRunning = false;
      // Disconnect from DLL (this will also clear any reconnection timers)
      await dllConnector.disconnect();

      // Stop event pipe
      await eventPipe.stop();
      logger.info('Bridge Service shut down successfully');
      this.emit('shutdown');
    } catch (error) {
      logger.error('Error during shutdown:', error);
      throw error;
    }
  }

  /**
   * Get service health status
   */
  public getHealthStatus(): HealthCheckResponse {
    const uptime = Math.floor((Date.now() - this.startTime.getTime()) / 1000);
    const dllConnected = dllConnector.isConnected();
    
    return {
      success: this.isRunning && dllConnected,
      dll_connected: dllConnected,
      uptime,
      version: process.env.npm_package_version
    };
  }

  /**
   * Get detailed service statistics
   */
  public getServiceStats(): {
    uptime: number;
    dll: {
      connected: boolean;
      pendingRequests: number;
      reconnectAttempts: number;
    };
    lua: {
      registeredFunctions: number;
    };
    external: {
      registeredFunctions: number;
      functionNames: string[];
    };
    eventPipe: {
      enabled: boolean;
      clients: number;
      pipeName: string;
    };
    memory: {
      used: number;
      total: number;
      heapUsed: number;
      heapTotal: number;
    };
  } {
    const uptime = Math.floor((Date.now() - this.startTime.getTime()) / 1000);
    const memUsage = process.memoryUsage();
    
    return {
      uptime,
      dll: dllConnector.getStats(),
      lua: luaManager.getStats(),
      external: externalManager.getStats(),
      eventPipe: eventPipe.getStats(),
      memory: {
        used: Math.round(memUsage.rss / 1024 / 1024), // MB
        total: Math.round(memUsage.rss / 1024 / 1024), // MB
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) // MB
      }
    };
  }
  
  /**
   * Check if service is running
   */
  public isServiceRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Get service configuration
   */
  public getConfig() {
    return {
      ...config,
      startTime: this.startTime,
      isRunning: this.isRunning
    };
  }
}

// Export singleton instance
export const bridgeService = new BridgeService();
export default bridgeService;