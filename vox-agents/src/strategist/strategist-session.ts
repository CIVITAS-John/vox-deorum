import { createLogger } from "../utils/logger.js";
import { mcpClient } from "../utils/models/mcp-client.js";
import { VoxPlayer } from "./vox-player.js";
import { voxCivilization } from "../infra/vox-civilization.js";
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
  /** Game mode - 'start' for new game, 'load' to load existing (default: 'load') */
  gameMode: 'start' | 'load';
}

/**
 * Manages a game session for the strategist system
 */
export class StrategistSession {
  private activePlayers = new Map<number, VoxPlayer>();
  private abortController = new AbortController();
  private victoryPromise: Promise<void>;
  private victoryResolve?: () => void;
  private lastGameState: 'running' | 'crashed' | 'victory' = 'running';
  private crashRecoveryAttempts = 0;
  private readonly MAX_RECOVERY_ATTEMPTS = 3;

  constructor(private config: StrategistSessionConfig) {
    this.victoryPromise = new Promise((resolve) => {
      this.victoryResolve = resolve;
    });
  }

  /**
   * Starts the session and plays until PlayerVictory
   * @param gameMode - Override the default game mode from config
   */
  async start(): Promise<void> {
    const luaScript = this.config.gameMode === 'start' ? 'StartGame.lua' : 'LoadGame.lua';

    logger.info(`Starting strategist session in ${this.config.gameMode} mode`, this.config);

    // Register game exit handler for crash recovery
    voxCivilization.onGameExit(this.handleGameExit.bind(this));
    await voxCivilization.startGame(luaScript);

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
        case "DLLConnected":
          await this.handleDLLConnected(params);
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
      player.notifyTurn(params.turn, params.latestID);
      this.crashRecoveryAttempts = Math.max(0, this.crashRecoveryAttempts - 1);
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

    await mcpClient.callTool("set-metadata", { Key: "experiment", Value: this.config.strategist })
    if (this.config.autoPlay && params.turn === 0) {
      // Autoplay
      await setTimeout(1000);
      await mcpClient.callTool("lua-executor", {
        Script: `
Events.LoadScreenClose();
Game.SetPausePlayer(-1);
Game.SetAIAutoPlay(1, -1);`
      });
      await setTimeout(5000);
      await mcpClient.callTool("lua-executor", { Script: `ToggleStrategicView();` });
    } else {
      await setTimeout(1000);
      await mcpClient.callTool("lua-executor", { Script: `Events.LoadScreenClose(); Game.SetPausePlayer(-1);` });
    }
  }

  private async handleDLLConnected(params: any): Promise<void> {
    const recovering = this.lastGameState === 'crashed';

    if (recovering) {
      logger.info('Game successfully recovered from crash');
      this.lastGameState = 'running';
      await mcpClient.callTool("lua-executor", { Script: `Events.LoadScreenClose(); Game.SetPausePlayer(-1);` });
      if (this.config.autoPlay) {
        await setTimeout(5000);
        await mcpClient.callTool("lua-executor", { Script: `ToggleStrategicView();` });
      }
    }
  }

  private async handlePlayerVictory(params: any): Promise<void> {
    logger.info(`Player ${params.playerID} has won the game on turn ${params.turn}!`);

    // Mark game as victory state
    this.lastGameState = 'victory';

    // Abort all existing players
    for (const player of this.activePlayers.values()) {
      player.abort();
    }
    this.activePlayers.clear();

    // Stop autoplay
    await mcpClient.callTool("lua-executor", { Script: `Game.SetAIAutoPlay(-1);` });
    if (this.config.autoPlay) {
      await mcpClient.callTool("lua-executor", { Script: `UI.ExitGame()` });
      await setTimeout(5000);
      await voxCivilization.killGame();
    }

    // Resolve the victory promise to complete the session
    if (this.victoryResolve) {
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
    logger.info('Starting Civilization V with LoadGame.lua to recover from crash...');
    const started = await voxCivilization.startGame('LoadGame.lua');

    if (!started) {
      logger.error('Failed to restart the game');
      await this.shutdown();
      return;
    }
  }
}