import { createLogger } from "../utils/logger.js";
import { mcpClient } from "../utils/models/mcp-client.js";
import { VoxPlayer } from "./vox-player.js";
import { setTimeout } from 'node:timers/promises';

const logger = createLogger('StrategistSession');

/**
 * Configuration for a StrategistSession
 */
export interface StrategistSessionConfig {
  /** Player IDs to monitor and control with LLM */
  llmPlayers: number[];
  /** Whether to automatically start playing when game switches */
  autoPlay: boolean;
  /** Strategist type to use */
  strategist: string;
}

/**
 * Manages a game session for the strategist system
 */
export class StrategistSession {
  private activePlayers = new Map<number, VoxPlayer>();
  private abortController = new AbortController();
  private victoryPromise: Promise<void>;
  private victoryResolve?: () => void;

  constructor(private config: StrategistSessionConfig) {
    this.victoryPromise = new Promise((resolve) => {
      this.victoryResolve = resolve;
    });
  }

  /**
   * Starts the session and plays until PlayerVictory
   */
  async start(): Promise<void> {
    logger.info('Starting strategist session', this.config);

    // Connect to MCP server
    await mcpClient.connect();

    // Register callbacks
    mcpClient.onElicitInput(async (params) => {
      if (this.abortController.signal.aborted) return;

      switch (params.message) {
        case "PlayerDoneTurn":
          await this.handlePlayerDoneTurn(params);
          break;
        case "GameSwitched":
          await this.handleGameSwitched(params);
          break;
        case "PlayerVictory":
          await this.handlePlayerVictory(params);
          break;
        default:
          logger.info(`Received elicitInput notification: ${params.message}`, params);
          break;
      }
    });

    // Wait for victory or shutdown
    await this.victoryPromise;
  }

  /**
   * Shuts down the session gracefully
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down strategist session');

    // Signal abort to stop processing new events
    this.abortController.abort();

    // Abort all active players
    for (const [playerID, player] of this.activePlayers.entries()) {
      logger.debug(`Aborting player ${playerID}`);
      player.abort();
    }
    this.activePlayers.clear();

    // Disconnect from MCP server
    await mcpClient.disconnect();

    // Resolve victory promise if still pending
    if (this.victoryResolve) {
      this.victoryResolve();
    }
  }

  private async handlePlayerDoneTurn(params: any): Promise<void> {
    const player = this.activePlayers.get(params.playerID);
    if (player) {
      player.notifyTurn(params.turn, params.latestID);
    }
  }

  private async handleGameSwitched(params: any): Promise<void> {
    logger.warn(`Game context switching to ${params.gameID}`);

    // Abort all existing players
    for (const player of this.activePlayers.values()) {
      player.abort();
    }
    this.activePlayers.clear();

    // Create new players for this game
    for (const playerID of this.config.llmPlayers) {
      const player = new VoxPlayer(playerID, this.config.strategist, params.gameID, params.turn);
      this.activePlayers.set(playerID, player);
      player.execute();
    }

    // Autoplay
    if (this.config.autoPlay && params.turn === 0) {
      await setTimeout(1000);
      await mcpClient.callTool("lua-executor", {
        Script: `
Events.LoadScreenClose();
Game.SetPausePlayer(-1);
Game.SetAIAutoPlay(1, -1);`
      });
      await setTimeout(5000);
      await mcpClient.callTool("lua-executor", { Script: `ToggleStrategicView();` });
    }
  }

  private async handlePlayerVictory(params: any): Promise<void> {
    logger.info(`Player ${params.playerID} has won the game on turn ${params.turn}!`);

    // Abort all existing players
    for (const player of this.activePlayers.values()) {
      player.abort();
    }
    this.activePlayers.clear();

    // Stop autoplay
    await mcpClient.callTool("lua-executor", { Script: `Game.SetAIAutoPlay(-1);` });

    // Resolve the victory promise to complete the session
    if (this.victoryResolve) {
      this.victoryResolve();
    }
  }
}