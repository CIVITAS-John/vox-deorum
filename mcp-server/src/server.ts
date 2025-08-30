/**
 * Main MCP server implementation with registration system
 * Singleton instance that manages resources and tools with self-registration
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ToolBase } from './tools/base.js';
import { logger } from './utils/logger.js';
import { config } from './utils/config.js';
import { ZodRawShape } from 'zod';

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
   * Register a tool with the server
   */
  public addTool<InputSchema extends ZodRawShape, OutputSchema extends ZodRawShape>(tool: ToolBase<InputSchema, OutputSchema>): void {
    super.registerTool(tool.Name, {
      title: tool.Title,
      description: tool.Description,
      inputSchema: tool.InputSchema,
      outputSchema: tool.OutputSchema,
      annotations: tool.Annotations,
    }, tool.Execute);
    logger.info(`Registered tool: ${tool.Name}`);
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