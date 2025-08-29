/**
 * Test setup configuration for MCP Server tests
 * Provides global test configuration and utilities
 */

import { beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';

// Set test environment variables
process.env.NODE_ENV = 'test';

let bridgeServiceProcess: ChildProcess | null = null;
const BRIDGE_SERVICE_URL = 'http://localhost:8080';
const CONNECTION_TIMEOUT = 10000; // 10 seconds
const BRIDGE_SERVICE_PATH = path.resolve('../bridge-service');

/**
 * Check if bridge service is responding and DLL is connected
 */
async function checkBridgeConnection(): Promise<boolean> {
  try {
    const response = await fetch(`${BRIDGE_SERVICE_URL}/health`);
    if (!response.ok) {
      return false;
    }
    const healthData = await response.json();
    return healthData.result?.dll_connected === true;
  } catch {
    return false;
  }
}

/**
 * Wait for bridge service to be ready with timeout
 */
async function waitForBridgeService(): Promise<boolean> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < CONNECTION_TIMEOUT) {
    if (await checkBridgeConnection()) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  return false;
}

/**
 * Start bridge service in real mode
 */
async function startBridgeService(): Promise<void> {
  console.log('Starting Bridge Service for tests...');
  
  bridgeServiceProcess = spawn('npm', ['start'], {
    cwd: BRIDGE_SERVICE_PATH,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true
  });
  
  if (bridgeServiceProcess.stdout) {
    bridgeServiceProcess.stdout.on('data', (data) => {
      console.log(`Bridge Service: ${data.toString().trim()}`);
    });
  }
  
  if (bridgeServiceProcess.stderr) {
    bridgeServiceProcess.stderr.on('data', (data) => {
      console.error(`Bridge Service Error: ${data.toString().trim()}`);
    });
  }
  
  bridgeServiceProcess.on('error', (error) => {
    console.error('Failed to start Bridge Service:', error);
  });
  
  // Wait for service to be ready
  const isReady = await waitForBridgeService();
  
  if (!isReady) {
    console.warn('\n⚠️  WARNING: Bridge Service did not start within timeout!');
    console.warn('This likely means Civilization V is not running.');
    console.warn('Some tests may fail if they require the bridge service.');
    console.warn('To run full integration tests, please:');
    console.warn('1. Start Civilization V');
    console.warn('2. Load the Community Patch mod');
    console.warn('3. Run tests again\n');
    throw new Error('Bridge Service is not ready');
  } else {
    console.log('✅ Bridge Service is ready and connected!');
  }
}

/**
 * Stop bridge service
 */
async function stopBridgeService(): Promise<void> {
  if (bridgeServiceProcess && !bridgeServiceProcess.killed) {
    console.log('Stopping Bridge Service...');
    bridgeServiceProcess.kill('SIGTERM');
    
    // Give it time to gracefully shut down
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    if (!bridgeServiceProcess.killed) {
      bridgeServiceProcess.kill('SIGKILL');
    }
    
    bridgeServiceProcess = null;
  }
}

// Global test setup - start bridge service once for all tests
beforeAll(async () => {
  await startBridgeService();
}, 15000); // 15 second timeout for service startup

// Global test teardown - stop bridge service
afterAll(async () => {
  await stopBridgeService();
});

// Export utilities for tests
export {
  BRIDGE_SERVICE_URL,
  checkBridgeConnection
};