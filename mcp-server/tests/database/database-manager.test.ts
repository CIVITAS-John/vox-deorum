/**
 * Tests for DatabaseManager
 */

import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import { DatabaseManager } from '../../src/database/database-manager.js';
import { Database } from 'sqlite';
import sqlite3 from 'sqlite3';
import * as fs from 'fs/promises';
import path from 'path';

// Mock the sqlite module
vi.mock('sqlite', () => ({
  open: vi.fn(),
}));

// Mock fs/promises
vi.mock('fs/promises', () => ({
  default: {
    access: vi.fn(),
  },
  access: vi.fn(),
}));

// Mock child_process
vi.mock('child_process', () => ({
  exec: vi.fn((cmd, callback) => {
    // Mock PowerShell command to return a test Documents path
    callback(null, { stdout: 'C:\\Users\\TestUser\\Documents' });
  }),
}));

describe('DatabaseManager', () => {
  let manager: DatabaseManager;
  let mockMainDb: Partial<Database>;
  let mockLocalizationDb: Partial<Database>;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Create mock database instances
    mockMainDb = {
      all: vi.fn(),
      get: vi.fn(),
      close: vi.fn(),
    };
    
    mockLocalizationDb = {
      all: vi.fn(),
      get: vi.fn(),
      close: vi.fn(),
    };
    
    manager = new DatabaseManager({
      language: 'en_US',
      autoConvertLocalization: true,
    });
  });

  describe('initialization', () => {
    it('should initialize successfully when database files exist', async () => {
      const { open } = await import('sqlite');
      const fsAccess = fs.access as any;
      
      // Mock file existence checks
      fsAccess.mockResolvedValue(undefined);
      
      // Mock database connections
      (open as any).mockResolvedValueOnce(mockMainDb);
      (open as any).mockResolvedValueOnce(mockLocalizationDb);
      
      await manager.initialize();
      
      expect(manager.isInitialized()).toBe(true);
      expect(open).toHaveBeenCalledTimes(2);
    });

    it('should throw error when database files do not exist', async () => {
      const fsAccess = fs.access as any;
      
      // Mock file not found
      fsAccess.mockRejectedValue(new Error('File not found'));
      
      await expect(manager.initialize()).rejects.toThrow(
        'Database files not found'
      );
    });

    it('should not reinitialize if already initialized', async () => {
      const { open } = await import('sqlite');
      const fsAccess = fs.access as any;
      
      fsAccess.mockResolvedValue(undefined);
      (open as any).mockResolvedValue(mockMainDb);
      
      await manager.initialize();
      const callCount = (open as any).mock.calls.length;
      
      await manager.initialize(); // Second call
      
      expect((open as any).mock.calls.length).toBe(callCount);
    });
  });

  describe('query', () => {
    beforeEach(async () => {
      const { open } = await import('sqlite');
      const fsAccess = fs.access as any;
      
      fsAccess.mockResolvedValue(undefined);
      (open as any).mockResolvedValueOnce(mockMainDb);
      (open as any).mockResolvedValueOnce(mockLocalizationDb);
      
      await manager.initialize();
    });

    it('should execute SQL query and return results', async () => {
      const mockResults = [
        { ID: 1, Type: 'TECH_AGRICULTURE', Description: 'TXT_KEY_TECH_AGRICULTURE' },
        { ID: 2, Type: 'TECH_POTTERY', Description: 'TXT_KEY_TECH_POTTERY' },
      ];
      
      (mockMainDb.all as any).mockResolvedValue(mockResults);
      (mockLocalizationDb.get as any).mockImplementation((sql, params) => {
        const key = params[1];
        if (key === 'TXT_KEY_TECH_AGRICULTURE') {
          return Promise.resolve({ Text: 'Agriculture' });
        }
        if (key === 'TXT_KEY_TECH_POTTERY') {
          return Promise.resolve({ Text: 'Pottery' });
        }
        return Promise.resolve(null);
      });
      
      const results = await manager.query('SELECT * FROM Technologies');
      
      expect(results).toHaveLength(2);
      expect(results[0].Description).toBe('Agriculture');
      expect(results[1].Description).toBe('Pottery');
    });

    it('should throw error if not initialized', async () => {
      const uninitializedManager = new DatabaseManager();
      
      await expect(uninitializedManager.query('SELECT * FROM Technologies'))
        .rejects.toThrow('Database not initialized');
    });

    it('should handle query errors gracefully', async () => {
      (mockMainDb.all as any).mockRejectedValue(new Error('SQL error'));
      
      await expect(manager.query('INVALID SQL'))
        .rejects.toThrow('Query failed');
    });
  });

  describe('localization', () => {
    beforeEach(async () => {
      const { open } = await import('sqlite');
      const fsAccess = fs.access as any;
      
      fsAccess.mockResolvedValue(undefined);
      (open as any).mockResolvedValueOnce(mockMainDb);
      (open as any).mockResolvedValueOnce(mockLocalizationDb);
      
      await manager.initialize();
    });

    it('should get localized text for a key', async () => {
      (mockLocalizationDb.get as any).mockResolvedValue({
        Text: 'Agriculture',
      });
      
      const text = await manager.getLocalization('TXT_KEY_TECH_AGRICULTURE');
      
      expect(text).toBe('Agriculture');
      expect(mockLocalizationDb.get).toHaveBeenCalledWith(
        'SELECT Text FROM LocalizedText WHERE Language = ? AND Tag = ?',
        ['en_US', 'TXT_KEY_TECH_AGRICULTURE']
      );
    });

    it('should return key if translation not found', async () => {
      (mockLocalizationDb.get as any).mockResolvedValue(null);
      
      const text = await manager.getLocalization('TXT_KEY_UNKNOWN');
      
      expect(text).toBe('TXT_KEY_UNKNOWN');
    });

    it('should handle localization errors gracefully', async () => {
      (mockLocalizationDb.get as any).mockRejectedValue(new Error('DB error'));
      
      const text = await manager.getLocalization('TXT_KEY_ERROR');
      
      expect(text).toBe('TXT_KEY_ERROR');
    });
  });

  describe('language management', () => {
    it('should set and get language', () => {
      manager.setLanguage('fr_FR');
      expect(manager.getLanguage()).toBe('fr_FR');
    });

    it('should use default language if not set', () => {
      const newManager = new DatabaseManager();
      expect(newManager.getLanguage()).toBe('en_US');
    });
  });

  describe('cleanup', () => {
    it('should close database connections', async () => {
      const { open } = await import('sqlite');
      const fsAccess = fs.access as any;
      
      fsAccess.mockResolvedValue(undefined);
      (open as any).mockResolvedValueOnce(mockMainDb);
      (open as any).mockResolvedValueOnce(mockLocalizationDb);
      
      await manager.initialize();
      await manager.close();
      
      expect(mockMainDb.close).toHaveBeenCalled();
      expect(mockLocalizationDb.close).toHaveBeenCalled();
      expect(manager.isInitialized()).toBe(false);
    });
  });
});