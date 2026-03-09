/**
 * @module archivist/scanner
 *
 * Archive filesystem scanner that discovers game databases and identifies
 * LLM-controlled players. Walks experiment subdirectories under the archive
 * path, classifies database files by regex, and queries each game DB for
 * FlavorChanges to distinguish LLM players from VPAI players.
 */

import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { Kysely, SqliteDialect, ParseJSONResultsPlugin } from 'kysely';
import { createLogger } from '../utils/logger.js';
import type { KnowledgeDatabase } from '../../../mcp-server/dist/knowledge/schema/index.js';
import type { ArchiveEntry, PlayerEntry } from './types.js';

const logger = createLogger('ArchivistScanner');

/** Regex for game database files: {gameId}_{timestamp}.db */
const GAME_DB_REGEX = /^(.+?)_(\d+)\.db$/;

/** Regex for telepathist database files (checked first to exclude from telemetry match) */
const TELEPATHIST_DB_REGEX = /^(.+)-player-(\d+)\.telepathist\.db$/;

/** Regex for telemetry database files: {gameId}-player-{playerId}.db */
const TELEMETRY_DB_REGEX = /^(.+)-player-(\d+)\.db$/;

/**
 * Opens a game knowledge database in read-only mode with JSON parsing support.
 * Follows the pattern from oracle/db-resolver.ts.
 *
 * @param dbPath - Absolute path to the SQLite database
 * @returns Kysely instance for querying, or null on failure
 */
export function openReadonlyGameDb(dbPath: string): Kysely<KnowledgeDatabase> | null {
  try {
    const sqliteDb = new Database(dbPath, { readonly: true });
    return new Kysely<KnowledgeDatabase>({
      dialect: new SqliteDialect({ database: sqliteDb }),
      plugins: [new ParseJSONResultsPlugin()],
    });
  } catch (error) {
    logger.error(`Failed to open game database: ${dbPath}`, { error });
    return null;
  }
}

/**
 * Scans the archive directory for game databases and identifies LLM-controlled players.
 *
 * For each experiment subdirectory, classifies .db files into game DBs, telemetry DBs,
 * and telepathist DBs. Opens each game DB to query FlavorChanges for LLM player detection.
 * Only returns games with at least one LLM-controlled player that has a telemetry DB.
 *
 * @param archivePath - Root archive directory containing experiment subdirectories
 * @param experimentFilter - Optional: only process this specific experiment directory
 * @returns Discovered archive entries with their LLM players
 */
export async function scanArchive(
  archivePath: string,
  experimentFilter?: string
): Promise<ArchiveEntry[]> {
  const entries: ArchiveEntry[] = [];

  // Read experiment subdirectories
  let experimentDirs: string[];
  try {
    const dirEntries = fs.readdirSync(archivePath, { withFileTypes: true });
    experimentDirs = dirEntries
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
  } catch (error) {
    logger.error(`Failed to read archive directory: ${archivePath}`, { error });
    return [];
  }

  if (experimentFilter) {
    experimentDirs = experimentDirs.filter((d) => d === experimentFilter);
    if (experimentDirs.length === 0) {
      logger.warn(`Experiment directory not found: ${experimentFilter}`);
      return [];
    }
  }

  let totalGames = 0;
  let totalPlayers = 0;

  for (const experiment of experimentDirs) {
    const experimentPath = path.join(archivePath, experiment);
    let files: string[];

    try {
      files = fs.readdirSync(experimentPath);
    } catch (error) {
      logger.warn(`Failed to read experiment directory: ${experimentPath}`, { error });
      continue;
    }

    // Classify files by type
    const gameDbMap = new Map<string, string>(); // gameId -> dbPath
    const telemetryDbMap = new Map<string, Map<number, string>>(); // gameId -> (playerId -> dbPath)
    const telepathistDbMap = new Map<string, Map<number, string>>(); // gameId -> (playerId -> dbPath)

    for (const file of files) {
      // Check telepathist DB first (to exclude from telemetry regex)
      const telepathistMatch = TELEPATHIST_DB_REGEX.exec(file);
      if (telepathistMatch) {
        const [, gameId, playerIdStr] = telepathistMatch;
        const playerId = parseInt(playerIdStr, 10);
        if (!telepathistDbMap.has(gameId)) {
          telepathistDbMap.set(gameId, new Map());
        }
        telepathistDbMap.get(gameId)!.set(playerId, path.join(experimentPath, file));
        continue;
      }

      // Check telemetry DB (must not end with .telepathist.db, already handled above)
      const telemetryMatch = TELEMETRY_DB_REGEX.exec(file);
      if (telemetryMatch && !file.endsWith('.telepathist.db')) {
        const [, gameId, playerIdStr] = telemetryMatch;
        const playerId = parseInt(playerIdStr, 10);
        if (!telemetryDbMap.has(gameId)) {
          telemetryDbMap.set(gameId, new Map());
        }
        telemetryDbMap.get(gameId)!.set(playerId, path.join(experimentPath, file));
        continue;
      }

      // Check game DB
      const gameMatch = GAME_DB_REGEX.exec(file);
      if (gameMatch) {
        const [, gameId] = gameMatch;
        // Keep the latest timestamp if multiple game DBs exist for the same gameId
        gameDbMap.set(gameId, path.join(experimentPath, file));
      }
    }

    // Process each game that has a game DB
    for (const [gameId, gameDbPath] of gameDbMap) {
      const db = openReadonlyGameDb(gameDbPath);
      if (!db) {
        continue;
      }

      try {
        // Query FlavorChanges to find LLM player IDs
        // FlavorChanges uses PascalCase columns (Key, IsLatest) because the SQLite DB uses PascalCase
        const flavorRows = await db
          .selectFrom('FlavorChanges')
          .select('Key')
          .where('IsLatest', '=', 1)
          .groupBy('Key')
          .execute();

        const llmPlayerIds = new Set(flavorRows.map((r) => r.Key));

        if (llmPlayerIds.size === 0) {
          logger.debug(`No LLM players found for game ${gameId}, skipping`);
          await db.destroy();
          continue;
        }

        const players: PlayerEntry[] = [];
        const telemetryPlayers = telemetryDbMap.get(gameId);

        for (const playerId of llmPlayerIds) {
          const telemetryPath = telemetryPlayers?.get(playerId);
          if (!telemetryPath) {
            logger.warn(`LLM player ${playerId} in game ${gameId} has no telemetry DB, skipping`);
            continue;
          }

          // Derive telepathist DB path (may not exist yet, will be created by telepathist-prep)
          const telepathistPath =
            telepathistDbMap.get(gameId)?.get(playerId) ??
            telemetryPath.replace(/\.db$/, '.telepathist.db');

          players.push({
            playerId,
            telemetryDbPath: telemetryPath,
            telepathistDbPath: telepathistPath,
          });
        }

        await db.destroy();

        if (players.length > 0) {
          entries.push({
            experiment,
            gameId,
            gameDbPath,
            players,
          });
          totalGames++;
          totalPlayers += players.length;
        }
      } catch (error) {
        logger.error(`Error processing game ${gameId} in experiment ${experiment}`, { error });
        try {
          await db.destroy();
        } catch {
          // Ignore cleanup errors
        }
      }
    }
  }

  logger.info(`Archive scan complete: ${totalGames} games found, ${totalPlayers} total LLM players`);
  return entries;
}
