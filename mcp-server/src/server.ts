/**
 * Main MCP server implementation with registration system
 * Singleton instance that manages resources and tools with self-registration
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createLogger } from './utils/logger.js';
import { config } from './utils/config.js';
import * as tools from './tools/index.js';

const logger = createLogger('Server');

/**
 * MCP Server manager that handles resource and tool registration
 */
export class MCPServer extends McpServer {
  private static instance: MCPServer;
  private initialized = false;

  /**
   * Private constructor for MCPServer
   */
  private constructor() {
    super({
      name: config.server.name,
      version: config.server.version,
    });
  }

  /**
   * Get singleton instance of MCP server
   */
  public static getInstance(): MCPServer {
    if (!MCPServer.instance) {
      MCPServer.instance = new MCPServer();
    }
    return MCPServer.instance;
  }

  /**
   * Initialize the server (can be extended in the future)
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    logger.info('Initializing MCP server');
    // Register all resources and tools
    tools.registerAllTools(this);
    this.initialized = true;
  }

  /**
   * Shutdown the server
   */
  public async close(): Promise<void> {
    logger.info('Shutting down MCP server');
    await super.close();
    this.initialized = false;
  }
}