/**
 * Vox Client wrapper for Vox Agents
 * Wraps Mastra's MCPClient to handle MCP server connections and notifications
 */

import { MCPClient, type MastraMCPServerDefinition } from '@mastra/mcp';
import { createLogger } from './logger.js';
import { config, VoxAgentsConfig } from './config.js';

const logger = createLogger('VoxClient');

/**
 * Notification data for game state changes
 */
export interface GameStateNotification {
  PlayerID: number;
  Turn: number;
}

/**
 * Vox Client that extends Mastra's MCPClient for game-specific functionality
 */
export class VoxClient {
  private mcpClient: MCPClient;
  private notificationHandlers: Map<string, (data: any) => any> = new Map();

  constructor(private clientConfig: VoxAgentsConfig = config) {
    const transportConfig = this.clientConfig.mcpServer.transport;
    const serverConfig: Record<string, MastraMCPServerDefinition> = {};

    if (transportConfig.type === 'stdio') {
      if (!transportConfig.command) {
        throw new Error('Command is required for stdio transport');
      }
      // For stdio transport, use command and args
      serverConfig.mcpServer = {
        command: transportConfig.command,
        args: transportConfig.args || []
      };
      logger.info('Configuring stdio transport', { 
        command: transportConfig.command, 
        args: transportConfig.args 
      });
    } else if (transportConfig.type === 'http') {
      // For HTTP transport, use URL
      serverConfig.mcpServer = {
        url: new URL(transportConfig.endpoint!)
      };
      logger.info('Configuring HTTP transport', { url: transportConfig.endpoint });
    } else {
      throw new Error(`Unsupported transport type: ${transportConfig.type}`);
    }

    // Create MCPClient with server configuration
    this.mcpClient = new MCPClient({
      servers: serverConfig
    });

    // Set up event handlers immediately
    this.setupEventHandlers();
  }

  /**
   * Get the underlying MCPClient instance
   */
  getMCPClient(): MCPClient {
    return this.mcpClient;
  }

  /**
   * Explicitly connect to the MCP server and request the tool list
   * This is a simple connect function that doesn't maintain connection status
   */
  async connect(): Promise<boolean> {
    logger.info('Connecting to MCP server and requesting tools...');
    const tools = await this.mcpClient.getTools();
    return tools && Object.keys(tools).length > 0;
  }

  /**
   * Disconnect from the MCP server
   */
  async disconnect(): Promise<void> {
    logger.info('Disconnecting from MCP server...');
    await this.mcpClient.disconnect();
  }

  /**
   * Set up event handlers on the MCPClient
   */
  private async setupEventHandlers(): Promise<void> {
    try {
      // Set up elicitation handler for input requests from the server
      await this.mcpClient.elicitation.onRequest('mcpServer', async (request) => {
        logger.debug('Received elicitation request', request);
        
        // Check if this is a game state notification
        if (request.prompt === 'game-state-update') {
          const handler = this.notificationHandlers.get('notification');
          if (handler) {
            handler(request.params);
          }
        } else {
          // Handle general elicitInput requests
          const handler = this.notificationHandlers.get('elicitInput');
          if (handler) {
            return await handler(request);
          }
        }
        
        return { content: 'No handler registered' };
      });

      logger.info('Event handlers set up successfully');
    } catch (error) {
      logger.error('Failed to set up event handlers', error);
      // Don't throw here, as this is called in the constructor
      // The handlers will be set up when methods are called
    }
  }

  /**
   * Get available tools from the MCP server
   */
  async getTools(): Promise<Record<string, any>> {
    try {
      return await this.mcpClient.getTools();
    } catch (error) {
      logger.error('Failed to get tools', error);
      throw error;
    }
  }

  /**
   * Get available resources from the MCP server
   */
  async getResources(): Promise<Record<string, any>> {
    try {
      return await this.mcpClient.resources.list();
    } catch (error) {
      logger.error('Failed to get resources', error);
      throw error;
    }
  }

  /**
   * Register a handler for server-side notification (PlayerID/Turn notifications)
   */
  onNotification(handler: (data: GameStateNotification) => void): void {
    this.notificationHandlers.set('notification', handler);
    logger.info('Registered game state update handler');
  }

  /**
   * Register a handler for general elicitInput requests
   */
  onElicitInput(handler: (params: any) => Promise<any> | any): void {
    this.notificationHandlers.set('elicitInput', handler);
    logger.info('Registered elicitInput handler');
  }
}

/**
 * Create and export a singleton instance
 */
export const mcpClient = new VoxClient(config);
export default VoxClient;