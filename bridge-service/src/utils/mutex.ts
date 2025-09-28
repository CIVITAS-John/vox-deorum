import { createLogger } from './logger.js';

const logger = createLogger('GameMutex');
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
 * Global mutex for managing Civilization V game pause state
 */
class GameMutexManager {
  private mutex: any = null;
  private isPaused = false;
  private readonly mutexName = 'TurnByTurn';
  private pausedPlayerIds: Set<number> = new Set();
  private externalPause = false; // Whether game is paused by external (manual) operation
  private currentActivePlayer: number = -1;

  /**
   * Pauses the game by acquiring the mutex lock
   * Handles repetitive calls gracefully
   */
  pauseGame(isExternal: boolean = false): boolean {
    if (!Mutex) return false;
    if (isExternal) this.externalPause = true;
    if (this.isPaused) return true;

    try {
      this.mutex = new Mutex(this.mutexName);
      this.isPaused = true;
      if (isExternal) this.externalPause = true;
      logger.warn(`Game paused successfully (external: ${isExternal})`);
      return true;
    } catch (error) {
      logger.warn('Failed to pause game:', error);
      return false;
    }
  }

  /**
   * Resumes the game by releasing the mutex lock
   * Handles repetitive calls gracefully
   */
  resumeGame(isExternal: boolean = false): boolean {
    if (!Mutex) return false;
    if (isExternal) this.externalPause = false;
    if (!this.mutex) return true;

    // Only resume if it's an external call or if there's no external pause
    if (this.externalPause) {
      logger.debug('Cannot auto-resume: game is externally paused');
      return false;
    }

    try {
      this.mutex.release();
      this.mutex = null;
      this.isPaused = false;
      logger.warn(`Game resumed successfully (external: ${isExternal})`);
      return true;
    } catch (error) {
      logger.warn('Failed to resume game:', error);
      return false;
    }
  }

  /**
   * Returns the current pause state of the game
   */
  isGamePaused(): boolean {
    return this.isPaused;
  }

  /**
   * Check if the game should be paused for a specific player
   */
  private shouldPauseForPlayer(playerId: number): boolean {
    return playerId >= 0 && playerId < MaxCivs && this.pausedPlayerIds.has(playerId);
  }

  /**
   * Add a player to the paused players list
   */
  registerPausedPlayer(playerId: number): boolean {
    this.pausedPlayerIds.add(playerId);
    logger.info(`Player ${playerId} added to paused players list, currently ${this.isPaused}`);

    // If this player is currently active, pause the game
    if (this.currentActivePlayer === playerId && !this.isPaused) {
      return this.pauseGame(false);
    }
    return true;
  }

  /**
   * Remove a player from the paused players list
   */
  unregisterPausedPlayer(playerId: number): boolean {
    this.pausedPlayerIds.delete(playerId);
    logger.info(`Player ${playerId} removed from paused players list, currently ${this.isPaused}`);

    // If this player is currently active and game is paused, try to resume
    if (this.currentActivePlayer === playerId && this.isPaused) {
      return this.resumeGame(false);
    }
    return true;
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
    this.pausedPlayerIds.clear();
    if (this.pausedPlayerIds.size > 0)
      logger.info('Cleared all paused players');

    // Try to resume if not externally paused
    if (this.isPaused && !this.externalPause) {
      this.resumeGame(false);
    }
  }

  /**
   * Update the active player and handle auto-pause/resume
   */
  setActivePlayer(playerId: number): void {
    const previousPlayer = this.currentActivePlayer;
    this.currentActivePlayer = playerId;

    if (previousPlayer === playerId) return;

    logger.info(`Active player changed from ${previousPlayer} to ${playerId}`);

    // Decide whether to pause or resume based on new active player
    if (this.shouldPauseForPlayer(playerId)) {
      if (!this.isPaused && this.pauseGame(false)) {
        logger.info(`Game auto-paused for player ${playerId}`);
      }
    } else if (this.resumeGame(false)) {
      logger.info(`Game auto-resumed for player ${playerId}`);
    }
  }

  /**
   * Finalizes the mutex manager, ensuring cleanup
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
 * Global singleton instance of the game mutex manager
 */
export const gameMutexManager = new GameMutexManager();

// Ensure cleanup on process exit
process.on('exit', () => {
  gameMutexManager.finalize();
});

process.on('SIGINT', () => {
  gameMutexManager.finalize();
  process.exit();
});

process.on('SIGTERM', () => {
  gameMutexManager.finalize();
  process.exit();
});