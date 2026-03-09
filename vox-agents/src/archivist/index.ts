/**
 * @module archivist/index
 *
 * CLI entry point for the Archivist pipeline.
 * Processes archived Civilization V game databases into a DuckDB episodes table,
 * where each row is a player-turn snapshot for LLM-controlled players.
 *
 * Usage:
 *   npm run archivist -- -a <archive-path> -o <output.duckdb> [-g <gameId>] [--force]
 */

import path from 'node:path';
import { parseArgs } from 'node:util';
import { createLogger } from '../utils/logger.js';
import { openReadonlyGameDb, scanArchive } from './scanner.js';
import { EpisodeWriter } from './writer.js';
import type { ArchiveEntry } from './types.js';
import { prepareTelepathist } from './telepathist-prep.js';
import { extractPlayerEpisodes, extractTurnContexts } from './extractor.js';

const logger = createLogger('Archivist');

/** Parse CLI flags */
const { values } = parseArgs({
  options: {
    archive: { type: 'string', short: 'a' },
    output: { type: 'string', short: 'o' },
    game: { type: 'string', short: 'g' },
    force: { type: 'boolean', default: false },
  },
  strict: false,
  allowPositionals: false,
});

async function main() {
  const archivePath = path.resolve(values.archive as string ?? 'archive');
  const outputPath = path.resolve(values.output as string ?? 'episodes.duckdb');
  const gameFilter = values.game as string | undefined;
  const force = values.force as boolean;

  logger.info('Archivist starting', { archivePath, outputPath, gameFilter, force });

  // Step 1: Scan archive for game entries
  const entries: ArchiveEntry[] = await scanArchive(archivePath, gameFilter);
  logger.info(`Found ${entries.length} game(s) to process`);

  if (entries.length === 0) {
    logger.warn('No games found in archive');
    return;
  }

  // Step 2: Initialize DuckDB writer
  const writer = await EpisodeWriter.create(outputPath);

  let processed = 0;
  let skipped = 0;
  let errors = 0;

  // Step 3: Process each game
  for (const entry of entries) {
    try {
      logger.info(`Processing game ${entry.gameId} (${entry.experiment})`, {
        players: entry.players.length,
      });

      if (force) {
        await writer.deleteGameEpisodes(entry.gameId);
      }

      // Open game DB for extraction
      const gameDb = openReadonlyGameDb(entry.gameDbPath);
      if (!gameDb) {
        logger.error(`Failed to open game DB for ${entry.gameId}, skipping`);
        errors++;
        continue;
      }

      try {
        // Query game metadata for winner determination
        const victoryRow = await gameDb
          .selectFrom('GameMetadata')
          .select('Value')
          .where('Key', '=', 'victoryPlayerID')
          .executeTakeFirst();
        const victoryPlayerId = victoryRow ? parseInt(victoryRow.Value, 10) : -1;

        // Build player info lookup (ID → civ name + leader name)
        const playerInfoRows = await gameDb
          .selectFrom('PlayerInformations')
          .selectAll()
          .execute();
        const playerInfoMap = new Map(playerInfoRows.map((r) => [r.Key, r]));

        // Extract turn contexts once per game (shared across all players)
        const turnContexts = await extractTurnContexts(gameDb);

        const existingPlayers = await writer.getProcessedPlayers(entry.gameId);

        for (const player of entry.players) {
          if (!force && existingPlayers.has(player.playerId)) {
            logger.info(`Skipping player ${player.playerId} (already processed)`);
            skipped++;
            continue;
          }

          try {
            // Phase 2: telepathist prep — generate turn summaries if missing
            await prepareTelepathist(player.telemetryDbPath, entry.gameId, player.playerId);

            // Phase 2: extract raw episodes
            const info = playerInfoMap.get(player.playerId);
            const civilization = info?.Civilization ?? 'Unknown';
            const leaderName = info?.Leader ?? 'Unknown';

            const rawEpisodes = await extractPlayerEpisodes(
              gameDb,
              player.telepathistDbPath,
              player.playerId,
              civilization,
              leaderName,
              turnContexts,
              entry.gameId,
              victoryPlayerId
            );

            logger.info(`Extracted ${rawEpisodes.length} raw episodes for player ${player.playerId}`);

            // Phase 3: transform episodes (placeholder)
            // Phase 3: generate embeddings (placeholder)
            // Phase 1: write episodes (placeholder — needs Episode[], not RawEpisode[])

            processed++;
          } catch (playerError) {
            logger.error(`Error processing player ${player.playerId} in game ${entry.gameId}`, {
              error: playerError,
            });
            errors++;
          }
        }

        // Phase 4: landmark selection (placeholder)
      } finally {
        await gameDb.destroy();
      }
    } catch (error) {
      logger.error(`Error processing game ${entry.gameId}`, {
        error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
      });
      errors++;
    }
  }

  // Step 4: Close and summarize
  await writer.close();

  logger.info('Archivist complete', {
    games: entries.length,
    processed,
    skipped,
    errors,
    output: outputPath,
  });
}

main().catch((error) => {
  logger.error('Archivist failed', { error: error instanceof Error ? { message: error.message, stack: error.stack } : error });
  process.exit(1);
});
