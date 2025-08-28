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
  const sentMessages: any[] = [];

  // Capture messages sent to DLL
  const captureHandler = (data: any) => {
    if (data.type === 'external_register' || data.type === 'external_unregister') {
      sentMessages.push(data);
    }
  };

  // Setup and teardown
  beforeAll(async () => {
    // Start mock external service
    await mockExternalService.start();
    
    // Start the test server
    await testServer.start(app, config.rest.port, config.rest.host);
    
    // Listen for messages sent to DLL
    dllConnector.on('ipc_send', captureHandler);
  });

  afterAll(async () => {
    // Remove listener
    dllConnector.off('ipc_send', captureHandler);
    
    // Close the test server
    await testServer.stop();
    
    // Stop mock external service
    await mockExternalService.stop();
  });

  beforeEach(() => {
    mockExternalService.reset();
    // Clear captured messages
    sentMessages.length = 0;
  });

  /**
   * Function Registration, Unregistration, and Listing Tests
   */
  describe('External Function Management', () => {
    const testRegistration = {
      name: 'testFunction',
      url: TEST_URLS.MOCK_SERVICE,
      async: true,
      timeout: TEST_TIMEOUTS.DEFAULT,
      description: 'Test function for unit tests'
    };

    afterEach(async () => await cleanupAllExternalFunctions(app));

    // Helper function to register and verify
    const registerAndVerify = async (registration: ExternalFunctionRegistration) => {
      await request(app).post('/external/register').send(registration).expect(200);
      await delay(100);
      expect(sentMessages.find(msg => 
        msg.type === 'external_register' && msg.name === registration.name
      )).toBeDefined();
    };

    // Helper function to verify function listing
    const verifyFunctionsList = async (expectedNames: string[]) => {
      const response = await request(app).get('/external/functions').expect(200);
      expectSuccessResponse(response, (res) => {
        expect(res.body.result.functions).toHaveLength(expectedNames.length);
        const names = res.body.result.functions.map((f: any) => f.name);
        expectedNames.forEach(name => expect(names).toContain(name));
      });
    };

    describe('Registration', () => {
      it('should register function, send DLL message, and list correctly', async () => {
        await registerAndVerify(testRegistration);
        await verifyFunctionsList(['testFunction']);
      });

      it.each([
        { registration: { name: '123-invalid!', url: TEST_URLS.MOCK_SERVICE, async: true }, expectedError: 'valid identifier' },
        { registration: { name: 'testFunction', url: 'not-a-valid-url', async: true }, expectedError: 'valid URL' },
        { registration: { name: 'testFunction', url: TEST_URLS.MOCK_SERVICE, async: true, timeout: -1000 }, expectedError: 'positive integer' }
      ])('should reject invalid registration: $expectedError', async ({ registration, expectedError }) => {
        const response = await request(app).post('/external/register').send(registration).expect(500);
        expectErrorResponse(response, ErrorCode.INVALID_ARGUMENTS, expectedError);
      });

      it('should reject duplicate registration', async () => {
        await request(app).post('/external/register').send(testRegistration).expect(200);
        const response = await request(app).post('/external/register').send(testRegistration).expect(500);
        expectErrorResponse(response, ErrorCode.INVALID_ARGUMENTS, 'already registered');
      });
    });

    describe('Unregistration', () => {
      beforeEach(async () => await registerAndVerify(testRegistration));

      it('should unregister function, send DLL message, and update list', async () => {
        await request(app).delete('/external/register/testFunction').expect(200);
        await delay(100);
        expect(sentMessages.find(msg => 
          msg.type === 'external_unregister' && msg.name === 'testFunction'
        )).toBeDefined();
        await verifyFunctionsList([]);
      });

      it('should error when unregistering non-existent function', async () => {
        const response = await request(app).delete('/external/register/nonExistent').expect(500);
        expectErrorResponse(response, ErrorCode.INVALID_FUNCTION, 'not registered');
      });
    });

    describe('Listing', () => {
      it('should return multiple registered functions with details', async () => {
        const functions = [
          { name: 'func1', url: TEST_URLS.MOCK_SERVICE, async: true },
          { name: 'func2', url: TEST_URLS.MOCK_SERVICE, async: false },
          { name: 'func3', url: TEST_URLS.MOCK_SERVICE, async: true, description: 'Test function 3' }
        ];

        for (const func of functions) {
          await request(app).post('/external/register').send(func);
        }

        const response = await request(app).get('/external/functions').expect(200);
        expectSuccessResponse(response, (res) => {
          expect(res.body.result.functions).toHaveLength(3);
          const func3 = res.body.result.functions.find((f: any) => f.name === 'func3');
          expect(func3.description).toBe('Test function 3');
          expect(func3.async).toBe(true);
        });
      });
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
});