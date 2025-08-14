/**
 * Reconnection logic test - Tests for automatic reconnection with exponential backoff
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DLLConnector } from '../../src/services/dll-connector.js';
import { config } from '../../src/utils/config.js';
import { logSuccess, delay } from '../test-utils/helpers.js';
import { TEST_TIMEOUTS } from '../test-utils/constants.js';

// Reconnection logic with exponential backoff
describe('Reconnection Logic', () => {
  let connector: DLLConnector;
  
  beforeEach(() => {
    connector = new DLLConnector();
  });
  
  afterEach(async () => {
    if (connector && connector.isConnected()) {
      connector.disconnect();
      await delay(TEST_TIMEOUTS.VERY_SHORT);
    }
  });

  // Reconnection attempt tracking
  it('should track reconnection attempts', async () => {
    // Test with invalid connection to trigger reconnection attempts
    const originalConfig = config.namedpipe.id;
    config.namedpipe.id = 'invalid-reconnect-test';
    
    try {
      // This should fail and start reconnection attempts
      await expect(connector.connect()).resolves.toBe(false);

      // Wait a bit for reconnection attempts to start
      await delay(TEST_TIMEOUTS.VERY_SHORT);
      
      const stats = connector.getStats();
      expect(stats.reconnectAttempts).toBeGreaterThan(0);
      
      logSuccess('Reconnection attempts tracked correctly');
    } finally {
      config.namedpipe.id = originalConfig;
      connector.disconnect(); // This should stop reconnection attempts
    }
  });
});