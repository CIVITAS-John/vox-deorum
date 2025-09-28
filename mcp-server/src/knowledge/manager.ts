/**
 * Central orchestrator for all knowledge-related operations.
 * Monitors game state changes and manages persistence.
 */

import { createLogger } from '../utils/logger.js';
import { bridgeManager, MCPServer } from '../server.js';
import { GameIdentity, syncGameIdentity } from '../utils/lua/game-identity.js';
import { KnowledgeStore } from './store.js';
import path from 'path';

const logger = createLogger('KnowledgeManager');

export class KnowledgeManager {
  private gameIdentity?: GameIdentity;
  private knowledgeStore?: KnowledgeStore;
  private autoSaveTimer: NodeJS.Timeout | null = null;
  private dllConnected: boolean = false;

  private config = {
    databasePath: 'data/',
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
    bridgeManager.on('gameEvent', async (data) => {
      logger.debug(`Game event received: ${data.id} of ${data.type}`, data);
      if (data.type == "dll_status") {
        if (data.payload.connected === true) {
          this.dllConnected = true;
          await this.checkGameContext();
          MCPServer.getInstance().sendNotification("DLLConnected", -1, -1, -1);
        } else if (this.dllConnected) {
          this.dllConnected = false;
          MCPServer.getInstance().sendNotification("DLLDisconnected", -1, -1, -1);
        }
      } else if (this.knowledgeStore) {
        await this.knowledgeStore.handleGameEvent(data.id, data.type, data.payload);
      }
    });
    this.startAutoSave();
  }

  /**
   * Check game context and detect changes
   */
  private async checkGameContext(): Promise<boolean> {
    try {
      const gameIdentity = await syncGameIdentity();
      if (gameIdentity && gameIdentity.gameId !== this.gameIdentity?.gameId) {
        logger.info(`Game context change detected: ${this.gameIdentity?.gameId ?? "(empty)"} -> ${gameIdentity.gameId}`);
        await this.switchGameContext(gameIdentity);
        return true;
      } else return false;
    } catch (error) {
      logger.error('Error checking game context:', error);
      return false;
    }
  }

  /**
   * Switch to a new game context
   */
  private async switchGameContext(identity: GameIdentity): Promise<void> {
    await this.saveKnowledge();
    
    // Close existing store if any
    if (this.knowledgeStore) {
      await this.knowledgeStore.close();
      this.knowledgeStore = undefined;
    }
    
    // Load knowledge store
    this.gameIdentity = identity;
    await this.loadKnowledge(identity.gameId);
    this.updateActivePlayer();

    // Notify our clients
    MCPServer.getInstance().sendNotification("GameSwitched", -1, this.getTurn(), 
        parseInt(await this.getStore().getMetadata("lastID") ?? "-1"), { gameID: identity.gameId });
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
    if (!this.gameIdentity || !this.knowledgeStore) return;
    
    logger.debug(`Saving knowledge for game: ${this.gameIdentity.gameId}`);
    
    try {
      // Update last save timestamp
      await this.knowledgeStore.setMetadata('turn', this.gameIdentity.turn.toString());
      await this.knowledgeStore.setMetadata('lastSave', Date.now().toString());
    } catch (error) {
      logger.error('Failed to save knowledge:', error);
    }
  }

  /**
   * Load knowledge for a specific game
   */
  async loadKnowledge(gameId: string): Promise<void> {
    logger.debug(`Loading knowledge for game: ${gameId}`);
    
    try {
      // Create new KnowledgeStore instance
      this.knowledgeStore = new KnowledgeStore();
      
      // Build database path based on game ID
      const dbPath = path.join(this.config.databasePath, `${gameId}.db`);
      
      // Initialize the store with the database
      await this.knowledgeStore.initialize(dbPath, gameId);
      
      // Log successful load
      const lastSave = await this.knowledgeStore.getMetadata('lastSave');
      if (lastSave) {
        logger.info(`Loaded knowledge from save at: ${new Date(parseInt(lastSave)).toISOString()}`);
      }
      
    } catch (error) {
      logger.error('Failed to load knowledge:', error);
      this.knowledgeStore = undefined;
    }
  }

  /**
   * Cleanup and shutdown
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down KnowledgeManager');

    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
    }

    await this.saveKnowledge();
    
    // Close knowledge store
    if (this.knowledgeStore) {
      await this.knowledgeStore.close();
      this.knowledgeStore = undefined;
    }
  }
  
  /**
   * Get current knowledge store instance (for testing or direct access)
   */
  getStore(): KnowledgeStore {
    if (!this.knowledgeStore) {
      throw new Error('KnowledgeStore not initialized. Call loadKnowledge() first.');
    }
    return this.knowledgeStore;
  }

  /**
   * Get current game turn
   */
  getTurn(): number {
    return this.gameIdentity?.turn ?? -1;
  }

  /**
   * Get current active player ID
   */
  getActivePlayerId(): number {
    return this.gameIdentity?.activePlayerId ?? -1;
  }

  /**
   * Get current game ID
   */
  getGameId(): string {
    return this.gameIdentity?.gameId ?? "";
  }

  /**
   * Update current game turn
   */
  updateTurn(turn: number) {
    if (this.gameIdentity && turn > this.gameIdentity.turn) {
      this.gameIdentity.turn = turn;
      logger.warn(`Game turn progressed to ${turn}`)
    }
  }

  /**
   * Update the active player (no longer handles pause/unpause)
   */
  updateActivePlayer(newID?: number) {
    if (!this.gameIdentity) return;
    const changed = newID !== undefined && newID !== this.gameIdentity.activePlayerId;
    if (changed) {
      this.gameIdentity.activePlayerId = newID;
      logger.info(`Active player changed to: ${this.getActivePlayerId()}`);
    }
  }
}