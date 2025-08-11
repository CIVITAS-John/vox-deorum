/**
 * Vitest setup file
 * Global test setup for Bridge Service tests
 */

// Configure test timeouts
import { beforeAll, afterAll } from 'vitest';

// Set longer timeouts for integration tests involving IPC
beforeAll(() => {
  // Default test timeout is extended for IPC operations
  console.log('🧪 Bridge Service Test Suite Starting');
  console.log(`📊 Using ${process.env.USE_MOCK !== 'false' ? 'MOCK' : 'REAL'} server mode`);
});

afterAll(() => {
  console.log('🏁 Bridge Service Test Suite Complete');
});

// Set process environment for consistent test behavior
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error'; // Reduce noise in tests