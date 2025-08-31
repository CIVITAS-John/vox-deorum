/**
 * Main MCP server implementation with registration system
 * Singleton instance that manages resources and tools with self-registration
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createLogger } from './utils/logger.js';
import { config } from './utils/config.js';
import { wrapResults } from './utils/mcp.js';
import { ToolBase } from './tools/base.js';
import { allTools } from './tools/index.js';
import { BridgeManager } from './bridge/bridge-manager.js';
import * as z from "zod";

const logger = createLogger('Server');

/**
 * MCP Server manager that handles resource and tool registration
 */
export class MCPServer {
  private static instance: MCPServer;
  private server: McpServer;
  private initialized = false;
  private tools = new Map<string, ToolBase>();
  private bridgeManager: BridgeManager;

  /**
   * Private constructor for MCPServer
   */
  private constructor() {
    this.server = new McpServer({
      name: config.server.name,
      version: config.server.version,
    }, {
      capabilities: {
        
      }
    });
    
    // Initialize BridgeManager
    this.bridgeManager = new BridgeManager(config.bridge?.url);
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
   * Get the underlying McpServer instance
   */
  public getServer(): McpServer {
    return this.server;
  }

  /**
   * Register a tool with the server
   */
  public registerTool(tool: ToolBase): void {
    if (this.tools.has(tool.name)) {
      logger.warn(`Tool ${tool.name} already registered, replacing`);
    }
    this.tools.set(tool.name, tool);
    // Register tool with McpServer using a generic handler
    // Since we can't directly pass ZodTypeAny as ZodRawShape, we'll use a generic approach
    tool.registered = this.server.registerTool(
      tool.name,
      {
        title: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema.shape,
        outputSchema: (tool.outputSchema as any).shape,
        annotations: tool.annotations,
      },
      (async (args: z.infer<typeof tool.inputSchema>) => {
        try {
          const results = await tool.execute(args);
          // If tool already returns CallToolResult, use it directly
          if (results && typeof results === 'object' && 'content' in results) {
            return results;
          }
          // Otherwise wrap for backward compatibility
          return wrapResults(results);
        } catch (error: any) {
          var message = `Error executing tool ${tool.name}: ${error?.message ?? "unknown"}`;
          logger.error(message, error);
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: message,
              }
            ]
          }
        }
      }) as any
    );
    tool.server = this;
    
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
   * Get the BridgeManager instance
   */
  public getBridgeManager(): BridgeManager {
    return this.bridgeManager;
  }

  /**
   * Initialize the server (can be extended in the future)
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    logger.info('Initializing MCP server');
    
    // Check Bridge Service health
    try {
      const health = await this.bridgeManager.checkHealth();
      logger.info('Bridge Service health:', health);
      
      // Connect to SSE stream for game events
      this.bridgeManager.connectSSE();
      
      // Set up event listeners
      this.bridgeManager.on('connected', () => {
        logger.info('Connected to Bridge Service SSE stream');
      });
      
      this.bridgeManager.on('disconnected', () => {
        logger.warn('Disconnected from Bridge Service SSE stream');
      });
      
      this.bridgeManager.on('gameEvent', (event) => {
        logger.debug('Received game event:', event);
        // TODO: Process game events in Stage 3
      });
    } catch (error: any) {
      throw new Error('Failed to connect to Bridge Service: ' + (error.message ?? "unknown error"), error);
    }
    
    // Register all tools
    allTools.forEach(tool => this.registerTool(tool));
    
    this.initialized = true;
  }

  /**
   * Connect the server to a transport
   */
  public async connect(transport: any): Promise<void> {
    await this.server.connect(transport);
  }

  /**
   * Shutdown the server
   */
  public async close(): Promise<void> {
    logger.info('Shutting down MCP server');
    
    // Shutdown BridgeManager
    this.bridgeManager.shutdown();
    
    // McpServer doesn't have a close method, but we can reset our state
    this.initialized = false;
  }
}