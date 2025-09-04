/**
 * DatabaseManager - Manages connections to Civilization V SQLite databases using Kysely
 * Provides structured access to game rules, units, buildings, technologies, and localized text
 */

import { Kysely, SqliteDialect } from 'kysely';
import Database from 'better-sqlite3';
import { createLogger } from '../utils/logger.js';
import path from 'path';
import fs from 'fs/promises';
import { config, getDocumentsPath } from '../utils/config.js';
import type { DB as MainDB } from './database.js';
import type { DB as LocalizationDB } from './localization.js';
import { enumMappings } from '../utils/knowledge/enum.js';
import * as changeCase from "change-case";

const logger = createLogger('DatabaseManager');

/**
 * Manages SQLite database connections and queries for Civilization V using Kysely
 */
export class DatabaseManager {
  private mainDb?: Kysely<MainDB>;
  private localizationDb?: Kysely<LocalizationDB>;
  private language: string;
  private initialized = false;

  /**
   * Create a new DatabaseManager instance
   */
  constructor() {
    this.language = config.database?.language ?? 'en_US';
  }

  /**
   * Initialize database connections
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    logger.info('Initializing DatabaseManager');
    
    const documentsPath = await getDocumentsPath();
    const civ5Path = path.join(documentsPath, 'My Games', 'Sid Meier\'s Civilization 5', 'cache');
    
    const mainDbPath = path.join(civ5Path, 'Civ5DebugDatabase.db');
    const localizationDbPath = path.join(civ5Path, 'Localization-Merged.db');

    try {
      // Check if database files exist
      await fs.access(mainDbPath);
      await fs.access(localizationDbPath);
    } catch (error) {
      const errorMsg = `Database files not found. Please ensure Civilization V is installed and has been run at least once. Expected paths:\n` +
                       `  Main DB: ${mainDbPath}\n` +
                       `  Localization DB: ${localizationDbPath}`;
      logger.error(errorMsg);
      throw new Error(errorMsg);
    }

    try {
      // Create Kysely instance for main database
      this.mainDb = new Kysely<MainDB>({
        dialect: new SqliteDialect({
          database: new Database(mainDbPath, { readonly: true }),
        }),
      });
      logger.info('Connected to main database');

      // Create Kysely instance for localization database
      this.localizationDb = new Kysely<LocalizationDB>({
        dialect: new SqliteDialect({
          database: new Database(localizationDbPath, { readonly: true }),
        }),
      });
      logger.info('Connected to localization database');

      // More initialization
      this.initializeMappings();

      this.initialized = true;
    } catch (error) {
      logger.error('Failed to open database:', error);
      throw new Error(`Failed to open database: ${error}`);
    }
  }

  /**
   * Get localized text for a given key
   */
  public async localize(key: string): Promise<string> {
    if (!this.localizationDb) {
      throw new Error('Localization database not initialized. Call initialize() first.');
    }

    try {
      const result = await this.localizationDb
        .selectFrom('LocalizedText')
        .select('Text')
        .where('Language', '=', this.language)
        .where('Tag', '=', key)
        .executeTakeFirst();
      
      return result?.Text || key; // Return key if no translation found
    } catch (error) {
      logger.error('Localization lookup failed:', error);
      return key; // Return key as fallback
    }
  }

  /**
   * Convert TXT_KEY_* strings in results to localized text
   */
  public async localizeObject<T extends Record<any, any>>(result: T): Promise<T> {
    return (await this.localizeObjects([result]))[0];
  }

