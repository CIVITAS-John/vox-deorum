/**
 * Pause Manager - Manages manual game pause state and player pause list synced with DLL
 */

import { EventEmitter } from 'events';
import { createLogger } from '../utils/logger.js';
import { dllConnector } from './dll-connector.js';
import { IPCMessage, PauseMessage } from '../types/event.js';

const logger = createLogger('PauseManager');
export const MaxCivs = 64; // From base.js schema

// Optional import - handle gracefully if package doesn't exist
let Mutex: any = null;
try {
  const mutexModule = await import('windows-mutex-prebuilt');
  Mutex = mutexModule.Mutex;
} catch {
  // Package doesn't exist - mutex operations will return false
  logger.warn('windows-mutex-prebuilt not available, cannot pause game');
}

/**
 * Manager for game pause state, synchronized with DLL
 */
class PauseManager extends EventEmitter {
  // Local state for player pause list (synced with DLL)
  private pausedPlayerIds: Set<number> = new Set();
  // Manual pause state (only external/manual pauses)
  private mutex: any = null;
  private isPaused = false;
  private readonly mutexName = 'TurnByTurn';

  constructor() {
    super();

    // Listen for DLL reconnection to resync state
    dllConnector.on('connected', () => {
      this.handleDllReconnected();
    });

    dllConnector.on('disconnected', () => {
      // When DLL disconnects, clear local state as DLL will clear its state too
      this.pausedPlayerIds.clear();
      logger.info('DLL disconnected, cleared paused players');
    });
  }

  /**
   * Handle DLL reconnection - resync paused players
   */
  private async handleDllReconnected(): Promise<void> {
    if (this.pausedPlayerIds.size === 0) return;

    logger.info(`DLL reconnected, resyncing ${this.pausedPlayerIds.size} paused players`);

    // Send all paused players back to DLL
    for (const playerId of this.pausedPlayerIds) {
      const message: PauseMessage = {
        type: 'pause_player',
        playerID: playerId
      };
      dllConnector.sendNoWait(message);
    }
  }

  /**
   * Pause the game manually using mutex
   */
  pauseGame(): boolean {
    if (!Mutex) return false;
    if (this.isPaused) return true;

    try {
      this.mutex = new Mutex(this.mutexName);
      this.isPaused = true;
      logger.debug('Game paused successfully');
      return true;
    } catch (error) {
      logger.warn('Failed to pause game:', error);
      return false;
    }
  }

  /**
   * Resume the game manually by releasing mutex
   */
  resumeGame(): boolean {
    if (!Mutex) return false;
    if (!this.mutex) return true;

    try {
      this.mutex.release();
      this.mutex = null;
      this.isPaused = false;
      logger.debug('Game resumed successfully');
      return true;
    } catch (error) {
      logger.warn('Failed to resume game:', error);
      return false;
    }
  }

  /**
   * Check if game is paused
   */
  isGamePaused(): boolean {
    return this.isPaused;
  }

  /**
   * Register a player for auto-pause
   */
  registerPausedPlayer(playerId: number): boolean {
    if (playerId < 0 || playerId >= MaxCivs) {
      logger.error(`Invalid player ID: ${playerId}`);
      return false;
    }

    // Add to local state
    this.pausedPlayerIds.add(playerId);
    logger.info(`Player ${playerId} added to paused players list`);

    // Send to DLL
    const message: PauseMessage = {
      type: 'pause_player',
      playerID: playerId
    };
    const result = dllConnector.sendNoWait(message);

    return result.success;
  }

  /**
   * Unregister a player from auto-pause
   */
  unregisterPausedPlayer(playerId: number): boolean {
    if (playerId < 0 || playerId >= MaxCivs) {
      logger.error(`Invalid player ID: ${playerId}`);
      return false;
    }

    // Remove from local state
    this.pausedPlayerIds.delete(playerId);
    logger.info(`Player ${playerId} removed from paused players list`);

    // Send to DLL
    const message: PauseMessage = {
      type: 'unpause_player',
      playerID: playerId
    };
    const result = dllConnector.sendNoWait(message);

    return result.success;
  }

  /**
   * Get all paused player IDs
   */
  getPausedPlayers(): number[] {
    return Array.from(this.pausedPlayerIds);
  }

  /**
   * Clear all paused players
   */
  clearPausedPlayers(): void {
    const hadPlayers = this.pausedPlayerIds.size > 0;
    this.pausedPlayerIds.clear();

    if (hadPlayers) {
      logger.info('Cleared all paused players');

      // Send to DLL
      const message: IPCMessage = {
        type: 'clear_paused_players'
      };
      dllConnector.sendNoWait(message);
    }
  }

  /**
   * Update the active player (called when game events indicate turn change)
   * Note: With DLL handling pausing, this is mainly for logging
   */
  setActivePlayer(playerId: number): void {
    logger.debug(`Active player set to ${playerId}`);

    // The DLL handles the actual pausing based on its internal state
    // We just track for UI/API responses
    if (this.pausedPlayerIds.has(playerId)) {
      logger.info(`Player ${playerId} is in paused list - DLL will pause`);
    }
  }

  /**
   * Clean up resources
   */
  finalize(): void {
    if (this.mutex && this.isPaused) {
      try {
        this.mutex.release();
        logger.info('Mutex released during finalization');
      } catch (error) {
        logger.error('Error releasing mutex during finalization:', error);
      }
    }
    this.mutex = null;
    this.isPaused = false;
    this.pausedPlayerIds.clear();
  }
}

/**
 * Global singleton instance
 */
export const pauseManager = new PauseManager();

// Ensure cleanup on process exit
process.on('exit', () => {
  pauseManager.finalize();
});

process.on('SIGINT', () => {
  pauseManager.finalize();
  process.exit();
});

process.on('SIGTERM', () => {
  pauseManager.finalize();
  process.exit();
});