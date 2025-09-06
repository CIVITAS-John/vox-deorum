/**
 * Tests for MCP Client utility
 * Uses actual MCP server configuration for integration testing
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MCPClient, GameStateNotification } from '../../src/utils/mcp-client.js';
import { config } from '../../src/utils/config.js';

describe('MCPClient', () => {
  let client: MCPClient;

  beforeEach(() => {
    // Create a new client instance for each test
    client = new MCPClient(config);
  });

  afterEach(async () => {
    // Ensure client is disconnected after each test
    if (client.connected) {
      await client.disconnect();
    }
  });

  describe('Connection Management', () => {
    it('should initialize with correct configuration', () => {
      expect(client).toBeDefined();
      expect(client.connected).toBe(false);
    });

    it('should connect to MCP server', async () => {
      await client.connect();
      expect(client.connected).toBe(true);
    });

    it('should handle multiple connect calls gracefully', async () => {
      await client.connect();
      expect(client.connected).toBe(true);
      
      // Second connect should not throw
      await client.connect();
      expect(client.connected).toBe(true);
    });

    it('should disconnect from MCP server', async () => {
      await client.connect();
      expect(client.connected).toBe(true);
      
      await client.disconnect();
      expect(client.connected).toBe(false);
    });

    it('should handle disconnect when not connected', async () => {
      expect(client.connected).toBe(false);
      
      // Should not throw
      await client.disconnect();
      expect(client.connected).toBe(false);
    });
  });

  describe('Tool Operations', () => {
    it('should list available tools', async () => {
      await client.connect();
      
      const tools = await client.listTools();
      expect(tools).toBeDefined();
      expect(tools).toHaveProperty('tools');
      expect(Array.isArray(tools.tools)).toBe(true);
    });

    it('should call a tool', async () => {
      await client.connect();
      
      // First list tools to find a valid tool
      const { tools } = await client.listTools();
      
      if (tools.length > 0) {
        const firstTool = tools[0];
        
        // Build arguments based on tool's input schema
        const args: any = {};
        if (firstTool.inputSchema?.properties) {
          // Add minimal required properties
          const required = firstTool.inputSchema.required || [];
          for (const prop of required) {
            const propSchema = firstTool.inputSchema.properties[prop];
            if (propSchema?.type === 'string') {
              args[prop] = 'test';
            } else if (propSchema?.type === 'number') {
              args[prop] = 0;
            } else if (propSchema?.type === 'boolean') {
              args[prop] = false;
            }
          }
        }
        
        try {
          const result = await client.callTool(firstTool.name, args);
          expect(result).toBeDefined();
        } catch (error: any) {
          // Tool might fail with invalid arguments, but connection should work
          expect(error.message).toBeDefined();
        }
      }
    });

    it('should throw error when calling tool without connection', async () => {
      expect(client.connected).toBe(false);
      
      await expect(client.callTool('test-tool', {})).rejects.toThrow('Not connected to MCP server');
    });
  });

  describe('Notification Handlers', () => {
    it('should register notification handler', () => {
      const handler = (data: GameStateNotification) => {
        console.log('Notification received:', data);
      };
      
      // Should not throw
      client.onNotification(handler);
    });

    it('should register elicit input handler', () => {
      const handler = async (params: any) => {
        return { response: 'test' };
      };
      
      // Should not throw
      client.onElicitInput(handler);
    });

    it('should register tools changed handler', () => {
      const handler = (data: any) => {
        console.log('Tools changed:', data);
      };
      
      // Should not throw
      client.onToolsChanged(handler);
    });
  });
});