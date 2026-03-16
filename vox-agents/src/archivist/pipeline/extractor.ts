/**
 * @module archivist/pipeline/extractor
 *
 * Reads game knowledge databases and telepathist databases to produce RawEpisode arrays.
 * Two main functions:
 * - extractTurnContexts: batch-queries all per-turn cross-player data once per game
 * - extractPlayerEpisodes: builds RawEpisode[] for a single player using the turn contexts
 */

import fs from 'node:fs';
import Database from 'better-sqlite3';
import { Kysely, type Selectable } from 'kysely';
import { createLogger } from '../../utils/logger.js';
import type {
  KnowledgeDatabase,
  TurnSummaryRecord,
  RawEpisode,
  TurnContext,
} from '../types.js';
import type {
  PlayerSummary,
  CityInformation,
  VictoryProgress,
  PlayerInformation,
} from '../../../../mcp-server/dist/knowledge/schema/index.js';
import {
  countPolicies,
  parseDiplomatics,
  aggregateCityYields,
  countMinorAllies,
  findLatestStrategy,
  extractAllVictoryProgress,
} from '../utils/game-data.js';

const logger = createLogger('ArchivistExtractor');

// ---------------------------------------------------------------------------
// Turn context extraction (once per game)
// ---------------------------------------------------------------------------

/**
 * Builds per-turn cross-player context by batch-querying the game knowledge database.
 * Called once per game and shared across all player extractions.
 *
 * @param gameDb - Kysely connection to the game knowledge database (with ParseJSONResultsPlugin)
 * @returns Map of turn number → TurnContext with all players' summaries, cities, and victory progress
 */
export async function extractTurnContexts(
  gameDb: Kysely<KnowledgeDatabase>
): Promise<Map<number, TurnContext>> {
  // 1. Query all PlayerInformations (immutable)
  const playerInfoRows = await gameDb
    .selectFrom('PlayerInformations')
    .selectAll()
    .execute();
  const playerInfos = new Map<number, Selectable<PlayerInformation>>();
  for (const row of playerInfoRows) {
    playerInfos.set(row.Key, row);
  }

  // 2. Query all PlayerSummaries — latest version per (Key, Turn)
  const summaryRows = await gameDb
    .selectFrom('PlayerSummaries')
    .selectAll()
    .where('ID', 'in',
      gameDb.selectFrom('PlayerSummaries')
        .select((eb) => eb.fn.max('ID').as('ID'))
        .groupBy(['Key', 'Turn'])
    )
    .execute();
  const summariesByTurn = new Map<number, Map<number, Selectable<PlayerSummary>>>();
  for (const row of summaryRows) {
    let turnMap = summariesByTurn.get(row.Turn);
    if (!turnMap) {
      turnMap = new Map();
      summariesByTurn.set(row.Turn, turnMap);
    }
    turnMap.set(row.Key, row);
  }

  // 3. Query all CityInformations — latest version per (Key, Turn)
  const cityRows = await gameDb
    .selectFrom('CityInformations')
    .selectAll()
    .where('ID', 'in',
      gameDb.selectFrom('CityInformations')
        .select((eb) => eb.fn.max('ID').as('ID'))
        .groupBy(['Key', 'Turn'])
    )
    .execute();
  const citiesByTurn = new Map<number, Selectable<CityInformation>[]>();
  for (const row of cityRows) {
    let arr = citiesByTurn.get(row.Turn);
    if (!arr) {
      arr = [];
      citiesByTurn.set(row.Turn, arr);
    }
    arr.push(row);
  }

  // 4. Query all VictoryProgress (Key=0 for global) — latest version per Turn
  const victoryRows = await gameDb
    .selectFrom('VictoryProgress')
    .selectAll()
    .where('Key', '=', 0)
    .where('ID', 'in',
      gameDb.selectFrom('VictoryProgress')
        .select((eb) => eb.fn.max('ID').as('ID'))
        .where('Key', '=', 0)
        .groupBy(['Key', 'Turn'])
    )
    .execute();
  const victoryByTurn = new Map<number, Selectable<VictoryProgress>>();
  for (const row of victoryRows) {
    victoryByTurn.set(row.Turn, row);
  }

  // 5. Assemble TurnContexts for all distinct turns
  const turnContexts = new Map<number, TurnContext>();
  for (const turn of summariesByTurn.keys()) {
    turnContexts.set(turn, {
      playerSummaries: summariesByTurn.get(turn)!,
      cityInformations: citiesByTurn.get(turn) ?? [],
      victoryProgress: victoryByTurn.get(turn) ?? null,
      playerInfos,
    });
  }

  logger.info(`Built turn contexts for ${turnContexts.size} turns`);
  return turnContexts;
}

