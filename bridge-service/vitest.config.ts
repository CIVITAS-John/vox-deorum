import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/tests/**/*.test.ts', '**/src/**/*.test.ts'],
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts', 'src/**/*.test.ts'],
      reporter: ['text', 'lcov', 'html']
    },
    testTimeout: 15000, // Extended timeout for IPC operations
    hookTimeout: 15000, // Extended timeout for setup/teardown
    retry: process.env.CI ? 1 : 0 // Retry once in CI for flaky IPC tests
  }
})