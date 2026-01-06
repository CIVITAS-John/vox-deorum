/**
 * @module strategist/strategist-session
 *
 * Strategist session management.
 * Orchestrates game lifecycle, player management, crash recovery, and event handling
 * for a single game session. Manages multiple VoxPlayers and handles game state transitions.
 */

import { createLogger } from "../utils/logger.js";
import { mcpClient } from "../utils/models/mcp-client.js";
import { VoxPlayer } from "./vox-player.js";
import { voxCivilization } from "../infra/vox-civilization.js";
import { setTimeout } from 'node:timers/promises';
import { VoxSession } from "../infra/vox-session.js";
import { sessionRegistry } from "../infra/session-registry.js";
import { StrategistSessionConfig } from "../types/config.js";
import { SessionStatus } from "../types/api.js";

const logger = createLogger('StrategistSession');

/**
 * Concrete implementation of VoxSession for Strategist game sessions.
 * Manages AI players and game lifecycle.
 * Handles game startup, player coordination, crash recovery, and graceful shutdown.
 *
 * @class
 */
export class StrategistSession extends VoxSession<StrategistSessionConfig> {
  private activePlayers = new Map<number, VoxPlayer>();
  private finishPromise: Promise<void>;
  private victoryResolve?: () => void;
  private lastGameID?: string;
  private crashRecoveryAttempts = 0;
  private dllConnected = false;
  private readonly MAX_RECOVERY_ATTEMPTS = 3;

  constructor(config: StrategistSessionConfig) {
    super(config);
    this.finishPromise = new Promise((resolve) => {
      this.victoryResolve = resolve;
    });
    voxCivilization.onGameExit(this.handleGameExit.bind(this));
  }

