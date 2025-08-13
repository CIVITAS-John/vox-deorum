/**
 * External function registration test - Tests for external function registration, unregistration, and listing
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/index.js';
import { externalManager } from '../../src/services/external-manager.js';
import { dllConnector } from '../../src/services/dll-connector.js';
import config from '../../src/utils/config.js';
import { ExternalFunctionRegistration } from '../../src/types/external.js';
import { ErrorCode } from '../../src/types/api.js';
import { 
  cleanupAllExternalFunctions, 
  expectSuccessResponse, 
  expectErrorResponse,
  waitForDLLResponse,
  logSuccess,
  delay,
  TestServer
} from '../test-utils/helpers.js';
import { MockExternalService } from '../test-utils/mock-external-service.js';
import { TEST_PORTS, TEST_URLS, TEST_TIMEOUTS } from '../test-utils/constants.js';

describe('External Routes', () => {
  const testServer = new TestServer();
  let mockExternalService = new MockExternalService(TEST_PORTS.MOCK_EXTERNAL_SERVICE);

  // Setup and teardown
  beforeAll(async () => {
    // Start mock external service
    await mockExternalService.start();
    
    // Start the test server
    await testServer.start(app, config.rest.port, config.rest.host);
  });

  afterAll(async () => {
    // Close the test server
    await testServer.stop();
    
    // Stop mock external service
    await mockExternalService.stop();
  });

  beforeEach(() => {
    mockExternalService.reset();
  });

  /**
   * Function Registration Tests
   */
  describe('POST /external/register', () => {
    afterEach(async () => {
      // Clean up any registered functions
      await cleanupAllExternalFunctions(app);
    });

    it('should register a valid external function', async () => {
      const registration: ExternalFunctionRegistration = {
        name: 'testFunction',
        url: TEST_URLS.MOCK_SERVICE,
        async: true,
        timeout: TEST_TIMEOUTS.DEFAULT,
        description: 'Test function for unit tests'
      };

      const response = await request(app)
        .post('/external/register')
        .send(registration)
        .expect(200);

      expectSuccessResponse(response);
      
      // Verify function is registered
      const functionsResponse = await request(app)
        .get('/external/functions')
        .expect(200);
      
      expectSuccessResponse(functionsResponse, (res) => {
        expect(res.body.result.functions).toHaveLength(1);
        expect(res.body.result.functions[0].name).toBe('testFunction');
      });
    });

    it.each([
      {
        registration: {
          name: '123-invalid-name!',
          url: TEST_URLS.MOCK_SERVICE,
          async: true
        },
        expectedError: 'valid identifier',
        testCase: 'invalid function name'
      },
      {
        registration: {
          name: 'testFunction',
          url: 'not-a-valid-url',
          async: true
        },
        expectedError: 'valid URL',
        testCase: 'invalid URL'
      },
      {
        registration: {
          name: 'testFunction',
          url: TEST_URLS.MOCK_SERVICE,
          async: true,
          timeout: -1000
        },
        expectedError: 'positive integer',
        testCase: 'invalid timeout'
      }
    ])('should reject registration with $testCase', async ({ registration, expectedError }) => {
      const response = await request(app)
        .post('/external/register')
        .send(registration)
        .expect(500);

      expectErrorResponse(response, ErrorCode.INVALID_ARGUMENTS, expectedError);
    });

    it('should reject duplicate function registration', async () => {
      const registration: ExternalFunctionRegistration = {
        name: 'duplicateFunction',
        url: TEST_URLS.MOCK_SERVICE,
        async: true
      };

      // First registration should succeed
      await request(app)
        .post('/external/register')
        .send(registration)
        .expect(200);

      // Second registration should fail
      const response = await request(app)
        .post('/external/register')
        .send(registration)
        .expect(500);

      expectErrorResponse(response, ErrorCode.INVALID_ARGUMENTS, 'already registered');
    });
  });

  /**
   * Function Unregistration Tests
   */
  describe('DELETE /external/register/:name', () => {
    beforeEach(async () => {
      // Register a test function
      const registration: ExternalFunctionRegistration = {
        name: 'functionToDelete',
        url: TEST_URLS.MOCK_SERVICE,
        async: true
      };
      await request(app)
        .post('/external/register')
        .send(registration);
    });

    afterEach(async () => {
      // Clean up
      await cleanupAllExternalFunctions(app);
    });

    it('should unregister an existing function', async () => {
      const response = await request(app)
        .delete('/external/register/functionToDelete')
        .expect(200);

      expectSuccessResponse(response);

      // Verify function is unregistered
      const functionsResponse = await request(app)
        .get('/external/functions')
        .expect(200);
      
      expectSuccessResponse(functionsResponse, (res) => {
        expect(res.body.result.functions).toHaveLength(0);
      });
    });

    it('should return error when unregistering non-existent function', async () => {
      const response = await request(app)
        .delete('/external/register/nonExistentFunction')
        .expect(500);

      expectErrorResponse(response, ErrorCode.INVALID_FUNCTION, 'not registered');
    });
  });

  /**
   * Function Listing Tests
   */
  describe('GET /external/functions', () => {
    afterEach(async () => {
      // Clean up all registered functions
      await cleanupAllExternalFunctions(app)
    });

    it('should return all registered functions', async () => {
      // Register multiple functions
      const functions = [
        { name: 'func1', url: TEST_URLS.MOCK_SERVICE, async: true },
        { name: 'func2', url: TEST_URLS.MOCK_SERVICE, async: false },
        { name: 'func3', url: TEST_URLS.MOCK_SERVICE, async: true, description: 'Test function 3' }
      ];

      for (const func of functions) {
        await request(app)
          .post('/external/register')
          .send(func);
      }

      const response = await request(app)
        .get('/external/functions')
        .expect(200);

      expectSuccessResponse(response, (res) => {
        expect(res.body.result.functions).toHaveLength(3);
      });
      
      const names = response.body.result.functions.map((f: any) => f.name);
      expect(names).toContain('func1');
      expect(names).toContain('func2');
      expect(names).toContain('func3');
      
      // Check that function details are preserved
      const func3 = response.body.result.functions.find((f: any) => f.name === 'func3');
      expect(func3.description).toBe('Test function 3');
      expect(func3.async).toBe(true);
      expect(func3.url).toBe(TEST_URLS.MOCK_SERVICE);
    });
  });

  /**
   * External Function Call Tests (via DLL events)
   */
  describe('External Function Calls', () => {
    beforeEach(async () => {
      // Register test functions
      const syncFunction: ExternalFunctionRegistration = {
        name: 'syncTestFunction',
        url: TEST_URLS.MOCK_SERVICE,
        async: false,
        timeout: TEST_TIMEOUTS.SHORT
      };
      
      const asyncFunction: ExternalFunctionRegistration = {
        name: 'asyncTestFunction',
        url: TEST_URLS.MOCK_SERVICE,
        async: true,
        timeout: TEST_TIMEOUTS.SHORT
      };
      
      await request(app).post('/external/register').send(syncFunction);
      await request(app).post('/external/register').send(asyncFunction);
    });

    afterEach(async () => {
      // Clean up
      await cleanupAllExternalFunctions(app);
    });

    it('should handle synchronous external function call', async () => {
      const responsePromise = waitForDLLResponse(dllConnector, 'test-sync-call-1');

      // Simulate external call from DLL
      dllConnector.emit('external_call', {
        function: 'syncTestFunction',
        args: { test: 'data', value: 42 },
        id: 'test-sync-call-1',
        async: false
      });

      const response = await responsePromise as any;
      
      expect(response.type).toBe('external_response');
      expect(response.id).toBe('test-sync-call-1');
      expect(response.success).toBe(true);
      // The mock service returns { success: true, result: { ... } }
      // This gets spread into the response
      expect(response.result.echo).toEqual({ test: 'data', value: 42 });
      expect(response.result.processed).toBe(true);
      
      // Verify external service was called
      expect(mockExternalService.getCallCount()).toBe(1);
      expect(mockExternalService.getLastRequest().args).toEqual({ test: 'data', value: 42 });
      
      logSuccess('Synchronous external function call handled');
    });

    it('should handle asynchronous external function call', async () => {
      const responsePromise = waitForDLLResponse(dllConnector, 'test-async-call-1');

      // Simulate external call from DLL
      dllConnector.emit('external_call', {
        function: 'asyncTestFunction',
        args: { async: true, data: 'async-test' },
        id: 'test-async-call-1',
        async: true
      });

      const response = await responsePromise as any;
      
      expect(response.type).toBe('external_response');
      expect(response.id).toBe('test-async-call-1');
      expect(response.success).toBe(true);
      expect(response.result.echo).toEqual({ async: true, data: 'async-test' });
      
      // Verify external service was called
      expect(mockExternalService.getCallCount()).toBe(1);
      
      logSuccess('Asynchronous external function call handled');
    });

    it('should handle external function call timeout', async () => {
      // Set response delay longer than timeout
      mockExternalService.setResponseDelay(3000);
      
      const responsePromise = waitForDLLResponse(dllConnector, 'test-timeout-call-1');

      // Simulate external call from DLL
      dllConnector.emit('external_call', {
        function: 'syncTestFunction',
        args: { timeout: 'test' },
        id: 'test-timeout-call-1',
        async: false
      });

      const response = await responsePromise as any;
      
      expect(response.type).toBe('external_response');
      expect(response.id).toBe('test-timeout-call-1');
      expect(response.success).toBe(false);
      expect(response.error.code).toBe(ErrorCode.CALL_TIMEOUT);
      expect(response.error.message).toContain('timed out');
      expect(response.error.message).toContain('2000ms');
      
      logSuccess('External function timeout handled correctly');
    });

    it('should handle external service failure', async () => {
      // Configure mock service to fail
      mockExternalService.setFailure(true, 503);
      
      const responsePromise = waitForDLLResponse(dllConnector, 'test-failure-call-1');

      // Simulate external call from DLL
      dllConnector.emit('external_call', {
        function: 'syncTestFunction',
        args: { failure: 'test' },
        id: 'test-failure-call-1',
        async: false
      });

      const response = await responsePromise as any;
      
      expect(response.type).toBe('external_response');
      expect(response.id).toBe('test-failure-call-1');
      expect(response.success).toBe(false);
      expect(response.error.code).toBe(ErrorCode.NETWORK_ERROR);
      expect(response.error.message).toContain('failed with status 503');
      
      logSuccess('External service failure handled correctly');
    });

    it('should handle call to unregistered function', async () => {
      const responsePromise = waitForDLLResponse(dllConnector, 'test-unregistered-call-1');

      // Simulate external call to unregistered function
      dllConnector.emit('external_call', {
        function: 'unregisteredFunction',
        args: { test: 'data' },
        id: 'test-unregistered-call-1',
        async: false
      });

      const response = await responsePromise as any;
      
      expect(response.type).toBe('external_response');
      expect(response.id).toBe('test-unregistered-call-1');
      expect(response.success).toBe(false);
      expect(response.error.code).toBe(ErrorCode.INVALID_FUNCTION);
      expect(response.error.message).toContain('not registered');
      
      logSuccess('Unregistered function call handled correctly');
    });
  });

  /**
   * Integration with Manager Statistics
   */
  describe('External Manager Statistics', () => {
    afterEach(async () => {
      // Clean up all registered functions
      await cleanupAllExternalFunctions(app)
    });

    it('should report external function stats', () => {
      const stats = externalManager.getStats();
      expect(stats).toHaveProperty('registeredFunctions');
      expect(stats).toHaveProperty('functionNames');
      expect(stats.registeredFunctions).toBe(0);
      expect(stats.functionNames).toEqual([]);
    });

    it('should update stats after registration', async () => {
      const registration: ExternalFunctionRegistration = {
        name: 'statsTestFunction',
        url: TEST_URLS.MOCK_SERVICE,
        async: true
      };

      await request(app)
        .post('/external/register')
        .send(registration);

      const stats = externalManager.getStats();
      expect(stats.registeredFunctions).toBe(1);
      expect(stats.functionNames).toContain('statsTestFunction');
    });
  });

  /**
   * Re-registration after DLL reconnection
   */
  describe('DLL Reconnection Handling', () => {
    it('should re-register all functions after reconnection', async () => {
      // Register multiple functions
      const functions = [
        { name: 'reconnectFunc1', url: TEST_URLS.MOCK_SERVICE, async: true },
        { name: 'reconnectFunc2', url: TEST_URLS.MOCK_SERVICE, async: false }
      ];

      for (const func of functions) {
        await request(app).post('/external/register').send(func);
      }

      // Track re-registration messages
      const reregisteredFunctions: string[] = [];
      const handler = (data: any) => {
        if (data.type === 'external_register') {
          reregisteredFunctions.push(data.name);
        }
      };
      
      dllConnector.on('ipc_send', handler);
      
      // Trigger re-registration
      externalManager.reregisterAll();
      
      // Wait for re-registration to complete
      await delay(TEST_TIMEOUTS.VERY_SHORT);
      
      dllConnector.off('ipc_send', handler);
      
      // Verify all functions were re-registered
      expect(reregisteredFunctions).toContain('reconnectFunc1');
      expect(reregisteredFunctions).toContain('reconnectFunc2');
      
      // Clean up
      for (const func of functions) {
        await request(app).delete(`/external/register/${func.name}`);
      }
    });
  });
});