import { createLogger } from "../utils/logger.js";
import { mcpClient } from "../utils/models/mcp-client.js";
import { VoxPlayer } from "./vox-player.js";
import { voxCivilization } from "../infra/vox-civilization.js";
import { setTimeout } from 'node:timers/promises';
import { Model } from "../utils/config.js";

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
  /** Game mode - 'start' for new game, 'load' to load existing (default: 'load') */
  gameMode: 'start' | 'load';
  /** The number of repeated runs. After the first, all will be new games. */
  repetition?: number;
  /** LLM model to use for the strategist - override the baseline config */
  llms?: Record<string, Model | string>;
}

/**
 * Manages a game session for the strategist system
 */
export class StrategistSession {
  private activePlayers = new Map<number, VoxPlayer>();
  private abortController = new AbortController();
  private finishPromise: Promise<void>;
  private victoryResolve?: () => void;
  private lastGameState: 'running' | 'crashed' | 'victory' | 'initializing' = 'initializing';
  private crashRecoveryAttempts = 0;
  private dllConnected = false;
  private readonly MAX_RECOVERY_ATTEMPTS = 3;

  constructor(private config: StrategistSessionConfig) {
    this.finishPromise = new Promise((resolve) => {
      this.victoryResolve = resolve;
    });
    voxCivilization.onGameExit(this.handleGameExit.bind(this));
  }

  /**
   * Starts the session and plays until PlayerVictory
   * @param gameMode - Override the default game mode from config
   */
  async start(): Promise<void> {
    const luaScript = this.config.gameMode === 'start' ? 'StartGame.lua' : 'LoadGame.lua';

    logger.info(`Starting strategist session in ${this.config.gameMode} mode`, this.config);

    // Register game exit handler for crash recovery
    await voxCivilization.startGame(luaScript);

    // Connect to MCP server
    await mcpClient.connect();

    // Register notification handler for game events
    mcpClient.onNotification(async (params: any) => {
      if (this.abortController.signal.aborted) return;

      // The notification now has 'event' field instead of 'message'
      switch (params.event) {
        case "PlayerDoneTurn":
          await this.handlePlayerDoneTurn(params);
          break;
        case "GameSwitched":
          await this.handleGameSwitched(params);
          break;
        case "PlayerVictory":
          await this.handlePlayerVictory(params);
          break;
        case "DLLConnected":
          this.dllConnected = true;
          await this.handleDLLConnected(params);
          break;
        case "DLLDisconnected":
          this.dllConnected = false;
          // Kill the game when the game hangs
          logger.warn(`The DLL is no longer connected. Waiting for 60 seconds...`);
          await setTimeout(60000);
          if (!this.dllConnected && this.lastGameState !== 'victory') {
            logger.warn(`The DLL is no longer connected. Trying to restart the game...`);
            await voxCivilization.killGame();
          }
          break;
        default:
          logger.info(`Received game event notification: ${params.event}`, params);
          break;
      }
    });

    // Wait for victory or shutdown
    await this.finishPromise;
  }

  /**
   * Shuts down the session gracefully
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down strategist session...');

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

    // Cleanup VoxCivilization
    voxCivilization.destroy();

    // Resolve victory promise if still pending
    if (this.victoryResolve) {
      this.victoryResolve();
    }
  }

  private async handlePlayerDoneTurn(params: any): Promise<void> {
    const player = this.activePlayers.get(params.playerID);
    if (player) {
      this.lastGameState = 'running';
      if (player.notifyTurn(params.turn, params.latestID))
        this.crashRecoveryAttempts = Math.max(0, this.crashRecoveryAttempts - 1);
    }
  }

  private async handleGameSwitched(params: any): Promise<void> {
    logger.warn(`Game context switching to ${params.gameID} at turn ${params.turn}`);

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

    await mcpClient.callTool("set-metadata", { Key: "experiment", Value: this.config.strategist })
    if (this.config.autoPlay && params.turn === 0) {
      // Autoplay
      await setTimeout(3000);
      await mcpClient.callTool("lua-executor", {
        Script: `
Events.LoadScreenClose();
Game.SetPausePlayer(-1);
Game.SetAIAutoPlay(2000, -1);`
      });
      await setTimeout(3000);
      await mcpClient.callTool("lua-executor", { Script: `ToggleStrategicView();` });
    } else {
      await setTimeout(1000);
      await mcpClient.callTool("lua-executor", { Script: `Events.LoadScreenClose(); Game.SetPausePlayer(-1);` });
    }
  }

  private async handleDLLConnected(params: any): Promise<void> {
    const recovering = this.lastGameState === 'crashed';

    if (recovering) {
      this.lastGameState = 'running';
      logger.info('Game successfully recovered from crash');
      await mcpClient.callTool("lua-executor", { Script: `Events.LoadScreenClose(); Game.SetPausePlayer(-1);` });
      if (this.config.autoPlay) {
        await setTimeout(3000);
        await mcpClient.callTool("lua-executor", { Script: `ToggleStrategicView();` });
      }
    }
  }

  private async handlePlayerVictory(params: any): Promise<void> {
    logger.warn(`Player ${params.playerID} has won the game on turn ${params.turn}!`);

    // Mark game as victory state
    this.lastGameState = 'victory';

    // Abort all existing players
    for (const player of this.activePlayers.values()) {
      player.abort();
    }
    this.activePlayers.clear();

    // Stop autoplay
    mcpClient.callTool("lua-executor", { Script: `Game.SetAIAutoPlay(-1);` }).catch((any) => null);
    if (this.config.autoPlay) {
      await setTimeout(5000);
      logger.info(`Requesting voluntary shutdown of the game...`);
      mcpClient.callTool("lua-executor", { Script: `Events.UserRequestClose();` }).catch((any) => null);
      await setTimeout(5000);
      const killed = await voxCivilization.killGame();
      logger.info(`Sent killing signals to the game: ${killed}`);
    }

    // Resolve the victory promise to complete the session
    if (this.victoryResolve) {
      logger.info(`Finishing the run...`);
      this.victoryResolve();
    }
  }

  /**
   * Handles game process exit events (crashes or normal exits)
   */
  private async handleGameExit(exitCode: number | null): Promise<void> {
    // Don't attempt recovery if we're shutting down or victory was achieved
    if (this.abortController.signal.aborted || this.lastGameState === 'victory') {
      logger.info('Game exited normally during shutdown or after victory');
      return;
    }

    // If the game wasn't initialized, start it again
    const luaScript = this.config.gameMode === 'start' && this.lastGameState === 'initializing' ? 'StartGame.lua' : 'LoadGame.lua';

    // Game crashed unexpectedly
    logger.error(`Game process crashed with exit code: ${exitCode}`);
    this.lastGameState = 'crashed';

    // Check if we've exceeded recovery attempts
    if (this.crashRecoveryAttempts >= this.MAX_RECOVERY_ATTEMPTS) {
      logger.error(`Maximum recovery attempts (${this.MAX_RECOVERY_ATTEMPTS}) exceeded. Shutting down session.`);
      await this.shutdown();
      return;
    }

    // Attempt to recover the game
    this.crashRecoveryAttempts++;
    logger.info(`Attempting game recovery (attempt ${this.crashRecoveryAttempts}/${this.MAX_RECOVERY_ATTEMPTS})...`);

    // Restart the game using LoadGame.lua to load the last save
    logger.info(`Starting Civilization V with ${luaScript} to recover from crash...`);
    const started = await voxCivilization.startGame(luaScript);

    if (!started) {
      logger.error('Failed to restart the game');
      await this.shutdown();
      return;
    }
  }
}