import { createLogger } from "../utils/logger.js";
import { mcpClient } from "../utils/mcp-client.js";
import { VoxPlayer } from "./vox-player.js";

const logger = createLogger('Strategists');

// Players to monitor - can be configured
const llmPlayers = [0];

// Active player instances
const activePlayers = new Map<number, VoxPlayer>();

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
      logger.warn(`Game context switching - aborting pending calls`, params);

      // Abort all existing players
      for (const player of activePlayers.values()) {
        player.abort();
      }
      activePlayers.clear();

      // Create new players for this game
      for (const playerID of llmPlayers) {
        const player = new VoxPlayer(playerID, "simple-strategist", params.gameID, params.turn);
        activePlayers.set(playerID, player);
        player.execute();
      }
      break;
    default:
      logger.info(`Received elicitInput notification: ${params.message}`, params);
      break;
  }
});