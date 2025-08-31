/**
 * Test setup configuration for MCP Server tests
 * Provides global test configuration and utilities
 */

import { beforeAll, afterAll } from 'vitest';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { startHttpServer } from '../src/http.js';
import { MCPServer } from '../src/server.js';
import config from '../src/utils/config.js';

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

let server: MCPServer;
let closeTransport: () => Promise<void>;
let mcpClient: Client;

// Global test setup - start bridge service once for all tests
beforeAll(async () => {
  await startBridgeService();
  mcpClient = new Client({
    name: "test-client",
    version: "1.0.0"
  });
  // Start server and client with appropriate transport
  switch (process.env.TEST_TRANSPORT ?? "http") {
    case 'stdio':
      config.transport.type = 'stdio';
      await mcpClient.connect(new StdioClientTransport({
        command: 'node',
        args: ['dist/index.js']
      }));
      closeTransport = () => mcpClient.close();
      break;
    case 'http':
      closeTransport = await startHttpServer();
      // Connect MCP client
      await mcpClient.connect(new StreamableHTTPClientTransport(
        new URL(`http://${config.transport.host || 'localhost'}:${config.transport.port || 3000}/mcp`)
      ));
      break;
    default:
      throw new Error(`Unknown transport type: ${process.env.TEST_TRANSPORT}`);
  }
  server = MCPServer.getInstance();
}, 15000); // 15 second timeout for service startup

// Global test teardown - stop bridge service
afterAll(async () => {
  await stopBridgeService();
  await closeTransport();
});

// Export utilities for tests
export {
  mcpClient,
  BRIDGE_SERVICE_URL,
  checkBridgeConnection
};