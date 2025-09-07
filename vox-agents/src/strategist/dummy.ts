import { Agent } from "@mastra/core";
import { getModel } from "../utils/models.js";
import { mcpClient, wrapTools } from "../utils/mcp-client.js";

/**
 * A very dumb strategist with a basic prompt and NO information about what's happening in the game.
 */
export const DummyStrategist = async function() {
  return new Agent({
    name: "dummy-strategist",
    instructions: `
You are an expert player in Civilization 5.
You are deciding on the most appropriate in-game AI strategies to use for the next turn.
You are NOT a chat assistant and you will not interact with real users. Only interact with the provided tools.
`,
    model: getModel("dumb"),
    tools: wrapTools(await mcpClient.getToolsFor("strategist"))
  })
}; 