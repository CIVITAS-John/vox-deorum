/**
 * Connection error handling test - Tests for connection failure scenarios
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DLLConnector } from '../../src/services/dll-connector.js';
import { config } from '../../src/utils/config.js';
import { ErrorCode } from '../../src/types/api.js';

// Connection failure scenarios and error handling
describe('Connection Error Handling', () => {
  let connector: DLLConnector;
  
  beforeEach(() => {
    connector = new DLLConnector();
  });
  
  afterEach(() => {
    if (connector && connector.isConnected()) {
      connector.disconnect();
    }
  });

  // Connection failures with invalid configurations
  it('should handle connection failures gracefully', async () => {
    // Mock invalid connection scenario
    const originalConfig = config.winsock.id;
    config.winsock.id = 'invalid-id-that-does-not-exist';
    
    try {
      await expect(connector.connect()).rejects.toThrow();
      expect(connector.isConnected()).toBe(false);
      
      console.log('✅ Connection failure handled correctly');
    } finally {
      // Restore original config
      config.winsock.id = originalConfig;
    }
  });
  
  // Pending request management during disconnections
  it('should reject pending requests when disconnected', async () => {
    await connector.connect();
    expect(connector.isConnected()).toBe(true);
    
    // Start a request but don't wait for it
    const messagePromise = connector.send({
      type: 'lua_call',
      id: 'test-request'
    } as any);
    
    // Immediately disconnect
    connector.disconnect();
    
    // The pending request should be rejected
    const response = await messagePromise;
    expect(response.success).toBe(false);
    expect(response.error?.code).toBe(ErrorCode.DLL_DISCONNECTED);
    
    console.log('✅ Pending requests rejected on disconnect');
  });
});