  /**
   * Starts the session and plays until PlayerVictory.
   * Launches the game, connects to MCP server, and waits for completion.
   */
  async start(): Promise<void> {
    try {
      // Update state to starting and register with the session registry
      this.onStateChange('starting');
      sessionRegistry.register(this);

      const luaScript = this.config.gameMode === 'start' ? 'StartGame.lua' :
                        this.config.gameMode === 'wait' ? 'LoadMods.lua' : 'LoadGame.lua';

      logger.info(`Starting strategist session ${this.id} in ${this.config.gameMode} mode`, this.config);

    // In wait mode, prompt the user to start the game manually
    if (this.config.gameMode === 'wait') {
      logger.warn('WAIT MODE: Please manually start or load your game.');
      logger.warn('The session will automatically continue when the game is loaded.');
    }

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
          // Transition to running state when DLL connects (game is initialized)
          await this.handleDLLConnected(params);
          break;
        case "DLLDisconnected":
          this.dllConnected = false;
          // Kill the game when the game hangs
          logger.warn(`The DLL is no longer connected. Waiting for 60 seconds...`);
          await setTimeout(60000);
          if (!this.dllConnected && this.state === 'running') {
            this.onStateChange('error');
            logger.warn(`The DLL is no longer connected. Trying to restart the game...`);
            await voxCivilization.killGame();
          }
          break;
        default:
          logger.info(`Received game event notification: ${params.event}`, params);
          break;
      }
    });

    // Register tool error handler to kill game on critical MCP tool errors
    mcpClient.onToolError(async ({ toolName, error }) => {
      if (this.abortController.signal.aborted) return;

      logger.error(`Critical MCP tool error in ${toolName}, killing game process`, error);
      await voxCivilization.killGame();
    });

      // Wait for victory or shutdown
      await this.finishPromise;
    } catch (error) {
      logger.error('Session failed with error:', error);
      this.onStateChange('error', (error as Error).message);
      sessionRegistry.unregister(this.id);
      throw error;
    }
  }

  /**
   * Stop the session gracefully (implements VoxSession abstract method).
   * Calls the existing shutdown() method.
   */
  async stop(): Promise<void> {
    await this.shutdown();
  }

  /**
   * Get current session status for API responses (implements VoxSession abstract method).
   */
  getStatus(): SessionStatus {
    // Get active VoxContext IDs from active players
    const contexts: string[] = [];
    for (const player of this.activePlayers.values()) {
      const contextId = player.getContextId();
      if (contextId) {
        contexts.push(contextId);
      }
    }

    return {
      id: this.id,
      type: this.config.type,
      state: this.state,
      config: this.config,
      startTime: this.startTime,
      contexts,
      gameID: this.gameID,
      turn: this.turn,
      error: this.errorMessage
    };
  }

  /**
   * Shuts down the session gracefully.
   * Aborts all players, disconnects from MCP, and cleans up resources.
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down strategist session...');

    // Update state
    this.onStateChange('stopping');

    // Signal abort to stop processing new events
    this.abortController.abort();

    // Abort all active players and wait for their contexts to shutdown
    for (const [playerID, player] of this.activePlayers.entries()) {
      logger.debug(`Aborting player ${playerID}`);
      player.abort(false);
      // Note: VoxPlayer.execute() will call context.shutdown() in its finally block
    }
    this.activePlayers.clear();

    // Wait briefly to ensure players have time to shutdown their contexts
    await setTimeout(1000);

    // Disconnect from MCP server
    await mcpClient.disconnect();

    // Cleanup VoxCivilization
    voxCivilization.destroy();

    // Resolve victory promise if still pending
    if (this.victoryResolve) {
      this.victoryResolve();
    }

    // Unregister from session registry and update state
    sessionRegistry.unregister(this.id);
    this.onStateChange('stopped');

    logger.info('Strategist session shutdown complete');
  }

  private async handlePlayerDoneTurn(params: any): Promise<void> {
    const player = this.activePlayers.get(params.playerID);
    if (this.turn !== params.turn)
      this.crashRecoveryAttempts = Math.max(0, this.crashRecoveryAttempts - 0.5);
    if (player) {
      player.notifyTurn(params.turn, params.latestID);
      this.onStateChange('running');
      this.turn = params.turn;  // Update current turn
    }
  }

  private async handleGameSwitched(params: any): Promise<void> {
    // If nothing is changing, ignore this
    if (params.gameID === this.lastGameID) return;
    this.lastGameID = params.gameID;
    this.gameID = params.gameID;  // Update current game ID
    this.turn = params.turn;  // Update current turn
    logger.warn(`Game context switching to ${params.gameID} at turn ${params.turn}`);

    // Abort all existing players
    for (const player of this.activePlayers.values()) {
      player.abort(false);
    }
    this.activePlayers.clear();

    // Create new players for this game
    for (const [playerIDStr, playerConfig] of Object.entries(this.config.llmPlayers)) {
      const playerID = parseInt(playerIDStr);
      const player = new VoxPlayer(playerID, playerConfig, params.gameID, params.turn);
      await player.context.registerTools();
      this.activePlayers.set(playerID, player);
      player.execute();
    }

    await mcpClient.callTool("set-metadata", { Key: `experiment`, Value: this.config.name });
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
    if (this.state === 'recovering') {
      logger.warn(`Game successfully recovered from crash, resuming play... (autoplay: ${this.config.autoPlay})`);
      await mcpClient.callTool("lua-executor", { Script: `Events.LoadScreenClose(); Game.SetPausePlayer(-1);` });
      if (this.config.autoPlay) {
        await setTimeout(3000);
        await mcpClient.callTool("lua-executor", { Script: `ToggleStrategicView();` });
      }
    } else {
      logger.info(`The DLL is now connected at the state '${this.state}'.`);
    }
    
    this.onStateChange('running');
  }

  private async handlePlayerVictory(params: any): Promise<void> {
    logger.warn(`Player ${params.playerID} has won the game on turn ${params.turn}!`);

    // Stop the game when autoplay
    if (this.config.autoPlay) {
      this.onStateChange('stopping');
      // Abort all existing players
      for (const player of this.activePlayers.values()) {
        player.abort(true);
      }
      this.activePlayers.clear();

      // Stop autoplay
      mcpClient.callTool("lua-executor", { Script: `Game.SetAIAutoPlay(-1);` }).catch((any) => null);

      // Stop the game
      await setTimeout(5000);
      logger.info(`Requesting voluntary shutdown of the game...`);
      mcpClient.callTool("lua-executor", { Script: `Events.UserRequestClose();` }).catch((any) => null);
      await setTimeout(5000);

      // Kill the process
      const killed = await voxCivilization.killGame();
      logger.info(`Sent killing signals to the game: ${killed}`);
      this.onStateChange('stopped');
    }

    // Resolve the victory promise to complete the session
    if (this.victoryResolve) {
      logger.info(`Finishing the run...`);
      this.victoryResolve();
    }
  }

  /**
   * Handles game process exit events (crashes or normal exits).
   * Implements bounded crash recovery with automatic game restart.
   *
   * @private
   * @param exitCode - Exit code from the game process
   */
  private async handleGameExit(exitCode: number | null): Promise<void> {
    // Don't attempt recovery if we're shutting down or victory was achieved
    if (this.abortController.signal.aborted || this.state === 'stopping' || this.state === 'stopped') {
      logger.info('Game exited normally during shutdown or after victory');
      return;
    }

    // If the game wasn't initialized, use the appropriate script based on mode
    const luaScript = this.config.gameMode === 'start' && this.state === 'starting' ? 'StartGame.lua' :
                      this.config.gameMode === 'wait' ? 'LoadMods.lua' : 'LoadGame.lua';

    // Game crashed unexpectedly
    logger.error(`Game process crashed with exit code: ${exitCode}`);
    this.onStateChange('error');

    // Check if we've exceeded recovery attempts
    if (this.crashRecoveryAttempts >= this.MAX_RECOVERY_ATTEMPTS) {
      logger.error(`Maximum recovery attempts (${this.MAX_RECOVERY_ATTEMPTS}) exceeded. Shutting down session.`);
      await this.shutdown();
      return;
    }

    // Attempt to recover the game
    this.crashRecoveryAttempts++;
    logger.info(`Attempting game recovery (attempt ${Math.ceil(this.crashRecoveryAttempts)}/${this.MAX_RECOVERY_ATTEMPTS})...`);

    // Update state to recovering
    this.onStateChange('recovering');

    // Restart the game using the appropriate script to recover from crash
    if (this.config.gameMode === 'wait') {
      logger.warn('RECOVERY: Please load your game manually.');
      logger.warn('The session will automatically continue when the game is loaded.');
    } else {
      logger.info(`Starting Civilization V with ${luaScript} to recover from crash...`);
    }
    const started = await voxCivilization.startGame(luaScript);

    if (!started) {
      logger.error('Failed to restart the game');
      await this.shutdown();
      return;
    }
  }
}