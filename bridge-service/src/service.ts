/**
 * Bridge Service - Main orchestration class for the Vox Deorum Bridge Service
 */

import { EventEmitter } from 'events';
import { createLogger } from './utils/logger';
import { config } from './utils/config';
import { dllConnector } from './services/dll-connector';
import { luaManager } from './services/lua-manager';
import { externalManager } from './services/external-manager';
import { HealthCheckResponse } from './types/api';

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
    this.setupEventHandlers();
  }

  /**
   * Setup event handlers for service coordination
   */
  private setupEventHandlers(): void {
    // DLL connection events
    dllConnector.on('connected', () => {
      logger.info('DLL connected - bridge service fully operational');
      this.emit('dll_connected');
      
      // Re-register all external functions after reconnection
      externalManager.reregisterAll();
    });

    dllConnector.on('disconnected', () => {
      logger.warn('DLL disconnected - limited functionality available');
      this.emit('dll_disconnected');
    });

    dllConnector.on('max_reconnect_attempts', () => {
      logger.error('Maximum DLL reconnection attempts reached');
      this.emit('dll_connection_failed');
    });

    // Handle service-level errors
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received - shutting down gracefully');
      this.shutdown().then(() => {
        process.exit(0);
      }).catch((error) => {
        logger.error('Error during shutdown:', error);
        process.exit(1);
      });
    });

    process.on('SIGINT', () => {
      logger.info('SIGINT received - shutting down gracefully');
      this.shutdown().then(() => {
        process.exit(0);
      }).catch((error) => {
        logger.error('Error during shutdown:', error);
        process.exit(1);
      });
    });
  }

  /**
   * Start the bridge service
   */
  public async start(): Promise<void> {
    logger.info('Starting Bridge Service...');
    
    try {
      // Connect to DLL
      logger.info('Attempting to connect to DLL...');
      await dllConnector.connect();
      
      this.isRunning = true;
      logger.info('Bridge Service started successfully');
      this.emit('started');
    } catch (error) {
      logger.error('Failed to start Bridge Service:', error);
      this.emit('start_failed', error);
      throw error;
    }
  }

  /**
   * Stop the bridge service
   */
  public async shutdown(): Promise<void> {
    logger.info('Shutting down Bridge Service...');
    
    try {
      // Clear caches
      luaManager.clearCache();
      
      // Disconnect from DLL
      dllConnector.disconnect();
      
      this.isRunning = false;
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
      status: this.isRunning && dllConnected ? 'ok' : 'error',
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
      cacheActive: boolean;
    };
    external: {
      registeredFunctions: number;
      functionNames: string[];
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
      memory: {
        used: Math.round(memUsage.rss / 1024 / 1024), // MB
        total: Math.round(memUsage.rss / 1024 / 1024), // MB
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) // MB
      }
    };
  }

  /**
   * Force reconnection to DLL
   */
  public async reconnectDLL(): Promise<void> {
    logger.info('Forcing DLL reconnection...');
    
    try {
      // Disconnect first
      dllConnector.disconnect();
      
      // Wait a bit before reconnecting
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Reconnect
      await dllConnector.connect();
      
      logger.info('DLL reconnection successful');
    } catch (error) {
      logger.error('DLL reconnection failed:', error);
      throw error;
    }
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