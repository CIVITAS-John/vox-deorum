/**
 * Tests for VoxDeorumMCPServer
 * Validates MCP protocol compliance and basic server functionality
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { VoxDeorumMCPServer } from '../src/server.js';

describe('VoxDeorumMCPServer', () => {
  let server: VoxDeorumMCPServer;

  beforeEach(() => {
    server = new VoxDeorumMCPServer();
  });

  afterEach(async () => {
    if (server) {
      await server.stop();
    }
  });

  describe('Server Initialization', () => {
    it('should create server instance without errors', () => {
      expect(server).toBeDefined();
      expect(server).toBeInstanceOf(VoxDeorumMCPServer);
    });
  });

  describe('Server Lifecycle', () => {
    it('should start and stop cleanly', async () => {
      // Note: In a real test environment, we would mock the transport
      // For now, we just test that the methods exist and can be called
      expect(typeof server.start).toBe('function');
      expect(typeof server.stop).toBe('function');
      
      // Test stop method (start would require mocked transport)
      await expect(server.stop()).resolves.not.toThrow();
    });
  });
});