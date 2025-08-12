/**
 * Connection lifecycle test - Tests for DLL connection establishment and disconnection
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { globalMockDLL, USE_MOCK } from '../setup.js';
import { DLLConnector } from '../../src/services/dll-connector.js';
import { LuaCallMessage } from '../../src/types/lua.js';

// DLLConnector connection lifecycle (connect/disconnect)
describe('DLLConnector Connection Lifecycle', () => {
  let connector: DLLConnector;
  
  beforeEach(() => {
    connector = new DLLConnector();
  });
  
  afterEach(() => {
    if (connector && connector.isConnected()) {
      connector.disconnect();
    }
  });

  // Basic connection establishment and communication
  it('should establish connection to DLL server', async () => {
    if (USE_MOCK && globalMockDLL) {
      // Verify mock server is running
      const status = globalMockDLL.getStatus();
      expect(status.running).toBe(true);
      console.log('📊 Mock server status:', status);
    }

    // Test initial state
    expect(connector.isConnected()).toBe(false);
    
    // Test connection event emission
    let connectedEventFired = false;
    connector.on('connected', () => {
      connectedEventFired = true;
    });
    
    // Attempt to connect
    await connector.connect();
    expect(connector.isConnected()).toBe(true);
    console.log('✅ Successfully connected to DLL server');

    expect(connectedEventFired).toBe(true);
    console.log('✅ Connection event fired');
    
    // Test basic communication - send a Lua call
    if (USE_MOCK && globalMockDLL) {
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
  });
  
  // Clean disconnection with event emission
  it('should handle clean disconnection', async () => {
    await connector.connect();
    expect(connector.isConnected()).toBe(true);
    
    // Test disconnection event emission
    let disconnectedEventFired = false;
    connector.on('disconnected', () => {
      disconnectedEventFired = true;
    });
    
    connector.disconnect();
    expect(connector.isConnected()).toBe(false);
    
    // Give event time to fire
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(disconnectedEventFired).toBe(true);
    
    console.log('✅ Connection closed cleanly');
  });
  
  // Multiple connection attempts handling
  it('should handle multiple connection attempts gracefully', async () => {
    // First connection
    await connector.connect();
    expect(connector.isConnected()).toBe(true);
    
    // Second connection attempt should not cause issues
    await connector.connect();
    expect(connector.isConnected()).toBe(true);
    
    console.log('✅ Multiple connection attempts handled gracefully');
  });
  
  // Multiple disconnection calls handling
  it('should handle multiple disconnection calls gracefully', async () => {
    await connector.connect();
    expect(connector.isConnected()).toBe(true);
    
    connector.disconnect();
    expect(connector.isConnected()).toBe(false);
    
    // Second disconnect should not cause issues
    connector.disconnect();
    expect(connector.isConnected()).toBe(false);
    
    console.log('✅ Multiple disconnection calls handled gracefully');
  });
});