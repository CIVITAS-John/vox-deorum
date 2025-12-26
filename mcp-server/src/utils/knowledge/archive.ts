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
 * Generic function to find the latest file with a specific extension in a directory
 */
async function findLatestFile(
  directoryPath: string,
  extension: string,
  fileType: string
): Promise<SaveFileInfo | null> {
  try {
    // Check if directory exists
    try {
      await fs.access(directoryPath);
    } catch (error) {
      logger.warn(`${fileType} directory does not exist: ${directoryPath}`);
      return null;
    }

    // Read all files in the directory
    const files = await fs.readdir(directoryPath);

    // Filter for files with the specified extension and get their stats
    const matchingFiles: SaveFileInfo[] = [];
    for (const file of files) {
      if (file.endsWith(extension)) {
        const filePath = path.join(directoryPath, file);
        const stats = await fs.stat(filePath);
        matchingFiles.push({
          path: filePath,
          name: file,
          modifiedTime: stats.mtime
        });
      }
    }

    // Sort by modified time (newest first) and return the latest
    matchingFiles.sort((a, b) => b.modifiedTime.getTime() - a.modifiedTime.getTime());

    if (matchingFiles.length > 0) {
      logger.info(`Found latest ${fileType} file: ${matchingFiles[0].name}`);
      return matchingFiles[0];
    }

    logger.warn(`No ${fileType} files found`);
    return null;
  } catch (error) {
    logger.error(`Error finding latest ${fileType} file:`, error);
    return null;
  }
}

/**
 * Find the latest replay file for Civilization V
 */
export async function findLatestReplayFile(): Promise<SaveFileInfo | null> {
  const documentsPath = await getDocumentsPath();
  const replaysPath = path.join(documentsPath, 'My Games', 'Sid Meier\'s Civilization 5', 'Replays');
  return findLatestFile(replaysPath, '.Civ5Replay', 'replay');
}

/**
 * Find the latest save file for Civilization V
 */
export async function findLatestSaveFile(): Promise<SaveFileInfo | null> {
  const documentsPath = await getDocumentsPath();
  const savesPath = path.join(documentsPath, 'My Games', 'Sid Meier\'s Civilization 5', 'ModdedSaves', 'single', 'auto');
  return findLatestFile(savesPath, '.Civ5Save', 'save');
}

/**
 * Archive the latest game save, replay, database, and telemetry to a strategist-specific folder
 */
export async function archiveGameData(
  experimentOverride?: string
): Promise<{ savePath: string, dbPath: string, replayPath?: string, telemetryPaths?: string[] } | null> {
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

    // Copy telemetry data files
    const telemetryPaths: string[] = [];
    const telemetrySourceDir = path.join('vox-agents', 'telemetry');

    try {
      await fs.access(telemetrySourceDir);
      const telemetryFiles = await fs.readdir(telemetrySourceDir);

      // Filter for telemetry database files matching the game ID pattern
      const gameIdTelemetryFiles = telemetryFiles.filter(file => {
        // Match files like: {gameId}-player-{playerId}.db (and their WAL/SHM files)
        return file.startsWith(gameId) && file.endsWith('.db');
      });

      // Copy each telemetry file
      for (const telemetryFile of gameIdTelemetryFiles) {
        const sourcePath = path.join(telemetrySourceDir, telemetryFile);
        const destPath = path.join(archivePath, telemetryFile);

        try {
          await fs.copyFile(sourcePath, destPath);
          telemetryPaths.push(destPath);
          logger.info(`Archived telemetry file: ${telemetryFile}`);
        } catch (error) {
          logger.warn(`Could not copy telemetry file: ${telemetryFile}`, error);
        }
      }

      if (telemetryPaths.length > 0) {
        logger.info(`Archived ${telemetryPaths.length} telemetry files`);
      } else {
        logger.warn(`No telemetry files found for game ID: ${gameId}`);
      }
    } catch (error) {
      logger.error(`Telemetry directory not found or inaccessible: ${telemetrySourceDir}`);
      // Continue even if telemetry doesn't exist
    }

    // Copy the replay file if it exists
    let replayDest: string | undefined;
    const latestReplay = await findLatestReplayFile();
    if (latestReplay) {
      const replayFileName = `${gameId}_${Date.now()}.Civ5Replay`;
      replayDest = path.join(archivePath, replayFileName);
      try {
        await fs.copyFile(latestReplay.path, replayDest);
        logger.info(`Archived replay file: ${replayFileName}`);
      } catch (error) {
        logger.warn(`Replay file could not be copied: ${latestReplay.path}`, error);
        replayDest = undefined;
      }
    } else {
      logger.warn('No replay file found to archive');
    }

    logger.info(`Successfully archived game data for experiment: ${experiment}`);
    return {
      savePath: saveDest,
      dbPath: dbDest,
      replayPath: replayDest,
      telemetryPaths: telemetryPaths.length > 0 ? telemetryPaths : undefined
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