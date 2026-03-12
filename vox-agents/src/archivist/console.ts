/**
 * @module archivist/console
 *
 * CLI entry point for the Archivist pipeline.
 * Processes archived Civilization V game databases into a DuckDB episodes table,
 * where each row is a player-turn snapshot for LLM-controlled players.
 *
 * Three-phase pipeline:
 *   Phase A: Extract + Transform + Write (no LLM calls)
 *   Phase B: Select diverse landmarks per player
 *   Phase C: Generate summaries + embeddings for landmark and consequence turns only
 *
 * Usage:
 *   npm run archivist -- -a <archive-path> -o <output.duckdb> [-g <gameId>] [-n <limit>] [-m <model>] [--force] [--skip-telepathist] [--skip-embeddings] [--no-ui]
 */

import path from 'node:path';
import { parseArgs } from 'node:util';
import { config } from '../utils/config.js';
import { getEpisodeDbInstance } from './episode-db.js';
import { createLogger } from '../utils/logger.js';
import { openReadonlyGameDb, scanArchive } from './scanner.js';
import { EpisodeWriter } from './writer.js';
import type { ArchiveEntry } from './types.js';
import { horizons, horizonTolerance, victoryTypeMap } from './types.js';
import { prepareTelepathist } from './telepathist-prep.js';
import { extractPlayerEpisodes, extractTurnContexts, loadTurnSummaries } from './extractor.js';
import { transformEpisode } from './transformer.js';
import { generateEmbeddings } from './embeddings.js';
import { selectLandmarks } from './selector.js';
import { startWebServer } from '../web/server.js';

const logger = createLogger('Archivist');

/** Parse CLI flags */
const { values } = parseArgs({
  options: {
    archive: { type: 'string', short: 'a' },
    output: { type: 'string', short: 'o' },
    game: { type: 'string', short: 'g' },
    limit: { type: 'string', short: 'n' },
    model: { type: 'string', short: 'm' },
    force: { type: 'boolean', default: false },
    'skip-telepathist': { type: 'boolean', default: false },
    'skip-embeddings': { type: 'boolean', default: false },
    'no-ui': { type: 'boolean', default: false },
  },
  strict: false,
  allowPositionals: false,
});

/**
 * Compute the set of turns that need summaries: landmark turns plus their
 * consequence turns (at +5/+10/+15/+20 horizons used by the reader's outcome pipeline).
 * Snaps consequence turns to nearby existing summaries within {@link horizonTolerance}
 * to avoid redundant LLM calls when a close-enough summary already exists.
 */
function computeTargetTurns(
  landmarkTurns: number[],
  allTurns: Set<number>,
  existingSummaryTurns: Set<number>
): { targetTurns: number[]; landmarkSet: Set<number> } {
  const landmarkSet = new Set(landmarkTurns);
  const targetSet = new Set(landmarkTurns);

  for (const lt of landmarkTurns) {
    for (const h of horizons) {
      const ideal = lt + h;

      // Already covered by an existing target or prior summary at the exact turn
      if (targetSet.has(ideal) || existingSummaryTurns.has(ideal)) continue;

      // Check if a nearby turn (within tolerance) is already covered
      let covered = false;
      for (let d = 1; d <= horizonTolerance; d++) {
        if (targetSet.has(ideal - d) || existingSummaryTurns.has(ideal - d) ||
            targetSet.has(ideal + d) || existingSummaryTurns.has(ideal + d)) {
          covered = true;
          break;
        }
      }
      if (covered) continue;

      // No nearby summary exists — find the closest game turn within the window
      if (allTurns.has(ideal)) {
        targetSet.add(ideal);
      } else {
        for (let d = 1; d <= horizonTolerance; d++) {
          if (allTurns.has(ideal - d)) { targetSet.add(ideal - d); break; }
          if (allTurns.has(ideal + d)) { targetSet.add(ideal + d); break; }
        }
      }
    }
  }

  return {
    targetTurns: [...targetSet].sort((a, b) => a - b),
    landmarkSet,
  };
}

