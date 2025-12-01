/**
 * @module index
 * @description Main entry point for Vox Deorum MCP Server
 *
 * This module initializes and starts the MCP (Model Context Protocol) server with
 * the configured transport mechanism (stdio or HTTP). The transport type is determined
 * by the configuration loaded from environment variables or config files.
 *
 * @example
 * ```bash
 * # Start with stdio transport (default)
 * npm run dev
 *
 * # Start with HTTP transport
 * TRANSPORT_TYPE=http npm run dev
 * ```
 */

import { config } from './utils/config.js';
import { createLogger } from './utils/logger.js';
import { startStdioServer } from './stdio.js';
import { startHttpServer } from './http.js';

const logger = createLogger('index');

/**
 * Main function - Initialize and start the MCP server with selected transport
 *
 * Starts the MCP server using either stdio or HTTP transport based on configuration.
 * The server will expose game state tools and resources to MCP-compatible clients.
 *
 * @returns Promise that resolves when the server is started
 * @throws {Error} If an unknown transport type is configured
 */
async function main(): Promise<void> {
  logger.info(`Starting MCP server with ${config.transport.type} transport`);
  
  // Start server with appropriate transport
  switch (config.transport.type) {
    case 'stdio':
      await startStdioServer();
      break;
    case 'http':
      await startHttpServer();
      break;
    default:
      throw new Error(`Unknown transport type: ${config.transport.type}`);
  }
}

// Run the server
main().catch((error) => {
  logger.error('Unhandled error in main', { error });
  process.exit(1);
});