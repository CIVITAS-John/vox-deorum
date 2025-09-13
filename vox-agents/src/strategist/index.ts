import { VoxContext } from "../infra/vox-context.js";
import { langfuseSpanProcessor } from "../instrumentation.js";
import { createLogger } from "../utils/logger.js";
import { mcpClient } from "../utils/mcp-client.js";
import { getModelConfig } from "../utils/models.js";
import { SimpleStrategist } from "./simple-strategist.js";
import { StrategistParameters } from "./strategist.js";
import delay from 'delay';

const logger = createLogger('Strategists');

// Connect to the server
await mcpClient.connect();

// Create the context
const context = new VoxContext(getModelConfig("default"));
await context.registerMCP();

// Register agents
const strategist = "simple-strategist";
context.registerAgent(new SimpleStrategist());

// Initialize parameters.
const initParameters = () => {
  return {
    playerID: 0,
    turn: -1,
    after: -1,
    before: 0
  }
}

// Run strategist
var parameters: StrategistParameters<unknown> = initParameters();
const runStrategist = async (params: any) => {
  try {
    // Check relevant
    if (parameters.playerID != params.playerID) return;
    if (parameters.running) {
      logger.warn(`The ${strategist} is still working on turn ${parameters.turn}. Skipping this one...`)
    }
    // Pause the player beyond 1 turn from now
    context.callTool("pause-game", parameters.playerID);
    // Set the parameters
    parameters.turn = params.turn;
    parameters.before = params.latestID;
    parameters.playerID = params.playerID;
    logger.info(`Running the ${strategist} on ${parameters.turn}, with events ${parameters.after}~${parameters.before}`)
    // Execute the simple strategist
    try {
      // await context.execute("simple-strategist", Parameter);
      delay(5000);
    } finally {
      await langfuseSpanProcessor.forceFlush()
    }
    // Update the after parameter
    parameters.after = params.latestID;
  } finally {
    context.callTool("resume-game", parameters.playerID);
  }
}

// Test run
/*runStrategist({
  playerID: 0,
  turn: 0,
  latestID: 100
});*/

// Register callback
mcpClient.onElicitInput(async (params) => {
  switch (params.message) {
    case "PlayerDoneTurn":
      await runStrategist(params);
      break;
    case "GameSwitched":
      logger.warn(`Game context switching - aborting pending calls`);
      context.abort();
      parameters = initParameters();
      break;
    default:
      logger.info(`Received elicitInput notification: ${params.message}`, params);
      break;
  }
});