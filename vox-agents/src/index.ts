/**
 * Main entry point for Vox Agents with Web UI
 * This file starts the web server and makes agents available through the UI
 */

import { startWebServer } from './web/server.js';
import { createLogger, logStartup } from './utils/logger.js';
import config from './utils/config.js';

// Create logger for main entry point
const voxLogger = createLogger('VoxAgents');

/**
 * Main function to start Vox Agents with Web UI
 */
async function main() {
  // Use the centralized logStartup utility
  logStartup('Vox Agents', '1.0.0', config.webui.port);

  try {
    // Check if web UI is enabled
    if (!config.webui.enabled) {
      voxLogger.warn('Web UI is disabled in configuration');
      process.exit(0);
    }

    // Start the web server
    await startWebServer();
  } catch (error) {
    voxLogger.error('Failed to start Vox Agents:', error);
    process.exit(1);
  }
}

// Start the application
// Note: Uncaught exception handlers are already set up in utils/logger.ts
main();