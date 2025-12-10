/**
 * Main entry point for Vox Agents with Web UI
 * This file starts the web server and makes agents available through the UI
 */

import { startWebServer } from './web/server.js';
import { createLogger } from './utils/logger.js';
import config from './utils/config.js';

// Create logger for main entry point
const voxLogger = createLogger('VoxAgents');

/**
 * Main function to start Vox Agents with Web UI
 */
async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║                       VOX DEORUM                             ║');
  console.log('║          LLM-Enhanced AI System for Civilization V           ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');

  try {
    // Check if web UI is enabled
    if (!config.webui.enabled) {
      console.log('Web UI is disabled in configuration');
      process.exit(0);
    }

    // Start the web server
    await startWebServer();

    console.log('');
    console.log(`🌐 Web UI available at: http://localhost:${config.webui.port}`);
    console.log('');
    console.log('Available endpoints:');
    console.log('  • Health Check:  GET  /api/health');
    console.log('  • Log Stream:    GET  /api/logs/stream (SSE)');
    console.log('');
    console.log('Press Ctrl+C to stop the server');
    console.log('');

    // Log startup complete
    voxLogger.info('Vox Deorum system initialized', {
      mode: 'web-ui',
      port: config.webui.port,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Failed to start Vox Agents:', error);
    voxLogger.error('Startup failed', { error });
    process.exit(1);
  }
}

// Handle uncaught errors gracefully
process.on('uncaughtException', (error) => {
  voxLogger.error('Uncaught exception', { error });
  console.error('Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  voxLogger.error('Unhandled rejection', { reason, promise });
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the application
main();