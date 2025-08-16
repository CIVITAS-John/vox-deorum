/**
 * Lua test helper functions - Shared utilities for Lua-related tests
 */

import { expect } from 'vitest';
import request from 'supertest';
import { Application } from 'express';
import { globalMockDLL, USE_MOCK } from '../setup.js';
import { expectSuccessResponse, expectErrorResponse } from './helpers.js';
import { ErrorCode } from '../../src/types/api.js';
import { MockDLLServer } from './mock-dll-server.js';

/**
 * Register a Lua function (handles both mock and non-mock modes)
 * In mock mode: adds a mock function handler
 * In non-mock mode: registers via Game.RegisterFunction through /lua/execute
 */
export async function registerLuaFunction(
  app: Application,
  functionName: string, 
  expected: any,
  shouldSucceed: boolean = true,
  implementation?: string
): Promise<boolean> {
  if (USE_MOCK && globalMockDLL) {
    // In mock mode, add the function to mock DLL
    globalMockDLL.addLuaFunction(functionName, () => expected, shouldSucceed);
    return true;
  } else {
    // In non-mock mode, register through Game.RegisterFunction
    const script = implementation || `
      local function ${functionName.toLowerCase()}(args)
        return ${JSON.stringify(expected)};
      end
      Game.RegisterFunction("${functionName}", ${functionName.toLowerCase()})
      return true
    `;
    
    try {
      const response = await request(app)
        .post('/lua/execute')
        .send({ script });
      
      return response.status === 200 && response.body.success === true;
    } catch {
      return false;
    }
  }
}

/**
 * Unregister a Lua function (handles both mock and non-mock modes)
 * In mock mode: removes the mock function
 * In non-mock mode: unregisters via Game.UnregisterFunction through /lua/execute
 */
export async function unregisterLuaFunction(
  app: Application,
  functionName: string
): Promise<boolean> {
  if (USE_MOCK && globalMockDLL) {
    // In mock mode, remove the function from mock DLL
    const mockServer = globalMockDLL as MockDLLServer;
    mockServer.removeLuaFunction(functionName);
    return true;
  } else {
    // In non-mock mode, unregister through Game.UnregisterFunction
    const script = `
      Game.UnregisterFunction("${functionName}")
      return true
    `;
    
    try {
      const response = await request(app)
        .post('/lua/execute')
        .send({ script });
      
      return response.status === 200 && response.body.success === true;
    } catch {
      return false;
    }
  }
}

/**
 * Clear all Lua functions (handles both mock and non-mock modes)
 * In mock mode: clears all mock functions
 * In non-mock mode: clears via Game.ClearFunctions through /lua/execute
 */
export async function clearLuaFunctions(app?: Application): Promise<boolean> {
  if (USE_MOCK && globalMockDLL) {
    // In mock mode, clear all functions from mock DLL
    const mockServer = globalMockDLL as MockDLLServer;
    mockServer.clearLuaFunctions();
    return true;
  } else if (app) {
    // In non-mock mode, clear through Game.ClearFunctions
    const script = `
      Game.ClearFunctions()
      return true
    `;
    
    try {
      const response = await request(app)
        .post('/lua/execute')
        .send({ script });
      
      return response.status === 200 && response.body.success === true;
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Test a Lua function call with mock setup
 */
export async function testLuaFunctionCall(
  app: Application,
  functionName: string,
  args: any,
  expectedResult: any,
  mockResult?: any
): Promise<void> {
  // Setup mock if provided
  if (mockResult !== undefined && USE_MOCK) {
    await registerLuaFunction(app, functionName, mockResult, true);
  }
  
  const response = await request(app)
    .post('/lua/call')
    .send({
      function: functionName,
      args: args
    })
    .expect(200);

  expectSuccessResponse(response, (res) => {
    expect(res.body).toHaveProperty('result');
    if (USE_MOCK && expectedResult !== undefined) {
      expect(res.body.result).toEqual(expectedResult);
    }
  });
}

/**
 * Test Lua script execution
 */
export async function testLuaScriptExecution(
  app: Application,
  script: string,
  expectedResult?: any
): Promise<any> {
  // Setup mock for script execution if expected result provided
  if (expectedResult !== undefined && USE_MOCK) {
    await registerLuaFunction(app, 'ExecuteScript', expectedResult, true);
  }
  
  const response = await request(app)
    .post('/lua/execute')
    .send({ script })
    .expect(200);
    
  if (expectedResult !== undefined) {
    expect(response.body.success).toBe(true);
    expect(response.body.result).toEqual(expectedResult);
  }
  
  return response;
}