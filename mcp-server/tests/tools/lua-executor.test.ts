import { describe, it, expect } from "vitest";
import { mcpClient } from "../setup.js";

describe("Lua Executor Tool via MCP", () => {

  it("should list lua-executor tool", async () => {
    const tools = await mcpClient.listTools();
    
    expect(tools.tools).toBeDefined();
    expect(tools.tools.length).toBeGreaterThan(0);
    
    const luaExecutorTool = tools.tools.find(t => t.name === "lua-executor");
    expect(luaExecutorTool).toBeDefined();
    expect(luaExecutorTool?.description).toContain("Lua");
    expect(luaExecutorTool?.inputSchema).toBeDefined();
  });

  it("should execute basic Lua calculations", async () => {
    const testCases = [
      { script: "return 2 + 3", expected: 5 },
      { script: "return 10 * 5", expected: 50 },
      { script: "return math.sqrt(16)", expected: 4 },
      { script: "return 2^8", expected: 256 },
      { script: "return (10 + 5) * 2", expected: 30 }
    ];

    for (const test of testCases) {
      const result = await mcpClient.callTool({
        name: "lua-executor",
        arguments: { script: test.script }
      });

      expect(result.content).toBeDefined();
      expect((result.content as any)).toBeDefined();
      
      const content = (result.content as any);
      if (content.type === "text") {
        const parsed = JSON.parse(content.text);
        expect(parsed.result).toBe(test.expected);
      }
    }
  });

  it("should handle errors gracefully", async () => {
    const result = await mcpClient.callTool({
      name: "lua-executor",
      arguments: { script: "invalid lua code @#$" }
    });

    expect(result.content).toBeDefined();
    const content = (result.content as any)[0];
    expect(content.type).toBe("text");
    
    if (content.type === "text") {
      // Should contain error message
      expect(content.text).toContain("error");
    }
  });
});