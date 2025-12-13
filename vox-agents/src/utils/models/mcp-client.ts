/**
 * @module utils/models/mcp-client
 *
 * MCP Client wrapper for Vox Agents.
 * Provides a high-level interface for connecting to the MCP server via stdio or HTTP transport,
 * handling game event notifications, and calling MCP tools with retry logic.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { Tool, NotificationSchema } from '@modelcontextprotocol/sdk/types.js';
import { createLogger } from '../logger.js';
import { config, loadVersionInfo } from '../config.js';
import { Dispatcher, fetch, Pool, RetryAgent } from 'undici';
import { URL } from 'node:url';
import { setTimeout } from 'node:timers/promises';
import { z } from 'zod';
import { EventEmitter } from 'node:events';

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
 * MCP Client wrapper with notification support.
 * Manages connection to MCP server and provides event-driven access to game state changes.
 * Implements automatic reconnection and retry logic for resilient communication.
 *
 * @class
 * @extends EventEmitter
 *
 * @example
 * ```typescript
 * import { mcpClient } from './utils/models/mcp-client.js';
 *
 * await mcpClient.connect();
 * mcpClient.onNotification((data) => {
 *   console.log(`Turn ${data.Turn} for Player ${data.PlayerID}`);
 * });
 *
 * const tools = await mcpClient.getTools();
 * const result = await mcpClient.callTool('get-players', {});
 * ```
 */
export class MCPClient extends EventEmitter {
  private client: Client;
  private transport: StdioClientTransport | StreamableHTTPClientTransport;
  private isConnected: boolean = false;
  private dispatcher?: Dispatcher;
  private connectionPool: Pool | undefined;

  constructor() {
    super();
    this.client = undefined as any;
    this.transport = undefined as any;
    this.initializeClient();
  }

  /**
   * Initialize client based on config.
   * Creates transport (stdio or HTTP) and sets up the MCP client with capabilities.
   *
   * @private
   */
  private initializeClient() {
    this.client = new Client(
      {
        name: config.agent.name,
        version: loadVersionInfo()?.version ?? "unknown"
      },
      {
        capabilities: {
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
      if (this.connectionPool) this.connectionPool.close();
      this.connectionPool = new Pool(new URL(transportConfig.endpoint!).origin, { connections: 50 });
      this.dispatcher = new RetryAgent(
        this.connectionPool,
        {
          // Retry configuration for connection failures
          maxRetries: 1000000,          // More retries for initial connection
          minTimeout: 200,        // Start with 0.2 second delay
          maxTimeout: 2000,       // Cap at 2 seconds
          timeoutFactor: 2,       // Exponential backoff factor
          retryAfter: true,        // Respect Retry-After headers
          // Include connection errors and server unavailable statuses
          errorCodes: [
            'ECONNRESET',
            'ECONNREFUSED',
            'ENOTFOUND',
            'ENETDOWN',
            'ENETUNREACH',
            'EHOSTDOWN',
            'EHOSTUNREACH',
            'EPIPE',
            'ETIMEDOUT'
          ],
          statusCodes: [500, 502, 503, 504, 429],  // Standard retry status codes
          methods: ['GET', 'POST', 'HEAD', 'OPTIONS', 'PUT', 'DELETE', 'TRACE']  // Include POST
        }
      );
      // Global pooling for HTTP requests
      const mcpUrl = new URL(transportConfig.endpoint!);
      this.transport = new StreamableHTTPClientTransport(mcpUrl, {
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
   * Set up error handlers for transport layer.
   * Handles server restart scenarios by reconnecting automatically.
   *
   * @private
   */
  private setupErrorHandlers(): void {
    this.transport.onerror = async (error: Error) => {
      if (error.message.indexOf("Bad Request") !== -1) {
        if (this.isConnected) {
          logger.warn('MCP server has restarted. Reconnecting...', error);
          await this.disconnect();
          await this.connect();
        }
      } else {
        throw error;
      }
    };
  }

  /**
   * Set up handlers for server-side notifications.
   * Listens for vox-deorum/game-event notifications and emits them as events.
   *
   * @private
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
        this.emit('notification', {
          ...params,
          PlayerID: playerID,  // Keep backward compatibility with capitalized field name
          Turn: turn
        });
      }
    });
  }

  /**
   * Connect to the MCP server.
   * Uses configured transport (stdio or HTTP) with retry logic.
   *
   * @throws Error if connection fails after retries
   */
  async connect(): Promise<void> {
    if (this.isConnected) return;
    try {
      logger.info('Connecting to MCP server...');
      await this.client.connect(this.transport, {
        timeout: 3600000 // 60 minutes retry to MCP server
      });
      this.isConnected = true;
      logger.info('Successfully connected to MCP server');
    } catch (error) {
      logger.error('Failed to connect to MCP server:', error);
      throw error;
    }
  }
  /**
   * Disconnect from the MCP server.
   * Closes the connection and reinitializes the client for future connections.
   *
   * @throws Error if disconnection fails
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
   * Check if client is connected to the MCP server.
   *
   * @returns True if connected, false otherwise
   */
  get connected(): boolean {
    return this.isConnected;
  }

  /**
   * Register a handler for server-side notification (PlayerID/Turn notifications).
   * Handler will be called whenever a game event notification is received.
   *
   * @param handler - Callback function to handle game state notifications
   */
  onNotification(handler: (data: GameStateNotification) => void): void {
    this.on('notification', handler);
    logger.info('Registered game state update handler');
  }

  /**
   * Register a handler for tool errors.
   * Handler will be called when tool execution fails.
   *
   * @param handler - Callback function to handle tool errors
   */
  onToolError(handler: (error: { toolName: string, error: any }) => void): void {
    this.on('toolError', handler);
    logger.info('Registered tool error handler');
  }

  /**
   * Call a tool on the MCP server.
   * Implements retry logic (up to 3 attempts) for transient failures.
   *
   * @param name - Tool name to execute
   * @param args - Arguments to pass to the tool
   * @returns Tool execution result
   * @throws Error if the tool call fails after retries or if arguments are invalid
   */
  async callTool(name: string, args: any = {}): Promise<any> {
    if (!this.isConnected) {
      throw new Error('Not connected to MCP server');
    }

    for (var I = 0; I <= 3; I++) {
      try {
        // Out potato servers can be *really* slow
        const result = await this.client.callTool({ name, arguments: args }, undefined, {
          timeout: 60000,
          resetTimeoutOnProgress: true
        });
        return result;
      } catch (error) {
        if ((error as any).message?.indexOf("Invalid arguments") !== -1) {
          throw error;
        } else if (I === 3) {
          this.emit('toolError', { toolName: name, error });
          throw error;
        } else logger.error(`Failed to call tool ${name}. Retrying ${I}...`, error);
        // Wait until reconnected
        while (!this.isConnected) {
          await setTimeout(100);
        }
      }
    }
  }

  private cachedTools?: Tool[] = undefined;
  /**
   * List available tools from the MCP server.
   * Results are cached after the first call for performance.
   *
   * @returns Array of available MCP tools
   */
  async getTools(): Promise<Tool[]> {
    // Get all tools
    if (!this.cachedTools)
      this.cachedTools = (await this.client.listTools()).tools;
    return this.cachedTools;
  }
}

/**
 * Singleton MCP client instance.
 * This is the primary interface for interacting with the MCP server.
 *
 * @example
 * ```typescript
 * import { mcpClient } from './utils/models/mcp-client.js';
 * await mcpClient.connect();
 * ```
 */
export const mcpClient = new MCPClient();