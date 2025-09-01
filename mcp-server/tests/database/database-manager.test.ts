/**
 * DatabaseManager Tests - Verifies SQLite database connectivity and query functionality
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { DatabaseManager } from '../../src/database/database-manager.js';

describe('DatabaseManager', () => {
  let manager: DatabaseManager;

  beforeAll(async () => {
    manager = new DatabaseManager();
    await manager.initialize();
  });

  afterAll(async () => {
    // Clean up any managers that might still be initialized
    if (manager && manager.isInitialized()) {
      await manager.close();
    }
  });
  
  describe('Database Operations', () => {
    it('should query from different tables', async () => {
      await manager.initialize();
      
      const db = manager.getDatabase();
      
      // Query from BuildingClasses table
      const buildingClasses = await db
        .selectFrom('BuildingClasses')
        .select(['Type', 'Description'])
        .limit(5)
        .execute();
      
      expect(buildingClasses).toBeDefined();
      expect(Array.isArray(buildingClasses)).toBe(true);
      
      // Also test querying from Civilizations table
      const civs = await db
        .selectFrom('Civilizations')
        .select(['Type', 'Description', 'ShortDescription'])
        .limit(3)
        .execute();
      
      expect(civs).toBeDefined();
      expect(Array.isArray(civs)).toBe(true);
    });

  });

  describe('Localization', () => {
    it('should localize a single key', async () => {
      // Try to localize a common key
      const result = await manager.localize('TXT_KEY_TECH_AGRICULTURE_TITLE');
      
      expect(result).toBeDefined();
      expect(result).not.toBe('TXT_KEY_TECH_AGRICULTURE_TITLE');
      expect(typeof result).toBe('string');
      // Should return either the localized text or the key itself
    });

    it('should return key when localization not found', async () => {
      const nonExistentKey = 'TXT_KEY_THIS_DOES_NOT_EXIST_12345';
      const result = await manager.localize(nonExistentKey);
      
      // Should return the key itself when translation not found
      expect(result).toBe(nonExistentKey);
    });

    it('should localize object with TXT_KEY values', async () => {
      const db = manager.getDatabase();
      
      // Query data that likely contains TXT_KEY values
      const techs = await db
        .selectFrom('Technologies')
        .select(['Type', 'Description'])
        .limit(3)
        .execute();
      
      // Localize the results
      const localized = await manager.localizeObject(techs);
      
      expect(localized).toBeDefined();
      expect(Array.isArray(localized)).toBe(true);
      expect(localized.length).toBe(techs.length);
      
      // Check if TXT_KEY values were processed
      for (let i = 0; i < techs.length; i++) {
        const original = techs[i];
        const localizedItem = localized[i];
        
        if (original.Description && typeof original.Description === 'string' && original.Description.startsWith('TXT_KEY_')) {
          expect(localizedItem.Description).toBeDefined();
          expect(localizedItem.Description).not.toBe(original.Description);
        }
      }
    });

    it('should handle empty arrays for localization', async () => {
      await manager.initialize();
      
      const emptyArray: any[] = [];
      const result = await manager.localizeObject(emptyArray);
      
      expect(result).toEqual([]);
    });

    it('should handle objects without TXT_KEY values', async () => {
      await manager.initialize();
      
      const data = [
        { id: 1, name: 'Test', value: 100 },
        { id: 2, name: 'Another', value: 200 }
      ];
      
      const result = await manager.localizeObject(data);
      expect(result).toEqual(data);
    });
  });
});