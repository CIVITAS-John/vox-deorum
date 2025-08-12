/**
 * External function registration test - Tests for external function registration, unregistration, and listing
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { app } from '../../src/index.js';
import { externalManager } from '../../src/services/external-manager.js';
import { dllConnector } from '../../src/services/dll-connector.js';
import bridgeService from '../../src/service.js';
import config from '../../src/utils/config.js';
import { ExternalFunctionRegistration } from '../../src/types/external.js';
import { ErrorCode } from '../../src/types/api.js';

/**
 * Mock external service for testing external function calls
 */
class MockExternalService {
  private app: express.Application;
  private server: any;
  private callCount: number = 0;
  private lastRequest: any = null;
  private responseDelay: number = 0;
  private shouldFail: boolean = false;
  private failureStatus: number = 500;

  constructor(private port: number) {
    this.app = express();
    this.app.use(express.json());
    
    // Mock endpoint for external function calls
    this.app.post('/execute', async (req, res) => {
      this.callCount++;
      this.lastRequest = req.body;
      
      if (this.responseDelay > 0) {
        await new Promise(resolve => setTimeout(resolve, this.responseDelay));
      }
      
      if (this.shouldFail) {
        res.status(this.failureStatus).json({
          success: false,
          error: 'Mock failure'
        });
      } else {
        res.json({
          success: true,
          result: {
            echo: req.body.args,
            processed: true,
            timestamp: new Date().toISOString()
          }
        });
      }
    });
  }

