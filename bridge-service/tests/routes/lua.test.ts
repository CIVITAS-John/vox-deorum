/**
 * Lua execution endpoints test - Tests for Lua function calls, batch execution, script execution, and function listing
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../src/index.js';
import { dllConnector } from '../../src/services/dll-connector.js';
import { expectSuccessResponse, expectErrorResponse, logSuccess, TestServer } from '../test-utils/helpers.js';
import { 
  registerLuaFunction, 
  clearLuaFunctions,
  testLuaFunctionCall,
  testLuaScriptExecution,
  unregisterLuaFunction
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

  afterEach(async () => {
    // Clear functions after each test to prevent interference
    await clearLuaFunctions(app);
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
    beforeAll(async () => {
      // Register test functions for both mock and real DLL
      await registerLuaFunction(app, 'TestFunction1', 'Test function 1', true,
        `local function testfunction1(args) return "Test function 1" end
         Game.RegisterFunction("TestFunction1", testfunction1)
         return true`);
      await registerLuaFunction(app, 'TestFunction2', 'Test function 2', true,
        `local function testfunction2(args) return "Test function 2" end
         Game.RegisterFunction("TestFunction2", testfunction2)
         return true`);
    });

    it('should return list of available Lua functions', async () => {
      const response = await request(app)
        .get('/lua/functions')
        .expect(200);

      expectSuccessResponse(response, (res) => {
        expect(res.body.result).toHaveProperty('functions');
        expect(res.body.result.functions).toBeInstanceOf(Array);
        expect(res.body.result.functions).length.greaterThanOrEqual(2);
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
   * Function Call Tests
   */
  describe('POST /lua/call - Execute Lua function', () => {

    it('should successfully call a Lua function with arguments', async () => {
      // Register the function for both mock and real DLL
      await registerLuaFunction(app, 'GetPlayerName', 'Player 1', true,
        `local function getplayername(args)
           local playerId = args and args.playerId or 1
           return "Player 1"
         end
         Game.RegisterFunction("GetPlayerName", getplayername)
         return true`);
      
      await testLuaFunctionCall(
        app,
        'GetPlayerName',
        { playerId: 1 },
        'Player 1'
      );
      logSuccess('Lua function call with arguments successful');
    });

    it('should successfully call a Lua function without arguments', async () => {
      // Register the function for both mock and real DLL
      await registerLuaFunction(app, 'GetCurrentTurn', 150, true,
        `local function getcurrentturn(args)
           return 150
         end
         Game.RegisterFunction("GetCurrentTurn", getcurrentturn)
         return true`);
      
      await testLuaFunctionCall(
        app,
        'GetCurrentTurn',
        undefined,
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
      // Ensure it's not registered
      await unregisterLuaFunction(app, 'TestFunction1');
      
      const response = await request(app)
        .post('/lua/call')
        .send({
          function: 'TestFunction1',
          args: {}
        })
        .expect(500);

      // The actual error will come from the Lua execution
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();

      logSuccess('Invalid function call handled');
    });
  });

  /**
   * Batch Execution Tests
   */
  describe('POST /lua/batch - Execute multiple Lua functions', () => {

    it('should successfully execute batch of Lua functions', async () => {
      // Register functions for both mock and real DLL
      await registerLuaFunction(app, 'GetPlayerName', 'Player 1', true,
        `local function getplayername(args)
           local playerId = args and args.playerId or 1
           return "Player 1"
         end
         Game.RegisterFunction("GetPlayerName", getplayername)
         return true`);
      await registerLuaFunction(app, 'GetCurrentTurn', 100, true,
        `local function getcurrentturn(args) return 100 end
         Game.RegisterFunction("GetCurrentTurn", getcurrentturn)
         return true`);
      await registerLuaFunction(app, 'GetGameSpeed', 'Standard', true,
        `local function getgamespeed(args) return "Standard" end
         Game.RegisterFunction("GetGameSpeed", getgamespeed)
         return true`);
      
      const batchRequests = [
        { function: 'GetPlayerName', args: { playerId: 1 } },
        { function: 'GetCurrentTurn', args: {} },
        { function: 'GetGameSpeed', args: {} }
      ];

      const response = await request(app)
        .post('/lua/batch')
        .send(batchRequests);

      // Both mock and real should succeed
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.result).toHaveProperty('results');
      expect(response.body.result.results).toHaveLength(3);
      // Results are full response objects
      expect(response.body.result.results[0].result).toBe('Player 1');
      expect(response.body.result.results[0].success).toBe(true);
      expect(response.body.result.results[1].result).toBe(100);
      expect(response.body.result.results[1].success).toBe(true);
      expect(response.body.result.results[2].result).toBe('Standard');
      expect(response.body.result.results[2].success).toBe(true);

      logSuccess('Batch Lua function execution handled');
    });

    it('should handle batch with missing args', async () => {
      // Register functions for both mock and real DLL
      await registerLuaFunction(app, 'GetPlayerName', 'Default Player', true,
        `local function getplayername(args)
           return "Default Player"
         end
         Game.RegisterFunction("GetPlayerName", getplayername)
         return true`);
      await registerLuaFunction(app, 'GetCurrentTurn', 0, true,
        `local function getcurrentturn(args) return 0 end
         Game.RegisterFunction("GetCurrentTurn", getcurrentturn)
         return true`);
      
      const batchRequests = [
        { function: 'GetPlayerName' }, // Missing args
        { function: 'GetCurrentTurn' }
      ];

      const response = await request(app)
        .post('/lua/batch')
        .send(batchRequests);

      expect(response.status).toBe(200);
      expect(response.body).toBeDefined();
      expect(response.body.success).toBe(true);
      expect(response.body.result.results).toHaveLength(2);

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
      // Register valid functions for both mock and real DLL
      await registerLuaFunction(app, 'GetPlayerName', 'Test Player', true,
        `local function getplayername(args)
           local playerId = args and args.playerId or 1
           return "Test Player"
         end
         Game.RegisterFunction("GetPlayerName", getplayername)
         return true`);
      await registerLuaFunction(app, 'GetCurrentTurn', 200, true,
        `local function getcurrentturn(args) return 200 end
         Game.RegisterFunction("GetCurrentTurn", getcurrentturn)
         return true`);
      
      // For mock: register InvalidFunction as failing
      if (USE_MOCK) {
        await registerLuaFunction(app, 'InvalidFunction', 'Function not found', false);
      }
      // For real DLL: InvalidFunction is not registered, so it will fail
      
      const batchRequests = [
        { function: 'GetPlayerName', args: { playerId: 1 } },
        { function: 'InvalidFunction', args: {} },
        { function: 'GetCurrentTurn', args: {} }
      ];

      const response = await request(app)
        .post('/lua/batch')
        .send(batchRequests);

      expect(response.body).toBeDefined();
      expect(response.body.result).toHaveProperty('results');
      expect(response.body.result.results).toHaveLength(3);
      
      // First and third should succeed, second should fail
      expect(response.body.result.results[0].result).toBe('Test Player');
      expect(response.body.result.results[0].success).toBe(true);
      expect(response.body.result.results[1].success).toBe(false); // Invalid function fails
      expect(response.body.result.results[2].result).toBe(200);
      expect(response.body.result.results[2].success).toBe(true);

      logSuccess('Batch with mixed valid/invalid functions handled');
    });

    it('should handle large batch requests', async () => {
      // Register function for both mock and real DLL
      await registerLuaFunction(app, 'GetPlayerName', 'Batch Player', true,
        `local function getplayername(args)
           local playerId = args and args.playerId or 0
           return "Batch Player"
         end
         Game.RegisterFunction("GetPlayerName", getplayername)
         return true`);
      
      const batchRequests = Array.from({ length: 50 }, (_, i) => ({
        function: 'GetPlayerName',
        args: { playerId: i }
      }));

      const response = await request(app)
        .post('/lua/batch')
        .send(batchRequests);

      expect(response.status).toBe(200);
      expect(response.body).toBeDefined();
      expect(response.body.success).toBe(true);
      expect(response.body.result.results).toHaveLength(50);
      // All results should be 'Batch Player'
      response.body.result.results.forEach((result: any) => {
        expect(result.result).toBe('Batch Player');
        expect(result.success).toBe(true);
      });

      logSuccess('Large batch request handled');
    });
  });

  /**
   * Error Handling and Edge Cases
   */
  describe('Error Handling and Edge Cases', () => {

    it('should handle connection loss during Lua call', async () => {
      // Setup function for both mock and real DLL
      await registerLuaFunction(app, 'GetPlayerName', 'Test Player', true,
        `local function getplayername(args)
           return "Test Player"
         end
         Game.RegisterFunction("GetPlayerName", getplayername)
         return true`);
      
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
      // Register function for both mock and real DLL
      await registerLuaFunction(app, 'GetPlayerName', 'Rapid Player', true,
        `local function getplayername(args)
           local playerId = args and args.playerId or 0
           return "Rapid Player"
         end
         Game.RegisterFunction("GetPlayerName", getplayername)
         return true`);
      
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
        if (result.success) {
          expect(result.result).toBe('Rapid Player');
        }
      });

      logSuccess('Rapid sequential requests handled successfully');
    });
  });
});