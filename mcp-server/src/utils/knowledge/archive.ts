/**
 * Archive utility for backing up game saves and database files
 */

import fs from 'fs/promises';
import path from 'path';
import { getDocumentsPath } from '../config.js';
import { createLogger } from '../logger.js';
import { knowledgeManager } from '../../server.js';

const logger = createLogger('Archive');

/**
 * Information about a save file
 */
interface SaveFileInfo {
  path: string;
  name: string;
  modifiedTime: Date;
}

/**
 * Find the latest save file for Civilization V
 */
export async function findLatestSaveFile(): Promise<SaveFileInfo | null> {
  try {
    const documentsPath = await getDocumentsPath();
    const savesPath = path.join(documentsPath, 'My Games', 'Sid Meier\'s Civilization 5', 'ModdedSaves', 'single', 'auto');

    // Check if saves directory exists
    try {
      await fs.access(savesPath);
    } catch (error) {
      logger.warn(`Saves directory does not exist: ${savesPath}`);
      return null;
    }

    // Read all files in the saves directory
    const files = await fs.readdir(savesPath);

    // Filter for .Civ5Save files and get their stats
    const saveFiles: SaveFileInfo[] = [];
    for (const file of files) {
      if (file.endsWith('.Civ5Save')) {
        const filePath = path.join(savesPath, file);
        const stats = await fs.stat(filePath);
        saveFiles.push({
          path: filePath,
          name: file,
          modifiedTime: stats.mtime
        });
      }
    }

    // Sort by modified time (newest first) and return the latest
    saveFiles.sort((a, b) => b.modifiedTime.getTime() - a.modifiedTime.getTime());

    if (saveFiles.length > 0) {
      logger.info(`Found latest save file: ${saveFiles[0].name}`);
      return saveFiles[0];
    }

    logger.warn('No save files found');
    return null;
  } catch (error) {
    logger.error('Error finding latest save file:', error);
    return null;
  }
}

/**
 * Archive the latest game save and database to a strategist-specific folder
 */
export async function archiveGameData(
  experimentOverride?: string
): Promise<{ savePath: string, dbPath: string } | null> {
  try {
    // Get the strategist name from metadata or use override/default
    const store = knowledgeManager.getStore();
    let experiment = experimentOverride ?? await store.getMetadata('experiment') ?? "none";

    // Get the game ID
    const gameId = knowledgeManager.getGameId();
    if (!gameId) {
      logger.error('No game ID available');
      return null;
    }

    // Find the latest save file
    const latestSave = await findLatestSaveFile();
    if (!latestSave) {
      logger.error('No save file found to archive');
      return null;
    }

    // Create the archive directory
    const archivePath = path.join('archive', experiment);
    await fs.mkdir(archivePath, { recursive: true });
    logger.info(`Created archive directory: ${archivePath}`);

    // Copy the save file
    const saveFileName = `${gameId}_${Date.now()}.Civ5Save`;
    const saveDest = path.join(archivePath, saveFileName);
    await fs.copyFile(latestSave.path, saveDest);
    logger.info(`Archived save file: ${saveFileName}`);

    // Copy the database file
    const dbSource = path.join('data', `${gameId}.db`);
    const dbFileName = `${gameId}_${Date.now()}.db`;
    const dbDest = path.join(archivePath, dbFileName);

    try {
      await fs.access(dbSource);
      await fs.copyFile(dbSource, dbDest);
      logger.info(`Archived database file: ${dbFileName}`);
    } catch (error) {
      logger.warn(`Database file not found or could not be copied: ${dbSource}`);
      // Continue even if database doesn't exist
    }

    logger.info(`Successfully archived game data for experiment: ${experiment}`);
    return {
      savePath: saveDest,
      dbPath: dbDest
    };
  } catch (error) {
    logger.error('Error archiving game data:', error);
    return null;
  }
}

/**
 * List all archived games for a strategist
 */
export async function listArchivedGames(strategist?: string): Promise<string[]> {
  try {
    const strategistName = strategist || 'none';
    const archivePath = path.join(process.cwd(), 'archive', strategistName);

    try {
      await fs.access(archivePath);
    } catch (error) {
      logger.debug(`Archive directory does not exist: ${archivePath}`);
      return [];
    }

    const files = await fs.readdir(archivePath);
    return files.filter(f => f.endsWith('.Civ5Save'));
  } catch (error) {
    logger.error('Error listing archived games:', error);
    return [];
  }
}