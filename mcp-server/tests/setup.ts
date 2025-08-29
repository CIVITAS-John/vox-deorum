/**
 * Test setup configuration for MCP Server tests
 * Provides global test configuration and utilities
 */

import { beforeEach, afterEach } from 'vitest';

// Set test environment variables
process.env.NODE_ENV = 'test';

// Global test setup
beforeEach(() => {
  // Reset any global state before each test
});

afterEach(() => {
  // Cleanup after each test
});