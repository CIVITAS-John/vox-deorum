/**
 * MCP Client wrapper for Vox Agents
 * Handles connection to MCP server and notification subscriptions
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { createLogger } from './logger.js';
import { config, VoxAgentsConfig } from './config.js';

const logger = createLogger('MCPClient');

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

  constructor(clientConfig: VoxAgentsConfig = config) {
    this.client = new Client(
      {
        name: clientConfig.agent.name,
        version: clientConfig.agent.version
      },
      {
        capabilities: {
          resources: {},
          tools: {},
          elicitation: {}
        }
      }
    );

    // Initialize transport based on config
    const transportConfig = clientConfig.mcpServer.transport;
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
      const url = new URL(`http://${transportConfig.host}:${transportConfig.port}`);
      this.transport = new StreamableHTTPClientTransport(url);
      logger.info('Created HTTP transport', { url: url.toString() });
    } else {
      throw new Error(`Unsupported transport type: ${transportConfig.type}`);
    }

    // Set up notification handlers
    this.setupNotificationHandlers();
  }

  /**
   * Set up handlers for server-side notifications
   */
  private setupNotificationHandlers(): void {
    // Handle elicitInput notifications from the server
    this.client.setRequestHandler('notifications/elicitInput' as any, async (request: any) => {
      logger.info('Received elicitInput notification', request);
      
      // Check if this is a game state update (PlayerID and Turn)
      const { PlayerID, Turn } = request.params || {};
      
      if (PlayerID !== undefined && Turn !== undefined) {
        const data: GameStateNotification = { PlayerID, Turn };
        
        // Trigger game state update handler
        const handler = this.notificationHandlers.get('notification');
        if (handler) handler(data);
        
        // Respond with empty response as nothing is actually elicited
        // The notification is just used as a trigger mechanism
        return {};
      }
      
      // Handle general elicitInput requests
      const elicitHandler = this.notificationHandlers.get('elicitInput');
      if (elicitHandler) {
        const result = await elicitHandler(request.params);
        return result || {};
      }
      
      logger.warn('elicitInput notification not handled', request);
      return {};
    });

    // Handle other notification types
    this.client.setRequestHandler('notifications/resources/list_changed' as any, async (request: any) => {
      logger.info('Resources list changed', request);
      const handler = this.notificationHandlers.get('resourcesChanged');
      if (handler) {
        handler(request.params);
      }
      return {};
    });

    this.client.setRequestHandler('notifications/tools/list_changed' as any, async (request: any) => {
      logger.info('Tools list changed', request);
      const handler = this.notificationHandlers.get('toolsChanged');
      if (handler) {
        handler(request.params);
      }
      return {};
    });
  }

  /**
   * Connect to the MCP server
   */
  async connect(): Promise<void> {
    if (this.isConnected) {
      logger.warn('Already connected to MCP server');
      return;
    }

    try {
      logger.info('Connecting to MCP server...');
      await this.client.connect(this.transport);
      this.isConnected = true;
      logger.info('Successfully connected to MCP server');
      
      // List available resources and tools
      const [resources, tools] = await Promise.all([
        this.client.listResources(),
        this.client.listTools()
      ]);
      
      logger.info('Available resources:', resources);
      logger.info('Available tools:', tools);
    } catch (error) {
      logger.error('Failed to connect to MCP server:', error);
      throw error;
    }
  }

  /**
   * Disconnect from the MCP server
   */
  async disconnect(): Promise<void> {
    if (!this.isConnected) {
      logger.warn('Not connected to MCP server');
      return;
    }

    try {
      logger.info('Disconnecting from MCP server...');
      await this.client.close();
      this.isConnected = false;
      logger.info('Disconnected from MCP server');
    } catch (error) {
      logger.error('Error disconnecting from MCP server:', error);
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

  /**
   * Register a handler for resource changes
   */
  onResourcesChanged(handler: (data: any) => void): void {
    this.notificationHandlers.set('resourcesChanged', handler);
    logger.info('Registered resources changed handler');
  }

  /**
   * Register a handler for tool changes
   */
  onToolsChanged(handler: (data: any) => void): void {
    this.notificationHandlers.set('toolsChanged', handler);
    logger.info('Registered tools changed handler');
  }

  /**
   * Get a resource from the MCP server
   */
  async getResource(uri: string): Promise<any> {
    if (!this.isConnected) {
      throw new Error('Not connected to MCP server');
    }

    try {
      const result = await this.client.readResource({ uri });
      return result;
    } catch (error) {
      logger.error(`Failed to get resource ${uri}:`, error);
      throw error;
    }
  }

  /**
   * Call a tool on the MCP server
   */
  async callTool(name: string, args: any = {}): Promise<any> {
    if (!this.isConnected) {
      throw new Error('Not connected to MCP server');
    }

    try {
      const result = await this.client.callTool({ name, arguments: args });
      return result;
    } catch (error) {
      logger.error(`Failed to call tool ${name}:`, error);
      throw error;
    }
  }

  /**
   * List available resources
   */
  async listResources(): Promise<any> {
    if (!this.isConnected) {
      throw new Error('Not connected to MCP server');
    }

    try {
      const resources = await this.client.listResources();
      return resources;
    } catch (error) {
      logger.error('Failed to list resources:', error);
      throw error;
    }
  }

  /**
   * List available tools
   */
  async listTools(): Promise<any> {
    if (!this.isConnected) {
      throw new Error('Not connected to MCP server');
    }

    try {
      const tools = await this.client.listTools();
      return tools;
    } catch (error) {
      logger.error('Failed to list tools:', error);
      throw error;
    }
  }

  /**
   * Check if client is connected
   */
  get connected(): boolean {
    return this.isConnected;
  }
}

/**
 * Create and export a singleton instance
 */
export const mcpClient = new MCPClient(config);

export default MCPClient;