import { mcpClient, wrapTools } from "../utils/mcp-client.js";
import { getModel } from "../utils/models.js";
import { generateText, stepCountIs } from "ai";

/**
 * A very dumb strategist with a basic prompt and NO information about what's happening in the game.
 */
export const DummyStrategist = async function() {
  return generateText({
    model: getModel("dumb"),
    messages: [
      {
        role: "system",
        content: `
You are an expert player in Civilization 5.
You are deciding on the most appropriate in-game AI strategies to use for the next turn.
You are NOT a chat assistant and you will not interact with real users. Instead, you only interact with the provided tools.
Potential values of set-strategy are provided as part of the input schema.
`.trim()
      }
    ],
    tools: wrapTools(await mcpClient.getToolsFor("strategist")),
    experimental_telemetry: { isEnabled: true },
    stopWhen: stepCountIs(10)
  });
}; 