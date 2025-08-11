/**
 * DLL Connector - Manages Windows Socket connection to Community Patch DLL using node-ipc
 */

import ipc from 'node-ipc';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../utils/logger';
import { config } from '../utils/config';
import { IPCMessage } from '../types/event';
import { APIResponse, ErrorCode, respondError, respondSuccess } from '../types/api';

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
    ipc.config.retry = config.winsock.retry;
    ipc.config.maxRetries = false; // Infinite retries
    ipc.config.silent = true; // We'll handle our own logging
    ipc.config.rawBuffer = false;
    ipc.config.encoding = 'utf8';
  }

  /**
   * Connect to the DLL via IPC
   */
  public async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      logger.info(`Connecting to DLL with ID: ${config.winsock.id}`);

      ipc.connectTo(config.winsock.id, () => {
        ipc.of[config.winsock.id].on('connect', () => {
          this.connected = true;
          this.reconnectAttempts = 0;
          logger.info('Connected to DLL successfully');
          this.emit('connected');
          
          // Re-register event handlers
          this.setupEventHandlers();
          resolve();
        });

        ipc.of[config.winsock.id].on('disconnect', () => {
          if (!this.disconnect) {
            this.connected = false;
            logger.warn('Disconnected from DLL');
          }
          this.emit('disconnected');
          this.handleDisconnection();
        });

        ipc.of[config.winsock.id].on('error', (error: any) => {
          logger.error('IPC error:', error);
          if (!this.connected) {
            // For initial connection failures, also start reconnection attempts
            this.handleDisconnection();
            reject(new Error(`Failed to connect to DLL: ${error.message || error}`));
          }
        });
      });

      // Timeout for initial connection
      setTimeout(() => {
        if (!this.connected) {
          // For timeouts, also start reconnection attempts
          this.handleDisconnection();
          reject(new Error('Connection timeout - DLL may not be running'));
        }
      }, 10000);
    });
  }

  /**
   * Setup event handlers for IPC messages
   */
  private setupEventHandlers(): void {
    const socket = ipc.of[config.winsock.id];
    if (!socket) return;
    socket.on('message', (data: any) => {
      logger.debug('Received message:', data);
      this.handleMessage(data);
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
          logger.error('Failed to parse JSON message from DLL:', parseError);
          logger.debug('Raw message:', message);
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
        case 'external_call':
          this.emit('external_call', data);
          break;
        case 'game_event':
          this.emit('game_event', data);
          break;
        case 'lua_register':
          this.emit('lua_register', data);
          break;
        default:
          logger.warn('Unknown message type:', data.type);
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
      logger.warn('Received response for unknown request:', data.id);
    }
  }

  /**
   * Handle disconnection and attempt reconnection
   */
  private handleDisconnection(): void {
    this.connected = false;
    
    // Reject all pending requests
    for (const [, request] of this.pendingRequests) {
      clearTimeout(request.timeout);
      request.reject(respondError(ErrorCode.DLL_DISCONNECTED));
    }
    this.pendingRequests.clear();

    // Prevent parallel reconnection attempts
    if (this.reconnectTimer) {
      logger.debug('Reconnection already scheduled, skipping duplicate attempt');
      return;
    }

    // Attempt reconnection (infinite retries)
    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, Math.min(this.reconnectAttempts, 10)), 30000); // Cap exponential backoff at 10 attempts
    
    logger.info(`Attempting reconnection ${this.reconnectAttempts} in ${delay}ms`);
    
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined; // Clear the timer reference before attempting
      this.connect().catch((error) => {
        logger.error('Reconnection failed:', error);
        // Will automatically try again via handleDisconnection
      });
    }, delay);
  }

  /**
   * Send a message to the DLL
   */
  public async send<T>(message: IPCMessage, timeout: number = 30000): Promise<APIResponse<T>> {
    if (!this.connected) {
      return respondError(ErrorCode.DLL_DISCONNECTED);
    }

    // Add ID if not present
    const messageWithId = { ...message, id: (message as any).id || uuidv4() };
    
    return new Promise((resolve) => {
      try {
        ipc.of[config.winsock.id].emit('message', messageWithId);
        logger.debug('Sent message to DLL:', messageWithId);
      } catch (error) {
        resolve(respondError(ErrorCode.NETWORK_ERROR));
      }

      const request: PendingRequest<T> = {
        id: messageWithId.id,
        resolve,
        reject: resolve,
        timestamp: new Date(),
        timeout: setTimeout(() => {
          this.pendingRequests.delete(messageWithId.id);
          resolve(respondError(ErrorCode.CALL_TIMEOUT));
        }, timeout)
      };

      this.pendingRequests.set(messageWithId.id, request);
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
      ipc.of[config.winsock.id].emit('message', message);
      logger.debug('Sent no-wait message to DLL:', message);
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
  public disconnect(): void {
    logger.info('Disconnecting from DLL');
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }

    // Clear pending requests
    for (const [, request] of this.pendingRequests) {
      clearTimeout(request.timeout);
      request.reject(respondError(
        ErrorCode.NETWORK_ERROR,
        'The service was shutting down'
      ));
    }
    this.pendingRequests.clear();

    // Disconnect IPC
    if (ipc.of[config.winsock.id]) {
      ipc.disconnect(config.winsock.id);
    }
    
    this.connected = false;
    this.emit('disconnected');
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