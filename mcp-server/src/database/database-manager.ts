/**
 * DatabaseManager - Manages connections to Civilization V SQLite databases
 * Provides structured access to game rules, units, buildings, technologies, and localized text
 */

import { Database, open } from 'sqlite';
import sqlite3 from 'sqlite3';
import { createLogger } from '../utils/logger.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';

const execAsync = promisify(exec);
const logger = createLogger('DatabaseManager');

/**
 * Configuration for DatabaseManager
 */
export interface DatabaseConfig {
  language?: string; // Language code for localization (e.g., 'en_US')
  autoConvertLocalization?: boolean; // Auto-convert TXT_KEY_* to localized text
}

/**
 * Manages SQLite database connections and queries for Civilization V
 */
export class DatabaseManager {
  private mainDb?: Database<sqlite3.Database, sqlite3.Statement>;
  private localizationDb?: Database<sqlite3.Database, sqlite3.Statement>;
  private config: DatabaseConfig;
  private documentsPath?: string;
  private initialized = false;

  /**
   * Create a new DatabaseManager instance
   */
  constructor(config?: DatabaseConfig) {
    this.config = {
      language: config?.language || 'en_US',
      autoConvertLocalization: config?.autoConvertLocalization ?? true,
    };
  }

  /**
   * Get the Windows Documents folder path using PowerShell
   */
  private async getDocumentsPath(): Promise<string> {
    if (this.documentsPath) {
      return this.documentsPath;
    }

    try {
      // Use PowerShell to get the Documents folder path
      const { stdout } = await execAsync(
        'powershell -Command "[Environment]::GetFolderPath(\'MyDocuments\')"'
      );
      this.documentsPath = stdout.trim();
      logger.info(`Documents folder path: ${this.documentsPath}`);
      return this.documentsPath;
    } catch (error) {
      logger.error('Failed to get Documents folder path:', error);
      throw new Error('Could not determine Documents folder path');
    }
  }

  /**
   * Initialize database connections
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    logger.info('Initializing DatabaseManager');
    
    const documentsPath = await this.getDocumentsPath();
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
      this.mainDb = await open({
        filename: mainDbPath,
        driver: sqlite3.Database,
        mode: sqlite3.OPEN_READONLY,
      });
      logger.info('Connected to main database');

      // Open localization database in read-only mode
      this.localizationDb = await open({
        filename: localizationDbPath,
        driver: sqlite3.Database,
        mode: sqlite3.OPEN_READONLY,
      });
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
      const results = await this.mainDb.all(sql, params);
      
      // Auto-convert localization keys if enabled
      if (this.config.autoConvertLocalization) {
        return this.convertLocalizationKeys(results);
      }
      
      return results;
    } catch (error) {
      logger.error('Query failed:', error);
      throw new Error(`Query failed: ${error}`);
    }
  }

  /**
   * Get localized text for a given key
   */
  public async getLocalization(key: string): Promise<string> {
    if (!this.localizationDb) {
      throw new Error('Localization database not initialized. Call initialize() first.');
    }

    try {
      const result = await this.localizationDb.get(
        'SELECT Text FROM LocalizedText WHERE Language = ? AND Tag = ?',
        [this.config.language, key]
      );
      
      return result?.Text || key; // Return key if no translation found
    } catch (error) {
      logger.error('Localization lookup failed:', error);
      return key; // Return key as fallback
    }
  }

  /**
   * Convert TXT_KEY_* strings in results to localized text
   */
  private async convertLocalizationKeys(results: Record<string, any>[]): Promise<Record<string, any>[]> {
    const converted = [];
    
    for (const row of results) {
      const convertedRow: Record<string, any> = {};
      
      for (const [key, value] of Object.entries(row)) {
        if (typeof value === 'string' && value.startsWith('TXT_KEY_')) {
          convertedRow[key] = await this.getLocalization(value);
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
      await this.mainDb.close();
      this.mainDb = undefined;
    }
    
    if (this.localizationDb) {
      await this.localizationDb.close();
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