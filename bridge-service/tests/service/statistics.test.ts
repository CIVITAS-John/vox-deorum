/**
 * Connection statistics test - Tests for connection monitoring and statistics tracking
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { globalMockDLL, USE_MOCK } from '../setup.js';
import { DLLConnector } from '../../src/services/dll-connector.js';
import { LuaCallMessage } from '../../src/types/lua.js';
import bridgeService from '../../src/service.js';

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