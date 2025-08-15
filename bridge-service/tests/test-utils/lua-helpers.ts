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
 * Setup mock Lua function response
 */
export function setupMockLuaFunction(
  functionName: string, 
  result: any, 
  shouldSucceed: boolean = true
): void {
  if (USE_MOCK && globalMockDLL) {
    globalMockDLL.addLuaFunction(functionName, () => result, shouldSucceed);
  }
}

/**
 * Clear all mock Lua functions
 */
export function clearMockLuaFunctions(): void {
  if (USE_MOCK && globalMockDLL) {
    const mockServer = globalMockDLL as MockDLLServer;
    mockServer.clearLuaFunctions();
  }
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
  if (mockResult !== undefined) {
    setupMockLuaFunction(functionName, mockResult, true);
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
 * Test a batch of Lua function calls
 */
export async function testLuaBatchCall(
  app: Application,
  batchRequests: Array<{ function: string; args?: any }>,
  mockSetup?: Array<{ name: string; result: any; shouldSucceed?: boolean }>
): Promise<any> {
  // Setup mocks if provided
  if (mockSetup) {
    mockSetup.forEach(({ name, result, shouldSucceed = true }) => {
      setupMockLuaFunction(name, result, shouldSucceed);
    });
  }
  
  const expectedStatus = USE_MOCK ? 200 : 500;
  const response = await request(app)
    .post('/lua/batch')
    .send(batchRequests)
    .expect(expectedStatus);
    
  return response;
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
  if (expectedResult !== undefined) {
    setupMockLuaFunction('ExecuteScript', expectedResult, true);
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

/**
 * Test invalid request handling
 */
export async function testInvalidRequest(
  app: Application,
  endpoint: string,
  payload: any,
  expectedErrorCode: string,
  expectedErrorMessage: string
): Promise<void> {
  const response = await request(app)
    .post(endpoint)
    .send(payload)
    .expect(500);
    
  expectErrorResponse(response, expectedErrorCode, expectedErrorMessage);
}

/**
 * Test multiple invalid requests using data-driven approach
 */
export async function testInvalidRequests(
  app: Application,
  endpoint: string,
  testCases: Array<{
    payload: any;
    expectedError: string;
    errorCode?: string;
    testCase: string;
  }>
): Promise<void> {
  for (const { payload, expectedError, errorCode = ErrorCode.INVALID_ARGUMENTS } of testCases) {
    await testInvalidRequest(app, endpoint, payload, errorCode, expectedError);
  }
}

/**
 * Validate Lua function list response
 */
export function validateFunctionListResponse(response: any, expectedFunctions?: string[]): void {
  expectSuccessResponse(response, (res) => {
    expect(res.body.result).toHaveProperty('functions');
    expect(res.body.result.functions).toBeInstanceOf(Array);
    
    if (expectedFunctions) {
      expectedFunctions.forEach(funcName => {
        const found = res.body.result.functions.some((f: any) => 
          typeof f === 'string' ? f === funcName : f.name === funcName
        );
        expect(found).toBe(true);
      });
    }
  });
}

/**
 * Test concurrent Lua requests
 */
export async function testConcurrentLuaRequests(
  app: Application,
  endpoint: string,
  requests: Array<any>,
  mockSetup?: () => void
): Promise<any[]> {
  if (mockSetup) {
    mockSetup();
  }
  
  const promises = requests.map(reqData => 
    request(app)
      .post(endpoint)
      .send(reqData)
  );
  
  return Promise.all(promises);
}