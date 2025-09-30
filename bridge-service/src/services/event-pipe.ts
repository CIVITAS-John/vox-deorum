/**
 * Event pipe service for broadcasting game events through named pipes using node-ipc
 */

import ipc from 'node-ipc';
import { EventEmitter } from 'events';
import { createLogger } from '../utils/logger.js';
import { config } from '../utils/config.js';
import { GameEvent } from '../types/event.js';

const logger = createLogger('EventPipe');

/**
 * EventPipe service for broadcasting events through a named pipe using node-ipc
 */
export class EventPipe extends EventEmitter {
  private isServing: boolean = false;
  private shuttingDown: boolean = false;
  private connectedClients: Set<string> = new Set();

  constructor() {
    super();
    this.setupIPC();
  }

  /**
   * Configure IPC settings for the event pipe server
   */
  private setupIPC(): void {
    ipc.config.id = config.eventpipe.name;
    ipc.config.retry = 1500;
    ipc.config.silent = true; // We'll handle our own logging
    ipc.config.rawBuffer = true; // Use raw buffer like dll-connector
    ipc.config.encoding = 'utf8';
  }

  /**
   * Start the event pipe server
   */
  async start(): Promise<void> {
    if (!config.eventpipe.enabled) {
      logger.info('Event pipe is disabled in configuration');
      return;
    }

    if (this.isServing) {
      logger.warn('Event pipe server already running');
      return;
    }

    this.shuttingDown = false;

    return new Promise((resolve) => {
      ipc.serve(() => {
        logger.info(`Event pipe server listening on: ${config.eventpipe.name}`);
        this.isServing = true;

        // Handle new client connections
        ipc.server.on('connect', (socket: any) => {
          const clientId = socket.id || 'unknown';
          this.connectedClients.add(clientId);
          logger.info(`Event pipe client connected: ${clientId} (total: ${this.connectedClients.size})`);

          // Send welcome message using raw buffer format
          const welcomeMessage = JSON.stringify({
            type: 'connected',
            timestamp: new Date().toISOString(),
            message: 'Connected to event pipe'
          });
          ipc.server.emit(socket, welcomeMessage + '!@#$%^!');
        });

        // Handle client disconnections
        ipc.server.on('socket.disconnected', (_socket: any, destroyedSocketId: string) => {
          this.connectedClients.delete(destroyedSocketId);
          logger.info(`Event pipe client disconnected: ${destroyedSocketId} (remaining: ${this.connectedClients.size})`);
        });

        // Handle errors
        ipc.server.on('error', (error: any) => {
          logger.error('Event pipe server error:', error);
        });

        resolve();
      });

      ipc.server.start();
    });
  }

  /**
   * Broadcast a single event to all connected clients
   */
  broadcast(event: GameEvent): void {
    if (!config.eventpipe.enabled || !this.isServing || this.shuttingDown) {
      return;
    }

    try {
      // Broadcast single event using raw buffer format
      const message = JSON.stringify(event) + '!@#$%^!';
      ipc.server.broadcast(message);
    } catch (error) {
      logger.error('Error broadcasting event:', error);
    }
  }

  /**
   * Broadcast a batch of events to all connected clients
   */
  broadcastBatch(events: GameEvent[]): void {
    if (!config.eventpipe.enabled || !this.isServing || this.shuttingDown || events.length === 0) {
      return;
    }

    try {
      // Send as a batch using the delimiter format (same as dll-connector)
      const batchData = events.map(event => JSON.stringify(event)).join('!@#$%^!');
      ipc.server.broadcast(batchData + '!@#$%^!');

      logger.debug(`Broadcast batch of ${events.length} events to ${this.connectedClients.size} clients`);
    } catch (error) {
      logger.error('Error broadcasting event batch:', error);
    }
  }

  /**
   * Stop the event pipe server
   */
  async stop(): Promise<void> {
    if (!this.isServing) {
      return;
    }

    logger.info('Shutting down event pipe server');
    this.shuttingDown = true;

    // Send goodbye message to all clients
    try {
      const goodbyeMessage = JSON.stringify({
        type: 'disconnecting',
        timestamp: new Date().toISOString(),
        message: 'Server shutting down'
      });
      ipc.server.broadcast(goodbyeMessage + '!@#$%^!');
    } catch (error) {
      logger.error('Error sending disconnect message:', error);
    }

    // Stop the IPC server
    ipc.server.stop();
    this.isServing = false;
    this.connectedClients.clear();

    logger.info('Event pipe server stopped');
  }

  /**
   * Get statistics about the event pipe
   */
  getStats(): { enabled: boolean; clients: number; pipeName: string } {
    return {
      enabled: config.eventpipe.enabled,
      clients: this.connectedClients.size,
      pipeName: config.eventpipe.name
    };
  }
}

// Export singleton instance
export const eventPipe = new EventPipe();