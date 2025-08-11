/**
 * Connection test - Tests actual connection functionality between Bridge Service and DLL
 * 
 * This test verifies that:
 * 1. Bridge service can establish connection to DLL server
 * 2. Basic communication works (ping/pong)
 * 3. Connection can be terminated cleanly
 * 4. Error handling works for failed connections
 */

import { describe, it, expect } from 'vitest';
import { globalMockDLL, USE_MOCK } from './setup.js';
import { DLLConnector } from '../src/services/dll-connector.js';
import { config } from '../src/utils/config.js';
import { LuaCallMessage } from '../src/types/lua.js';

describe('Bridge Service Connection Test', () => {
  it('should establish connection to DLL server', async () => {
    if (USE_MOCK && globalMockDLL) {
      // Verify mock server is running
      const status = globalMockDLL.getStatus();
      expect(status.running).toBe(true);
      console.log('📊 Mock server status:', status);
    }

    // Create DLL connector instance
    const connector = new DLLConnector();
    
    try {
      // Attempt to connect
      await connector.connect();
      expect(connector.isConnected()).toBe(true);
      
      console.log('✅ Successfully connected to DLL server');
      
      // Test basic communication - send a Lua call
      if (USE_MOCK && globalMockDLL) {
        // Send a test Lua function call
        const message: LuaCallMessage = {
          type: 'lua_call',
          function: 'GetPlayerName',
          args: []
        };
        
        const response = await connector.send(message);
        
        expect(response.success).toBe(true);
        expect(response.result).toBe('Mock Player');
        
        console.log('✅ Basic communication test passed');
      }
      
    } finally {
      // Always disconnect
      connector.disconnect();
      expect(connector.isConnected()).toBe(false);
      
      console.log('✅ Connection closed cleanly');
    }
  });

  it('should handle connection failures gracefully', async () => {
    // Create connector with invalid config to test error handling
    const connector = new DLLConnector();
    
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

  it('should verify configuration is properly loaded', async () => {
    // Verify configuration is loaded
    expect(config).toBeDefined();
    expect(config.rest.port).toBeTypeOf('number');
    expect(config.winsock.id).toBeTypeOf('string');
    expect(config.rest.host).toBeTypeOf('string');
    
    console.log('⚙️ Bridge service config:', {
      port: config.rest.port,
      host: config.rest.host,
      winsockId: config.winsock.id
    });
  });
});