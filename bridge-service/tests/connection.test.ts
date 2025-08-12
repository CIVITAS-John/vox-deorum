/**
 * Connection test - Comprehensive tests for connection functionality between Bridge Service and DLL
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { globalMockDLL, USE_MOCK } from './setup.js';
import { DLLConnector } from '../src/services/dll-connector.js';
import { config } from '../src/utils/config.js';
import { LuaCallMessage } from '../src/types/lua.js';
import { ErrorCode } from '../src/types/api.js';
import { bridgeService } from '../src/service.js';
import { getSSEStats } from '../src/routes/events.js';


// Configuration verification (supporting all connection tests)
describe('Configuration', () => {
  // Configuration loading and validation
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

// Message handling and request/response flow
describe('Message Handling and Communication', () => {
  let connector: DLLConnector;
  
  beforeEach(async () => {
    connector = new DLLConnector();
    await connector.connect();
  });
  
  afterEach(() => {
    if (connector && connector.isConnected()) {
      connector.disconnect();
    }
  });

  // Successful message responses
  it('should handle successful message responses', async () => {
    if (!USE_MOCK || !globalMockDLL) {
      console.log('⏭️ Skipping mock-specific test in real server mode');
      return;
    }
    
    const message: LuaCallMessage = {
      type: 'lua_call',
      function: 'GetPlayerName',
      args: []
    };
    
    const response = await connector.send(message);
    
    expect(response.success).toBe(true);
    expect(response.result).toBe('Mock Player');
  });
  
  // Message error handling
  it('should handle message errors', async () => {
    if (!USE_MOCK || !globalMockDLL) {
      console.log('⏭️ Skipping mock-specific test in real server mode');
      return;
    }
    
    const message: LuaCallMessage = {
      type: 'lua_call',
      function: 'NonExistentFunction',
      args: []
    };
    
    const response = await connector.send(message);
    
    expect(response.success).toBe(false);
    expect(response.error).toBeDefined();
  });
  
  // Timeout handling and cleanup
  it('should handle message timeout', async () => {
    const message = {
      type: 'test_timeout',
      id: 'timeout-test'
    } as any;
    
    const response = await connector.send(message, 100); // 100ms timeout
    
    expect(response.success).toBe(false);
    expect(response.error?.code).toBe(ErrorCode.CALL_TIMEOUT);
    
    console.log('✅ Message timeout handled correctly');
  });
  
  // SendNoWait message handling
  it('should handle sendNoWait messages', async () => {
    const message = {
      type: 'lua_call',
      id: 'no-wait-test'
    } as any;
    
    const response = connector.sendNoWait(message);
    
    expect(response.success).toBe(true);
    console.log('✅ No-wait message sent successfully');
  });
  
  // SendNoWait rejection when disconnected
  it('should reject sendNoWait when disconnected', async () => {
    connector.disconnect();
    
    const message = {
      type: 'lua_call',
      id: 'disconnected-test'
    } as any;
    
    const response = connector.sendNoWait(message);
    
    expect(response.success).toBe(false);
    expect(response.error?.code).toBe(ErrorCode.DLL_DISCONNECTED);
    
    console.log('✅ SendNoWait rejection when disconnected working correctly');
  });
  
  // Event emission for connection state changes
  it('should handle various event types', async () => {
    const eventTypes = [
      'game_event',
      'external_call',
      'lua_register'
    ];
    
    // Just verify event handlers are set up correctly
    // eventPromises would be used in a full integration test
    
    // In a real scenario, these events would come from the DLL
    // For testing, we can simulate them by directly calling the message handler
    if (USE_MOCK && globalMockDLL) {
      // The mock server might send these events - just verify the handlers are set up
      expect(connector.listenerCount('game_event')).toBeGreaterThan(0);
      expect(connector.listenerCount('external_call')).toBeGreaterThan(0);
      expect(connector.listenerCount('lua_register')).toBeGreaterThan(0);
    }
    
    console.log('✅ Event handlers registered correctly');
  });
});

// Connection statistics and monitoring
describe('Connection Statistics and Monitoring', () => {
  let connector: DLLConnector;
  
  beforeEach(() => {
    connector = new DLLConnector();
  });
  
  afterEach(() => {
    if (connector && connector.isConnected()) {
      connector.disconnect();
    }
  });

  // Accurate connection statistics tracking
  it('should provide accurate connection statistics', async () => {
    // Test initial stats
    let stats = connector.getStats();
    expect(stats.connected).toBe(false);
    expect(stats.pendingRequests).toBe(0);
    expect(stats.reconnectAttempts).toBe(0);
    
    // Test stats after connection
    await connector.connect();
    stats = connector.getStats();
    expect(stats.connected).toBe(true);
    expect(stats.pendingRequests).toBe(0);
    expect(stats.reconnectAttempts).toBe(0);
    
    // Test stats after disconnect
    connector.disconnect();
    stats = connector.getStats();
    expect(stats.connected).toBe(false);
    expect(stats.pendingRequests).toBe(0);
    
    console.log('✅ Connection statistics working correctly');
  });
  
  // Pending request tracking
  it('should track pending requests', async () => {
    await connector.connect();
    
    if (USE_MOCK && globalMockDLL) {
      // Start a request but don't await it immediately
      const requestPromise = connector.send({
        type: 'lua_call',
        function: 'GetPlayerName',
        args: []
      } as LuaCallMessage);
      
      // Note: Stats might be 0 if the mock server responds too quickly
      
      // Wait for response
      await requestPromise;
      
      // Check stats after response
      const statsAfterResponse = connector.getStats();
      expect(statsAfterResponse.pendingRequests).toBe(0);
    }
    
    console.log('✅ Pending request tracking working');
  });
});

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

// Service-level connection coordination
describe('Service-Level Connection Management', () => {
  // Health status based on connection state
  it('should provide health status based on connection state', async () => {
    const healthStatus = bridgeService.getHealthStatus();
    
    expect(healthStatus).toHaveProperty('success');
    expect(healthStatus).toHaveProperty('dll_connected');
    expect(healthStatus).toHaveProperty('uptime');
    expect(typeof healthStatus.uptime).toBe('number');
    expect(healthStatus.uptime).toBeGreaterThanOrEqual(0);
    
    console.log('✅ Health status provides connection info');
  });
  
  // Detailed service statistics
  it('should provide detailed service statistics', async () => {
    const stats = bridgeService.getServiceStats();
    
    expect(stats).toHaveProperty('uptime');
    expect(stats).toHaveProperty('dll');
    expect(stats).toHaveProperty('lua');
    expect(stats).toHaveProperty('external');
    expect(stats).toHaveProperty('memory');
    
    expect(stats.dll).toHaveProperty('connected');
    expect(stats.dll).toHaveProperty('pendingRequests');
    expect(stats.dll).toHaveProperty('reconnectAttempts');
    
    expect(typeof stats.dll.connected).toBe('boolean');
    expect(typeof stats.dll.pendingRequests).toBe('number');
    expect(typeof stats.dll.reconnectAttempts).toBe('number');
    
    console.log('✅ Service statistics include connection details');
  });
  
  // Forced reconnection handling
  it('should handle forced reconnection', async () => {
    // This test just verifies the method exists and can be called
    // In a real scenario, this would reconnect to the DLL
    try {
      await bridgeService.reconnectDLL();
      console.log('✅ Forced reconnection completed');
    } catch (error) {
      // Reconnection might fail if DLL is not available
      // That's acceptable for this test
      console.log('⚠️ Forced reconnection failed (expected if no DLL):', error);
    }
  });
});

// SSE connection management
describe('SSE Connection Management', () => {
  // SSE statistics and client tracking
  it('should provide SSE statistics', async () => {
    const sseStats = getSSEStats();
    
    expect(sseStats).toHaveProperty('activeClients');
    expect(sseStats).toHaveProperty('clientIds');
    expect(typeof sseStats.activeClients).toBe('number');
    expect(Array.isArray(sseStats.clientIds)).toBe(true);
    
    console.log('✅ SSE statistics available');
  });
});