  /**
   * Convert TXT_KEY_* strings in results to localized text
   */
  public async localizeObjects<T extends Record<any, any>[]>(results: T): Promise<T> {
    if (!this.localizationDb) {
      throw new Error('Localization database not initialized. Call initialize() first.');
    }

    // Collect all unique TXT_KEY_* values
    const txtKeys = new Set<string>();
    for (const row of results) {
      for (const [key, value] of Object.entries(row)) {
        if (typeof value !== 'string') continue;
        if (value.startsWith('TXT_KEY_'))
          txtKeys.add(value);
        if (key.indexOf("Type") == -1 && value.match(/[A-Z_]*/))
          txtKeys.add(value);
      }
    }

    // If no keys to localize, return original results
    if (txtKeys.size === 0) return results;

    // Batch fetch all localizations at once
    const localizationMap = new Map<string, string>();
    
    try {
      const localizations = await this.localizationDb
        .selectFrom('LocalizedText')
        .select(['Tag', 'Text'])
        .where('Language', '=', this.language)
        .where('Tag', 'in', Array.from(txtKeys).map(
          k => k.startsWith("TXT_KEY_") ? k : "TXT_KEY_" + k
        ))
        .execute();
      
      // Build map of key -> localized text
      for (const { Tag, Text } of localizations) {
        if (Tag && Text) {
          localizationMap.set(Tag, Text);
        }
      }
      
      // Add any missing keys to the map (use key as fallback)
      for (const key of txtKeys) {
        if (!localizationMap.has(key)) {
          localizationMap.set(key, key);
        }
      }
    } catch (error) {
      logger.error('Batch localization lookup failed:', error);
      return results;
    }

    // Convert results using the localization map
    return results.map(row => {
      const convertedRow: Record<any, any> = {};
      
      for (const [key, value] of Object.entries(row)) {
        if (typeof value === 'string' && localizationMap.has(value)) {
          convertedRow[key] = localizationMap.get(value) || value;
        } else {
          convertedRow[key] = value;
        }
      }
      
      return convertedRow;
    }) as T;
  }

  /**
   * Get the main database instance for direct Kysely queries
   */
  public getDatabase(): Kysely<MainDB> {
    if (!this.mainDb) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return this.mainDb;
  }

  /**
   * Set the language for localization
   */
  public setLanguage(language: string): void {
    this.language = language;
    logger.info(`Language set to: ${language}`);
  }

  /**
   * Get current language setting
   */
  public getLanguage(): string {
    return this.language;
  }

  /**
   * Close database connections
   */
  public async close(): Promise<void> {
    logger.info('Closing database connections');
    
    if (this.mainDb) {
      await this.mainDb.destroy();
      this.mainDb = undefined;
    }
    
    if (this.localizationDb) {
      await this.localizationDb.destroy();
      this.localizationDb = undefined;
    }
    
    this.initialized = false;
  }

  /**
   * Check if the manager is initialized
   */
  public isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Initialize enum-like mappings
   */
  async initializeMappings() {
    await this.addEnumMappings("Improvements", "ImprovementType");
    await this.addEnumMappings("Buildings", "BuildingType");
    await this.addEnumMappings("BuildingClasses", "BuildingClass");
    await this.addEnumMappings("Projects", "ProjectType");
    await this.addEnumMappings("Specialists", "SpecialistType");
    await this.addEnumMappings("GreatWorks", "GreatWorkType");
    await this.addEnumMappings("Beliefs", "BeliefType");
    await this.addEnumMappings("GoodyHuts", "GoodyType");
    await this.addEnumMappings("GreatPersons", "GreatPersonType", "Great ");
    await this.addEnumMappings("PolicyBranchTypes", "BranchType");
    await this.addEnumMappings("Resolutions", "ResolutionType");
    await this.addEnumMappings("Units", "UnitType");
    await this.addEnumMappings("UnitClasses", "UnitClass");
    await this.addEnumMappings("Technologies", "TechID");
    await this.addEnumMappings("Policies", "PolicyID");
    await this.addEnumMappings("Resources", "ResourceType");
    await this.addEnumMappings("Religions", "ReligionID");
    await this.addEnumMappings("Features", "FeatureType");
  }

  /**
   * Read a named table and add int-number mappings to enumMappings
   */
  async addEnumMappings(tableName: string, mappedName: string, prefix: string = ""): Promise<void> {
    if (!this.mainDb) {
      throw new Error('Database not initialized. Call initialize() first.');
    }

    try {
      // Query the specified table
      const results = await this.mainDb
        .selectFrom(tableName as any).selectAll()
        .execute();

      const tableMap: Record<number, string> = { "-1": "None" };

      // Process each row in the results
      for (const row of results) {
        if (!('ID' in row)) continue;
        const id = Number(row.ID);
        if ('Description' in row) {
          tableMap[id] = String(row.Description);
        } else if ('Type' in row) {
          var type = String(row.Type);
          if (!isNaN(id)) {
            type = type.includes('_') ? type.split('_').slice(1).join('_') : type;
            tableMap[id] = prefix + changeCase.pascalCase(type);
          }
        }
      }

      enumMappings[mappedName] = await this.localizeObject(tableMap);

      //console.log(tableMap);
      logger.info(`Added ${Object.keys(tableMap).length} enum mappings from table ${tableName}`);
    } catch (error) {
      logger.error(`Failed to read enum mappings from table ${tableName}:`, error);
      throw new Error(`Failed to read enum mappings from table ${tableName}: ${error}`);
    }
  }
}