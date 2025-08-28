/**
 * External function test helper functions - Support for both real and mock DLL modes
 */

import { expect } from 'vitest';
import request from 'supertest';
import { Application } from 'express';
import { dllConnector } from '../../src/services/dll-connector.js';
import { globalMockDLL, USE_MOCK } from '../setup.js';
import { ExternalFunctionRegistration } from '../../src/types/external.js';
import { MockDLLServer } from './mock-dll-server.js';
import {  delay, waitForEvent } from './helpers.js';

/**
 * Trigger an external function call in both mock and real modes
 * Mock mode: Directly emits external_call event via mock DLL
 * Real mode: Executes Lua script that calls Game.CallExternal()
 */
export async function triggerExternalFunctionCall(
  app: Application,
  functionName: string,
  callId: string,
  async: boolean = true
): Promise<void> {
  if (USE_MOCK) {
    // Mock mode: Directly emit external_call event to DLL connector
    // This simulates what the DLL would send to the bridge service
    const { dllConnector } = await import('../../src/services/dll-connector.js');
    dllConnector.emit('external_call', {
      function: functionName,
      args: callId,
      id: callId,
      async
    });
  } else {
    // Real mode: Execute Lua script that calls Game.CallExternal()
    const luaScript = generateExternalCallScript(functionName, callId, async);
    
    const response = await request(app)
      .post('/lua/execute')
      .send({ script: luaScript });
    
    if (response.status !== 200 || !response.body.success) {
      throw new Error(`Failed to execute external call script: ${JSON.stringify(response.body)}`); // ?.error?.message || 'Unknown error'
    }
  }
}

/**
 * Generate Lua script to call an external function
 * This script will be executed in the real Civilization V DLL environment
 */
export function generateExternalCallScript(
  functionName: string,
  callId: string,
  async: boolean
): string {
  if (async) {
    // Asynchronous call with callback
    return `
      -- Trigger asynchronous external function call
      if Game.IsExternalRegistered and Game.IsExternalRegistered("${functionName}") then
        Game.CallExternal("${functionName}", "${callId}", function(result)
          -- Callback function for async mode
          -- Result will be handled by the DLL
        end)
        return {success = true, message = "Async call initiated"}
      else
        return {success = false, error = "Function not registered"}
      end
    `;
  } else {
    // Synchronous call
    return `
      -- Trigger synchronous external function call
      local result = Game.CallExternal("${functionName}", "${callId}")
      return result
    `;
  }
}

/**
 * Register an external function for testing in both modes
 */
export async function registerExternalFunction(
  app: Application,
  registration: ExternalFunctionRegistration
): Promise<void> {
  const response = await request(app)
    .post('/external/register')
    .send(registration);
    
  if (response.status !== 200) {
    throw new Error(`Failed to register external function: ${response.body?.error?.message || 'Unknown error'}`);
  }
  
  // Wait for registration to propagate to DLL
  await delay(100);
}

/**
 * Test an external function call end-to-end in both modes
 * Returns the response received from the external service
 */
export async function testExternalFunctionCall<T = any>(
  app: Application,
  functionName: string,
  callId: string,
  async: boolean = true
): Promise<T> {
  // Set up promise to wait for the external_response
  const responsePromise = waitForDLLResponse<T>(dllConnector, callId, 5000);
  
  // Trigger the external function call
  await triggerExternalFunctionCall(app, functionName, callId, async);
  
  // Wait for and return the response
  return await responsePromise;
}

/**
 * Wait for a DLL response with specific ID
 */
export function waitForDLLResponse<T = any>(
  dllConnector: any,
  responseId: string,
  timeout: number = 5000
): Promise<T> {
  return waitForEvent<T>(
    dllConnector,
    'ipc_send',
    timeout,
    (data) => data.type === 'external_response' && data.result === responseId
  );
}

/**
 * Verify that an external function is properly registered
 * Works for both mock and real modes
 */
export async function verifyFunctionRegistered(
  app: Application,
  functionName: string,
  expectedUrl?: string
): Promise<void> {
  const response = await request(app).get('/external/functions');
  expect(response.status).toBe(200);
  expect(response.body.success).toBe(true);
  
  const functions = response.body.result.functions || [];
  const func = functions.find((f: any) => f.name === functionName);
  
  expect(func).toBeDefined();
  if (expectedUrl) {
    expect(func.url).toBe(expectedUrl);
  }
}

/**
 * Verify external function call response structure
 */
export function verifyExternalResponse(
  response: any,
  expectedResult: string,
  shouldSucceed: boolean = true
): void {
  expect(response.type).toBe('external_response');
  expect(response.success).toBe(shouldSucceed);
  
  if (shouldSucceed) {
    expect(response).toHaveProperty('result');
    expect(response.result).toBe(expectedResult);
  } else {
    expect(response).toHaveProperty('error');
    expect(response.error).toHaveProperty('code');
    expect(response.error).toHaveProperty('message');
  }
}

/**
 * Create a test external function registration with defaults
 */
export function createTestExternalRegistration(
  name: string,
  url: string,
  overrides: Partial<ExternalFunctionRegistration> = {}
): ExternalFunctionRegistration {
  return {
    name,
    url,
    async: true,
    timeout: 5000,
    description: `Test external function: ${name}`,
    ...overrides
  };
}

/**
 * Wait for external function to be registered in the DLL
 * In real mode: Checks if Bridge.IsExternalRegistered() returns true
 * In mock mode: Checks mock DLL internal state
 */
export async function waitForExternalRegistration(
  app: Application,
  functionName: string,
  timeout: number = 2000
): Promise<boolean> {
  if (USE_MOCK) {
    // In mock mode, check internal state
    const mockServer = globalMockDLL as MockDLLServer;
    const status = mockServer.getStatus();
    return status.externalFunctions.includes(functionName);
  } else {
    // In real mode, check via the bridge service API
    // The bridge service maintains its own registry of external functions
    const response = await request(app)
      .get('/external/functions');
    
    if (response.status === 200 && response.body.success) {
      const functions = response.body.result.functions || [];
      return functions.some((f: any) => f.name === functionName);
    }
    
    return false;
  }
}

/**
 * Clean up external function registration
 */
export async function unregisterExternalFunction(
  app: Application,
  functionName: string
): Promise<void> {
  const response = await request(app)
    .delete(`/external/register/${functionName}`);
    
  if (response.status !== 200) {
    throw new Error(`Failed to unregister external function: ${response.body?.error?.message || 'Unknown error'}`);
  }
  
  // Wait for unregistration to propagate
  await delay(100);
}

/**
 * Clean up all external function registrations
 */
export async function cleanupAllExternalFunctionsHelper(
  app: Application
): Promise<void> {
  // Get list of all registered functions
  const response = await request(app).get('/external/functions');
  
  if (response.status === 200 && response.body.success) {
    const functions = response.body.result.functions || [];
    
    // Unregister each function
    for (const func of functions) {
      await unregisterExternalFunction(app, func.name);
    }
  }
}