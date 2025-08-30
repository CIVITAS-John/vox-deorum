/**
 * Stdio transport entry point for MCP server
 * Default mode for direct client connections via standard input/output
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { MCPServer } from './server.js';
import { createLogger } from './utils/logger.js';

const logger = createLogger('stdio');

/**
 * Start the MCP server with stdio transport
 * @param setupSignalHandlers - Whether to set up SIGINT/SIGTERM handlers (default: true)
 * @returns The transport instance for testing purposes
 */
export async function startStdioServer(setupSignalHandlers = true): Promise<() => Promise<void>> {
  const server = MCPServer.getInstance();
  const transport = new StdioServerTransport();

  // Set up graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down stdio server gracefully');
    await server.close();
    await transport.close();
  };

  if (setupSignalHandlers) {
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  }

  try {
    await server.initialize();
    // Connect the server to the transport
    await server.connect(transport);
    
    logger.info('MCP server connected via stdio transport');
    return shutdown;
  } catch (error) {
    logger.error('Failed to start stdio server:', error);
    if (setupSignalHandlers)
      process.exit(1);
    throw error;
  }
}