/**
 * Connection error handling test - Tests for connection failure scenarios
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DLLConnector } from '../../src/services/dll-connector.js';
import { config } from '../../src/utils/config.js';
import { ErrorCode } from '../../src/types/api.js';
import { delay, logSuccess } from '../test-utils/helpers.js';
import { TEST_TIMEOUTS } from '../test-utils/constants.js';

// Connection failure scenarios and error handling
describe('Connection Error Handling', () => {
  let connector: DLLConnector;
  
  beforeEach(() => {
    connector = new DLLConnector();
  });
  
  afterEach(async () => {
    if (connector && connector.isConnected()) {
      await connector.disconnect();
    }
  });

  // Connection failures with invalid configurations
  it('should handle connection failures gracefully', async () => {
    // Mock invalid connection scenario
    const originalConfig = config.namedpipe.id;
    config.namedpipe.id = 'invalid-id-that-does-not-exist';
    
    try {
      await expect(connector.connect()).resolves.toBe(false);
      expect(connector.isConnected()).toBe(false);
      
      logSuccess('Connection failure handled correctly');
    } finally {
      // Restore original config
      config.namedpipe.id = originalConfig;
    }
  });
  
  // Pending request management during disconnections
  it('should reject pending requests when disconnected', async () => {
      await expect(connector.connect()).resolves.toBe(true);
    
    // Start a request but don't wait for it
    const messagePromise = connector.send({
      type: 'lua_call',
      id: 'test-request'
    } as any);
    
    // Immediately disconnect
    await connector.disconnect();
    
    // The pending request should be rejected
    const response = await messagePromise;
    expect(response.success).toBe(false);
    expect(response.error?.code).toBe(ErrorCode.DLL_DISCONNECTED);
    
    logSuccess('Pending requests rejected on disconnect');
  });
});