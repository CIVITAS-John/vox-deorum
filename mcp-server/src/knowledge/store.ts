/**
 * KnowledgeStore - Foundation for storing and managing AI player knowledge
 * Provides type-safe CRUD operations using Kysely query builder
 */

import { Kysely, ParseJSONResultsPlugin, SqliteDialect, Selectable } from 'kysely';
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
import { knowledgeManager } from '../server.js';
import { EventName, eventSchemas } from './schema/events/index.js';
import { analyzeEventVisibility } from '../utils/lua/event-visibility.js';
import { applyVisibility } from '../utils/knowledge/visibility.js';
import { explainEnums } from '../utils/knowledge/enum.js';
import { detectChanges } from '../utils/knowledge/changes.js';
import { MCPServer } from '../server.js';
import { getPlayerInformations } from './getters/player-information.js';

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
  "CityPrepared",
  "UnitGetSpecialExploreTarget",
  "PlayerCityFounded",
  "TeamSetHasTech",
  "CombatEnded",
  "BarbariansSpawnedUnit",
]);

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
        // logger.debug(`Blocked event type: ${type}`);
        return;
      }

      // Check if the payload is an array (it should be an array from the DLL)
      if (!Array.isArray(payload)) {
        logger.warn(`Invalid ${type} event payload: not an array`);
        return;
      }

      // Special block: TileRevealed for minor civs
      if (type == "TileRevealed" && payload[5] >= MaxMajorCivs)
        return;

      // Check if we have a schema for this event type
      if (!(type in eventSchemas)) {
        logger.warn(`Unknown event type: ${type}`);
        return;
      }

      // Update the turn
      knowledgeManager.updateTurn(Math.floor(id / 1000000));

      // Get the corresponding schema
      const schema = eventSchemas[type as EventName];

      // Get the schema shape to map payload array to object
      // We need to get the field names from the schema
      const schemaShape = schema._def.shape() as Record<string, any>;
      const fieldNames = Object.keys(schemaShape);

      // Create an object from the payload array
      const eventObject: Record<string, unknown> = {};
      let payloadIndex = 0;
      
      // Process each field in the schema
      for (const fieldName of fieldNames) {
        const fieldSchema = schemaShape[fieldName];
        
        // Check if this field is an array of objects
        if (fieldSchema._def.typeName === 'ZodArray' && 
            fieldSchema._def.type._def.typeName === 'ZodObject') {
          // The current payload index should contain the count
          const itemCount = payload[payloadIndex] as number;
          payloadIndex++;
          
          // Get the nested object's field names
          const nestedShape = fieldSchema._def.type._def.shape();
          const nestedFieldNames = Object.keys(nestedShape);
          
          // Parse each item in the array
          const items: Array<Record<string, unknown>> = [];
          for (let i = 0; i < itemCount; i++) {
            const item: Record<string, unknown> = {};
            for (const nestedFieldName of nestedFieldNames) {
              if (payloadIndex < payload.length) {
                item[nestedFieldName] = payload[payloadIndex];
                payloadIndex++;
              }
            }
            items.push(item);
          }
          
          eventObject[fieldName] = items;
        } else {
          // Simple field mapping
          if (payloadIndex < payload.length) {
            eventObject[fieldName] = payload[payloadIndex];
            payloadIndex++;
          }
        }
      }

      // Other blocking reasons
      if (eventObject["PlotX"] == -2147483647 || eventObject["PlotY"] == -2147483647) return;
      if (eventObject["OldPopulation"] && eventObject["OldPopulation"] == eventObject["NewPopulation"]) return;

      // Validate t(he event object against the schema
      const result = schema.safeParse(eventObject);

      if (result.success) {
        const data: any = result.data;
        if (typeof data.PlayerID === "number") {
          // Special: Victory
          if (type == "PlayerVictory") {
            this.setMetadata("VictoryPlayerID", data.PlayerID);
            this.setMetadata("VictoryType", data.VictoryType);
          }
          MCPServer.getInstance().sendNotification(type, data.PlayerID, id, knowledgeManager.getTurn());
          this.setMetadata("lastID", id.toString());
        }
        const mappedType = renamedEventTypes[type] ?? type;
        this.storeGameEvent(id, mappedType, data);
      } else {
        logger.warn(`Invalid ${type} event:`, {
          errors: result.error.errors,
          payload,
          eventObject
        });
      }
    } catch (error) {
      logger.error('Error handling game event: ' + String(error), payload);
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
        Payload: payload,
      } as any,
      visibilityFlags
    );

    if (visibilityResult) {
      // Log invalidations if any exist
      const invalidationKeys = Object.keys(visibilityResult.invalidations);
      if (invalidationKeys.length > 0) {
        logger.debug(`Cache invalidations for ${type}: ${invalidationKeys.join(', ')}`);
      }
    
      // Save the extra payloads
      Object.assign(payload, visibilityResult.extraPayload);
      // Explain the enums for LLM readability
      explainEnums(payload);
      logger.info(`Storing event: ${id} / ${type} at turn ${knowledgeManager.getTurn()}, visibility: [${visibilityFlags}]`, payload);
    } else {
      logger.warn(`Storing event: ${id} / ${type} at turn ${knowledgeManager.getTurn()}, visibility analysis failed`, payload);
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

  /**
   * Generic function to store MutableKnowledge entries
   * Handles versioning, change tracking, and visibility automatically
   * 
   * @param tableName - The table name in the database (must be a key of KnowledgeDatabase)
   * @param key - The unique identifier for this knowledge item
   * @param data - The data to store (must extend MutableKnowledge)
   * @param visibilityFlags - Array of player IDs that can see this knowledge
   * @returns The stored entry with generated fields
   */
  async storeMutableKnowledge<
    TTable extends keyof KnowledgeDatabase,
    TData extends Partial<Selectable<KnowledgeDatabase[TTable]>>
  >(
    tableName: TTable,
    key: number,
    data: TData,
    visibilityFlags?: number[]
  ): Promise<void> {
    const db = this.getDatabase();
    const turn = knowledgeManager.getTurn();
    
    try {
      // Start a transaction for atomic updates
      await db.transaction().execute(async (trx) => {
        // Find the latest version for this key
        const latestEntry = await (trx
          .selectFrom(tableName)
          .selectAll() as any)
          .where('Key' as any, '=', key)
          .where('IsLatest' as any, '=', 1)
          .executeTakeFirst() as MutableKnowledge | null;
        
        // Calculate version number and detect changes
        const newVersion = latestEntry ? (latestEntry.Version) + 1 : 1;
        const changes = detectChanges(latestEntry, data as any);
        
        // Skip if no changes detected (for updates)
        if (latestEntry && changes.length === 0) {
          logger.debug(`No changes detected for ${tableName} key ${key}, skipping update`);
          return;
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
          Changes: changes,
          Payload: data,
        };

        // Apply visibility flags if provided
        if (visibilityFlags) {
          applyVisibility(newEntry, visibilityFlags);
        }
        
        // Insert the new version
        await trx
          .insertInto(tableName)
          .values(newEntry)
          .execute();
        
        logger.info(
          `Stored ${tableName} entry - Key: ${key}, Version: ${newVersion}, Turn: ${turn}, Changes: ${changes.join(', ') || 'initial'}`
        );
      });
    } catch (error) {
      logger.error(`Error storing MutableKnowledge in ${tableName}:`, error);
      throw error;
    }
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
      return result as Selectable<KnowledgeDatabase[TTable]> | undefined || null;
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
      await db
        .insertInto(tableName)
        .values(entry)
        .onConflict((oc) => oc
          .column('Key' as any)
          .doUpdateSet(entry)
        )
        .execute();
      
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