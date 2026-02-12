/**
 * @module utils/identifier-parser
 *
 * Utility functions for parsing game and player identifiers from various formats.
 * Handles context IDs, database filenames, and telemetry session IDs.
 */

import path from 'path';

/**
 * Information extracted from an identifier string
 */
export interface GameIdentifierInfo {
  gameID: string;
  playerID: number;
  folderPath?: string;
}

/**
 * Parse game and player ID from a context identifier.
 * Handles formats like:
 * - `{gameID}-player-{playerID}` (VoxContext format)
 * - `{gameID}-{playerID}` (telemetry format)
 *
 * @param contextId - The context identifier to parse
 * @returns Parsed game and player information
 */
export function parseContextIdentifier(contextId: string): GameIdentifierInfo {
  const parts = contextId.split('-');

  // Handle VoxContext format: {gameID}-player-{playerID}
  if (parts.length >= 3 && parts[parts.length - 2] === 'player') {
    const playerID = parseInt(parts[parts.length - 1] || '0', 10);
    const gameID = parts.slice(0, -2).join('-') || contextId;
    return { gameID, playerID };
  }

  // Handle telemetry format: {gameID}-{playerID}
  if (parts.length >= 2) {
    const playerID = parseInt(parts[parts.length - 1] || '0', 10);
    const gameID = parts.slice(0, -1).join('-') || contextId;
    return { gameID, playerID };
  }

  // Fallback for unknown formats
  return { gameID: contextId, playerID: 0 };
}

/**
 * Parse game and player ID from a database filename.
 * Expects format: `{gameID}-{playerID}.db`
 * Optionally extracts folder path if full path is provided.
 *
 * @param databasePath - The database file path (can be full path or just filename)
 * @param basePath - Optional base path to calculate relative folder path from
 * @returns Parsed game and player information with optional folder path
 */
export function parseDatabaseIdentifier(databasePath: string, basePath?: string): GameIdentifierInfo {
  const nameWithoutExt = path.basename(databasePath, '.db');
  const parts = nameWithoutExt.split('-');

  let result: GameIdentifierInfo;

  if (parts.length >= 2) {
    const playerID = parseInt(parts[parts.length - 1] || '0', 10);
    const gameID = parts.slice(0, -1).join('-') || 'unknown';
    result = { gameID, playerID };
  } else {
    // Fallback for unknown formats
    result = { gameID: nameWithoutExt || 'unknown', playerID: 0 };
  }

  // Extract folder path if base path is provided
  if (basePath) {
    const dir = path.dirname(databasePath);
    const relativePath = path.relative(basePath, dir);
    result.folderPath = relativePath.replace(/\\/g, '/');
  }

  return result;
}

/**
 * Create a VoxContext identifier from game and player IDs.
 * Returns format: `{gameID}-player-{playerID}`
 *
 * @param gameID - The game identifier
 * @param playerID - The player identifier
 * @returns Formatted context ID
 */
export function createContextId(gameID: string, playerID: number): string {
  return `${gameID}-player-${playerID}`;
}