  async start(): Promise<void> {
    return new Promise(resolve => {
      this.server = this.app.listen(this.port, () => {
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    return new Promise(resolve => {
      if (this.server) {
        this.server.close(() => resolve());
      } else {
        resolve();
      }
    });
  }

  setResponseDelay(ms: number): void {
    this.responseDelay = ms;
  }

  setFailure(shouldFail: boolean, status: number = 500): void {
    this.shouldFail = shouldFail;
    this.failureStatus = status;
  }

  getCallCount(): number {
    return this.callCount;
  }

  getLastRequest(): any {
    return this.lastRequest;
  }

  reset(): void {
    this.callCount = 0;
    this.lastRequest = null;
    this.responseDelay = 0;
    this.shouldFail = false;
    this.failureStatus = 500;
  }
}

describe('External Routes', () => {
  let server: any;
  let mockExternalService: MockExternalService;
  const mockServicePort = 19876;  // Changed to avoid conflicts
  const mockServiceUrl = `http://localhost:${mockServicePort}/execute`;

  // Setup and teardown
  beforeAll(async () => {
    // Start mock external service
    mockExternalService = new MockExternalService(mockServicePort);
    await mockExternalService.start();
    
    // Start the bridge service (DLL connection)
    await bridgeService.start();
    
    // Start the Express server
    server = app.listen(config.rest.port, config.rest.host);
    
    // Wait for server to be ready
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  afterAll(async () => {
    // Close the Express server
    if (server) {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    }
    
    // Shutdown bridge service
    await bridgeService.shutdown();
    
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
      const functionsResponse = await request(app).get('/external/functions');
      if (functionsResponse.body.success && functionsResponse.body.result.functions) {
        for (const func of functionsResponse.body.result.functions) {
          await request(app).delete(`/external/register/${func.name}`);
        }
      }
    });

    it('should register a valid external function', async () => {
      const registration: ExternalFunctionRegistration = {
        name: 'testFunction',
        url: mockServiceUrl,
        async: true,
        timeout: 5000,
        description: 'Test function for unit tests'
      };

      const response = await request(app)
        .post('/external/register')
        .send(registration)
        .expect(200);

      expect(response.body.success).toBe(true);
      
      // Verify function is registered
      const functionsResponse = await request(app)
        .get('/external/functions')
        .expect(200);
      
      expect(functionsResponse.body.success).toBe(true);
      expect(functionsResponse.body.result.functions).toHaveLength(1);
      expect(functionsResponse.body.result.functions[0].name).toBe('testFunction');
    });

    it('should reject registration with invalid function name', async () => {
      const registration: ExternalFunctionRegistration = {
        name: '123-invalid-name!',
        url: mockServiceUrl,
        async: true
      };

      const response = await request(app)
        .post('/external/register')
        .send(registration)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe(ErrorCode.INVALID_ARGUMENTS);
      expect(response.body.error.message).toContain('valid identifier');
    });

    it('should reject registration with invalid URL', async () => {
      const registration: ExternalFunctionRegistration = {
        name: 'testFunction',
        url: 'not-a-valid-url',
        async: true
      };

      const response = await request(app)
        .post('/external/register')
        .send(registration)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe(ErrorCode.INVALID_ARGUMENTS);
      expect(response.body.error.message).toContain('valid URL');
    });

    it('should reject registration with invalid timeout', async () => {
      const registration: ExternalFunctionRegistration = {
        name: 'testFunction',
        url: mockServiceUrl,
        async: true,
        timeout: -1000
      };

      const response = await request(app)
        .post('/external/register')
        .send(registration)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe(ErrorCode.INVALID_ARGUMENTS);
      expect(response.body.error.message).toContain('positive integer');
    });

    it('should reject duplicate function registration', async () => {
      const registration: ExternalFunctionRegistration = {
        name: 'duplicateFunction',
        url: mockServiceUrl,
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

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe(ErrorCode.INVALID_ARGUMENTS);
      expect(response.body.error.message).toContain('already registered');
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
        url: mockServiceUrl,
        async: true
      };
      await request(app)
        .post('/external/register')
        .send(registration);
    });

    afterEach(async () => {
      // Clean up
      await request(app).delete('/external/register/functionToDelete');
    });

    it('should unregister an existing function', async () => {
      const response = await request(app)
        .delete('/external/register/functionToDelete')
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify function is unregistered
      const functionsResponse = await request(app)
        .get('/external/functions')
        .expect(200);
      
      expect(functionsResponse.body.result.functions).toHaveLength(0);
    });

    it('should return error when unregistering non-existent function', async () => {
      const response = await request(app)
        .delete('/external/register/nonExistentFunction')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe(ErrorCode.INVALID_FUNCTION);
      expect(response.body.error.message).toContain('not registered');
    });
  });

  /**
   * Function Listing Tests
   */
  describe('GET /external/functions', () => {
    afterEach(async () => {
      // Clean up all registered functions
      const functionsResponse = await request(app).get('/external/functions');
      if (functionsResponse.body.success && functionsResponse.body.result.functions) {
        for (const func of functionsResponse.body.result.functions) {
          await request(app).delete(`/external/register/${func.name}`);
        }
      }
    });

    it('should return all registered functions', async () => {
      // Register multiple functions
      const functions = [
        { name: 'func1', url: mockServiceUrl, async: true },
        { name: 'func2', url: mockServiceUrl, async: false },
        { name: 'func3', url: mockServiceUrl, async: true, description: 'Test function 3' }
      ];

      for (const func of functions) {
        await request(app)
          .post('/external/register')
          .send(func);
      }

      const response = await request(app)
        .get('/external/functions')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.result.functions).toHaveLength(3);
      
      const names = response.body.result.functions.map((f: any) => f.name);
      expect(names).toContain('func1');
      expect(names).toContain('func2');
      expect(names).toContain('func3');
      
      // Check that function details are preserved
      const func3 = response.body.result.functions.find((f: any) => f.name === 'func3');
      expect(func3.description).toBe('Test function 3');
      expect(func3.async).toBe(true);
      expect(func3.url).toBe(mockServiceUrl);
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
        url: mockServiceUrl,
        async: false,
        timeout: 2000
      };
      
      const asyncFunction: ExternalFunctionRegistration = {
        name: 'asyncTestFunction',
        url: mockServiceUrl,
        async: true,
        timeout: 2000
      };
      
      await request(app).post('/external/register').send(syncFunction);
      await request(app).post('/external/register').send(asyncFunction);
    });

    afterEach(async () => {
      // Clean up
      await request(app).delete('/external/register/syncTestFunction');
      await request(app).delete('/external/register/asyncTestFunction');
    });

    it('should handle synchronous external function call', async () => {
      const responsePromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          dllConnector.off('ipc_send', handler);
          reject(new Error('Timeout waiting for response'));
        }, 5000);
        
        const handler = (data: any) => {
          if (data.type === 'external_response' && data.id === 'test-sync-call-1') {
            clearTimeout(timeout);
            dllConnector.off('ipc_send', handler);
            resolve(data);
          }
        };
        dllConnector.on('ipc_send', handler);
      });

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
    });

    it('should handle asynchronous external function call', async () => {
      const responsePromise = new Promise((resolve) => {
        const handler = (data: any) => {
          if (data.type === 'external_response' && data.id === 'test-async-call-1') {
            dllConnector.off('ipc_send', handler);
            resolve(data);
          }
        };
        dllConnector.on('ipc_send', handler);
      });

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
    });

    it('should handle external function call timeout', async () => {
      // Set response delay longer than timeout
      mockExternalService.setResponseDelay(3000);
      
      const responsePromise = new Promise((resolve) => {
        const handler = (data: any) => {
          if (data.type === 'external_response' && data.id === 'test-timeout-call-1') {
            dllConnector.off('ipc_send', handler);
            resolve(data);
          }
        };
        dllConnector.on('ipc_send', handler);
      });

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
    });

    it('should handle external service failure', async () => {
      // Configure mock service to fail
      mockExternalService.setFailure(true, 503);
      
      const responsePromise = new Promise((resolve) => {
        const handler = (data: any) => {
          if (data.type === 'external_response' && data.id === 'test-failure-call-1') {
            dllConnector.off('ipc_send', handler);
            resolve(data);
          }
        };
        dllConnector.on('ipc_send', handler);
      });

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
    });

    it('should handle call to unregistered function', async () => {
      const responsePromise = new Promise((resolve) => {
        const handler = (data: any) => {
          if (data.type === 'external_response' && data.id === 'test-unregistered-call-1') {
            dllConnector.off('ipc_send', handler);
            resolve(data);
          }
        };
        dllConnector.on('ipc_send', handler);
      });

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
    });
  });

  /**
   * Integration with Manager Statistics
   */
  describe('External Manager Statistics', () => {
    afterEach(async () => {
      // Clean up all registered functions
      const functionsResponse = await request(app).get('/external/functions');
      if (functionsResponse.body.success && functionsResponse.body.result.functions) {
        for (const func of functionsResponse.body.result.functions) {
          await request(app).delete(`/external/register/${func.name}`);
        }
      }
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
        url: mockServiceUrl,
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
        { name: 'reconnectFunc1', url: mockServiceUrl, async: true },
        { name: 'reconnectFunc2', url: mockServiceUrl, async: false }
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
      await new Promise(resolve => setTimeout(resolve, 100));
      
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