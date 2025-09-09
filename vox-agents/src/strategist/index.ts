import { VoxContext } from "../infra/vox-context.js";
import { langfuseSpanProcessor } from "../instrumentation.js";
import { mcpClient } from "../utils/mcp-client.js";
import { getModelConfig } from "../utils/models.js";
import { SimpleStrategist } from "./simple-strategist.js";

// Connect to the server
await mcpClient.connect();

// Create the context
const context = new VoxContext(getModelConfig("default"));
await context.registerMCP();

// Register agents
context.registerAgent(new SimpleStrategist());

var Parameter = {
  PlayerID: 0,
  Turn: 0,
  After: 0,
  Extra: undefined
};

// Execute the simple strategist
try {
  await context.execute("simple-strategist", Parameter);

} finally {
  await langfuseSpanProcessor.forceFlush()
  // Disconnect from MCP server
  await mcpClient.disconnect();
}