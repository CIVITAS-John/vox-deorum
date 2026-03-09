/**
 * @module archivist/index
 *
 * CLI entry point for the Archivist pipeline.
 * Processes archived Civilization V game databases into a DuckDB episodes table,
 * where each row is a player-turn snapshot for LLM-controlled players.
 *
 * Usage:
 *   npm run archivist -- -a <archive-path> -o <output.duckdb> [-e <experiment>] [--force]
 */

import path from 'node:path';
import { parseArgs } from 'node:util';
import { createLogger } from '../utils/logger.js';
import { scanArchive } from './scanner.js';
import { EpisodeWriter } from './writer.js';
import type { ArchiveEntry } from './types.js';

const logger = createLogger('Archivist');

/** Parse CLI flags */
const { values } = parseArgs({
  options: {
    archive: { type: 'string', short: 'a' },
    output: { type: 'string', short: 'o' },
    experiment: { type: 'string', short: 'e' },
    force: { type: 'boolean', default: false },
  },
  strict: false,
  allowPositionals: false,
});

async function main() {
  const archivePath = path.resolve(values.archive as string ?? 'archive');
  const outputPath = path.resolve(values.output as string ?? 'episodes.duckdb');
  const experimentFilter = values.experiment as string | undefined;
  const force = values.force as boolean;

  logger.info('Archivist starting', { archivePath, outputPath, experimentFilter, force });

  // Step 1: Scan archive for game entries
  const entries: ArchiveEntry[] = await scanArchive(archivePath, experimentFilter);
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

      const existingPlayers = await writer.getProcessedPlayers(entry.gameId);

      for (const player of entry.players) {
        if (!force && existingPlayers.has(player.playerId)) {
          logger.info(`Skipping player ${player.playerId} (already processed)`);
          skipped++;
          continue;
        }

        // Phase 2: telepathist prep (placeholder)
        // Phase 2: extract raw episodes (placeholder)
        // Phase 3: transform episodes (placeholder)
        // Phase 3: generate embeddings (placeholder)
        // Phase 1: write episodes (placeholder — no episodes yet)

        logger.info(`[STUB] Would process player ${player.playerId} in game ${entry.gameId}`);
        processed++;
      }

      // Phase 4: landmark selection (placeholder)

    } catch (error) {
      logger.error(`Error processing game ${entry.gameId}`, { error });
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
  logger.error('Archivist failed', { error });
  process.exit(1);
});
