/**
 * Message handling test - Tests for request/response flow and message communication
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { globalMockDLL, USE_MOCK } from '../setup.js';
import { DLLConnector } from '../../src/services/dll-connector.js';
import { LuaCallMessage } from '../../src/types/lua.js';
import { ErrorCode } from '../../src/types/api.js';
import { logSuccess, delay } from '../test-utils/helpers.js';
import { TEST_TIMEOUTS } from '../test-utils/constants.js';

// Message handling and request/response flow
describe('Message Handling and Communication', () => {
  let connector: DLLConnector;
  
  beforeEach(async () => {
    connector = new DLLConnector();
    await expect(connector.connect()).resolves.toBe(true);
  });
  
  afterEach(async () => {
    if (connector && connector.isConnected()) {
      await connector.disconnect();
    }
  });

  // Successful message responses
  it('should handle successful message responses', async () => {
    if (!USE_MOCK) {
      logSuccess('Skipping mock-specific test in real server mode');
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
    if (!USE_MOCK) {
      logSuccess('Skipping mock-specific test in real server mode');
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

    const response = await connector.send(message, 10); // 10ms timeout

    expect(response.success).toBe(false);
    expect(response.error?.code).toBe(ErrorCode.CALL_TIMEOUT);
    
    logSuccess('Message timeout handled correctly');
  });
  
  // SendNoWait message handling (connected and disconnected states)
  it('should handle sendNoWait messages in different connection states', async () => {
    // Test sendNoWait when connected
    const connectedMessage = {
      type: 'lua_call',
      id: 'no-wait-test'
    } as any;
    
    const connectedResponse = connector.sendNoWait(connectedMessage);
    expect(connectedResponse.success).toBe(true);
    logSuccess('No-wait message sent successfully when connected');
    
    // Test sendNoWait when disconnected
    await connector.disconnect();
    
    const disconnectedMessage = {
      type: 'lua_call',
      id: 'disconnected-test'
    } as any;
    
    const disconnectedResponse = connector.sendNoWait(disconnectedMessage);
    expect(disconnectedResponse.success).toBe(false);
    expect(disconnectedResponse.error?.code).toBe(ErrorCode.DLL_DISCONNECTED);
    logSuccess('SendNoWait correctly rejected when disconnected');
  });
  
  // Event emission for connection state changes
  it('should handle various event types', async () => {
    const eventTypes = [
      'game_event',
      'external_call',
      'lua_register'
    ];
    
    // Register event handlers for testing
    const eventHandlers: { [key: string]: ReturnType<typeof vi.fn> } = {};
    eventTypes.forEach(eventType => {
      eventHandlers[eventType] = vi.fn();
      connector.on(eventType, eventHandlers[eventType]);
    });

    // Verify the handlers are set up
    eventTypes.forEach(eventType => {
      expect(connector.listenerCount(eventType)).toBe(1);
    });

    // When using the mock DLL, we can simulate events
    if (USE_MOCK) {
      eventTypes.forEach(eventType => {
        globalMockDLL!.sendRawMessage({ type: eventType });
      });
      // Wait a bit to ensure events are processed
      await delay(TEST_TIMEOUTS.VERY_SHORT);
      eventTypes.forEach(eventType => {
        expect(eventHandlers[eventType]).toHaveBeenCalled();
      });
    }
    
    // Clean up listeners
    eventTypes.forEach(eventType => {
      connector.off(eventType, eventHandlers[eventType]);
    });
    
    logSuccess('Event handlers registered correctly');
  });
});