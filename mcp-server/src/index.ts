/**
 * Main entry point for Vox Deorum MCP Server
 * Initializes and starts the MCP server with transport selection
 */

import { config } from './utils/config.js';
import { createLogger } from './utils/logger.js';
import { startStdioServer } from './stdio.js';
import { startHttpServer } from './http.js';

const logger = createLogger('index');

/**
 * Main function - Initialize and start the MCP server with selected transport
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