#!/usr/bin/env tsx
/**
 * Mock DLL Server - Start a mock Civilization V DLL for testing
 * 
 * This script starts a mock DLL server that implements the same IPC protocol
 * as the real Community Patch DLL, allowing for development and testing without
 * the actual Civilization V game.
 * 
 * Usage: npm run mock
 */

import { createMockDLLServer } from './mock-dll-server.js';
import { createLogger } from '../../src/utils/logger.js';

const logger = createLogger('TestScript');

/**
 * Main function to start the mock DLL server
 */
async function main() {
  logger.info('🚀 Starting Mock DLL Server...');

  try {
    // Create and start mock DLL server
    const mockDLL = await createMockDLLServer({
      id: 'civ5',
      simulateDelay: true,
      responseDelay: 100,
      autoEvents: true,
      eventInterval: 3000
    });

    logger.info('✅ Mock DLL server started successfully');
    logger.info('📊 Server status:', mockDLL.getStatus());

    // Now you can start the bridge service in another terminal with: npm run dev
    // The bridge service will connect to this mock DLL instead of the real one

    // Keep the script running
    logger.info('🎮 Mock DLL server is running. Press Ctrl+C to stop.');
    logger.info('💡 Start the bridge service in another terminal: npm run dev');
    logger.info('🌐 Bridge service will be available at: http://localhost:8080');

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('Shutting down mock DLL server...');
      await mockDLL.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info('Shutting down mock DLL server...');
      await mockDLL.stop();
      process.exit(0);
    });

    // Demonstrate some mock functionality after a delay
    setTimeout(() => {
      logger.info('🎯 Simulating some game events...');
      
      mockDLL.simulateGameEvent('turn_complete', { 
        turn: 42,
        player: 'Test Player',
        year: '1000 AD' 
      });

      mockDLL.simulateGameEvent('city_founded', {
        cityName: 'New Test City',
        player: 'Test Player',
        position: [12, 8]
      });
      
      logger.info('🎲 Game events simulated. Check the bridge service logs for activity.');
    }, 5000);

  } catch (error) {
    logger.error('Failed to start mock DLL server:', error);
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at: ' + promise?.toString() + ', reason:', reason);
  process.exit(1);
});

// Run the main function
main().catch((error) => {
  logger.error('Script error:', error);
  process.exit(1);
});