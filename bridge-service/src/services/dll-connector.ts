/**
 * DLL Connector - Manages Windows Socket connection to Community Patch DLL using node-ipc
 */

import ipc from 'node-ipc';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../utils/logger';
import { config } from '../utils/config';
import { IPCMessage } from '../types/api';

const logger = createLogger('DLLConnector');

/**
 * Pending request tracking
 */
interface PendingRequest {
  id: string;
  resolve: (value: any) => void;
  reject: (error: any) => void;
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
  private maxReconnectAttempts: number = 10;
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
    ipc.config.maxRetries = this.maxReconnectAttempts;
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
          this.connected = false;
          logger.warn('Disconnected from DLL');
          this.emit('disconnected');
          this.handleDisconnection();
        });

        ipc.of[config.winsock.id].on('error', (error: any) => {
          logger.error('IPC error:', error);
          if (!this.connected) {
            reject(new Error(`Failed to connect to DLL: ${error.message || error}`));
          }
        });
      });

      // Timeout for initial connection
      setTimeout(() => {
        if (!this.connected) {
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

    // Handle Lua responses
    socket.on('lua_response', (data: any) => {
      this.handleResponse(data);
    });

    // Handle external function calls from Lua
    socket.on('external_call', (data: any) => {
      this.emit('external_call', data);
    });

    // Handle game events
    socket.on('game_event', (data: any) => {
      this.emit('game_event', data);
    });

    // Handle external function responses
    socket.on('external_response', (data: any) => {
      this.handleResponse(data);
    });

    // Handle generic messages
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
      const data = typeof message === 'string' ? JSON.parse(message) : message;
      
      // Route based on message type
      switch (data.type) {
        case 'lua_response':
        case 'external_response':
          this.handleResponse(data);
          break;
        case 'external_call':
          this.emit('external_call', data);
          break;
        case 'game_event':
          this.emit('game_event', data);
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
        request.resolve(data.result);
      } else {
        request.reject(data.error || new Error('Operation failed'));
      }
    } else {
      logger.warn('Received response for unknown request:', data.id);
    }
  }

  /**
   * Handle disconnection and attempt reconnection
   */
  private handleDisconnection(): void {
    // Reject all pending requests
    for (const [id, request] of this.pendingRequests) {
      clearTimeout(request.timeout);
      request.reject(new Error('DLL disconnected'));
    }
    this.pendingRequests.clear();

    // Attempt reconnection
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
      
      logger.info(`Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
      
      this.reconnectTimer = setTimeout(() => {
        this.connect().catch((error) => {
          logger.error('Reconnection failed:', error);
        });
      }, delay);
    } else {
      logger.error('Max reconnection attempts reached. Manual intervention required.');
      this.emit('max_reconnect_attempts');
    }
  }

  /**
   * Send a message to the DLL
   */
  public async send(message: IPCMessage, timeout: number = 30000): Promise<any> {
    if (!this.connected) {
      throw new Error('Not connected to DLL');
    }

    // Add ID if not present
    const messageWithId = { ...message, id: (message as any).id || uuidv4() };
    
    return new Promise((resolve, reject) => {
      const request: PendingRequest = {
        id: messageWithId.id,
        resolve,
        reject,
        timestamp: new Date(),
        timeout: setTimeout(() => {
          this.pendingRequests.delete(messageWithId.id);
          reject(new Error(`Request timeout after ${timeout}ms`));
        }, timeout)
      };

      this.pendingRequests.set(messageWithId.id, request);

      try {
        ipc.of[config.winsock.id].emit('message', messageWithId);
        logger.debug('Sent message to DLL:', messageWithId);
      } catch (error) {
        this.pendingRequests.delete(messageWithId.id);
        clearTimeout(request.timeout);
        reject(error);
      }
    });
  }

  /**
   * Send a message without waiting for response
   */
  public sendNoWait(message: IPCMessage): void {
    if (!this.connected) {
      logger.warn('Cannot send message - not connected to DLL');
      return;
    }

    try {
      ipc.of[config.winsock.id].emit('message', message);
      logger.debug('Sent no-wait message to DLL:', message);
    } catch (error) {
      logger.error('Failed to send no-wait message:', error);
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
    for (const [id, request] of this.pendingRequests) {
      clearTimeout(request.timeout);
      request.reject(new Error('Service shutting down'));
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