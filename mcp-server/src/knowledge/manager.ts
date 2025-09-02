/**
 * Central orchestrator for all knowledge-related operations.
 * Monitors game state changes and manages persistence.
 */

import { createLogger } from '../utils/logger.js';
import { bridgeManager } from '../server.js';
import { GameIdentity, syncGameIdentity } from '../utils/lua/game-identity.js';
import { KnowledgeStore } from './store.js';
import { eventSchemas, EventName } from './schema/events/index.js';
import path from 'path';

const logger = createLogger('KnowledgeManager');

export class KnowledgeManager {
  private gameIdentity?: GameIdentity;
  private knowledgeStore?: KnowledgeStore;
  private autoSaveTimer: NodeJS.Timeout | null = null;

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
    bridgeManager.on('gameEvent', (data) => {
      logger.debug('Game event received: ' + data.type, data);
      this.handleGameEvent(data.type, data.payload);
      this.checkGameContext();
    });
    this.startAutoSave();
  }

  /**
   * Handle incoming game events by validating against schemas
   */
  private handleGameEvent(type: string, payload: unknown): void {
    try {
      // Check if the payload is an array (it should be an array from the DLL)
      if (!Array.isArray(payload)) {
        logger.warn('Invalid game event payload: not an array');
        return;
      }

      // Check if we have a schema for this event type
      if (!(type in eventSchemas)) {
        logger.debug(`Unknown event type: ${type}`);
        return;
      }

      // Get the corresponding schema
      const schema = eventSchemas[type as EventName];

      // Get the schema shape to map payload array to object
      // We need to get the field names from the schema
      const schemaShape = schema._def.shape();
      const fieldNames = Object.keys(schemaShape);

      // Create an object from the payload array
      const eventObject: Record<string, unknown> = {};
      fieldNames.forEach((fieldName, index) => {
        if (index < payload.length) {
          eventObject[fieldName] = payload[index];
        }
      });

      // Validate the event object against the schema
      const result = schema.safeParse(eventObject);

      if (result.success) {
        logger.info(`Valid ${type} event:`, result.data);
        if (this.knowledgeStore) {
          // Store event in database - implementation depends on store structure
          // this.knowledgeStore.storeEvent(eventType, result.data, eventData.timestamp);
        }
      } else {
        logger.warn(`Invalid ${type} event:`, {
          errors: result.error.errors,
          payload,
          eventObject
        });
      }
    } catch (error) {
      logger.error('Error handling game event:', error);
    }
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
    
    // Close existing store if any
    if (this.knowledgeStore) {
      await this.knowledgeStore.close();
      this.knowledgeStore = undefined;
    }
    
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
    if (!this.gameIdentity || !this.knowledgeStore) return;
    
    logger.info(`Saving knowledge for game: ${this.gameIdentity.gameId}`);
    
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
    logger.info(`Loading knowledge for game: ${gameId}`);
    
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
}