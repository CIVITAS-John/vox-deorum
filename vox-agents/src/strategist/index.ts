import { VoxContext } from "../infra/vox-context.js";
import { langfuseSpanProcessor } from "../instrumentation.js";
import { createLogger } from "../utils/logger.js";
import { mcpClient } from "../utils/mcp-client.js";
import { getModelConfig } from "../utils/models.js";
import { SimpleStrategist } from "./simple-strategist.js";
import { StrategistParameters } from "./strategist.js";

const logger = createLogger('Strategists');

// Connect to the server
await mcpClient.connect();

// Create the context
const context = new VoxContext(getModelConfig("default"));
await context.registerMCP();

// Register agents
const strategist = "simple-strategist";
context.registerAgent(new SimpleStrategist());

// Run strategist
const Parameter: StrategistParameters<unknown> = {
  playerID: 0,
  turn: -1,
  after: -1,
  before: 0
}
const runStrategist = async (params: any) => {
  // Check relevant
  if (Parameter.playerID != params.playerID) return;
  if (Parameter.running) {
    logger.warn(`The ${strategist} is still working on turn ${Parameter.turn}. Skipping this one...`)
  }
  // Set the parameters
  Parameter.turn = params.turn;
  Parameter.before = params.latest;
  Parameter.playerID = params.playerID;
  if (Parameter.running) {
    logger.info(`Running the ${strategist} on ${Parameter.turn}, with events ${Parameter.after}~${Parameter.before}`)
  }
  // Execute the simple strategist
  try {
    await context.execute("simple-strategist", Parameter);

  } finally {
    await langfuseSpanProcessor.forceFlush()
  }
  // Update the after parameter
  Parameter.after = params.latest;
}

// Test run
runStrategist({
  playerID: 0,
  turn: 0,
  latest: 100
});

// Register callback
mcpClient.onElicitInput((params) => {
   logger.info(`Received elicitInput notification: ${params.message}`, params);
  switch (params.message) {
    case "PlayerDoneTurn":
      runStrategist(params);
      break;
    case "GameSwitched":
      break;
  }
});