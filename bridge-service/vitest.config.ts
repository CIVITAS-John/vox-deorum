import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts'],
      reporter: ['text', 'lcov', 'html']
    },
    testTimeout: 15000, // Extended timeout for IPC operations
    hookTimeout: 15000, // Extended timeout for setup/teardown
    retry: process.env.CI ? 1 : 0, // Retry once in CI for flaky IPC tests
    // Run tests sequentially when using mock DLLs to avoid parallel execution issues
    // Mock DLL server uses a single IPC connection that can't handle concurrent tests
    pool: process.env.USE_MOCK !== 'false' ? 'forks' : 'threads',
    poolOptions: {
      forks: {
        singleFork: process.env.USE_MOCK !== 'false' // Sequential execution for mock mode
      }
    }
  }
})