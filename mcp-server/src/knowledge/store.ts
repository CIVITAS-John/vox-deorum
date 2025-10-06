/**
 * KnowledgeStore - Foundation for storing and managing AI player knowledge
 * Provides type-safe CRUD operations using Kysely query builder
 */

import { Kysely, ParseJSONResultsPlugin, SqliteDialect, Selectable, Updateable, Insertable } from 'kysely';
import Database from 'better-sqlite3';
import { createLogger } from '../utils/logger.js';
import { JsonSerializePlugin } from '../utils/json-serialize-plugin.js';
import { 
  MaxMajorCivs,
  type KnowledgeDatabase,
  type MutableKnowledge,
} from './schema/base.js';
import { setupKnowledgeDatabase } from './schema/setup.js';
import fs from 'fs/promises';
import path from 'path';
import { gameDatabase, knowledgeManager } from '../server.js';
import { EventName, eventSchemas } from './schema/events/index.js';
import { applyVisibility } from '../utils/knowledge/visibility.js';
import { explainEnums } from '../utils/knowledge/enum.js';
import { detectChanges } from '../utils/knowledge/changes.js';
import { MCPServer } from '../server.js';
import { getPlayerInformations } from './getters/player-information.js';
import { getPlayerStrategy } from './getters/player-strategy.js';
import { archiveGameData } from '../utils/knowledge/archive.js';
import { getPlayerPersona } from './getters/player-persona.js';
import { getPlayerOpinions } from './getters/player-opinions.js';
import { getPlayerSummaries } from './getters/player-summary.js';
import { getCityInformations } from './getters/city-information.js';
import Bottleneck from 'bottleneck';

const logger = createLogger('KnowledgeStore');

// List of event types renamed for better understanding
const renamedEventTypes: Record<string, string> = {
  "PlayerBuilt": "UnitBuildStart",
  "PlayerBuilding": "UnitBuildCompleted",
  "UnitSetXY": "UnitMoved",
}

/**
 * Foundation for storing and managing AI player knowledge with SQLite persistence
 */
export class KnowledgeStore {
  private db?: Kysely<KnowledgeDatabase>;
  private gameId?: string;
  private resyncing: boolean = true;

