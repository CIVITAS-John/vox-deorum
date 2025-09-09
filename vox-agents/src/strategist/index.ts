import { VoxContext } from "../infra/vox-context.js";
import { langfuseSpanProcessor } from "../instrumentation.js";
import { mcpClient } from "../utils/mcp-client.js";
import { getModel } from "../utils/models.js";
import { SimpleStrategist } from "./simple-strategist.js";
import { updateActiveObservation, updateActiveTrace } from "@langfuse/tracing";
import { trace } from "@opentelemetry/api";

// Connect to the server
await mcpClient.connect();

// Create the context
const context = new VoxContext(getModel("default"));
await context.registerMCP();

// Register agents
context.registerAgent(new SimpleStrategist());

// Tracing
var Parameter = {
  PlayerID: 0,  // Active player
  Turn: 1 // You can update this as needed
};
updateActiveObservation({
  input: Parameter,
});
updateActiveTrace({
  name: "strategist",
  sessionId: "test",
  userId: `player-${Parameter.PlayerID}`,
  input: Parameter.Turn,
});

// Execute the simple strategist
try {
  await context.execute("simple-strategist", Parameter);

} finally {
  trace.getActiveSpan()?.end();
  await langfuseSpanProcessor.forceFlush()
  // Disconnect from MCP server
  await mcpClient.disconnect();
}