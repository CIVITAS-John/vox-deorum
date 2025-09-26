/**
 * MCP Client wrapper for Vox Agents
 * Handles connection to MCP server and notification subscriptions
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { Tool, NotificationSchema } from '@modelcontextprotocol/sdk/types.js';
import { createLogger } from '../logger.js';
import { config } from '../config.js';
import { Dispatcher, fetch, Pool, RetryAgent } from 'undici';
import { URL } from 'node:url';
import { setTimeout } from 'node:timers/promises';
import { z } from 'zod';

const logger = createLogger('MCPClient');

/**
 * Schema for Vox Deorum game event notifications
 */
const GameEventNotificationSchema = NotificationSchema.extend({
  method: z.literal("vox-deorum/game-event"),
  params: z.object({
    event: z.string(),
    playerID: z.number(),
    turn: z.number(),
    latestID: z.number(),
    gameID: z.string().optional(),
  }).passthrough()
});

/**
 * Notification data for game state changes
 */
export interface GameStateNotification {
  PlayerID: number;
  Turn: number;
}

/**
 * MCP Client wrapper with notification support
 */
export class MCPClient {
  private client: Client;
  private transport: StdioClientTransport | StreamableHTTPClientTransport;
  private isConnected: boolean = false;
  private notificationHandlers: Map<string, (data: any) => any> = new Map();
  private dispatcher?: Dispatcher;

  constructor() {
    this.client = undefined as any;
    this.transport = undefined as any;
    this.initializeClient();
  }

  /**
   * Initialize client based on config
   */
  private initializeClient() {
    this.client = new Client(
      {
        name: config.agent.name,
        version: config.agent.version
      },
      {
        capabilities: {
          tools: {},
          elicitation: {}
        }
      }
    );

    const transportConfig = config.mcpServer.transport;
    if (transportConfig.type === 'stdio') {
      if (!transportConfig.command) {
        throw new Error('Command is required for stdio transport');
      }
      this.transport = new StdioClientTransport({
        command: transportConfig.command,
        args: transportConfig.args || []
      });
      logger.info('Created stdio transport', { 
        command: transportConfig.command, 
        args: transportConfig.args 
      });
    } else if (transportConfig.type === 'http') {
      this.dispatcher = new RetryAgent(
        new Pool(new URL(transportConfig.endpoint!).origin, { connections: 5 }),
        {
          // Retry configuration for connection failures
          maxRetries: 1000,          // More retries for initial connection
          minTimeout: 200,        // Start with 0.1 second delay
          maxTimeout: 2000,       // Cap at 1 seconds
          timeoutFactor: 2,      // Gentler backoff (1s, 1.5s, 2.25s, 3.37s, ...)
          retryAfter: true,        // Respect Retry-After headers
          // Include connection errors and server unavailable statuses
          errorCodes: [
            'ECONNRESET',
            'ECONNREFUSED',      // Connection refused - server not yet running
            'ENOTFOUND',
            'ENETDOWN',
            'ENETUNREACH',
            'EHOSTDOWN',
            'EHOSTUNREACH',
            'EPIPE',
            'ETIMEDOUT'          // Add timeout errors
          ],
          statusCodes: [500, 502, 503, 504, 429],  // Standard retry status codes
          methods: ['GET', 'POST', 'HEAD', 'OPTIONS', 'PUT', 'DELETE', 'TRACE']  // Include POST
        }
      );
      // Global pooling for HTTP requests
      const mcpUrl = new URL(transportConfig.endpoint!);
      this.transport = new StreamableHTTPClientTransport(mcpUrl, {
        reconnectionOptions: {
          maxReconnectionDelay: 2000,
          initialReconnectionDelay: 200,
          reconnectionDelayGrowFactor: 2,
          maxRetries: 1000
        },
        fetch: (url, init) => {
          init = init ?? {};
          init.dispatcher = this.dispatcher;
          return fetch(url, init);
        }
      });
      logger.info('Created HTTP transport', { url: mcpUrl.toString() });
    } else {
      throw new Error(`Unsupported transport type: ${transportConfig.type}`);
    }
    
    // Set up error handlers for transports
    this.setupErrorHandlers();

    // Set up notification handlers
    this.setupNotificationHandlers();
  }

