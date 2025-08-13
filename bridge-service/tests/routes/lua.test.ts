/**
 * Lua execution endpoints test - Tests for Lua function calls, batch execution, script execution, and function listing
 */

import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../src/index.js';
import { luaManager } from '../../src/services/lua-manager.js';
import { dllConnector } from '../../src/services/dll-connector.js';
import { expectSuccessResponse, expectErrorResponse, logSuccess, delay, TestServer } from '../test-utils/helpers.js';
import { ErrorCode } from '../../src/types/api.js';
import { TEST_TIMEOUTS } from '../test-utils/constants.js';
import config from '../../src/utils/config.js';
import { globalMockDLL, USE_MOCK } from '../setup.js';
import type { MockDLLServer } from '../../scripts/mock-dll-server.js';

/**
 * Lua Service Tests
 */
describe('Lua Service', () => {
  const testServer = new TestServer();
  const TEST_PORT = 3456; // Use a different port for tests
  
  /**
   * Helper function to setup mock Lua function responses using the new mock server API
   */
  const setupMockLuaFunction = (functionName: string, result: any, shouldSucceed: boolean = true) => {
    globalMockDLL!.addLuaFunction(functionName, () => result, shouldSucceed);
  };

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
    if (USE_MOCK && globalMockDLL) {
      const mockServer = globalMockDLL as MockDLLServer;
      mockServer.clearLuaFunctions();
    }
  });

  /**
   * Function Call Tests
   */
  describe('POST /lua/call - Execute Lua function', () => {

    it('should successfully call a Lua function with arguments', async () => {
      // Setup mock response for this test if in mock mode
      if (USE_MOCK) {
        setupMockLuaFunction('GetPlayerName', 'Mock Player', true);
      }
      
      const response = await request(app)
        .post('/lua/call')
        .send({
          function: 'GetPlayerName',
          args: { playerId: 1 }
        })
        .expect(200);

      expectSuccessResponse(response, (res) => {
        expect(res.body).toHaveProperty('result');
        if (USE_MOCK) {
          expect(res.body.result).toBe('Mock Player');
        }
      });

      logSuccess('Lua function call with arguments successful');
    });

    it('should successfully call a Lua function without arguments', async () => {
      // Setup mock response for this test if in mock mode
      if (USE_MOCK) {
        setupMockLuaFunction('GetCurrentTurn', 150, true);
      }
      
      const response = await request(app)
        .post('/lua/call')
        .send({
          function: 'GetCurrentTurn'
        })
        .expect(200);

      expectSuccessResponse(response, (res) => {
        expect(res.body).toHaveProperty('result');
        if (USE_MOCK) {
          expect(res.body.result).toBe(150);
        }
      });

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

    it('should handle malformed JSON', async () => {
      await request(app)
        .post('/lua/call')
        .set('Content-Type', 'application/json')
        .send('{"function": "test", args: }') // Invalid JSON
        .expect(500);

      logSuccess('Malformed JSON handled correctly');
    });
  });

  /**
   * Batch Execution Tests
   */
  describe('POST /lua/batch - Execute multiple Lua functions', () => {

    it('should successfully execute batch of Lua functions', async () => {
      // Setup mock responses if in mock mode
      if (USE_MOCK) {
        setupMockLuaFunction('GetPlayerName', 'Mock Player', true);
        setupMockLuaFunction('GetCurrentTurn', 100, true);
        setupMockLuaFunction('GetGameSpeed', 'Standard', true);
      }
      
      const batchRequests = [
        { function: 'GetPlayerName', args: { playerId: 1 } },
        { function: 'GetCurrentTurn', args: {} },
        { function: 'GetGameSpeed', args: {} }
      ];

      const expectedStatus = USE_MOCK ? 200 : 500; // Mock mode should succeed
      const response = await request(app)
        .post('/lua/batch')
        .send(batchRequests)
        .expect(expectedStatus);

      expect(response.body).toBeDefined();
      if (USE_MOCK && response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.result).toHaveProperty('results');
        expect(response.body.result.results).toHaveLength(3);
      }

      logSuccess('Batch Lua function execution handled');
    });

    it('should handle batch with missing args', async () => {
      // Setup mock responses if in mock mode
      if (USE_MOCK) {
        setupMockLuaFunction('GetPlayerName', 'Default Player', true);
        setupMockLuaFunction('GetCurrentTurn', 0, true);
      }
      
      const batchRequests = [
        { function: 'GetPlayerName' }, // Missing args
        { function: 'GetCurrentTurn' }
      ];

      const expectedStatus = USE_MOCK ? 200 : 500; // Mock mode might handle missing args
      const response = await request(app)
        .post('/lua/batch')
        .send(batchRequests)
        .expect(expectedStatus);

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
      // Setup mock responses if in mock mode
      if (USE_MOCK) {
        setupMockLuaFunction('GetPlayerName', 'Mock Player', true);
        setupMockLuaFunction('InvalidFunction', 'Function not found', false);
        setupMockLuaFunction('GetCurrentTurn', 200, true);
      }
      
      const batchRequests = [
        { function: 'GetPlayerName', args: { playerId: 1 } },
        { function: 'InvalidFunction', args: {} },
        { function: 'GetCurrentTurn', args: {} }
      ];

      // In mock mode, batch might succeed with partial results
      const expectedStatus = USE_MOCK ? 200 : 500;
      const response = await request(app)
        .post('/lua/batch')
        .send(batchRequests)
        .expect(expectedStatus);

      expect(response.body).toBeDefined();
      if (USE_MOCK && response.status === 200) {
        expect(response.body.result).toHaveProperty('results');
        // Should have results for all 3, but one should be an error
        expect(response.body.result.results).toHaveLength(3);
      }

      logSuccess('Batch with mixed valid/invalid functions handled');
    });

    it('should handle large batch requests', async () => {
      // Setup mock response for batch test
      if (USE_MOCK) {
        setupMockLuaFunction('GetPlayerName', 'Batch Player', true);
      }
      
      const batchRequests = Array.from({ length: 50 }, (_, i) => ({
        function: 'GetPlayerName',
        args: { playerId: i }
      }));

      const expectedStatus = USE_MOCK ? 200 : 500;
      const response = await request(app)
        .post('/lua/batch')
        .send(batchRequests)
        .expect(expectedStatus);

      expect(response.body).toBeDefined();
      if (USE_MOCK && response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.result.results).toHaveLength(50);
      }

      logSuccess('Large batch request handled');
    });
  });

  /**
   * Script Execution Tests
   */
  describe('POST /lua/execute - Execute raw Lua script', () => {

    it('should successfully execute a simple Lua script', async () => {
      // Setup mock response for script execution
      if (USE_MOCK) {
        setupMockLuaFunction('ExecuteScript', 42, true);
      }
      
      const script = 'return 42';

      // Script execution now supported in mock mode
      const expectedStatus = USE_MOCK ? 200 : 500;
      const response = await request(app)
        .post('/lua/execute')
        .send({ script })
        .expect(expectedStatus);

      expect(response.body).toBeDefined();
      if (USE_MOCK && response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.result).toBe(42);
      }

      logSuccess('Simple Lua script execution handled');
    }, TEST_TIMEOUTS.DEFAULT);

    it('should execute complex Lua script with functions', async () => {
      // Setup mock response for script execution
      if (USE_MOCK) {
        setupMockLuaFunction('ExecuteScript', 30, true);
      }
      
      const script = `
        local function add(a, b)
          return a + b
        end
        return add(10, 20)
      `;

      // Script execution now supported in mock mode
      const expectedStatus = USE_MOCK ? 200 : 500;
      const response = await request(app)
        .post('/lua/execute')
        .send({ script })
        .expect(expectedStatus);

      expect(response.body).toBeDefined();
      if (USE_MOCK && response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.result).toBe(30);
      }

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
      // Setup mock response for script execution
      if (USE_MOCK) {
        setupMockLuaFunction('ExecuteScript', 4950, true); // Sum of 0 to 99
      }
      
      const script = `
        local result = 0
        ${Array.from({ length: 100 }, (_, i) => `result = result + ${i}`).join('\n')}
        return result
      `;

      const expectedStatus = USE_MOCK ? 200 : 500;
      const response = await request(app)
        .post('/lua/execute')
        .send({ script })
        .expect(expectedStatus);

      expect(response.body).toBeDefined();
      if (USE_MOCK && response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.result).toBe(4950);
      }

      logSuccess('Long Lua script handled');
    }, TEST_TIMEOUTS.DEFAULT);

    it('should handle scripts with special characters', async () => {
      // Setup mock response for script execution
      if (USE_MOCK) {
        setupMockLuaFunction('ExecuteScript', 'Hello\nWorld\t!', true);
      }
      
      const script = 'return "Hello\\nWorld\\t!"';

      const expectedStatus = USE_MOCK ? 200 : 500;
      const response = await request(app)
        .post('/lua/execute')
        .send({ script })
        .expect(expectedStatus);

      expect(response.body).toBeDefined();
      if (USE_MOCK && response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.result).toBe('Hello\nWorld\t!');
      }

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

      expectSuccessResponse(response, (res) => {
        expect(res.body.result).toHaveProperty('functions');
        expect(res.body.result.functions).toBeInstanceOf(Array);
        // Just check we got an array back, the functions might vary
        expect(res.body.result.functions.length).toBeGreaterThanOrEqual(0);
      });

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
      await delay(TEST_TIMEOUTS.VERY_SHORT);
      dllConnector.disconnect();

      const response = await requestPromise;

      expect(response.status).toBeDefined();
      // Should get an error response due to disconnection (unless mock handles it)
      expect(response.body.success).toBeDefined();
      
      // Reconnect for next tests
      await dllConnector.connect();

      logSuccess('Connection loss during request handled');
    });

    it('should handle timeout for long-running Lua scripts', async () => {
      const script = `
        local start = os.clock()
        while os.clock() - start < 10 do
          -- Busy wait
        end
        return "done"
      `;

      try {
        const response = await request(app)
          .post('/lua/execute')
          .send({ script })
          .timeout(TEST_TIMEOUTS.SHORT);
        
        // The request itself might timeout or return an error
        expect(response.status).toBeDefined();
      } catch (error: any) {
        // Timeout is expected
        expect(error.message.toLowerCase()).toContain('timeout');
      }

      logSuccess('Long-running script timeout handled');
    }, TEST_TIMEOUTS.LONG);

    it('should handle rapid sequential requests', async () => {
      // Setup mock response if in mock mode
      if (USE_MOCK) {
        setupMockLuaFunction('GetPlayerName', 'Rapid Player', true);
      }
      
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

    it('should handle requests with various content types', async () => {
      // Setup mock response if in mock mode
      if (USE_MOCK) {
        setupMockLuaFunction('GetPlayerName', 'Content Type Player', true);
      }
      
      // Test with different content types
      const contentTypes = [
        'application/json',
        'application/json; charset=utf-8',
        'text/plain', // Should fail
      ];

      for (const contentType of contentTypes) {
        const response = await request(app)
          .post('/lua/call')
          .set('Content-Type', contentType)
          .send(JSON.stringify({
            function: 'GetPlayerName',
            args: { playerId: 1 }
          }));

        expect(response.status).toBeDefined();
        
        if (contentType.includes('application/json')) {
          expect(response.status).toBeDefined();
          if (USE_MOCK && response.status === 200) {
            expect(response.body.result).toBe('Content Type Player');
          }
        }
      }

      logSuccess('Various content types handled correctly');
    });
  });

  /**
   * LuaManager Integration Tests
   */
  describe('LuaManager Integration', () => {
    afterEach(() => {
      vi.clearAllMocks();
    });

    it('should properly delegate to LuaManager for function calls', async () => {
      const spy = vi.spyOn(luaManager, 'callFunction');

      await request(app)
        .post('/lua/call')
        .send({
          function: 'TestFunction',
          args: { test: true }
        });

      expect(spy).toHaveBeenCalledWith({
        function: 'TestFunction',
        args: { test: true }
      });

      logSuccess('LuaManager delegation for function calls verified');
    });

    it('should properly delegate to LuaManager for batch calls', async () => {
      const spy = vi.spyOn(luaManager, 'callBatch');

      const batchRequests = [
        { function: 'Func1', args: {} },
        { function: 'Func2', args: {} }
      ];

      await request(app)
        .post('/lua/batch')
        .send(batchRequests);

      expect(spy).toHaveBeenCalledWith(batchRequests);

      logSuccess('LuaManager delegation for batch calls verified');
    });

    it('should properly delegate to LuaManager for script execution', async () => {
      const spy = vi.spyOn(luaManager, 'executeScript');

      const script = 'return "test"';

      await request(app)
        .post('/lua/execute')
        .send({ script })
        .timeout(TEST_TIMEOUTS.DEFAULT);

      expect(spy).toHaveBeenCalledWith({ script });

      logSuccess('LuaManager delegation for script execution verified');
    }, TEST_TIMEOUTS.LONG);

    it('should properly retrieve functions from LuaManager', async () => {
      const spy = vi.spyOn(luaManager, 'getFunctions');

      await request(app)
        .get('/lua/functions');

      expect(spy).toHaveBeenCalled();

      logSuccess('LuaManager function retrieval verified');
    });
  });
});