// ---------------------------------------------------------------------------
// Per-player episode extraction
// ---------------------------------------------------------------------------

/**
 * Extracts raw episode data for a single player across all turns.
 *
 * @param gameDb - Kysely connection to the game knowledge database
 * @param telepathistDbPath - Path to the player's telepathist database (may not exist)
 * @param playerId - Player ID within the game
 * @param civilization - Civilization short description (e.g. "Rome") — used to match CityInformation.Owner
 * @param turnContexts - Pre-built turn contexts from extractTurnContexts()
 * @param gameId - Game identifier
 * @param victoryPlayerId - Player ID of the game winner (-1 if no winner)
 * @param agentTurns - Set of turns with agent execution trails (null = all turns eligible)
 * @returns Array of RawEpisode records, one per turn where the player has data
 */
export async function extractPlayerEpisodes(
  gameDb: Kysely<KnowledgeDatabase>,
  telepathistDbPath: string | null,
  playerId: number,
  civilization: string,
  turnContexts: Map<number, TurnContext>,
  gameId: string,
  victoryPlayerId: number,
  agentTurns?: Set<number> | null,
): Promise<RawEpisode[]> {
  // Load telepathist summaries (pass null to skip, e.g. in Phase A before summaries exist)
  const turnSummaries = telepathistDbPath ? loadTurnSummaries(telepathistDbPath) : new Map<number, TurnSummaryRecord>();

  // Query strategy changes for this player — latest version per Turn, sorted for binary search
  const strategyRows = await gameDb
    .selectFrom('StrategyChanges')
    .selectAll()
    .where('Key', '=', playerId)
    .where('ID', 'in',
      gameDb.selectFrom('StrategyChanges')
        .select((eb) => eb.fn.max('ID').as('ID'))
        .where('Key', '=', playerId)
        .groupBy(['Key', 'Turn'])
    )
    .orderBy('Turn', 'asc')
    .execute();

  // Build set of major civ names for relationship filtering
  const firstContext = turnContexts.values().next().value;
  const majorCivNames = new Set<string>();
  if (firstContext) {
    for (const [, info] of firstContext.playerInfos) {
      if (info.IsMajor === 1) {
        majorCivNames.add(info.Civilization);
      }
    }
  }

  const episodes: RawEpisode[] = [];

  for (const [turn, ctx] of turnContexts) {
    if (agentTurns && !agentTurns.has(turn)) continue;

    const summary = ctx.playerSummaries.get(playerId);
    if (!summary) continue; // Player not present at this turn

    // --- Identity ---
    const isWinner = playerId === victoryPlayerId;

    // --- Basic state ---
    const era = (summary.Era as string) ?? 'Unknown';
    const grandStrategy = findLatestStrategy(strategyRows, turn);

    // --- Diplomatic counts ---
    const diplomatics = parseDiplomatics(
      summary.Relationships as Record<string, string | string[]> | null,
      majorCivNames
    );

    // --- Raw values ---
    const score = (summary.Score as number) ?? null;
    const cities = (summary.Cities as number) ?? null;
    const population = (summary.Population as number) ?? null;
    const goldPerTurn = (summary.GoldPerTurn as number) ?? null;
    const culturePerTurn = (summary.CulturePerTurn as number) ?? null;
    const tourismPerTurn = (summary.TourismPerTurn as number) ?? null;
    const militaryStrength = (summary.MilitaryStrength as number) ?? null;
    const technologies = (summary.Technologies as number) ?? null;
    const votes = (summary.Votes as number) ?? null;
    const happinessPercentage = (summary.HappinessPercentage as number) ?? null;
    const militaryUnits = (summary.MilitaryUnits as number) ?? null;
    const militarySupply = (summary.MilitarySupply as number) ?? null;

    // --- City aggregates (production, food) ---
    const { productionPerTurn, foodPerTurn } = aggregateCityYields(
      ctx.cityInformations,
      civilization
    );

    // --- Policies count ---
    const policies = countPolicies(
      summary.PolicyBranches as Record<string, string[]> | null
    );

    // --- Minor allies count ---
    const minorAllies = countMinorAllies(ctx, civilization);

    // --- Victory progress ---
    const victory = extractAllVictoryProgress(ctx.victoryProgress, civilization);

    // --- Telepathist text ---
    const turnSummary = turnSummaries.get(turn);

    episodes.push({
      gameId,
      turn,
      playerId,
      civilization,
      isWinner,
      era,
      grandStrategy,
      ...diplomatics,
      score,
      cities,
      population,
      goldPerTurn,
      culturePerTurn,
      tourismPerTurn,
      militaryStrength,
      technologies,
      votes,
      happinessPercentage,
      productionPerTurn,
      foodPerTurn,
      policies,
      minorAllies,
      militaryUnits,
      militarySupply,
      ...victory,
      situationAbstract: turnSummary?.situationAbstract ?? null,
      decisionAbstract: turnSummary?.decisionAbstract ?? null,
      situation: turnSummary?.situation ?? null,
      decisions: turnSummary?.decisions ?? null,
    });
  }

  logger.info(`Extracted ${episodes.length} raw episodes for player ${playerId} in game ${gameId}`);
  return episodes;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns the set of turns that have agent execution spans in the telemetry DB.
 *  Returns null if the DB doesn't exist (caller should treat as "all turns eligible"). */
export function getAgentTurns(telemetryDbPath: string): Set<number> | null {
  if (!fs.existsSync(telemetryDbPath)) {
    logger.debug(`Telemetry DB not found: ${telemetryDbPath}`);
    return null;
  }

  let sqliteDb: InstanceType<typeof Database> | undefined;
  try {
    sqliteDb = new Database(telemetryDbPath, { readonly: true });
    const rows = sqliteDb.prepare(
      `SELECT DISTINCT turn FROM spans WHERE turn IS NOT NULL AND turn >= 0 AND name LIKE 'agent.%' AND name NOT LIKE '%.step.%'`
    ).all() as Array<{ turn: number }>;
    return new Set(rows.map(r => r.turn));
  } catch (error) {
    logger.warn(`Failed to read telemetry DB: ${telemetryDbPath}`, { error });
    return null;
  } finally {
    sqliteDb?.close();
  }
}

/** Load turn summaries from the telepathist database. Returns empty map if DB doesn't exist.
 *  When `turns` is provided, only loads summaries for those specific turns. */
export function loadTurnSummaries(dbPath: string, turns?: number[]): Map<number, TurnSummaryRecord> {
  const map = new Map<number, TurnSummaryRecord>();

  if (!fs.existsSync(dbPath)) {
    logger.debug(`Telepathist DB not found: ${dbPath}`);
    return map;
  }

  let sqliteDb: InstanceType<typeof Database> | undefined;
  try {
    sqliteDb = new Database(dbPath, { readonly: true });
    const rows = turns && turns.length > 0
      ? sqliteDb.prepare(`SELECT * FROM turn_summaries WHERE turn IN (${turns.map(() => '?').join(',')})`).all(...turns) as TurnSummaryRecord[]
      : sqliteDb.prepare('SELECT * FROM turn_summaries').all() as TurnSummaryRecord[];
    for (const row of rows) {
      map.set(row.turn, row);
    }
  } catch (error) {
    logger.warn(`Failed to read telepathist DB: ${dbPath}`, { error });
  } finally {
    sqliteDb?.close();
  }

  return map;
}
