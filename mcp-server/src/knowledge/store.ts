/**
 * KnowledgeStore - Foundation for storing and managing AI player knowledge
 * Provides type-safe CRUD operations using Kysely query builder
 */

import { Kysely, SqliteDialect } from 'kysely';
import Database from 'better-sqlite3';
import { createLogger } from '../utils/logger.js';
import type { 
  KnowledgeDatabase, 
  GameEvent,
} from './schema.js';
import { setupKnowledgeDatabase } from './setup.js';
import fs from 'fs/promises';
import path from 'path';

const logger = createLogger('KnowledgeStore');

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
   * Store a game event
   */
  async storeGameEvent(event: Omit<GameEvent, 'ID' | 'CreatedAt'>): Promise<void> {
    await this.getDatabase()
      .insertInto('GameEvents')
      .values({
        Turn: event.Turn,
        Key: event.Key,
        Type: event.Type,
        OwnerID: event.OwnerID,
        IsLatest: event.IsLatest,
        KnownByIDs: JSON.stringify(event.KnownByIDs),
        Payload: JSON.stringify(event.Payload),
      })
      .execute();

    logger.debug(`Stored game event: ${event.Type} at turn ${event.Turn}`);
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