/**
 * Central orchestrator for all knowledge-related operations.
 * Monitors game state changes and manages persistence.
 */

import { logger } from '../utils/logger.js';
import { bridgeManager } from '../server.js';
import { GameIdentity, syncGameIdentity } from '../utils/lua/game-identity.js';

export class KnowledgeManager {
  private gameIdentity?: GameIdentity;
  private autoSaveTimer: NodeJS.Timeout | null = null;

  private config = {
    databasePath: 'saves/',
    autoSaveInterval: 30000,
  };

  /**
   * Setup event listeners for SSE and Bridge Service events
   */
  async initialize() {
    bridgeManager.on('connected', () => {
      logger.info('Bridge Service connected');
      this.checkGameContext();
    });
    bridgeManager.on('gameEvent', (data) => {
      logger.debug('Turn start event received', data);
      this.checkGameContext();
    });
    this.startAutoSave();
  }

  /**
   * Check game context and detect changes
   */
  private async checkGameContext(): Promise<void> {
    try {
      const gameIdentity = await syncGameIdentity();
      if (gameIdentity && gameIdentity.gameId !== this.gameIdentity?.gameId) {
        logger.info(`Game context change detected: ${this.gameIdentity?.gameId ?? "(empty)"} -> ${gameIdentity.gameId}`);
        await this.switchGameContext(gameIdentity);
      }
    } catch (error) {
      logger.error('Error checking game context:', error);
    }
  }

  /**
   * Switch to a new game context
   */
  private async switchGameContext(identity: GameIdentity): Promise<void> {
    await this.saveKnowledge();
    this.gameIdentity = identity;
    await this.loadKnowledge(identity.gameId);
  }

  /**
   * Start auto-save timer
   */
  private startAutoSave(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
    }

    this.autoSaveTimer = setInterval(() => {
      this.saveKnowledge();
    }, this.config.autoSaveInterval);
  }

  /**
   * Save current knowledge to database
   */
  async saveKnowledge(): Promise<void> {
    if (!this.gameIdentity) return;
    logger.info(`Saving knowledge for game: ${this.gameIdentity.gameId}`);
    // TODO: Implement actual save to KnowledgeStore (Phase 3)

  }

  /**
   * Load knowledge for a specific game
   */
  async loadKnowledge(gameId: string): Promise<void> {
    logger.info(`Loading knowledge for game: ${gameId}`);
    // TODO: Implement actual load from KnowledgeStore (Phase 3)

  }

  /**
   * Cleanup and shutdown
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down KnowledgeManager');

    if (this.autoSaveTimer)
      clearInterval(this.autoSaveTimer);

    await this.saveKnowledge();
  }
}