  // Database operation bottleneck
  private bottleneck = new Bottleneck({
    maxConcurrent: 1,
    timeout: 1000,
  })

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
      plugins: [new JsonSerializePlugin(), new ParseJSONResultsPlugin()],
    });

    // Setup database schema if needed
    await setupKnowledgeDatabase(this.db);
    
    // Store game ID in metadata
    await this.setMetadata('gameId', gameId);
    await this.setMetadata('lastSync', Date.now().toString());
    
    // Retrieve and store player information as public knowledge
    try {
      const players = await getPlayerInformations();
      logger.info(`Retrieved ${players.length} player(s) from the game`);
      
      // Store each player's information in the PlayerInformation table
      for (const player of players) {
        await this.storePublicKnowledge('PlayerInformations', player.Key, player);
      }
      
      logger.info(`Stored player information for ${players.length} players`);
    } catch (error) {
      logger.error('Failed to retrieve or store player information:', error);
      // Continue initialization even if player info fails - it can be retrieved later
    }
    
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
    await this.bottleneck.schedule(() => this.getDatabase()
      .insertInto('GameMetadata')
      .values({ Key: key, Value: value })
      .onConflict((oc) => oc.column('Key').doUpdateSet({ Value: value }))
      .execute());
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
   * Drop all game events with ID greater than the specified ID
   * Returns the number of events dropped
   */
  async dropEventsAfterId(id: number): Promise<number> {
    const db = this.getDatabase();

    try {
      const result = await this.bottleneck.schedule(() => db
        .deleteFrom('GameEvents')
        .where('ID', '>=', id)
        .executeTakeFirst());

      return Number(result.numDeletedRows) || 0;
    } catch (error) {
      logger.error(`Error dropping events after ID ${id}:`, error);
      return 0;
    }
  }

  /**
   * Set the knowledge store in resyncing mode (dropping all events with an ID later than the first incoming event)
   */
  setResyncing() {
    this.resyncing = true;
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

  /**
   * Handle incoming game events by validating against schemas
   */
  async handleGameEvent(id: number, type: string, payload: Record<string, any>, visibilityFlags?: number[], extraPayload?: Record<string, any>): Promise<void> {
    try {
      // Check if we have a schema for this event type
      if (!(type in eventSchemas)) {
        logger.warn(`Unknown event type: ${type}`);
        return;
      }

      // Update the turn
      knowledgeManager.updateTurn(Math.floor(id / 1000000));

      // Drop events after the id
      if (this.resyncing) {
        const droppedCount = await this.dropEventsAfterId(id);
        if (droppedCount > 0) {
          logger.warn(`Detected repeated events after resyncing. Dropped ${droppedCount} events after ID ${id}`);
        }
        this.resyncing = false;
      }

      // Get the corresponding schema
      const schema = eventSchemas[type as EventName];

      // Other blocking reasons
      if (type == "TileRevealed" && payload["PlayerID"] >= MaxMajorCivs)
        return;
      if (payload["PlotX"] == -2147483647 || payload["PlotY"] == -2147483647) 
        return;
      if (payload["OldPopulation"] && payload["OldPopulation"] == payload["NewPopulation"])
        return;

      // Validate the event object against the schema
      const result = schema.passthrough().safeParse(payload);

      if (result.success) {
        const data: any = result.data;
        const mappedType = renamedEventTypes[type] ?? type;
        // Postprocess the event
        if (extraPayload)
          Object.assign(data, extraPayload);
        
        // Store the event
        await this.storeGameEvent(id, mappedType, data, visibilityFlags);
        await this.setMetadata("lastID", id.toString());

        // Handle special events for notification
        if (typeof data.PlayerID === "number") {
          // Special: Victory
          if (type == "PlayerVictory") {
            await this.setMetadata("victoryPlayerID", data.PlayerID);
            await this.setMetadata("victoryType", data.VictoryType);
            archiveGameData();
          }
          // Track active player on turn events
          if (type === "PlayerDoTurn") {
            knowledgeManager.updateActivePlayer(data.PlayerID);
          } else if (type === "PlayerDoneTurn") {
            // Store all players' summary info
            if (data.PlayerID === 63) {
              await Promise.all([
                getPlayerSummaries(),
                getCityInformations()
              ]);
            }
            // Store game data for examination
            if (data.PlayerID < MaxMajorCivs) {
              await Promise.all([
                getPlayerOpinions(data.PlayerID),
                getPlayerStrategy(data.PlayerID),
                getPlayerPersona(data.PlayerID)
              ]);
            }
            knowledgeManager.updateActivePlayer(data.NextPlayerID);
          }
          MCPServer.getInstance().sendNotification(type, data.PlayerID, knowledgeManager.getTurn(), id);
        }
      } else {
        logger.warn(`Invalid ${type} event:`, {
          errors: result.error.errors,
          payload
        });
      }
    } catch (error) {
      logger.error('Error handling game event: ' + String(error), payload);
    }
  }

  /**
   * Store a game event with automatic visibility determination
   */
  async storeGameEvent<T extends object>(id: number, type: string, payload: T, visibilityFlags?: number[]): Promise<void> {
    // Explain the enums for LLM readability
    payload = await gameDatabase.localizeObject(explainEnums(payload));
    
    // Create event object with visibility markers
    const eventWithVisibility = applyVisibility(
      {
        ID: id,
        Turn: knowledgeManager.getTurn(),
        Type: type,
        Payload: payload,
      } as any,
      visibilityFlags
    );

    try {
      await this.bottleneck.schedule(() => this.getDatabase()
        .insertInto('GameEvents')
        .values(eventWithVisibility)
        .execute());
      logger.debug(`Storing event: ${id} / ${type} at turn ${knowledgeManager.getTurn()}, visibility: [${visibilityFlags}]`, payload);
    } catch (error) {
      logger.warn(`Failed to store event: ${id} / ${type} at turn ${knowledgeManager.getTurn()}, ${String(error)}`);
    }
  }

  /**
   * Batch store multiple TimedKnowledge entries in a single transaction
   * Used for events and other time-based knowledge that doesn't track versions
   *
   * @param tableName - The table name in the database (must be a key of KnowledgeDatabase)
   * @param items - Array of items to store, each containing key, data, and optional visibility flags
   * @returns Promise that resolves when all items are stored
   */
  async storeTimedKnowledgeBatch<
    TTable extends keyof KnowledgeDatabase,
    TData extends Partial<Selectable<KnowledgeDatabase[TTable]> | Insertable<KnowledgeDatabase[TTable]>>
  >(
    tableName: TTable,
    items: Array<{
      key: number;
      data: TData;
      visibilityFlags?: number[];
    }>
  ): Promise<void> {
    const db = this.getDatabase();
    const turn = knowledgeManager.getTurn();

    try {
      // Process all items in a single transaction for efficiency
      await this.bottleneck.schedule(() => db.transaction().execute(async (trx) => {
        for (const item of items) {
          const { key, data, visibilityFlags } = item;

          // Prepare the new entry with TimedKnowledge fields
          const newEntry: any = {
            ...data,
            Key: key,
            Turn: turn
          };
          if (!newEntry.payload)
            newEntry.payload = {};

          // Apply visibility flags if provided
          if (visibilityFlags !== undefined)
            applyVisibility(newEntry, visibilityFlags);

          // Insert the entry
          await this.bottleneck.schedule(() => trx
            .insertInto(tableName)
            .values(newEntry)
            .execute());

          logger.debug(
            `Stored ${tableName} entry - Key: ${key}, Turn: ${turn}`
          );
        }
      }));
    } catch (error) {
      logger.error(`Error storing TimedKnowledge batch in ${tableName}:`, error);
      throw error;
    }
  }

  /**
   * Batch store multiple MutableKnowledge entries in a single transaction
   * Handles versioning, change tracking, and visibility automatically for each item
   *
   * @param tableName - The table name in the database (must be a key of KnowledgeDatabase)
   * @param items - Array of items to store, each containing key, data, and optional visibility/ignore fields
   * @returns Promise that resolves when all items are stored
   */
  async storeMutableKnowledgeBatch<
    TTable extends keyof KnowledgeDatabase,
    TData extends Partial<Selectable<KnowledgeDatabase[TTable]> | Insertable<KnowledgeDatabase[TTable]> | Updateable<KnowledgeDatabase[TTable]>>
  >(
    tableName: TTable,
    items: Array<{
      key: number;
      data: TData;
      visibilityFlags?: number[];
      ignoreFields?: string[];
    }>
  ): Promise<void> {
    const db = this.getDatabase();
    const turn = knowledgeManager.getTurn();

    try {
      // Process all items in a single transaction for efficiency
      await this.bottleneck.schedule(() => db.transaction().execute(async (trx) => {
        for (const item of items) {
          const { key, data, visibilityFlags, ignoreFields } = item;

          // Find the latest version for this key
          const latestEntry = await (trx
            .selectFrom(tableName)
            .selectAll() as any)
            .where('Key' as any, '=', key)
            .where('IsLatest' as any, '=', 1)
            .executeTakeFirst() as MutableKnowledge | null;

          // Calculate version number and detect changes
          const newVersion = latestEntry ? (latestEntry.Version) + 1 : 1;
          const changes = detectChanges(latestEntry, data as any, ignoreFields);

          // Skip if no changes detected (for updates)
          if (latestEntry && changes.length === 0) {
            logger.debug(`No changes detected for ${tableName} key ${key}, skipping update`);
            continue;
          }

          // Mark the previous version as not latest
          if (latestEntry) {
            await (trx
              .updateTable(tableName) as any)
              .set({ IsLatest: 0 } as any)
              .where('Key', '=', key)
              .where('IsLatest', '=', 1)
              .execute();
          }

          // Prepare the new entry with all MutableKnowledge fields
          const newEntry: any = {
            ...data,
            Key: key,
            Turn: turn,
            Version: newVersion,
            IsLatest: 1,
            Changes: changes
          };

          if (!newEntry.payload) newEntry.payload = {};

          // Apply visibility flags if provided
          if (visibilityFlags) {
            applyVisibility(newEntry, visibilityFlags);
          }

          // Insert the new version
          await trx
            .insertInto(tableName)
            .values(newEntry)
            .execute();

          logger.debug(
            `Stored ${tableName} entry - Key: ${key}, Version: ${newVersion}, Turn: ${turn}, Changes: ${changes.join(', ') || 'initial'}`
          );
        }
      }));
    } catch (error) {
      logger.error(`Error storing MutableKnowledge batch in ${tableName}:`, error);
      throw error;
    }
  }

  /**
   * Store a single MutableKnowledge entry
   * Convenience method that wraps storeMutableKnowledgeBatch for single items
   *
   * @param tableName - The table name in the database (must be a key of KnowledgeDatabase)
   * @param key - The unique identifier for this knowledge item
   * @param data - The data to store (must extend MutableKnowledge)
   * @param visibilityFlags - Array of player IDs that can see this knowledge
   * @param ignoreFields - Array of field names to ignore when detecting changes
   * @returns Promise that resolves when the item is stored
   */
  async storeMutableKnowledge<
    TTable extends keyof KnowledgeDatabase,
    TData extends Partial<Selectable<KnowledgeDatabase[TTable]> | Insertable<KnowledgeDatabase[TTable]> | Updateable<KnowledgeDatabase[TTable]>>
  >(
    tableName: TTable,
    key: number,
    data: TData,
    visibilityFlags?: number[],
    ignoreFields?: string[]
  ): Promise<void> {
    await this.storeMutableKnowledgeBatch(tableName, [{
      key,
      data,
      visibilityFlags,
      ignoreFields
    }]);
  }

  /**
   * Retrieve the latest version of a MutableKnowledge entry
   * 
   * @param tableName - The table name in the database
   * @param key - The unique identifier for this knowledge item
   * @param playerId - Optional player ID for visibility filtering
   * @returns The latest entry or null if not found/not visible
   */
  async getMutableKnowledge<TTable extends keyof KnowledgeDatabase>(
    tableName: TTable,
    key: number,
    playerId?: number,
    failedCallback?: () => Promise<any>,
  ): Promise<Selectable<KnowledgeDatabase[TTable]> | null> {
    const db = this.getDatabase();
    
    let query = (db
      .selectFrom(tableName)
      .selectAll() as any)
      .where('Key', '=', key)
      .where('IsLatest', '=', 1);
    
    // Apply visibility filter if player ID provided
    if (playerId !== undefined) {
      const playerColumn = `Player${playerId}` as any;
      query = query.where(playerColumn, '>', 0);
    }
    
    const result = await query.executeTakeFirst();
    if (!result && failedCallback) {
      await failedCallback();
      return this.getMutableKnowledge(tableName, key, playerId);
    } else {
      return result as Selectable<KnowledgeDatabase[TTable]> | null;
    }
  }

  /**
   * Get the history of a MutableKnowledge entry
   * 
   * @param tableName - The table name in the database
   * @param key - The unique identifier for this knowledge item
   * @param playerId - Optional player ID for visibility filtering
   * @returns Array of all versions, ordered by version descending
   */
  async getMutableKnowledgeHistory<TTable extends keyof KnowledgeDatabase>(
    tableName: TTable,
    key: number,
    playerId?: number
  ): Promise<Selectable<KnowledgeDatabase[TTable]>[]> {
    const db = this.getDatabase();
    
    let query = (db
      .selectFrom(tableName)
      .selectAll() as any)
      .where('Key', '=', key)
      .orderBy('Version', 'desc');
    
    // Apply visibility filter if player ID provided
    if (playerId !== undefined) {
      const playerColumn = `Player${playerId}` as any;
      query = query.where(playerColumn, '>', 0);
    }
    
    const results = await query.execute();
    return results as Selectable<KnowledgeDatabase[TTable]>[];
  }

  /**
   * Generic function to store PublicKnowledge entries
   * Handles insert or update operations for public knowledge tables
   * Public knowledge is visible to all players by default
   * 
   * @param tableName - The table name in the database (must be a key of KnowledgeDatabase)
   * @param key - The unique identifier for this knowledge item
   * @param data - The data to store
   * @returns Promise that resolves when the operation is complete
   */
  async storePublicKnowledge<
    TTable extends keyof KnowledgeDatabase,
    TData extends Omit<Partial<Selectable<KnowledgeDatabase[TTable]>>, "ID" | "Data">
  >(
    tableName: TTable,
    key: number,
    data: TData
  ): Promise<void> {
    const db = this.getDatabase();
    
    try {
      // Prepare the entry with standard fields
      const entry: any = {
        ...data,
        Key: key
      };
      
      // Insert or update the entry
      await this.bottleneck.schedule(() => db
        .insertInto(tableName)
        .values(entry)
        .onConflict((oc) => oc
          .column('Key' as any)
          .doUpdateSet(entry)
        )
        .execute());
      
      logger.debug(
        `Stored ${tableName} public knowledge - Key: ${key}`
      );
    } catch (error) {
      logger.error(`Error storing PublicKnowledge in ${tableName}:`, error);
      throw error;
    }
  }

  /**
   * Retrieve a PublicKnowledge entry
   * Public knowledge is visible to all players
   *
   * @param tableName - The table name in the database
   * @param key - The unique identifier for this knowledge item
   * @returns The entry or null if not found
   */
  async getPublicKnowledge<TTable extends keyof KnowledgeDatabase>(
    tableName: TTable,
    key: string | number
  ): Promise<Selectable<KnowledgeDatabase[TTable]> | null> {
    const db = this.getDatabase();
    key = String(key);
    
    const result = await (db
      .selectFrom(tableName)
      .selectAll() as any)
      .where('Key', '=', key)
      .executeTakeFirst();
    
    return result as Selectable<KnowledgeDatabase[TTable]> | undefined || null;
  }

  /**
   * Retrieve all PublicKnowledge entries from a table
   * Public knowledge is visible to all players
   * 
   * @param tableName - The table name in the database
   * @returns Array of all entries
   */
  async getAllPublicKnowledge<TTable extends keyof KnowledgeDatabase>(
    tableName: TTable
  ): Promise<Selectable<KnowledgeDatabase[TTable]>[]> {
    const db = this.getDatabase();
    
    const results = await (db
      .selectFrom(tableName)
      .selectAll() as any)
      .execute();
    
    return results as Selectable<KnowledgeDatabase[TTable]>[];
  }
}