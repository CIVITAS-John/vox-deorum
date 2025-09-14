import { LangfuseSpan, startObservation } from "@langfuse/tracing";
import { VoxContext } from "../infra/vox-context.js";
import { langfuseSpanProcessor } from "../instrumentation.js";
import { createLogger } from "../utils/logger.js";
import { mcpClient } from "../utils/mcp-client.js";
import { getModelConfig } from "../utils/models.js";
import { SimpleStrategist } from "./simple-strategist.js";
import { StrategistParameters } from "./strategist.js";
import { setTimeout } from 'node:timers/promises';

const logger = createLogger('Strategists');

// Connect to the server
await mcpClient.connect();

// Create the context
const context = new VoxContext(getModelConfig("default"));
await context.registerMCP();

// Register agents
const strategist = "simple-strategist";
context.registerAgent(new SimpleStrategist());

// Initialize parameters
const initParameters = () => {
  return {
    playerID: 0,
    turn: -1,
    after: -1,
    before: 0
  }
};

// Start obversation
var observation: LangfuseSpan;

// Run strategist
var parameters: StrategistParameters<unknown> = initParameters();
const runStrategist = async (params: any) => {
  try {
    // Check relevant
    if (parameters.playerID != params.playerID) return;
    if (parameters.running) {
      logger.warn(`The ${strategist} is still working on turn ${parameters.turn}. Skipping this one...`);
      return;
    }
    // Set the parameters
    parameters.turn = params.turn;
    parameters.before = params.latestID;
    parameters.playerID = params.playerID;
    logger.warn(`Running the ${strategist} on ${parameters.turn}, with events ${parameters.after}~${parameters.before}`);
    // Pause the player beyond 1 turn from now
    await context.callTool("pause-game", { PlayerID: parameters.playerID }, parameters);
    parameters.running = strategist;
    // Execute the strategist
    // await context.execute(strategist, Parameter);
    // Fake running
    parameters.running = strategist;
    await setTimeout(5000);
    // Update the after parameter
  } catch (Error) {
    logger.error(`${strategist} error: `, Error);
  }
  parameters.after = params.latestID;
  await context.callTool("resume-game", { PlayerID: parameters.playerID }, parameters);
  await langfuseSpanProcessor.forceFlush()
  parameters.running = undefined;
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
      logger.warn(`Game context switching - aborting pending calls`, params);
      // Abort existing operations
      context.abort();
      if (observation) observation.end();
      // Initialize parameters
      parameters = initParameters();
      parameters.gameID = params.gameID;
      parameters.after = params.turn * 1000000;
      // Start observation
      observation = startObservation("strategist", {
        input: `Game: ${params.gameID}, Turn: ${params.turn}, Player: ${parameters.playerID}`,
      }, { asType: "span" });
      // Resume the game - in case we are resuming something
      await context.callTool("resume-game", { PlayerID: parameters.playerID }, parameters);
      break;
    default:
      logger.info(`Received elicitInput notification: ${params.message}`, params);
      break;
  }
});