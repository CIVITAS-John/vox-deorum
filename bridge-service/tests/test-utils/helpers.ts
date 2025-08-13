/**
 * Common test helper functions for bridge-service tests
 */

import { expect } from 'vitest';
import request from 'supertest';
import { Application } from 'express';
import bridgeService from '../../src/service';
import { TEST_TIMEOUTS } from './constants';

/**
 * Standard response assertions
 */
export function expectSuccessResponse(response: any, additionalChecks?: (response: any) => void) {
  expect(response.body.success).toBe(true);
  if (additionalChecks) {
    additionalChecks(response);
  }
}

export function expectErrorResponse(
  response: any, 
  errorCode: string, 
  messageContains?: string
) {
  expect(response.body.success).toBe(false);
  expect(response.body.error.code).toBe(errorCode);
  if (messageContains) {
    expect(response.body.error.message).toContain(messageContains);
  }
}

/**
 * Clean up all registered external functions
 */
export async function cleanupAllExternalFunctions(app: Application) {
  const response = await request(app).get('/external/functions');
  if (response.body.success && response.body.result.functions) {
    for (const func of response.body.result.functions) {
      await request(app).delete(`/external/register/${func.name}`);
    }
  }
}

/**
 * Wait for an event with timeout
 */
export function waitForEvent<T = any>(
  emitter: any,
  eventName: string,
  timeout: number = 5000,
  filter?: (data: any) => boolean
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      emitter.off(eventName, handler);
      reject(new Error(`Timeout waiting for event: ${eventName}`));
    }, timeout);

    const handler = (data: any) => {
      if (!filter || filter(data)) {
        clearTimeout(timer);
        emitter.off(eventName, handler);
        resolve(data);
      }
    };

    emitter.on(eventName, handler);
  });
}

/**
 * Wait for a DLL response with specific ID
 */
export function waitForDLLResponse(
  dllConnector: any,
  responseId: string,
  timeout: number = 5000
): Promise<any> {
  return waitForEvent(
    dllConnector,
    'ipc_send',
    timeout,
    (data) => data.type === 'external_response' && data.id === responseId
  );
}

/**
 * Standard success log helper
 */
export function logSuccess(message: string): void {
  console.log(`✅ ${message}`);
}

/**
 * Delay helper for async operations
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Test server lifecycle management
 */
export class TestServer {
  private server: any = null;

  async start(app: Application, port: number, host: string = 'localhost'): Promise<void> {
    return new Promise(async (resolve) => {
      // Start the bridge service (DLL connection)
      await bridgeService.start();
      // Start the Express server
      this.server = app.listen(port, host, () => resolve());
      // Wait for server to be ready
      await delay(TEST_TIMEOUTS.VERY_SHORT);
    });
  }

  async stop(): Promise<void> {
    if (this.server) {
      return new Promise<void>(async (resolve) => {
      // Shutdown bridge service
      await bridgeService.shutdown();
        this.server.close(() => resolve());
      });
    }
  }

  isRunning(): boolean {
    return this.server !== null;
  }
}