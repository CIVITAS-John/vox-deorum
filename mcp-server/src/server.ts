/**
 * MCP Server for Vox Deorum
 * Exposes Civilization V game state as MCP resources and tools for AI agents
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { logger } from './utils/logger.js';

/**
 * VoxDeorumMCPServer - Main MCP server implementation
 * Provides foundation for exposing game state and AI tools through MCP protocol
 */
export class VoxDeorumMCPServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'vox-deorum-mcp-server',
        version: '1.0.0',
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
   * Set up MCP protocol request handlers
   */
  private setupHandlers(): void {
    // Resource handlers
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      logger.debug('Handling ListResources request');
      return {
        resources: [
          {
            uri: 'vox-deorum://game-state',
            name: 'Game State',
            description: 'Current Civilization V game state information',
            mimeType: 'application/json',
          },
        ],
      };
    });

    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;
      logger.debug('Handling ReadResource request', { uri });

      if (uri === 'vox-deorum://game-state') {
        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify({
                status: 'hello-world',
                message: 'MCP Server is running',
                timestamp: new Date().toISOString(),
              }),
            },
          ],
        };
      }

      throw new Error(`Resource not found: ${uri}`);
    });

    // Tool handlers
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      logger.debug('Handling ListTools request');
      return {
        tools: [
          {
            name: 'ping',
            description: 'Simple ping tool to test MCP server connectivity',
            inputSchema: {
              type: 'object',
              properties: {
                message: {
                  type: 'string',
                  description: 'Message to echo back',
                },
              },
            },
          },
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      logger.debug('Handling CallTool request', { name, args });

      if (name === 'ping') {
        const message = (args as { message?: string })?.message || 'Hello from MCP Server!';
        return {
          content: [
            {
              type: 'text',
              text: `Pong: ${message}`,
            },
          ],
        };
      }

      throw new Error(`Tool not found: ${name}`);
    });
  }

  /**
   * Start the MCP server with stdio transport
   */
  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    
    logger.info('Starting Vox Deorum MCP Server');
    
    try {
      await this.server.connect(transport);
      logger.info('MCP Server connected and ready');
    } catch (error) {
      logger.error('Failed to start MCP Server', { error });
      throw error;
    }
  }

  /**
   * Stop the MCP server
   */
  async stop(): Promise<void> {
    logger.info('Stopping MCP Server');
    await this.server.close();
  }
}