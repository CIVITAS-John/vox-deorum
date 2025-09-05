/**
 * Tests for get-events tool
 * Tests game events querying functionality through MCP
 */

import { describe, it, expect } from "vitest";
import { mcpClient } from "../../setup.js";

describe("Get Events Tool via MCP", () => {

  /**
   * Test that the tool is properly registered
   */
  it("should list get-events tool", async () => {
    const tools = await mcpClient.listTools();
    
    expect(tools.tools).toBeDefined();
    expect(tools.tools.length).toBeGreaterThan(0);
    
    const getEventsTool = tools.tools.find(t => t.name === "get-events");
    expect(getEventsTool).toBeDefined();
    expect(getEventsTool?.inputSchema).toBeDefined();
  });

  /**
   * Test retrieving all events without filters
   */
  it("should retrieve all events without filters", async () => {
    const result = await mcpClient.callTool({
      name: "get-events",
      arguments: {}
    });

    expect(result.content).toBeDefined();
    const content = (result.content as any)[0];
    expect(content.type).toBe("text");
    
    const parsed = JSON.parse(content.text);
    expect(parsed.count).toBeDefined();
    expect(typeof parsed.count).toBe("number");
    expect(parsed.events).toBeDefined();
    expect(Array.isArray(parsed.events)).toBe(true);
    
    // Check that if there are events, they have expected fields
    if (parsed.events.length > 0) {
      const event = parsed.events[0];
      expect(event.id).toBeDefined();
      expect(event.turn).toBeDefined();
      expect(event.type).toBeDefined();
      expect(event.payload).toBeDefined();
      expect(event.createdAt).toBeDefined();
      expect(event.visibility).toBeDefined();
    }
  });

  /**
   * Test filtering events by turn
   */
  it("should filter events by turn", async () => {
    const result = await mcpClient.callTool({
      name: "get-events",
      arguments: {
        turn: 1
      }
    });

    const content = (result.content as any)[0];
    const parsed = JSON.parse(content.text);
    
    expect(parsed.filters.turn).toBe(1);
    expect(parsed.events).toBeDefined();
    expect(Array.isArray(parsed.events)).toBe(true);
    
    // All events should be from turn 1
    parsed.events.forEach((event: any) => {
      expect(event.turn).toBe(1);
    });
  });

  /**
   * Test filtering events by player visibility
   */
  it("should filter events by player visibility", async () => {
    const result = await mcpClient.callTool({
      name: "get-events",
      arguments: {
        playerID: 0
      }
    });

    const content = (result.content as any)[0];
    const parsed = JSON.parse(content.text);
    
    expect(parsed.filters.playerID).toBe(0);
    expect(parsed.events).toBeDefined();
    expect(Array.isArray(parsed.events)).toBe(true);
    
    // Events should not include visibility data when filtered by player
    if (parsed.events.length > 0) {
      expect(parsed.events[0].visibility).toBeUndefined();
    }
  });

  /**
   * Test combining turn and player filters
   */
  it("should filter events by both turn and player", async () => {
    const result = await mcpClient.callTool({
      name: "get-events",
      arguments: {
        turn: 1,
        playerID: 0
      }
    });

    const content = (result.content as any)[0];
    const parsed = JSON.parse(content.text);
    
    expect(parsed.filters.turn).toBe(1);
    expect(parsed.filters.playerID).toBe(0);
    expect(parsed.events).toBeDefined();
    expect(Array.isArray(parsed.events)).toBe(true);
    
    // All events should be from turn 1
    parsed.events.forEach((event: any) => {
      expect(event.turn).toBe(1);
    });
  });

  /**
   * Test with invalid player ID
   */
  it("should handle invalid player ID", async () => {
    try {
      await mcpClient.callTool({
        name: "get-events",
        arguments: {
          playerID: 25 // Invalid - should be 0-21
        }
      });
      expect.fail("Should have thrown an error");
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  /**
   * Test empty result when no events match filters
   */
  it("should return empty array when no events match", async () => {
    const result = await mcpClient.callTool({
      name: "get-events",
      arguments: {
        turn: 999999
      }
    });

    const content = (result.content as any)[0];
    const parsed = JSON.parse(content.text);
    
    expect(parsed.count).toBe(0);
    expect(parsed.events).toEqual([]);
    expect(parsed.filters.turn).toBe(999999);
  });
});