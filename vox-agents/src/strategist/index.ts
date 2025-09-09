import { VoxContext } from "../infra/vox-context.js";
import { loadConfig } from "../utils/config.js";
import { mcpClient } from "../utils/mcp-client.js";
import { getModel } from "../utils/models.js";
import { SimpleStrategist } from "./simple-strategist.js";

// Load the config
loadConfig();

// Connect to the server
await mcpClient.connect();

// Create the context
const context = new VoxContext(getModel("default"));
await context.registerMCP();

// Register agents
context.registerAgent(new SimpleStrategist());

// Execute the simple strategist
try {
  console.log("Starting simple strategist agent...");
  const result = await context.execute("simple-strategist", {
    playerID: 0,  // Active player
    turnNumber: 1 // You can update this as needed
  });
  console.log("Strategist completed:", result);
} catch (error) {
  console.error("Error executing strategist:", error);
} finally {
  // Disconnect from MCP server
  await mcpClient.disconnect();
}