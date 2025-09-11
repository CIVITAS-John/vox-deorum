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

// Register callback
mcpClient.onElicitInput(async (params) => {
  return;

  var Parameter = {
    PlayerID: params.playerID,
    Turn: params.turn,
    After: 0,
    Extra: undefined
  };

  // Execute the simple strategist
  try {
    await context.execute("simple-strategist", Parameter);

  } finally {
    await langfuseSpanProcessor.forceFlush()
  }
});