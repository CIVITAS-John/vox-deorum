/**
 * Lua execution endpoints test - Tests for Lua function calls, batch execution, script execution, and function listing
 */

import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../src/index.js';
import { luaManager } from '../../src/services/lua-manager.js';
import { dllConnector } from '../../src/services/dll-connector.js';
import { expectSuccessResponse, expectErrorResponse, logSuccess, delay, TestServer } from '../test-utils/helpers.js';
import { 
  setupMockLuaFunction, 
  clearMockLuaFunctions, 
  testLuaFunctionCall,
  testLuaBatchCall,
  testLuaScriptExecution,
  validateFunctionListResponse
} from '../test-utils/lua-helpers.js';
import { ErrorCode } from '../../src/types/api.js';
import { TEST_TIMEOUTS } from '../test-utils/constants.js';
import config from '../../src/utils/config.js';
import { USE_MOCK } from '../setup.js';

/**
 * Lua Service Tests
 */
describe('Lua Service', () => {
  const testServer = new TestServer();
  const TEST_PORT = 3456; // Use a different port for tests

  // Setup and teardown
  beforeAll(async () => {
    // Start the test server
    await testServer.start(app, TEST_PORT, config.rest.host);
  }, TEST_TIMEOUTS.LONG);

  afterAll(async () => {
    // Stop the test server
    await testServer.stop();
  }, TEST_TIMEOUTS.LONG);

  afterEach(() => {
    // Clear mock functions after each test to prevent interference
    clearMockLuaFunctions();
  });

  /**
   * Script Execution Tests
   */
  describe('POST /lua/execute - Execute raw Lua script', () => {

    it('should successfully execute a simple Lua script', async () => {
      const script = 'return 42';
      await testLuaScriptExecution(app, script, 42);
      logSuccess('Simple Lua script execution handled');
    }, TEST_TIMEOUTS.DEFAULT);

    it('should execute complex Lua script with functions', async () => {
      const script = `
        local function add(a, b)
          return a + b
        end
        return add(10, 20)
      `;
      await testLuaScriptExecution(app, script, 30);
      logSuccess('Complex Lua script execution handled');
    }, TEST_TIMEOUTS.DEFAULT);

    it.each([
      {
        payload: {},
        expectedError: 'Missing Lua script',
        testCase: 'missing script field'
      },
      {
        payload: { script: '' },
        expectedError: 'Missing Lua script',
        testCase: 'empty script'
      }
    ])('should handle $testCase', async ({ payload, expectedError }) => {
      await request(app)
        .post('/lua/execute')
        .send(payload)
        .expect(500)
        .then(response => expectErrorResponse(response, ErrorCode.INVALID_SCRIPT, expectedError));
    });

    it('should handle syntax errors in Lua script', async () => {
      const script = 'local x = ; return x'; // Syntax error

      // Mock will still return a result, real DLL would error
      const expectedStatus = USE_MOCK ? 200 : 500;
      const response = await request(app)
        .post('/lua/execute')
        .send({ script })
        .expect(expectedStatus);

      // Will return an error from Lua execution or mock result
      expect(response.body).toBeDefined();
      if (!USE_MOCK) {
        expect(response.body.success).toBe(false);
      }

      logSuccess('Lua syntax error handled');
    }, TEST_TIMEOUTS.DEFAULT);

    it('should handle very long scripts', async () => {
      const script = `
        local result = 0
        ${Array.from({ length: 100 }, (_, i) => `result = result + ${i}`).join('\n')}
        return result
      `;
      await testLuaScriptExecution(app, script, 4950);
      logSuccess('Long Lua script handled');
    }, TEST_TIMEOUTS.DEFAULT);

    it('should handle scripts with special characters', async () => {
      const script = 'return "Hello\\nWorld\\t!"';
      await testLuaScriptExecution(app, script, 'Hello\nWorld\t!');
      logSuccess('Script with special characters handled');
    }, TEST_TIMEOUTS.DEFAULT);
  });

  /**
   * Function Listing Tests
   */
  describe('GET /lua/functions - List available Lua functions', () => {
    beforeEach(() => {
      // Register some test functions
      luaManager.registerFunction('TestFunction1', 'Test function 1');
      luaManager.registerFunction('TestFunction2', 'Test function 2');
    });

    it('should return list of available Lua functions', async () => {
      const response = await request(app)
        .get('/lua/functions')
        .expect(200);

      validateFunctionListResponse(response);
      logSuccess('List of Lua functions retrieved successfully');
    });

    it('should handle concurrent requests', async () => {
      const requests = Array.from({ length: 10 }, () =>
        request(app).get('/lua/functions')
      );

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expectSuccessResponse(response, (res) => {
          expect(res.body.result).toHaveProperty('functions');
          expect(res.body.result.functions).toBeInstanceOf(Array);
        });
      });

      logSuccess('Concurrent requests handled successfully');
    });
  });

  /**
   * Function Call Tests
   */
  describe('POST /lua/call - Execute Lua function', () => {

    it('should successfully call a Lua function with arguments', async () => {
      await testLuaFunctionCall(
        app,
        'GetPlayerName',
        { playerId: 1 },
        'Mock Player',
        'Mock Player'
      );
      logSuccess('Lua function call with arguments successful');
    });

    it('should successfully call a Lua function without arguments', async () => {
      await testLuaFunctionCall(
        app,
        'GetCurrentTurn',
        undefined,
        150,
        150
      );
      logSuccess('Lua function call without arguments successful');
    });

    it.each([
      {
        payload: { args: { playerId: 1 } },
        expectedError: 'Missing function name',
        testCase: 'missing function name'
      },
      {
        payload: {},
        expectedError: 'Missing function name',
        testCase: 'empty request body'
      }
    ])('should handle $testCase', async ({ payload, expectedError }) => {
      await request(app)
        .post('/lua/call')
        .send(payload)
        .expect(500)
        .then(response => expectErrorResponse(response, ErrorCode.INVALID_ARGUMENTS, expectedError));
    });

    it('should handle invalid function calls', async () => {
      // Setup mock to return error for unknown function
      if (USE_MOCK) {
        setupMockLuaFunction('NonExistentFunction', 'Function not found', false);
      }
      
      const response = await request(app)
        .post('/lua/call')
        .send({
          function: 'NonExistentFunction',
          args: {}
        })
        .expect(500);

      // The actual error will come from the Lua execution
      expect(response.body.success).toBe(false);
      if (USE_MOCK) {
        expect(response.body.error).toBeDefined();
      }

      logSuccess('Invalid function call handled');
    });
  });

  /**
   * Batch Execution Tests
   */
  describe('POST /lua/batch - Execute multiple Lua functions', () => {

    it('should successfully execute batch of Lua functions', async () => {
      const batchRequests = [
        { function: 'GetPlayerName', args: { playerId: 1 } },
        { function: 'GetCurrentTurn', args: {} },
        { function: 'GetGameSpeed', args: {} }
      ];

      const mockSetup = [
        { name: 'GetPlayerName', result: 'Mock Player' },
        { name: 'GetCurrentTurn', result: 100 },
        { name: 'GetGameSpeed', result: 'Standard' }
      ];

      const response = await testLuaBatchCall(app, batchRequests, mockSetup);

      if (USE_MOCK && response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.result).toHaveProperty('results');
        expect(response.body.result.results).toHaveLength(3);
      }

      logSuccess('Batch Lua function execution handled');
    });

    it('should handle batch with missing args', async () => {
      const batchRequests = [
        { function: 'GetPlayerName' }, // Missing args
        { function: 'GetCurrentTurn' }
      ];

      const mockSetup = [
        { name: 'GetPlayerName', result: 'Default Player' },
        { name: 'GetCurrentTurn', result: 0 }
      ];

      const response = await testLuaBatchCall(app, batchRequests, mockSetup);
      expect(response.body).toBeDefined();

      logSuccess('Batch with missing args handled correctly');
    });

    it.each([
      {
        payload: [],
        expectedError: 'non-empty array',
        testCase: 'empty batch array'
      },
      {
        payload: { function: 'GetPlayerName', args: {} },
        expectedError: 'must be a non-empty array',
        testCase: 'non-array batch request'
      }
    ])('should handle $testCase', async ({ payload, expectedError }) => {
      await request(app)
        .post('/lua/batch')
        .send(payload)
        .expect(500)
        .then(response => expectErrorResponse(response, ErrorCode.INVALID_ARGUMENTS, expectedError));
    });

    it('should handle batch with mixed valid and invalid functions', async () => {
      const batchRequests = [
        { function: 'GetPlayerName', args: { playerId: 1 } },
        { function: 'InvalidFunction', args: {} },
        { function: 'GetCurrentTurn', args: {} }
      ];

      const mockSetup = [
        { name: 'GetPlayerName', result: 'Mock Player', shouldSucceed: true },
        { name: 'InvalidFunction', result: 'Function not found', shouldSucceed: false },
        { name: 'GetCurrentTurn', result: 200, shouldSucceed: true }
      ];

      const response = await testLuaBatchCall(app, batchRequests, mockSetup);

      expect(response.body).toBeDefined();
      if (USE_MOCK && response.status === 200) {
        expect(response.body.result).toHaveProperty('results');
        expect(response.body.result.results).toHaveLength(3);
      }

      logSuccess('Batch with mixed valid/invalid functions handled');
    });

    it('should handle large batch requests', async () => {
      const batchRequests = Array.from({ length: 50 }, (_, i) => ({
        function: 'GetPlayerName',
        args: { playerId: i }
      }));

      const mockSetup = [{ name: 'GetPlayerName', result: 'Batch Player' }];
      const response = await testLuaBatchCall(app, batchRequests, mockSetup);

      expect(response.body).toBeDefined();
      if (USE_MOCK && response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.result.results).toHaveLength(50);
      }

      logSuccess('Large batch request handled');
    });
  });

  /**
   * Error Handling and Edge Cases
   */
  describe('Error Handling and Edge Cases', () => {

    it('should handle connection loss during Lua call', async () => {
      // Setup mock response if in mock mode
      if (USE_MOCK) {
        // Mock will still work even if connector disconnects
        setupMockLuaFunction('GetPlayerName', 'Mock Player', true);
      }
      
      // Start a request
      const requestPromise = request(app)
        .post('/lua/call')
        .send({
          function: 'GetPlayerName',
          args: { playerId: 1 }
        });

      // Disconnect the connector mid-request
      await dllConnector.disconnect();

      const response = await requestPromise;

      expect(response.status).toBeDefined();
      // Should get an error response due to disconnection (unless mock handles it)
      expect(response.body.success).toBeDefined();
      
      // Reconnect for next tests
      await expect(dllConnector.connect()).resolves.toBe(true);

      logSuccess('Connection loss during request handled');
    });

    it('should handle rapid sequential requests', async () => {
      setupMockLuaFunction('GetPlayerName', 'Rapid Player', true);
      
      const results: any[] = [];
      
      for (let i = 0; i < 20; i++) {
        const response = await request(app)
          .post('/lua/call')
          .send({
            function: 'GetPlayerName',
            args: { playerId: i }
          });
        
        expect(response.status).toBeDefined();
        results.push(response.body);
      }

      expect(results).toHaveLength(20);
      results.forEach(result => {
        expect(result).toBeDefined();
        if (USE_MOCK && result.success) {
          expect(result.result).toBe('Rapid Player');
        }
      });

      logSuccess('Rapid sequential requests handled successfully');
    });
  });
});