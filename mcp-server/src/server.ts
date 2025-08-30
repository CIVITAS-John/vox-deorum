/**
 * Main MCP server implementation with registration system
 * Singleton instance that manages resources and tools with self-registration
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { ResourceBase } from './resources/base.js';
import { ToolBase } from './tools/base.js';
import { logger } from './utils/logger.js';
import { config } from './utils/config.js';
import { registerAllResources } from './resources/index.js';
import { registerAllTools } from './tools/index.js';

/**
 * MCP Server manager that handles resource and tool registration
 */
export class MCPServer {
  private static instance: MCPServer;
  private server: Server;
  private resources: Map<string, ResourceBase> = new Map();
  private tools: Map<string, ToolBase> = new Map();
  private initialized = false;

  private constructor() {
    this.server = new Server(
      {
        name: config.server.name,
        version: config.server.version,
      },
      {
        capabilities: {
          resources: {},
          tools: {},
        },
      }
    );

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
   * Get the underlying SDK server instance
   */
  public getServer(): Server {
    return this.server;
  }

  /**
   * Setup MCP protocol handlers
   */
  private setupHandlers(): void {
    // Handle resource list requests
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      const resources = Array.from(this.resources.values()).map(r => {
        const metadata = r.getMetadata();
        return {
          uri: metadata.uri,
          name: metadata.name,
          description: metadata.description,
          mimeType: metadata.mimeType,
        };
      });

      logger.debug(`Listing ${resources.length} resources`);
      return { resources };
    });

    // Handle resource read requests
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;
      const resource = this.resources.get(uri);

      if (!resource) {
        throw new Error(`Resource not found: ${uri}`);
      }

      logger.debug(`Reading resource: ${uri}`);
      const content = await resource.read();
      
      return {
        contents: [
          {
            uri,
            mimeType: resource.getMetadata().mimeType || 'application/json',
            text: typeof content === 'string' ? content : JSON.stringify(content, null, 2),
          },
        ],
      };
    });

    // Handle tool list requests
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools = Array.from(this.tools.values()).map(t => {
        const metadata = t.getMetadata();
        return {
          name: metadata.name,
          description: metadata.description,
          inputSchema: metadata.inputSchema,
        };
      });

      logger.debug(`Listing ${tools.length} tools`);
      return { tools };
    });

    // Handle tool execution requests
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      const tool = this.tools.get(name);

      if (!tool) {
        throw new Error(`Tool not found: ${name}`);
      }

      logger.debug(`Executing tool: ${name}`);
      const result = await tool.run(args);

      return {
        content: [
          {
            type: 'text',
            text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
          },
        ],
      };
    });
  }

  /**
   * Register a resource with the server
   */
  public registerResource(resource: ResourceBase): void {
    const metadata = resource.getMetadata();
    
    if (this.resources.has(metadata.uri)) {
      logger.warn(`Resource already registered: ${metadata.uri}`);
      return;
    }

    this.resources.set(metadata.uri, resource);
    resource.register(this.server);
    logger.info(`Registered resource: ${metadata.uri}`);
  }

  /**
   * Register a tool with the server
   */
  public registerTool(tool: ToolBase): void {
    const metadata = tool.getMetadata();
    
    if (this.tools.has(metadata.name)) {
      logger.warn(`Tool already registered: ${metadata.name}`);
      return;
    }

    this.tools.set(metadata.name, tool);
    tool.register(this.server);
    logger.info(`Registered tool: ${metadata.name}`);
  }

  /**
   * Unregister a resource
   */
  public unregisterResource(uri: string): void {
    if (this.resources.delete(uri)) {
      logger.info(`Unregistered resource: ${uri}`);
    }
  }

  /**
   * Unregister a tool
   */
  public unregisterTool(name: string): void {
    if (this.tools.delete(name)) {
      logger.info(`Unregistered tool: ${name}`);
    }
  }

  /**
   * Get all registered resources
   */
  public getResources(): ResourceBase[] {
    return Array.from(this.resources.values());
  }

  /**
   * Get all registered tools
   */
  public getTools(): ToolBase[] {
    return Array.from(this.tools.values());
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
    registerAllResources();
    registerAllTools();
    
    this.initialized = true;
  }

  /**
   * Shutdown the server
   */
  public async shutdown(): Promise<void> {
    logger.info('Shutting down MCP server');
    this.resources.clear();
    this.tools.clear();
    this.initialized = false;
  }
}