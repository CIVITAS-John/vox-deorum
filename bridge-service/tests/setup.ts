/**
 * Vitest setup file
 * Global test setup for Bridge Service tests
 */

import { beforeAll, afterAll } from 'vitest';
import { createTestMockDLL, MockDLLServer } from '../scripts/mock-dll-server.js';

// Environment variable to switch between mock and real server
const USE_MOCK = process.env.USE_MOCK !== 'false';

// Global mock server instance
let globalMockDLL: MockDLLServer | null = null;

// Set longer timeouts for integration tests involving IPC
beforeAll(async () => {
  console.log('🧪 Bridge Service Test Suite Starting');
  console.log(`📊 Using ${USE_MOCK ? 'MOCK' : 'REAL'} server mode`);
  
  if (USE_MOCK) {
    console.log('🧪 Starting global mock DLL server for all tests');
    globalMockDLL = await createTestMockDLL();
    console.log('✅ Global mock DLL server started');
  } else {
    console.log('🎮 Using real DLL connection (make sure Civ5 is running)');
  }
}, 10000); // 10 second timeout for setup

afterAll(async () => {
  if (globalMockDLL) {
    console.log('🛑 Stopping global mock DLL server');
    await globalMockDLL.stop();
    console.log('✅ Global mock DLL server stopped');
  }
  console.log('🏁 Bridge Service Test Suite Complete');
}, 10000); // 10 second timeout for cleanup

// Set process environment for consistent test behavior
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error'; // Reduce noise in tests

// Override process exit handlers for tests to prevent test runner crashes
process.removeAllListeners('uncaughtException');
process.removeAllListeners('unhandledRejection');

process.on('uncaughtException', (error) => {
  console.error('Test uncaught exception:', error);
  // Don't exit in tests
});

process.on('unhandledRejection', (reason) => {
  console.error('Test unhandled rejection:', reason);
  // Don't exit in tests
});

// Export global mock server instance for use in tests
export { globalMockDLL, USE_MOCK };