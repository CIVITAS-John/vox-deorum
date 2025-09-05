/**
 * KnowledgeStore - Foundation for storing and managing AI player knowledge
 * Provides type-safe CRUD operations using Kysely query builder
 */

import { Kysely, ParseJSONResultsPlugin, SqliteDialect } from 'kysely';
import Database from 'better-sqlite3';
import { createLogger } from '../utils/logger.js';
import type { 
  KnowledgeDatabase, 
} from './schema/base.js';
import { setupKnowledgeDatabase } from './schema/setup.js';
import fs from 'fs/promises';
import path from 'path';
import { knowledgeManager } from '../server.js';
import { EventName, eventSchemas } from './schema/events/index.js';
import { analyzeEventVisibility } from '../utils/lua/event-visibility.js';
import { applyVisibility } from '../utils/knowledge/visibility.js';
import { explainEnums } from '../utils/knowledge/enum.js';

const logger = createLogger('KnowledgeStore');

// List of event types to block from being stored
const blockedEventTypes = new Set<string>([
  "GatherPerTurnReplayStats",
  "GameCoreTestVictory",
  "TestEvent",
  "UnitPrekill",
  "PlayerEndTurnInitiated",
  "PlayerEndTurnCompleted",
  "TerraformingPlot",
  "GameSave",
]);

/**
 * Foundation for storing and managing AI player knowledge with SQLite persistence
 */
export class KnowledgeStore {
  private db?: Kysely<KnowledgeDatabase>;
  private gameId?: string;

  /**
   * Initialize or switch to a game-specific database
   */
  async initialize(dbPath: string, gameId: string): Promise<void> {
    // Close existing connection if any
    if (this.db) {
      await this.close();
    }

    this.gameId = gameId;
    
    // Ensure the directory for the database file exists
    const dbDir = path.dirname(dbPath);
    await fs.mkdir(dbDir, { recursive: true });

    logger.info(`Initializing KnowledgeStore for game: ${gameId} at path: ${dbPath}`);

    // Create Kysely instance with Better-SQLite3
    const sqliteDb = new Database(dbPath);
    
    this.db = new Kysely<KnowledgeDatabase>({
      dialect: new SqliteDialect({
        database: sqliteDb,
      }),
      plugins: [new ParseJSONResultsPlugin()],
    });

    // Setup database schema if needed
    await setupKnowledgeDatabase(this.db);
    
    // Store game ID in metadata
    await this.setMetadata('gameId', gameId);
    await this.setMetadata('lastSync', Date.now().toString());
    
    logger.info(`KnowledgeStore initialized successfully for game: ${gameId}`);
  }

  /**
   * Get database instance for direct queries
   */
  getDatabase(): Kysely<KnowledgeDatabase> {
    if (!this.db) {
      throw new Error('KnowledgeStore not initialized. Call initialize() first.');
    }
    return this.db;
  }

  /**
   * Set metadata value
   */
  async setMetadata(key: string, value: string): Promise<void> {
    await this.getDatabase()
      .insertInto('GameMetadata')
      .values({ Key: key, Value: value })
      .onConflict((oc) => oc.column('Key').doUpdateSet({ Value: value }))
      .execute();
  }

  /**
   * Get metadata value
   */
  async getMetadata(key: string): Promise<string | undefined> {
    const result = await this.getDatabase()
      .selectFrom('GameMetadata')
      .select('Value')
      .where('Key', '=', key)
      .executeTakeFirst();

    return result?.Value;
  }

  /**
   * Handle incoming game events by validating against schemas
   */
  handleGameEvent(id: number, type: string, payload: unknown): void {
    try {
      if (blockedEventTypes.has(type)) {
        logger.debug(`Blocked event type: ${type}`);
        return;
      }

      // Check if the payload is an array (it should be an array from the DLL)
      if (!Array.isArray(payload)) {
        logger.warn(`Invalid ${type} event payload: not an array`);
        return;
      }

      // Check if we have a schema for this event type
      if (!(type in eventSchemas)) {
        logger.warn(`Unknown event type: ${type}`);
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

      // Other blocking reasons
      if (eventObject["PlotX"] == -2147483647 || eventObject["PlotY"] == -2147483647) return;
      if (eventObject["OldPopulation"] && eventObject["OldPopulation"] == eventObject["NewPopulation"]) return;

      // Validate the event object against the schema
      const result = schema.safeParse(eventObject);

      if (result.success) {
        this.storeGameEvent(id, type, result.data);
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
   * Store a game event with automatic visibility determination
   */
  async storeGameEvent<T extends object>(id: number, type: string, payload: T): Promise<void> {
    // Determine visibility for this event
    const visibilityResult = await analyzeEventVisibility(type, payload);
    
    // Extract visibility flags for storage
    const visibilityFlags = visibilityResult?.visibilityFlags;
    
    // Create event object with visibility markers
    const eventWithVisibility = applyVisibility(
      {
        ID: id,
        Turn: knowledgeManager.getTurn(),
        Type: type,
        Payload: JSON.stringify(payload),
      } as any,
      visibilityFlags
    );

    if (visibilityResult) {
      // Log invalidations if any exist
      const invalidationKeys = Object.keys(visibilityResult.invalidations);
      if (invalidationKeys.length > 0) {
        logger.info(`Cache invalidations for ${type}: ${invalidationKeys.join(', ')}`);
      }
    
      // Save the extra payloads
      Object.assign(payload, visibilityResult.extraPayload);
      // Explain the enums for LLM readability
      explainEnums(payload);
      logger.info(`Storing event: ${id} / ${type} at turn ${knowledgeManager.getTurn()}, visibility: [${visibilityFlags}]`, payload);
    } else {
      logger.info(`Storing event: ${id} / ${type} at turn ${knowledgeManager.getTurn()}, visibility analysis failed`, payload);
    }
    
    await this.getDatabase()
      .insertInto('GameEvents')
      .values(eventWithVisibility)
      .execute();
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    if (this.db) {
      await this.db.destroy();
      this.db = undefined;
      logger.info('KnowledgeStore closed');
    }
  }

  /**
   * Check if store is initialized
   */
  isInitialized(): boolean {
    return !!this.db;
  }

  /**
   * Get current game ID
   */
  getGameId(): string | undefined {
    return this.gameId;
  }
}