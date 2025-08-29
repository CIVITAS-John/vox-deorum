/**
 * Main entry point for Vox Deorum MCP Server
 * Initializes and starts the MCP server for Civilization V game state exposure
 */

import { VoxDeorumMCPServer } from './server.js';
import { logger } from './utils/logger.js';

/**
 * Main function - Initialize and start the MCP server
 */
async function main(): Promise<void> {
  try {
    const server = new VoxDeorumMCPServer();
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('Received SIGINT, shutting down gracefully...');
      await server.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info('Received SIGTERM, shutting down gracefully...');
      await server.stop();
      process.exit(0);
    });

    // Start the server
    await server.start();
  } catch (error) {
    logger.error('Failed to start MCP Server', { error });
    process.exit(1);
  }
}

// Run the server
main().catch((error) => {
  logger.error('Unhandled error in main', { error });
  process.exit(1);
});