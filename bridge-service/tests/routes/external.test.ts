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
  logSuccess,
  TestServer
} from '../test-utils/helpers.js';
import { MockExternalService } from '../test-utils/mock-external-service.js';
import { TEST_PORTS, TEST_URLS, TEST_TIMEOUTS } from '../test-utils/constants.js';
import {
  registerExternalFunction,
  testExternalFunctionCall,
  verifyExternalResponse,
  createTestExternalRegistration,
  waitForExternalRegistration,
  unregisterExternalFunction,
  verifyFunctionRegistered
} from '../test-utils/external-helpers.js';
import { USE_MOCK } from '../setup.js';

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
      await registerExternalFunction(app, registration);
      
      // In mock mode, check that message was sent to DLL
      if (USE_MOCK) {
        expect(sentMessages.find(msg => 
          msg.type === 'external_register' && msg.name === registration.name
        )).toBeDefined();
      }
      
      // Wait for registration to be confirmed
      const registered = await waitForExternalRegistration(app, registration.name);
      expect(registered).toBe(true);
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
        await unregisterExternalFunction(app, 'testFunction');
        
        // In mock mode, check that unregister message was sent
        if (USE_MOCK) {
          expect(sentMessages.find(msg => 
            msg.type === 'external_unregister' && msg.name === 'testFunction'
          )).toBeDefined();
        }
        
        // Verify function is no longer registered
        const stillRegistered = await waitForExternalRegistration(app, 'testFunction');
        expect(stillRegistered).toBe(false);
        
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
          await registerExternalFunction(app, func);
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
   * These tests work for both mock and real DLL modes
   */
  describe('External Function Calls', () => {
    beforeEach(async () => {
      // Register test functions using helper that works for both modes
      const syncFunction = createTestExternalRegistration(
        'syncTestFunction',
        TEST_URLS.MOCK_SERVICE,
        // The timeout for sync external call is 1s (to avoid clogging the game)
        { async: false, timeout: TEST_TIMEOUTS.VERY_SHORT }
      );
      
      const asyncFunction = createTestExternalRegistration(
        'asyncTestFunction',
        TEST_URLS.MOCK_SERVICE,
        { async: true, timeout: TEST_TIMEOUTS.SHORT }
      );
      
      await registerExternalFunction(app, syncFunction);
      await registerExternalFunction(app, asyncFunction);
      
      // Wait for registration to propagate in real mode
      if (!USE_MOCK) {
        await waitForExternalRegistration(app, 'syncTestFunction');
        await waitForExternalRegistration(app, 'asyncTestFunction');
      }
    });

    afterEach(async () => {
      // Clean up
      await cleanupAllExternalFunctions(app);
    });

    it('should handle synchronous external function call', async () => {
      const argument = 'test-sync-call-1';

      // Use helper function that works for both mock and real modes
      const response = await testExternalFunctionCall(
        app,
        'syncTestFunction',
        argument,
        false // synchronous
      );
      
      // Verify response structure
      verifyExternalResponse(response, argument, true);
      
      // Verify external service was called (only in mock mode)
      if (USE_MOCK) {
        expect(mockExternalService.getCallCount()).toBe(1);
        expect(mockExternalService.getLastRequest().args).toEqual(argument);
      }
      
      logSuccess('Synchronous external function call handled');
    });

    it('should handle asynchronous external function call', async () => {
      const argument = 'test-async-call-1';
      
      // Use helper function that works for both mock and real modes
      const response = await testExternalFunctionCall(
        app,
        'asyncTestFunction',
        argument,
        true // asynchronous
      );
      
      // Verify response structure
      verifyExternalResponse(response, argument, true);
      
      // Verify external service was called (only in mock mode)
      if (USE_MOCK) {
        expect(mockExternalService.getCallCount()).toBe(1);
      }
      
      logSuccess('Asynchronous external function call handled');
    });

    it('should handle external function call timeout', async () => {
      // Set response delay longer than timeout
      mockExternalService.setResponseDelay(3000);
      const argument = 'test-timeout-call-1';
      
      // Use helper function that works for both mock and real modes
      const response = await testExternalFunctionCall(
        app,
        'syncTestFunction',
        argument,
        false // synchronous
      );
      
      // Verify timeout error response
      verifyExternalResponse(response, argument, false);
      expect(response.error.code).toBe(ErrorCode.CALL_TIMEOUT);
      expect(response.error.message).toContain('timed out');
      
      logSuccess('External function timeout handled correctly');
    });

    it('should handle external service failure', async () => {
      // Configure mock service to fail
      mockExternalService.setFailure(true, 503);
      
      const args = { failure: 'test' };
      const argument = 'test-failure-call-1';
      
      // Use helper function that works for both mock and real modes
      const response = await testExternalFunctionCall(
        app,
        'syncTestFunction',
        argument,
        false // synchronous
      );
      
      // Verify failure response
      verifyExternalResponse(response, argument, false);
      expect(response.error.code).toBe(ErrorCode.NETWORK_ERROR);
      expect(response.error.message).toContain('failed with status 503');
      
      logSuccess('External service failure handled correctly');
    });

    it('should handle call to unregistered function', async () => {
      const args = { test: 'data' };
      const argument = 'test-unregistered-call-1';
      
      // Use helper function that works for both mock and real modes
      const response = await testExternalFunctionCall(
        app,
        'unregisteredFunction',
        argument,
        false // synchronous
      );
      
      // Verify error response for unregistered function
      verifyExternalResponse(response, argument, false);
      expect(response.error.code).toBe(ErrorCode.INVALID_FUNCTION);
      expect(response.error.message).toContain('not registered');
      
      logSuccess('Unregistered function call handled correctly');
    });

    // Additional tests for real DLL mode
    it('should handle multiple concurrent external calls', async () => {
      const arguments = ['test-concurrent-1', 'test-concurrent-2', 'test-concurrent-3'];
      const promises: Promise<any>[] = [];
      
      // Start multiple concurrent calls
      for (let i = 0; i < arguments.length; i++) {
        const promise = testExternalFunctionCall(
          app,
          i % 2 === 0 ? 'syncTestFunction' : 'asyncTestFunction',
          arguments[i],
          i % 2 === 1 // alternate between sync and async
        );
        promises.push(promise);
      }
      
      // Wait for all responses
      const responses = await Promise.all(promises);
      
      // Verify all responses are successful
      responses.forEach((response, i) => {
        verifyExternalResponse(response, arguments[i], true);
        expect(response.result.echo).toMatchObject({ index: i, test: 'concurrent' });
      });
      
      logSuccess('Multiple concurrent external calls handled');
    });

    it('should properly handle function re-registration', async () => {
      const functionName = 'reregisterTestFunction';
      const oldUrl = TEST_URLS.MOCK_SERVICE;
      const newUrl = TEST_URLS.MOCK_SERVICE + '/v2';
      
      // Register the function with initial URL
      await registerExternalFunction(app, createTestExternalRegistration(
        functionName,
        oldUrl,
        { async: true }
      ));
      
      // Verify initial registration
      await verifyFunctionRegistered(app, functionName, oldUrl);
      
      // Unregister the function
      await unregisterExternalFunction(app, functionName);
      
      // Re-register with different URL
      await registerExternalFunction(app, createTestExternalRegistration(
        functionName,
        newUrl,
        { async: true }
      ));
      
      // Verify new registration
      await verifyFunctionRegistered(app, functionName, newUrl);
      
      // Clean up
      await unregisterExternalFunction(app, functionName);
      
      logSuccess('Function re-registration handled correctly');
    });
  });
});