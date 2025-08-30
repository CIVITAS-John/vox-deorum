/**
 * Main MCP server implementation with registration system
 * Singleton instance that manages resources and tools with self-registration
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { createLogger } from './utils/logger.js';
import { config } from './utils/config.js';
import { ToolBase } from './tools/base.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { getAllTools } from './tools/index.js';

const logger = createLogger('Server');

/**
 * MCP Server manager that handles resource and tool registration
 */
export class MCPServer extends Server {
  private static instance: MCPServer;
  private initialized = false;
  private tools = new Map<string, ToolBase>();

  /**
   * Private constructor for MCPServer
   */
  private constructor() {
    super({
      name: config.server.name,
      version: config.server.version,
    }, {
      capabilities: {
        tools: {},
      }
    });
    
    this.setupHandlers();
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
  public registerTool(tool: ToolBase): void {
    if (this.tools.has(tool.name)) {
      logger.warn(`Tool ${tool.name} already registered, replacing`);
    }
    this.tools.set(tool.name, tool);
    logger.info(`Registered tool: ${tool.name}`);
  }

  /**
   * Get a registered tool by name
   */
  public getTool(name: string): ToolBase | undefined {
    return this.tools.get(name);
  }

  /**
   * Get all registered tools
   */
  public getAllTools(): ToolBase[] {
    return Array.from(this.tools.values());
  }

  /**
   * Setup MCP protocol handlers
   */
  private setupHandlers(): void {
    // Handle tools/list request
    this.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools = this.getAllTools().map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
        outputSchema: tool.outputSchema,
        annotations: tool.annotations,
      }));
      
      return { tools };
    });

    // Handle tools/call request
    this.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      const tool = this.getTool(name);
      if (!tool) {
        throw new Error(`Tool not found: ${name}`);
      }
      
      try {
        const results = await tool.execute(args || {});
        return {
          contents: results,
        };
      } catch (error) {
        logger.error(`Error executing tool ${name}:`, error);
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error: ${(error as Error).message}`,
            }
          ]
        }
      }
    });
  }

  /**
   * Initialize the server (can be extended in the future)
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    logger.info('Initializing MCP server');
    // Register all tools
    getAllTools().forEach(tool => this.registerTool(tool));
    
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