  /**
   * Set up error handlers for transport layer
   */
  private setupErrorHandlers(): void {
    this.transport.onerror = async (error: Error) => {
      if (error.message.indexOf("Bad Request")) {
        if (this.isConnected) {
          logger.warn('MCP server has restarted. Reconnecting...');
          await this.disconnect();
          await this.connect();
        }
      } else {
        logger.error('Transport error occurred:', error);
      }
    };
  }

  /**
   * Set up handlers for server-side notifications
   */
  private setupNotificationHandlers(): void {
    // Handle vox-deorum/game-event notifications from the server
    this.client.setNotificationHandler(GameEventNotificationSchema, async (notification) => {
      if (notification.method != "vox-deorum/game-event") return;
      logger.debug('Received game event notification', notification);

      const params = notification.params;
      const { event, playerID, turn } = params;

      // Trigger the appropriate handler based on event type
      if (event && playerID !== undefined && turn !== undefined) {
        const handler = this.notificationHandlers.get('notification');
        if (handler) {
          await handler({
            ...params,
            PlayerID: playerID,  // Keep backward compatibility with capitalized field name
            Turn: turn
          });
        }
      }
    });
  }

  /**
   * Connect to the MCP server
   */
  async connect(): Promise<void> {
    if (this.isConnected) return;
    try {
      logger.info('Connecting to MCP server...');
      await this.client.connect(this.transport);
      this.isConnected = true;
      logger.info('Successfully connected to MCP server');
    } catch (error) {
      logger.error('Failed to connect to MCP server:', error);
      throw error;
    }
  }
  /**
   * Disconnect from the MCP server
   */
  async disconnect(): Promise<void> {
    if (!this.isConnected) return;
    try {
      logger.info('Disconnecting from MCP server...');
      this.isConnected = false;
      await this.client.close();
      await this.initializeClient();
      logger.info('Disconnected from MCP server');
    } catch (error) {
      logger.error('Error disconnecting from MCP server:', error);
      throw error;
    }
  }
  /**
   * Check if client is connected
   */
  get connected(): boolean {
    return this.isConnected;
  }

  /**
   * Register a handler for server-side notification (PlayerID/Turn notifications)
   */
  onNotification(handler: (data: GameStateNotification) => void): void {
    this.notificationHandlers.set('notification', handler);
    logger.info('Registered game state update handler');
  }

  /**
   * Call a tool on the MCP server
   */
  async callTool(name: string, args: any = {}): Promise<any> {
    if (!this.isConnected) {
      throw new Error('Not connected to MCP server');
    }

    for (var I = 0; I <= 3; I++) {
      try {
        // Out potato servers can be *really* slow
        const result = await this.client.callTool({ name, arguments: args }, undefined, {
          timeout: 30000,
          resetTimeoutOnProgress: true
        });
        return result;
      } catch (error) {
        if (I === 3 || (error as any).message?.indexOf("Invalid arguments"))
          throw error;
        else logger.error(`Failed to call tool ${name}. Retrying ${I}...`, error);
        // Wait until reconnected
        while (!this.isConnected) {
          await setTimeout(100);
        }
      }
    }
  }

  private cachedTools?: Tool[] = undefined;
  /**
   * List available tools
   */
  async getTools(): Promise<Tool[]> {
    // Get all tools
    if (!this.cachedTools)
      this.cachedTools = (await this.client.listTools()).tools;
    return this.cachedTools;
  }
}

/**
 * Create and export a singleton instance
 */
export const mcpClient = new MCPClient();