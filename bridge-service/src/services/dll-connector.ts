/**
 * DLL Connector - Manages Windows Socket connection to Community Patch DLL using node-ipc
 */

import ipc from 'node-ipc';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../utils/logger.js';
import { config } from '../utils/config.js';
import { IPCMessage } from '../types/event.js';
import { APIResponse, ErrorCode, respondError, respondSuccess } from '../types/api.js';

const logger = createLogger('DLLConnector');

/**
 * Pending request tracking
 */
interface PendingRequest<T = any> {
  id: string;
  resolve: (value: APIResponse<T>) => void;
  reject: (error: APIResponse<T>) => void;
  timeout: NodeJS.Timeout;
  timestamp: Date;
}

/**
 * DLL Connector class for managing IPC communication
 */
export class DLLConnector extends EventEmitter {
  private connected: boolean = false;
  private shuttingDown: boolean = false;
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private reconnectAttempts: number = 0;
  private reconnectTimer?: NodeJS.Timeout;

  constructor() {
    super();
    this.setupIPC();
  }

  /**
   * Configure IPC settings
   */
  private setupIPC(): void {
    ipc.config.id = 'bridge-service';
    ipc.config.retry = config.namedpipe.retry;
    ipc.config.maxRetries = false; // Infinite retries
    ipc.config.silent = true; // We'll handle our own logging
    ipc.config.rawBuffer = true;
    ipc.config.encoding = 'utf8';
  }

  /**
   * Connect to the DLL via IPC
   */
  public async connect(): Promise<boolean> {
    this.shuttingDown = false;
    if (this.connected) {
      logger.info('Already connected to DLL');
      return Promise.resolve(true);
    }
    return new Promise((resolve) => {
      logger.info(`Connecting to DLL with ID: ${config.namedpipe.id}`);

      ipc.connectTo(config.namedpipe.id, () => {
        ipc.of[config.namedpipe.id].on('connect', () => {
          this.connected = true;
          this.reconnectAttempts = 0;
          logger.info('Connected to DLL successfully');
          this.emit('connected');
          
          // Wait for 100ms for Windows Named Pipe to work
          setTimeout(() => {
            resolve(true);
          }, 100);
        }).on('disconnect', () => {
          if (this.shuttingDown) {
            logger.warn('Disconnected from DLL, shutting down...');
          } else {
            logger.warn('Disconnected from DLL, reconnecting...');
            this.handleDisconnection();
          }
          this.emit('disconnected');
        }).on('error', (error: any) => {
          if (!this.connected) {
            // For initial connection failures, also start reconnection attempts
            logger.error(`Failed to connect to DLL: ${error.message || error}, reconnecting...`);
            this.handleDisconnection();
            resolve(false);
          } else {
            logger.error('IPC error:', error);
          }
        }).on('data', (data: Buffer) => {
          // Parse into JSON
          try {
            const jsonData = JSON.parse(data.toString());
            logger.debug('Received data: ' + JSON.stringify(jsonData));
            this.handleMessage(jsonData);
          } catch (error) {
            logger.error('Failed to parse JSON data:', error);
          }
        });
      });
    });
  }

  /**
   * Handle incoming messages
   */
  private handleMessage(message: any): void {
    try {
      // Parse message if it's a string
      let data: any;
      if (typeof message === 'string') {
        try {
          data = JSON.parse(message);
        } catch (parseError) {
          logger.error('Failed to parse JSON message from DLL:' + parseError, message);
          return;
        }
      } else {
        data = message;
      }
      // Route based on message type
      switch (data.type) {
        case 'lua_response':
          this.handleResponse(data);
          break;
        default:
          this.emit(data.type, data);
      }
    } catch (error) {
      logger.error('Failed to handle message:', error);
    }
  }

  /**
   * Handle response messages
   */
  private handleResponse(data: any): void {
    const request = this.pendingRequests.get(data.id);
    if (request) {
      clearTimeout(request.timeout);
      this.pendingRequests.delete(data.id);
      
      if (data.success) {
        request.resolve(data);
      } else {
        request.reject(data);
      }
    } else {
      logger.warn('Received response for unknown request: ' + data.id);
    }
  }

