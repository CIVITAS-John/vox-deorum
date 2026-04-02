import { config } from '../../src/utils/config.js';
import bridgeService from '../../src/service.js';
import { pauseManager } from '../../src/services/pause-manager.js';
import { globalMockDLL, USE_MOCK } from '../setup.js';
import { createMockDLLServer, MockDLLServer } from './mock-dll-server.js';

export interface IsolatedMockContext {
  mockDLL: MockDLLServer;
  pipeId: string;
  originalPipeId: string;
}

export function createUniqueGamePipeId(prefix: string = 'vox-deorum-bridge-test'): string {
  return `${prefix}-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function startIsolatedMockDLL(prefix?: string): Promise<IsolatedMockContext> {
  const originalPipeId = config.gamepipe.id;
  const pipeId = createUniqueGamePipeId(prefix);

  await bridgeService.shutdown();
  pauseManager.finalize();

  if (USE_MOCK && globalMockDLL?.getStatus().running) {
    await globalMockDLL.stop();
  }

  config.gamepipe.id = pipeId;

  const mockDLL = await createMockDLLServer({
    id: pipeId,
    simulateDelay: true,
    responseDelay: 50,
    autoEvents: false
  });

  return {
    mockDLL,
    pipeId,
    originalPipeId
  };
}

export async function restoreSharedMockDLL(mockDLL: MockDLLServer, originalPipeId: string): Promise<void> {
  await bridgeService.shutdown();
  pauseManager.finalize();
  await mockDLL.stop();
  config.gamepipe.id = originalPipeId;

  if (USE_MOCK && globalMockDLL && !globalMockDLL.getStatus().running) {
    await globalMockDLL.start();
  }
}
