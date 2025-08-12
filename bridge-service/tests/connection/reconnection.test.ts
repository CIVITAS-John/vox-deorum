/**
 * Reconnection logic test - Tests for automatic reconnection with exponential backoff
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DLLConnector } from '../../src/services/dll-connector.js';
import { config } from '../../src/utils/config.js';

// Reconnection logic with exponential backoff
describe('Reconnection Logic', () => {
  let connector: DLLConnector;
  
  beforeEach(() => {
    connector = new DLLConnector();
  });
  
  afterEach(() => {
    if (connector && connector.isConnected()) {
      connector.disconnect();
    }
  });

  // Reconnection attempt tracking
  it('should track reconnection attempts', async () => {
    // Test with invalid connection to trigger reconnection attempts
    const originalConfig = config.winsock.id;
    config.winsock.id = 'invalid-reconnect-test';
    
    try {
      // This should fail and start reconnection attempts
      await expect(connector.connect()).rejects.toThrow();
      
      // Wait a bit for reconnection attempts to start
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const stats = connector.getStats();
      expect(stats.reconnectAttempts).toBeGreaterThan(0);
      
      console.log('✅ Reconnection attempts tracked correctly');
    } finally {
      config.winsock.id = originalConfig;
      connector.disconnect(); // This should stop reconnection attempts
    }
  });
});