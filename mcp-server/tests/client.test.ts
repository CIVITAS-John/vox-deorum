/**
 * Test file to verify MCP client connectivity
 */

import { describe, it, expect } from 'vitest';
import { mcpClient } from './setup.js';

describe('MCP Client Connection', () => {
  it('should be connected to the server', async () => {
    // Test ping to verify connection
    const pingResult = await mcpClient.ping();
    expect(pingResult).toBeDefined();
  });

  it('should retrieve server capabilities', async () => {
    const capabilities = mcpClient.getServerCapabilities();
    expect(capabilities).toBeDefined();
    expect(capabilities?.resources).toBeDefined();
    expect(capabilities?.tools).toBeDefined();
  });

  it('should list available resources', async () => {
    const resources = await mcpClient.listResources();
    expect(resources).toBeDefined();
    expect(resources.resources).toBeInstanceOf(Array);
  });

  it('should list available tools', async () => {
    const tools = await mcpClient.listTools();
    expect(tools).toBeDefined();
    expect(tools.tools).toBeInstanceOf(Array);
  });
});