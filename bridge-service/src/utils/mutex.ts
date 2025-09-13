import { Mutex } from '@vscode/windows-mutex'
import { createLogger } from './logger.js';

const logger = createLogger('GameMutex');

/**
 * Global mutex for managing Civilization V game pause state
 */
class GameMutexManager {
  private mutex: any = null;
  private isPaused = false;
  private readonly mutexName = 'TurnByTurn';

  /**
   * Pauses the game by acquiring the mutex lock
   * Handles repetitive calls gracefully
   */
  pauseGame(): boolean {
    if (this.isPaused) {
      logger.debug('Game already paused, ignoring pauseGame() call');
      return true;
    }

    try {
      this.mutex = new Mutex(this.mutexName);
      this.isPaused = true;
      logger.info('Game paused successfully');
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
  resumeGame(): boolean {
    if (!this.isPaused || !this.mutex) {
      logger.debug('Game not paused, ignoring resumeGame() call');
      return true;
    }

    try {
      this.mutex.release();
      this.mutex = null;
      this.isPaused = false;
      logger.info('Game resumed successfully');
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