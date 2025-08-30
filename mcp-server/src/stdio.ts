/**
 * Stdio transport entry point for MCP server
 * Default mode for direct client connections via standard input/output
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { MCPServer } from './server.js';
import { logger } from './utils/logger.js';

/**
 * Start the MCP server with stdio transport
 */
export async function startStdioServer(): Promise<void> {
  const server = MCPServer.getInstance();
  const transport = new StdioServerTransport();

  // Set up graceful shutdown
  process.on('SIGINT', async () => {
    logger.info('Received SIGINT, shutting down gracefully');
    await server.shutdown();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM, shutting down gracefully');
    await server.shutdown();
    process.exit(0);
  });

  try {
    await server.initialize();
    // Connect the server to the transport
    await server.getServer().connect(transport);
    
    logger.info('MCP server connected via stdio transport');
  } catch (error) {
    logger.error('Failed to start stdio server:', error);
    process.exit(1);
  }
}