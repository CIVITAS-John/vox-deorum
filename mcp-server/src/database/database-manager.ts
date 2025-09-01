/**
 * DatabaseManager - Manages connections to Civilization V SQLite databases
 * Provides structured access to game rules, units, buildings, technologies, and localized text
 */

import Database from 'better-sqlite3';
import { createLogger } from '../utils/logger.js';
import path from 'path';
import fs from 'fs/promises';
import { config as appConfig, getDocumentsPath } from '../utils/config.js';

const logger = createLogger('DatabaseManager');

/**
 * Configuration for DatabaseManager
 */
export interface DatabaseConfig {
  language?: string; // Language code for localization (e.g., 'en_US')
  autoConvertLocalization?: boolean; // Auto-convert TXT_KEY_* to localized text
  documentsPath?: string; // Custom path to documents folder (defaults to system Documents)
}

/**
 * Manages SQLite database connections and queries for Civilization V
 */
export class DatabaseManager {
  private mainDb?: Database.Database;
  private localizationDb?: Database.Database;
  private config: DatabaseConfig;
  private initialized = false;

  /**
   * Create a new DatabaseManager instance
   */
  constructor(config?: DatabaseConfig) {
    this.config = {
      language: config?.language ?? appConfig.database?.language ?? 'en_US',
      autoConvertLocalization: config?.autoConvertLocalization ?? appConfig.database?.autoConvertLocalization ?? true,
      documentsPath: config?.documentsPath ?? appConfig.database?.documentsPath,
    };
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
      // Open main database in read-only mode
      this.mainDb = new Database(mainDbPath, { readonly: true });
      logger.info('Connected to main database');

      // Open localization database in read-only mode
      this.localizationDb = new Database(localizationDbPath, { readonly: true });
      logger.info('Connected to localization database');

      this.initialized = true;
    } catch (error) {
      logger.error('Failed to open database:', error);
      throw new Error(`Failed to open database: ${error}`);
    }
  }

  /**
   * Execute a raw SQL query on the main database
   */
  public async query(sql: string, params?: any[]): Promise<Record<string, any>[]> {
    if (!this.mainDb) {
      throw new Error('Database not initialized. Call initialize() first.');
    }

    try {
      const stmt = this.mainDb.prepare(sql);
      const results = params ? stmt.all(...params) : stmt.all();
      
      // Auto-convert localization keys if enabled
      if (this.config.autoConvertLocalization) {
        return this.localizeObject(results as Record<string, any>[]);
      }
      
      return results as Record<string, any>[];
    } catch (error) {
      logger.error('Query failed:', error);
      throw new Error(`Query failed: ${error}`);
    }
  }

  /**
   * Get localized text for a given key
   */
  public localize(key: string): string {
    if (!this.localizationDb) {
      throw new Error('Localization database not initialized. Call initialize() first.');
    }

    try {
      const stmt = this.localizationDb.prepare(
        'SELECT Text FROM LocalizedText WHERE Language = ? AND Tag = ?'
      );
      const result = stmt.get(this.config.language, key) as { Text?: string } | undefined;
      
      return result?.Text || key; // Return key if no translation found
    } catch (error) {
      logger.error('Localization lookup failed:', error);
      return key; // Return key as fallback
    }
  }

  /**
   * Convert TXT_KEY_* strings in results to localized text
   */
  public localizeObject<T extends Record<string, any>>(results: Record<string, any>[]): T {
    const converted: T = {} as T;
    
    for (const row of results) {
      const convertedRow: Record<string, any> = {};
      
      for (const [key, value] of Object.entries(row)) {
        if (typeof value === 'string' && value.startsWith('TXT_KEY_')) {
          convertedRow[key] = this.localize(value);
        } else {
          convertedRow[key] = value;
        }
      }
      
      converted.push(convertedRow);
    }
    
    return converted;
  }

  /**
   * Set the language for localization
   */
  public setLanguage(language: string): void {
    this.config.language = language;
    logger.info(`Language set to: ${language}`);
  }

  /**
   * Get current language setting
   */
  public getLanguage(): string {
    return this.config.language || 'en_US';
  }

  /**
   * Close database connections
   */
  public async close(): Promise<void> {
    logger.info('Closing database connections');
    
    if (this.mainDb) {
      this.mainDb.close();
      this.mainDb = undefined;
    }
    
    if (this.localizationDb) {
      this.localizationDb.close();
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
}