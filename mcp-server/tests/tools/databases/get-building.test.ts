/**
 * Tests for get-building tool
 * Tests building database querying functionality through MCP
 */

import { describe, it, expect, beforeAll } from "vitest";
import { mcpClient } from "../../setup.js";

describe("Get Building Tool via MCP", () => {
  
  /**
   * Test that the tool is properly registered
   */
  it("should list get-building tool", async () => {
    const tools = await mcpClient.listTools();
    
    expect(tools.tools).toBeDefined();
    expect(tools.tools.length).toBeGreaterThan(0);
    
    const getBuildingTool = tools.tools.find(t => t.name === "get-building");
    expect(getBuildingTool).toBeDefined();
    expect(getBuildingTool?.inputSchema).toBeDefined();
  });

  /**
   * Test listing all buildings without search
   */
  it("should list all buildings without search", async () => {
    const result = await mcpClient.callTool({
      name: "get-building",
      arguments: {}
    });

    expect(result.content).toBeDefined();
    const content = (result.content as any)[0];
    expect(content.type).toBe("text");
    
    const parsed = JSON.parse(content.text);
    expect(parsed.count).toBeGreaterThan(0);
    expect(parsed.items).toBeDefined();
    expect(Array.isArray(parsed.items)).toBe(true);
    
    // Check first building has expected fields
    if (parsed.items.length > 0) {
      const building = parsed.items[0];
      expect(building.Type).toBeDefined();
      expect(building.Name).toBeDefined();
      expect(building.Help).toBeDefined();
      expect(building.Cost).toBeDefined();
      // PrereqTech can be null
    }
  });

  /**
   * Test searching for a specific building
   */
  it("should search for specific building by name", async () => {
    const result = await mcpClient.callTool({
      name: "get-building",
      arguments: { 
        search: "Library"
      }
    });

    expect(result.content).toBeDefined();
    const content = (result.content as any)[0];
    expect(content.type).toBe("text");
    
    const parsed = JSON.parse(content.text);
    expect(parsed.count).toBeGreaterThan(0);
    expect(parsed.items).toBeDefined();
    
    // Should find Library
    const library = parsed.items.find((b: any) => b.Name === "Library");
    expect(library).toBeDefined();
    
    // When only one result, should return full info
    if (parsed.count === 1) {
      const building = parsed.items[0];
      expect(building.Class).toBeDefined();
      expect(building.PrereqBuildings).toBeDefined();
      expect(building.IsNationalWonder).toBeDefined();
      expect(building.IsWorldWonder).toBeDefined();
      expect(building.Happiness).toBeDefined();
      expect(building.Defense).toBeDefined();
      expect(building.HP).toBeDefined();
      expect(building.Maintenance).toBeDefined();
      expect(building.SpecialAbilities).toBeDefined();
    }
  });

  /**
   * Test fuzzy search functionality
   */
  it("should handle fuzzy search", async () => {
    const result = await mcpClient.callTool({
      name: "get-building",
      arguments: { 
        search: "baracks" // Intentional typo
      }
    });

    expect(result.content).toBeDefined();
    const content = (result.content as any)[0];
    expect(content.type).toBe("text");
    
    if (content.type === "text") {
      const parsed = JSON.parse(content.text);
      // Should find Barracks despite typo
      const barracks = parsed.items.find((b: any) => b.Name === "Barracks");
      expect(barracks).toBeDefined();
    }
  });

  /**
   * Test searching for an exact match returns full details
   */
  it("should return full details for exact match", async () => {
    const result = await mcpClient.callTool({
      name: "get-building",
      arguments: { 
        search: "BUILDING_LIBRARY" // Exact Type match
      }
    });

    expect(result.content).toBeDefined();
    const content = (result.content as any)[0];
    expect(content.type).toBe("text");
    
    if (content.type === "text") {
      const parsed = JSON.parse(content.text);
      expect(parsed.count).toBe(1);
      
      const building = parsed.items[0];
      // Should have full information
      expect(building.Type).toBe("BUILDING_LIBRARY");
      expect(building.Class).toBeDefined();
      expect(building.PrereqBuildings).toBeDefined();
      expect(Array.isArray(building.PrereqBuildings)).toBe(true);
      expect(typeof building.IsNationalWonder).toBe("boolean");
      expect(typeof building.IsWorldWonder).toBe("boolean");
      expect(typeof building.Happiness).toBe("number");
      expect(typeof building.Defense).toBe("number");
      expect(typeof building.HP).toBe("number");
      expect(typeof building.Maintenance).toBe("number");
      expect(Array.isArray(building.SpecialAbilities)).toBe(true);
    }
  });

  /**
   * Test searching for wonders
   */
  it("should find world wonders", async () => {
    const result = await mcpClient.callTool({
      name: "get-building",
      arguments: { 
        search: "Pyramids",
        maxResults: 10
      }
    });

    expect(result.content).toBeDefined();
    const content = (result.content as any)[0];
    expect(content.type).toBe("text");
    
    if (content.type === "text") {
      const parsed = JSON.parse(content.text);
      expect(parsed.count).toBeGreaterThan(0);
      
      // Should find Pyramids
      const pyramids = parsed.items.find((b: any) => 
        b.Name && b.Name.toLowerCase().includes("pyramid")
      );
      expect(pyramids).toBeDefined();
      
      // If we got full details, check if it's a world wonder
      if (parsed.count === 1 && pyramids) {
        expect(pyramids.IsWorldWonder).toBe(true);
      }
    }
  });

  /**
   * Test that prerequisite buildings are properly linked
   */
  it("should properly link prerequisite buildings", async () => {
    const result = await mcpClient.callTool({
      name: "get-building",
      arguments: { 
        search: "BUILDING_UNIVERSITY" // A building with prerequisites
      }
    });

    expect(result.content).toBeDefined();
    const content = (result.content as any)[0];
    expect(content.type).toBe("text");
    
    if (content.type === "text") {
      const parsed = JSON.parse(content.text);
      expect(parsed.count).toBe(1);
      
      const building = parsed.items[0];
      expect(building.PrereqBuildings).toBeDefined();
      expect(Array.isArray(building.PrereqBuildings)).toBe(true);
      // University typically requires Library
      if (building.PrereqBuildings.length > 0) {
        expect(building.PrereqBuildings[0]).toContain("Library");
      }
    }
  });

  /**
   * Test that special abilities are properly populated
   */
  it("should show special abilities for buildings", async () => {
    const result = await mcpClient.callTool({
      name: "get-building",
      arguments: { 
        search: "BUILDING_GRANARY" // A building with yield changes
      }
    });

    expect(result.content).toBeDefined();
    const content = (result.content as any)[0];
    expect(content.type).toBe("text");
    
    if (content.type === "text") {
      const parsed = JSON.parse(content.text);
      expect(parsed.count).toBe(1);
      
      const building = parsed.items[0];
      expect(building.SpecialAbilities).toBeDefined();
      expect(Array.isArray(building.SpecialAbilities)).toBe(true);
      // Granary typically provides food yield
      const foodAbility = building.SpecialAbilities.find((a: string) => 
        a.toLowerCase().includes("food") || a.includes("YIELD_FOOD")
      );
      expect(foodAbility).toBeDefined();
    }
  });
});