import { langfuseSpanProcessor } from "../instrumentation.js";
import { createLogger } from "../utils/logger.js";
import { mcpClient } from "../utils/models/mcp-client.js";
import { VoxPlayer } from "./vox-player.js";
import { setTimeout } from 'node:timers/promises';

const logger = createLogger('Strategists');

// Players to monitor - can be configured
const llmPlayers = [0];
// Auto-play?
const autoPlay = true;
// Strategist to use
const strategist = "simple-strategist"
// const strategist = "none"

// Active player instances
const activePlayers = new Map<number, VoxPlayer>();

// Graceful shutdown handler
async function shutdown(signal: string) {
  logger.info(`Received ${signal}, shutting down gracefully...`);

  // Abort all active players
  for (const [playerID, player] of activePlayers.entries()) {
    player.abort();
  }
  activePlayers.clear();

  // Disconnect from MCP server
  try {
    await mcpClient.disconnect();
    logger.info('Disconnected from MCP server');
  } catch (error) {
    logger.error('Error disconnecting from MCP server:', error);
  }

  await langfuseSpanProcessor.forceFlush();
  await setTimeout(1000);

  process.exit(0);
}

// Register signal handlers
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  shutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection at:', promise, 'reason:', reason);
  shutdown('unhandledRejection');
});

// Connect to the server
await mcpClient.connect();

// Register callback
mcpClient.onElicitInput(async (params) => {
  switch (params.message) {
    case "PlayerDoneTurn":
      const player = activePlayers.get(params.playerID);
      if (player) {
        player.notifyTurn(params.turn, params.latestID);
      }
      break;
    case "GameSwitched":
      logger.warn(`Game context switching to ${params.gameID}`);

      // Abort all existing players
      for (const player of activePlayers.values()) {
        player.abort();
      }
      activePlayers.clear();

      // Create new players for this game
      for (const playerID of llmPlayers) {
        const player = new VoxPlayer(playerID, strategist, params.gameID, params.turn);
        activePlayers.set(playerID, player);
        player.execute();
      }

      // Autoplay
      if (autoPlay && params.turn === 0) {
        await setTimeout(1000);
        await mcpClient.callTool("lua-executor", { Script: `
Events.LoadScreenClose();
Game.SetPausePlayer(-1);
Game.SetAIAutoPlay(1, -1);
ToggleStrategicView();` });
      }
      break;
    case "PlayerVictory":
      logger.info(`Player ${params.playerID} has won the game on turn ${params.turn}!`);
      // Abort all existing players
      for (const player of activePlayers.values()) {
        player.abort();
      }
      activePlayers.clear();
      // Stop autoplay
      await mcpClient.callTool("lua-executor", { Script: `Game.SetAIAutoPlay(-1);` });
      break;
    default:
      logger.info(`Received elicitInput notification: ${params.message}`, params);
      break;
  }
});