async function main() {
  const archivePath = path.resolve(values.archive as string ?? 'archive');
  const outputPath = path.resolve(values.output as string ?? config.episodeDbPath);
  const gameFilter = values.game as string | undefined;
  const force = values.force as boolean;
  const limit = values.limit ? parseInt(values.limit as string, 10) : Infinity;
  const modelOverride = values.model as string | undefined;
  const skipTelepathist = values['skip-telepathist'] as boolean;
  const skipEmbeddings = values['skip-embeddings'] as boolean;
  const noUi = values['no-ui'] as boolean;

  logger.info('Archivist starting', { archivePath, outputPath, gameFilter, force, limit, modelOverride, skipTelepathist, skipEmbeddings, noUi });

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
  let claimed = 0;
  let gamesProcessed = 0;

  // Release all claims on unexpected shutdown
  const shutdownCleanup = () => { writer.releaseAllGames().catch(() => {}); };
  process.on('SIGTERM', shutdownCleanup);

  // Web UI
  await startWebServer();

  // Step 3: Process each game
  for (const entry of entries) {
    // Claim game to prevent concurrent processing by other instances
    if (!await writer.claimGame(entry.gameId)) {
      logger.info(`Skipping game ${entry.gameId} (claimed by another instance)`);
      claimed++;
      continue;
    }

    try {
      // Game-level completeness check: skip Phase A+B if all players already processed
      let skipPhaseAB = false;
      if (!force) {
        const existingPlayers = await writer.getProcessedPlayers(entry.gameId);
        const allPlayersProcessed = entry.players.every(p => existingPlayers.has(p.playerId));
        if (allPlayersProcessed) {
          if (skipTelepathist && skipEmbeddings) {
            logger.info(`Skipping game ${entry.gameId} (already complete, Phase C disabled)`);
            skipped += entry.players.length;
            continue;
          }
          skipPhaseAB = true;
          logger.info(`Game ${entry.gameId} Phase A+B complete, checking Phase C`);
        }
      }

      // Collect all turn numbers for consequence turn lookup in Phase C
      let allTurns: Set<number> | undefined;

      if (!skipPhaseAB) {
        if (gamesProcessed >= limit) {
          logger.info(`Reached game limit (${limit}), stopping`);
          break;
        }

        logger.info(`Processing game ${entry.gameId} (${entry.experiment})`, {
          players: entry.players.length,
        });

        if (force) {
          await writer.resetGameLandmarks(entry.gameId);
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

          // Build player info lookup (ID -> civ name + leader name)
          const playerInfoRows = await gameDb
            .selectFrom('PlayerInformations')
            .selectAll()
            .execute();
          const playerInfoMap = new Map(playerInfoRows.map((r) => [r.Key, r]));

          // Extract turn contexts once per game (shared across all players)
          const turnContexts = await extractTurnContexts(gameDb);
          allTurns = new Set(turnContexts.keys());

          // Query victory type and compute max turn for game outcome metadata
          const victoryTypeRow = await gameDb
            .selectFrom('GameMetadata')
            .select('Value')
            .where('Key', '=', 'victoryType')
            .executeTakeFirst();
          const victoryType = victoryTypeRow?.Value ?? null;
          const maxTurn = allTurns.size > 0 ? Math.max(...allTurns) : 0;

          await writer.writeGameOutcome(entry.gameId, victoryPlayerId, victoryType, maxTurn);

          const existingPlayers = await writer.getProcessedPlayers(entry.gameId);

          // ---------------------------------------------------------------
          // Phase A: Extract + Transform + Write (no LLM calls)
          // ---------------------------------------------------------------
          for (const player of entry.players) {
            if (!force && existingPlayers.has(player.playerId)) {
              logger.info(`Skipping player ${player.playerId} (already processed)`);
              skipped++;
              continue;
            }

            try {
              const info = playerInfoMap.get(player.playerId);
              const civilization = info?.Civilization ?? 'Unknown';

              const rawEpisodes = await extractPlayerEpisodes(
                gameDb,
                player.telepathistDbPath, // reads existing summaries from prior runs if available
                player.playerId,
                civilization,
                turnContexts,
                entry.gameId,
                victoryPlayerId
              );

              logger.info(`Extracted ${rawEpisodes.length} raw episodes for player ${player.playerId}`);

              const episodes = rawEpisodes.map(raw => {
                const tc = turnContexts.get(raw.turn);
                if (!tc) throw new Error(`Missing TurnContext for turn ${raw.turn}`);
                return transformEpisode(raw, tc);
              });

              // In force mode, delete old rows before writing new ones
              if (force) {
                await writer.deletePlayerEpisodes(entry.gameId, player.playerId);
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
        } finally {
          await gameDb.destroy();
        }

        // ---------------------------------------------------------------
        // Phase B: Landmark selection (vectors only, no embeddings needed)
        // ---------------------------------------------------------------
        await selectLandmarks(writer, entry.gameId);

        gamesProcessed++;
      }

      // ---------------------------------------------------------------
      // Phase C: Generate summaries + embeddings for selected turns only
      // ---------------------------------------------------------------
      if (!skipTelepathist || !skipEmbeddings) {
        for (const player of entry.players) {
          try {
            const landmarkTurns = await writer.getLandmarkTurns(entry.gameId, player.playerId);
            if (landmarkTurns.length === 0) {
              logger.info(`No landmarks for player ${player.playerId}, skipping Phase C`);
              continue;
            }

            // Use game DB turns when available, otherwise query from DuckDB
            const playerTurns = allTurns ?? await writer.getPlayerTurns(entry.gameId, player.playerId);

            // Load existing summaries first so computeTargetTurns can snap to nearby ones
            const summaries = loadTurnSummaries(player.telepathistDbPath);
            const existingSummaryTurns = new Set(summaries.keys());
            const { targetTurns, landmarkSet } = computeTargetTurns(landmarkTurns, playerTurns, existingSummaryTurns);

            // Generate telepathist summaries for target turns only
            if (!skipTelepathist) {
              logger.info(`Player ${player.playerId}: generating summaries for ${targetTurns.length} turns (${landmarkTurns.length} landmarks + ${targetTurns.length - landmarkTurns.length} consequence)`);
              await prepareTelepathist(player.telemetryDbPath, entry.gameId, player.playerId, targetTurns, modelOverride);
            }

            // Build update records for turns that have summaries
            const updates: Array<{
              turn: number;
              abstract: string | null;
              situation: string | null;
              decisions: string | null;
              abstractEmbedding: number[] | null;
            }> = [];

            for (const turn of targetTurns) {
              const summary = summaries.get(turn);
              if (!summary) continue;
              updates.push({
                turn,
                abstract: summary.abstract ?? null,
                situation: summary.situation ?? null,
                decisions: summary.decisions ?? null,
                abstractEmbedding: null, // filled below if needed
              });
            }

            // Generate embeddings for landmark turns with abstracts
            if (!skipEmbeddings) {
              const landmarkUpdates = updates.filter(u => landmarkSet.has(u.turn) && u.abstract != null);
              if (landmarkUpdates.length > 0) {
                const embeddings = await generateEmbeddings(landmarkUpdates.map(u => u.abstract));
                for (let i = 0; i < landmarkUpdates.length; i++) {
                  landmarkUpdates[i].abstractEmbedding = embeddings[i];
                }
              }
            }

            if (updates.length > 0) {
              await writer.updateEpisodeTexts(entry.gameId, player.playerId, updates);
            }
          } catch (playerError) {
            logger.error(`Error in Phase C for player ${player.playerId} in game ${entry.gameId}`, {
              error: playerError instanceof Error ? { message: playerError.message, stack: playerError.stack } : playerError,
            });
          }
        }
      }
    } catch (error) {
      logger.error(`Error processing game ${entry.gameId}`, error);
      errors++;
    } finally {
      await writer.releaseGame(entry.gameId);
    }
  }

  // Step 4: Close and summarize
  await writer.close();

  logger.info('Archivist complete', {
    games: entries.length,
    processed,
    skipped,
    claimed,
    errors,
    output: outputPath,
  });

  // Step 5: Open DuckDB UI for result inspection
  if (!noUi) {
    logger.info('Starting DuckDB UI...');
    const uiInstance = await getEpisodeDbInstance(outputPath);
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