  /**
   * Handle disconnection and attempt reconnection
   */
  private handleDisconnection(): void {
    this.connected = false;
    
    // Reject all pending requests
    if (this.shuttingDown) return;

    // Prevent parallel reconnection attempts
    if (this.reconnectTimer) {
      logger.debug('Reconnection already scheduled, skipping duplicate attempt');
      return;
    }

    // Attempt reconnection (infinite retries)
    this.reconnectAttempts++;
    const delay = Math.min(200 * Math.pow(1.5, this.reconnectAttempts), 5000); // Cap exponential backoff at 10 attempts
    
    logger.info(`Attempting reconnection ${this.reconnectAttempts} in ${delay}ms`);
    
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined; // Clear the timer reference before attempting
      if (this.shuttingDown) return; // Don't reconnect if shutting down
      this.connect().catch((error) => {
        logger.error('Reconnection failed:', error);
      });
    }, delay);
  }

  /**
   * Send a message to the DLL
   */
  public async send<T>(message: IPCMessage, timeout: number = 30000): Promise<APIResponse<T>> {
    if (!this.connected) {
      logger.warn('Cannot send message, DLL is disconnected');
      return respondError(ErrorCode.DLL_DISCONNECTED);
    }

    // Add ID if not present
    const messageWithId = { ...message, id: (message as any).id || uuidv4() };
    
    return new Promise((resolve) => {
      const request: PendingRequest<T> = {
        id: messageWithId.id,
        resolve,
        reject: resolve,
        timestamp: new Date(),
        timeout: setTimeout(() => {
          this.pendingRequests.delete(messageWithId.id);
          logger.error('Message timeout:', messageWithId);
          resolve(respondError(ErrorCode.CALL_TIMEOUT));
        }, timeout)
      };

      this.pendingRequests.set(messageWithId.id, request);

      try {
        ipc.of[config.namedpipe.id].emit(JSON.stringify(messageWithId) + "!@#$%^!");
        logger.debug('Sent message to DLL:', messageWithId);
        // Emit event for testing
        this.emit('ipc_send', messageWithId);
      } catch (error) {
        this.pendingRequests.delete(messageWithId.id);
        resolve(respondError(ErrorCode.NETWORK_ERROR));
      }
    });
  }

  /**
   * Send a message without waiting for response
   */
  public sendNoWait(message: IPCMessage): APIResponse<any> {
    if (!this.connected) {
      logger.warn('Cannot send message, DLL is disconnected');
      return respondError(ErrorCode.DLL_DISCONNECTED);
    }

    try {
      ipc.of[config.namedpipe.id].emit(JSON.stringify(message) + "!@#$%^!");
      logger.debug('Sent no-wait message to DLL:', message);
      // Emit event for testing
      this.emit('ipc_send', message);
      return respondSuccess();
    } catch (error) {
      logger.error('Failed to send no-wait message:', error);
      return respondError(ErrorCode.NETWORK_ERROR);
    }
  }

  /**
   * Check if connected to DLL
   */
  public isConnected(): boolean {
    return this.connected;
  }

  /**
   * Disconnect from the DLL
   */
  public async disconnect(): Promise<void> {
    if (!this.connected) {
      logger.info('Already disconnected from DLL');
      return;
    }
    
    logger.info('Disconnecting from DLL');
    
    // Clear pending requests
    for (const [, request] of this.pendingRequests) {
      clearTimeout(request.timeout);
      request.reject(respondError(
        ErrorCode.DLL_DISCONNECTED,
        'The service was shutting down'
      ));
    }
    this.pendingRequests.clear();

    // Avoid reconnection attempts during shutdown
    this.reconnectTimer = undefined;
    this.shuttingDown = true;

    // Create a promise that resolves when disconnected event is emitted
    const disconnectedPromise = new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        // If disconnected event doesn't fire within 2 seconds, resolve anyway
        logger.warn('Disconnect timeout - resolving without event');
        resolve();
      }, 2000);

      this.once('disconnected', () => {
        clearTimeout(timeout);
        setTimeout(() => {
          resolve();
        }, 200);
      });
    });

    // Disconnect IPC
    this.connected = false;
    if (ipc.of[config.namedpipe.id]) {
      ipc.disconnect(config.namedpipe.id);
    }

    // Wait for disconnected event or timeout
    await disconnectedPromise;
    logger.info('Disconnected from DLL successfully');
  }

  /**
   * Get connection statistics
   */
  public getStats(): {
    connected: boolean;
    pendingRequests: number;
    reconnectAttempts: number;
  } {
    return {
      connected: this.connected,
      pendingRequests: this.pendingRequests.size,
      reconnectAttempts: this.reconnectAttempts
    };
  }
}

// Export singleton instance
export const dllConnector = new DLLConnector();
export default dllConnector;