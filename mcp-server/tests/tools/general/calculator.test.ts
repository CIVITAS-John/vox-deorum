import { describe, it, expect } from "vitest";
import { mcpClient } from "../../setup.js";

describe("Calculator Tool via MCP", () => {

  it("should list calculator tool", async () => {
    const tools = await mcpClient.listTools();
    
    expect(tools.tools).toBeDefined();
    expect(tools.tools.length).toBeGreaterThan(0);
    
    const calculatorTool = tools.tools.find(t => t.name === "calculator");
    expect(calculatorTool).toBeDefined();
    expect(calculatorTool?.description).toContain("mathematical");
    expect(calculatorTool?.inputSchema).toBeDefined();
  });

  it("should execute basic calculations", async () => {
    const testCases = [
      { expression: "2 + 3", expected: 5 },
      { expression: "10 * 5", expected: 50 },
      { expression: "sqrt(16)", expected: 4 },
      { expression: "2^8", expected: 256 },
      { expression: "(10 + 5) * 2", expected: 30 }
    ];

    for (const test of testCases) {
      const result = await mcpClient.callTool({
        name: "calculator",
        arguments: { expression: test.expression }
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

  it("should handle complex expressions", async () => {
    const result = await mcpClient.callTool({
      name: "calculator",
      arguments: { expression: "pi * 2" }
    });

    expect(result.content).toBeDefined();
    const content = (result.content as any);
    if (content.type === "text") {
      const parsed = JSON.parse(content.text);
      expect(parsed.result).toBeCloseTo(6.283185307);
    }
  });

  it("should handle non-numeric results", async () => {
    const result = await mcpClient.callTool({
      name: "calculator",
      arguments: { expression: "sqrt(-1)" }
    });

    expect(result.content).toBeDefined();
    const content = (result.content as any)[0];
    if (content.type === "text") {
      const parsed = JSON.parse(content.text);
      expect(parsed.result).toBe("i");
    }
  });

  it("should handle errors gracefully", async () => {
    const result = await mcpClient.callTool({
      name: "calculator",
      arguments: { expression: "invalid expression @#$" }
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