/**
 * @module archivist/index
 *
 * CLI entry point for the Archivist pipeline.
 * Processes archived Civilization V game databases into a DuckDB episodes table,
 * where each row is a player-turn snapshot for LLM-controlled players.
 *
 * Usage:
 *   npm run archivist -- -a <archive-path> -o <output.duckdb> [-g <gameId>] [--force] [--skip-telepathist] [--skip-embeddings] [--no-ui]
 */

import path from 'node:path';
import { parseArgs } from 'node:util';
import { DuckDBInstance } from '@duckdb/node-api';
import { createLogger } from '../utils/logger.js';
import { openReadonlyGameDb, scanArchive } from './scanner.js';
import { EpisodeWriter } from './writer.js';
import type { ArchiveEntry } from './types.js';
import { prepareTelepathist } from './telepathist-prep.js';
import { extractPlayerEpisodes, extractTurnContexts } from './extractor.js';
import { transformEpisode } from './transformer.js';
import { generateEmbeddings } from './embeddings.js';

const logger = createLogger('Archivist');

/** Parse CLI flags */
const { values } = parseArgs({
  options: {
    archive: { type: 'string', short: 'a' },
    output: { type: 'string', short: 'o' },
    game: { type: 'string', short: 'g' },
    force: { type: 'boolean', default: false },
    'skip-telepathist': { type: 'boolean', default: false },
    'skip-embeddings': { type: 'boolean', default: false },
    'no-ui': { type: 'boolean', default: false },
  },
  strict: false,
  allowPositionals: false,
});

async function main() {
  const archivePath = path.resolve(values.archive as string ?? 'archive');
  const outputPath = path.resolve(values.output as string ?? 'episodes.duckdb');
  const gameFilter = values.game as string | undefined;
  const force = values.force as boolean;
  const skipTelepathist = values['skip-telepathist'] as boolean;
  const skipEmbeddings = values['skip-embeddings'] as boolean;
  const noUi = values['no-ui'] as boolean;

  logger.info('Archivist starting', { archivePath, outputPath, gameFilter, force, skipTelepathist, skipEmbeddings, noUi });

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
            if (skipTelepathist) {
              logger.info(`Skipping telepathist prep for player ${player.playerId} (--skip-telepathist)`);
            } else {
              await prepareTelepathist(player.telemetryDbPath, entry.gameId, player.playerId);
            }

            // Phase 2: extract raw episodes
            const info = playerInfoMap.get(player.playerId);
            const civilization = info?.Civilization ?? 'Unknown';

            const rawEpisodes = await extractPlayerEpisodes(
              gameDb,
              player.telepathistDbPath,
              player.playerId,
              civilization,
              turnContexts,
              entry.gameId,
              victoryPlayerId
            );

            logger.info(`Extracted ${rawEpisodes.length} raw episodes for player ${player.playerId}`);

            // Phase 3: transform raw episodes into full episodes with computed fields
            const episodes = rawEpisodes.map(raw => {
              const tc = turnContexts.get(raw.turn);
              if (!tc) throw new Error(`Missing TurnContext for turn ${raw.turn}`);
              return transformEpisode(raw, tc);
            });

            // Phase 3: generate abstract embeddings (optional)
            if (!skipEmbeddings) {
              const embeddings = await generateEmbeddings(episodes.map(e => e.abstract));
              for (let i = 0; i < episodes.length; i++) {
                episodes[i].abstractEmbedding = embeddings[i];
              }
            }

            await writer.writeEpisodes(episodes);

            processed++;
          } catch (playerError) {
            logger.error(`Error processing player ${player.playerId} in game ${entry.gameId}`, {
              error: playerError instanceof Error ? { message: playerError.message, stack: playerError.stack } : playerError,
            });
            errors++;
          }
        }

        // Phase 4: landmark selection (placeholder)
      } finally {
        await gameDb.destroy();
      }
    } catch (error) {
      logger.error(`Error processing game ${entry.gameId}`, error);
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

  // Step 5: Open DuckDB UI for result inspection
  if (!noUi) {
    logger.info('Starting DuckDB UI...');
    const uiInstance = await DuckDBInstance.create(outputPath);
    const uiConn = await uiInstance.connect();
    await uiConn.run('INSTALL ui; LOAD ui;');
    await uiConn.run('CALL start_ui_server();');

    const url = 'http://localhost:4213';
    const open = (await import('open')).default;
    await open(url);
    logger.info(`DuckDB UI running at ${url} — press Ctrl+C to stop`);

    await new Promise<void>((resolve) => {
      // Keep the event loop alive so the UI server continues running
      const keepAlive = setInterval(() => {}, 1 << 30);
      process.on('SIGINT', () => {
        clearInterval(keepAlive);
        logger.info('Shutting down DuckDB UI');
        uiConn.run('CALL stop_ui_server();').finally(() => {
          uiConn.disconnectSync();
          resolve();
        });
      });
    });
  }
}

main().catch((error) => {
  logger.error('Archivist failed', { error: error instanceof Error ? { message: error.message, stack: error.stack } : error });
  process.exit(1);
});
