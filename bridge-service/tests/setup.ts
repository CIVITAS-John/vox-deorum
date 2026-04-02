/**
 * Vitest setup file
 * Global test setup for Bridge Service tests
 */

import { beforeAll, afterAll } from 'vitest';
import { createTestMockDLL, MockDLLServer } from './test-utils/mock-dll-server.js';

// Environment variable to switch between mock and real server
const USE_MOCK = process.env.USE_MOCK !== 'false';
const TEST_RUN_ID = process.env.TEST_RUN_ID || `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const TEST_GAMEPIPE_ID = process.env.gamepipe_ID || `vox-deorum-bridge-test-${TEST_RUN_ID}`;
const TEST_EVENTPIPE_NAME = process.env.EVENTPIPE_NAME || `vox-deorum-events-test-${TEST_RUN_ID}`;
const TEST_REST_PORT = process.env.PORT || String(
  15000 + Array.from(TEST_RUN_ID).reduce((sum, char) => sum + char.charCodeAt(0), 0) % 10000
);
const TEST_EXTERNAL_PORT = process.env.TEST_EXTERNAL_PORT || String(
  25000 + Array.from(TEST_RUN_ID).reduce((sum, char) => sum + char.charCodeAt(0), 0) % 5000
);
const TEST_EXTERNAL_PORT_2 = process.env.TEST_EXTERNAL_PORT_2 || String(Number(TEST_EXTERNAL_PORT) + 1);

// Set process environment for consistent test behavior before the app is imported.
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';

if (USE_MOCK) {
  process.env.gamepipe_ID = TEST_GAMEPIPE_ID;
  process.env.EVENTPIPE_NAME = TEST_EVENTPIPE_NAME;
  process.env.EVENTPIPE_ENABLED = process.env.EVENTPIPE_ENABLED || 'false';
  process.env.PORT = TEST_REST_PORT;
  process.env.TEST_EXTERNAL_PORT = TEST_EXTERNAL_PORT;
  process.env.TEST_EXTERNAL_PORT_2 = TEST_EXTERNAL_PORT_2;
}

// Global mock server instance
let globalMockDLL: MockDLLServer | null = null;
type BridgeTestGlobalState = {
  activeSetupFiles: number;
  mockDLL: MockDLLServer | null;
  mockDLLStart: Promise<MockDLLServer> | null;
};

const globalState = (globalThis as typeof globalThis & {
  __bridgeServiceTestState?: BridgeTestGlobalState;
}).__bridgeServiceTestState ?? {
  activeSetupFiles: 0,
  mockDLL: null,
  mockDLLStart: null
};

(globalThis as typeof globalThis & {
  __bridgeServiceTestState: BridgeTestGlobalState;
}).__bridgeServiceTestState = globalState;

globalState.activeSetupFiles += 1;

// Set longer timeouts for integration tests involving IPC
beforeAll(async () => {
  console.log('🧪 Bridge Service Test Suite Starting');
  console.log(`📊 Using ${USE_MOCK ? 'MOCK' : 'REAL'} server mode`);
  
  if (USE_MOCK) {
    if (!globalState.mockDLL) {
      if (!globalState.mockDLLStart) {
        console.log(`🧪 Starting global mock DLL server on pipe ${TEST_GAMEPIPE_ID}`);
        globalState.mockDLLStart = createTestMockDLL();
      }
      globalState.mockDLL = await globalState.mockDLLStart;
      globalState.mockDLLStart = null;
      console.log('✅ Global mock DLL server started');
    }
    globalMockDLL = globalState.mockDLL;
  } else {
    console.log('🎮 Using real DLL connection (make sure Civ5 is running)');
  }
}, 10000); // 10 second timeout for setup

afterAll(async () => {
  globalState.activeSetupFiles -= 1;
  if (globalState.activeSetupFiles <= 0 && globalState.mockDLL) {
    console.log('🛑 Stopping global mock DLL server');
    await globalState.mockDLL.stop();
    globalState.mockDLL = null;
    console.log('✅ Global mock DLL server stopped');
  }
  globalMockDLL = globalState.mockDLL;
  console.log('🏁 Bridge Service Test Suite Complete');
}, 10000); // 10 second timeout for cleanup

// Override process exit handlers for tests to prevent test runner crashes
process.removeAllListeners('uncaughtException');
process.removeAllListeners('unhandledRejection');

process.on('uncaughtException', (error) => {
  console.error('Test uncaught exception:', error);
  // Don't exit in tests
});

process.on('unhandledRejection', (reason) => {
  console.error('Test unhandled rejection:', reason);
  // Don't exit in tests
});

// Export global mock server instance for use in tests
export {
  globalMockDLL,
  USE_MOCK,
  TEST_EVENTPIPE_NAME,
  TEST_EXTERNAL_PORT,
  TEST_EXTERNAL_PORT_2,
  TEST_GAMEPIPE_ID,
  TEST_REST_PORT,
  TEST_RUN_ID
};
