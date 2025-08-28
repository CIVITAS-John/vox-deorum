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
import { waitForDLLResponse, delay } from './helpers.js';

/**
 * Trigger an external function call in both mock and real modes
 * Mock mode: Directly emits external_call event via mock DLL
 * Real mode: Executes Lua script that calls Game.CallExternal()
 */
export async function triggerExternalFunctionCall(
  app: Application,
  functionName: string,
  args: any,
  callId: string,
  async: boolean = true
): Promise<void> {
  if (USE_MOCK) {
    // Mock mode: Directly emit external_call event to DLL connector
    // This simulates what the DLL would send to the bridge service
    const { dllConnector } = await import('../../src/services/dll-connector.js');
    dllConnector.emit('external_call', {
      function: functionName,
      args,
      id: callId,
      async
    });
  } else {
    // Real mode: Execute Lua script that calls Game.CallExternal()
    const luaScript = generateExternalCallScript(functionName, args, callId, async);
    
    const response = await request(app)
      .post('/lua/execute')
      .send({ script: luaScript });
    
    if (response.status !== 200 || !response.body.success) {
      throw new Error(`Failed to execute external call script: ${response.body?.error?.message || 'Unknown error'}`);
    }
  }
}

/**
 * Generate Lua script to call an external function
 * This script will be executed in the real Civilization V DLL environment
 */
export function generateExternalCallScript(
  functionName: string,
  args: any,
  callId: string,
  async: boolean
): string {
  const argsJson = JSON.stringify(args);
  
  if (async) {
    // Asynchronous call with callback
    return `
      -- Trigger asynchronous external function call
      if Game.IsExternalRegistered("${functionName}") then
        Game.CallExternal("${functionName}", ${argsJson}, function(result)
          -- Callback will be handled by the DLL automatically
          -- The result will be sent back to the bridge service
        end, "${callId}")
        return {success = true, message = "Async call initiated"}
      else
        return {success = false, error = "Function not registered"}
      end
    `;
  } else {
    // Synchronous call
    return `
      -- Trigger synchronous external function call
      if Game.IsExternalRegistered("${functionName}") then
        local result = Game.CallExternal("${functionName}", ${argsJson}, "${callId}")
        return result
      else
        return {success = false, error = "Function not registered"}
      end
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
export async function testExternalFunctionCall(
  app: Application,
  functionName: string,
  args: any,
  callId: string,
  async: boolean = true,
  timeout: number = 5000
): Promise<any> {
  // Set up promise to wait for the external_response
  const responsePromise = waitForDLLResponse(dllConnector, callId, timeout);
  
  // Trigger the external function call
  await triggerExternalFunctionCall(app, functionName, args, callId, async);
  
  // Wait for and return the response
  return await responsePromise;
}

/**
 * Verify external function call response structure
 */
export function verifyExternalResponse(
  response: any,
  expectedId: string,
  shouldSucceed: boolean = true
): void {
  expect(response.type).toBe('external_response');
  expect(response.id).toBe(expectedId);
  expect(response.success).toBe(shouldSucceed);
  
  if (shouldSucceed) {
    expect(response).toHaveProperty('result');
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
 * In real mode: Checks if Game.IsExternalRegistered() returns true
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
    // In real mode, execute Lua script to check registration
    const checkScript = `
      return Game.IsExternalRegistered("${functionName}")
    `;
    
    const response = await request(app)
      .post('/lua/execute')
      .send({ script: checkScript });
    
    return response.status === 200 && 
           response.body.success === true && 
           response.body.result === true;
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