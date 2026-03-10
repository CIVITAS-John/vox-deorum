/**
 * @module archivist/extractor
 *
 * Reads game knowledge databases and telepathist databases to produce RawEpisode arrays.
 * Two main functions:
 * - extractTurnContexts: batch-queries all per-turn cross-player data once per game
 * - extractPlayerEpisodes: builds RawEpisode[] for a single player using the turn contexts
 */

import fs from 'node:fs';
import Database from 'better-sqlite3';
import { Kysely, SqliteDialect, ParseJSONResultsPlugin, type Selectable } from 'kysely';
import { createLogger } from '../utils/logger.js';
import type {
  KnowledgeDatabase,
  TelepathistDatabase,
  TurnSummaryRecord,
  RawEpisode,
  TurnContext,
} from './types.js';
import { countPolicies } from './types.js';
import type {
  PlayerSummary,
  CityInformation,
  VictoryProgress,
  PlayerInformation,
} from '../../../mcp-server/dist/knowledge/schema/index.js';

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
 * @returns Array of RawEpisode records, one per turn where the player has data
 */
export async function extractPlayerEpisodes(
  gameDb: Kysely<KnowledgeDatabase>,
  telepathistDbPath: string,
  playerId: number,
  civilization: string,
  turnContexts: Map<number, TurnContext>,
  gameId: string,
  victoryPlayerId: number
): Promise<RawEpisode[]> {
  // Load telepathist summaries (if DB exists)
  const turnSummaries = loadTurnSummaries(telepathistDbPath);

  // If telepathist was run but has no summary for the last turn, exclude it
  // (e.g. a victory termination turn with no agent activity)
  const lastTurn = turnSummaries.size > 0 ? Math.max(...turnContexts.keys()) : -1;
  const skipLastTurn = lastTurn >= 0 && !turnSummaries.has(lastTurn);
  if (skipLastTurn) {
    logger.info(`Will exclude terminal turn ${lastTurn} (no telepathist summary)`);
  }

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
    if (skipLastTurn && turn === lastTurn) continue;

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
    const sciencePerTurn = (summary.SciencePerTurn as number) ?? null;
    const culturePerTurn = (summary.CulturePerTurn as number) ?? null;
    const faithPerTurn = (summary.FaithPerTurn as number) ?? null;
    const tourismPerTurn = (summary.TourismPerTurn as number) ?? null;
    const militaryStrength = (summary.MilitaryStrength as number) ?? null;
    const technologies = (summary.Technologies as number) ?? null;
    const votes = (summary.Votes as number) ?? null;
    const happinessPercentage = (summary.HappinessPercentage as number) ?? null;

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
      sciencePerTurn,
      culturePerTurn,
      faithPerTurn,
      tourismPerTurn,
      militaryStrength,
      technologies,
      votes,
      happinessPercentage,
      productionPerTurn,
      foodPerTurn,
      policies,
      minorAllies,
      ...victory,
      abstract: turnSummary?.abstract ?? null,
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

/** Load turn summaries from the telepathist database. Returns empty map if DB doesn't exist. */
function loadTurnSummaries(dbPath: string): Map<number, TurnSummaryRecord> {
  const map = new Map<number, TurnSummaryRecord>();

  if (!fs.existsSync(dbPath)) {
    logger.debug(`Telepathist DB not found: ${dbPath}`);
    return map;
  }

  try {
    const sqliteDb = new Database(dbPath, { readonly: true });
    const db = new Kysely<TelepathistDatabase>({
      dialect: new SqliteDialect({ database: sqliteDb }),
    });

    // Synchronous approach: use the underlying better-sqlite3 directly
    const rows = sqliteDb.prepare('SELECT * FROM turn_summaries').all() as TurnSummaryRecord[];
    for (const row of rows) {
      map.set(row.turn, row);
    }

    sqliteDb.close();
  } catch (error) {
    logger.warn(`Failed to read telepathist DB: ${dbPath}`, { error });
  }

  return map;
}

/**
 * Find the latest grand strategy at or before the given turn.
 * Strategy rows must be sorted by Turn ascending.
 */
function findLatestStrategy(
  strategyRows: Array<{ Turn: number; GrandStrategy: string | null }>,
  turn: number
): string | null {
  let result: string | null = null;
  for (const row of strategyRows) {
    if (row.Turn > turn) break;
    result = row.GrandStrategy;
  }
  return result;
}

/** War weariness extraction regex */
export const WAR_WEARINESS_REGEX = /Our War Weariness: (\d+)%/;

/** Diplomatic count result */
export interface DiplomaticCounts {
  isVassal: number;
  activeWars: number;
  truces: number;
  defensivePacts: number;
  friends: number;
  denouncements: number;
  vassals: number;
  warWeariness: number;
}

/**
 * Parse diplomatic relationship counts from the Relationships JSON.
 * Only counts relationships with major civilizations.
 */
export function parseDiplomatics(
  relationships: Record<string, string | string[]> | null,
  majorCivNames: Set<string>
): DiplomaticCounts {
  const result: DiplomaticCounts = {
    isVassal: 0,
    activeWars: 0,
    truces: 0,
    defensivePacts: 0,
    friends: 0,
    denouncements: 0,
    vassals: 0,
    warWeariness: 0,
  };

  if (!relationships) return result;

  for (const [civName, statuses] of Object.entries(relationships)) {
    // Only count major civ relationships
    if (!majorCivNames.has(civName)) continue;

    const statusArray = Array.isArray(statuses) ? statuses : [statuses];
    let hasWar = false;

    for (const status of statusArray) {
      // War detection: "War (Our Score: ...)" — check for "War" followed by space or paren
      if (!hasWar && (status.startsWith('War ') || status === 'War')) {
        result.activeWars++;
        hasWar = true;
        // Extract war weariness
        const match = WAR_WEARINESS_REGEX.exec(status);
        if (match) {
          const weariness = parseInt(match[1], 10);
          if (weariness > result.warWeariness) {
            result.warWeariness = weariness;
          }
        }
      }
      if (status.includes('Peace Treaty')) result.truces++;
      if (status.includes('Defensive Pact')) result.defensivePacts++;
      if (status.includes('Declaration of Friendship')) result.friends++;
      if (status.includes('Denounced Them') || status.includes('Denounced By Them')) {
        result.denouncements++;
      }
      if (status.includes('Our Vassal')) result.vassals++;
      if (status.includes('Our Master')) result.isVassal = 1;
    }
  }

  return result;
}

/** Sum production and food per turn from cities owned by this player's civilization. */
function aggregateCityYields(
  cityInformations: Selectable<CityInformation>[],
  civilization: string
): { productionPerTurn: number | null; foodPerTurn: number | null } {
  let production = 0;
  let food = 0;
  let found = false;

  for (const city of cityInformations) {
    if (city.Owner === civilization) {
      found = true;
      production += (city.ProductionPerTurn as number) ?? 0;
      food += (city.FoodPerTurn as number) ?? 0;
    }
  }

  return {
    productionPerTurn: found ? production : null,
    foodPerTurn: found ? food : null,
  };
}

// countPolicies imported from types.ts (shared with transformer.ts and game-state-vector.ts)

/** Count minor civs allied to this player (where MajorAlly matches civilization name). */
function countMinorAllies(ctx: TurnContext, civilization: string): number | null {
  let count = 0;
  for (const [key, summary] of ctx.playerSummaries) {
    const info = ctx.playerInfos.get(key);
    if (!info || info.IsMajor === 1) continue; // Skip major civs
    if ((summary.MajorAlly as string) === civilization) {
      count++;
    }
  }
  return count;
}

/** Victory progress extraction result */
export interface VictoryProgressResult {
  dominationProgress: number | null;
  scienceProgress: number | null;
  cultureProgress: number | null;
  diplomaticProgress: number | null;
  dominationLeaderProgress: number | null;
  scienceLeaderProgress: number | null;
  cultureLeaderProgress: number | null;
  diplomaticLeaderProgress: number | null;
}

/**
 * Extract victory progress for a player from the VictoryProgress row.
 * Each victory type field can be a string (unavailable) or a JSON object with per-civ entries.
 */
export function extractAllVictoryProgress(
  victoryRow: Selectable<VictoryProgress> | null,
  civName: string
): VictoryProgressResult {
  const empty: VictoryProgressResult = {
    dominationProgress: null,
    scienceProgress: null,
    cultureProgress: null,
    diplomaticProgress: null,
    dominationLeaderProgress: null,
    scienceLeaderProgress: null,
    cultureLeaderProgress: null,
    diplomaticLeaderProgress: null,
  };

  if (!victoryRow) return empty;

  // Domination: CapitalsPercentage
  const dom = extractVictoryProgress(
    victoryRow.DominationVictory,
    civName,
    (entry) => (entry?.CapitalsPercentage as number) ?? null
  );

  // Science: PartsPercentage
  const sci = extractVictoryProgress(
    victoryRow.ScienceVictory,
    civName,
    (entry) => (entry?.PartsPercentage as number) ?? null
  );

  // Culture: InfluentialCivs / CivsNeeded * 100
  const cul = extractVictoryProgress(
    victoryRow.CulturalVictory,
    civName,
    (entry, obj) => {
      const influential = entry?.InfluentialCivs as number | undefined;
      if (influential == null) return null;
      const needed = (obj as Record<string, unknown>).CivsNeeded as number;
      if (!needed) return null;
      return (influential / needed) * 100;
    }
  );

  // Diplomatic: VictoryPercentage
  const dip = extractVictoryProgress(
    victoryRow.DiplomaticVictory,
    civName,
    (entry) => (entry?.VictoryPercentage as number) ?? null
  );

  return {
    dominationProgress: dom.progress,
    scienceProgress: sci.progress,
    cultureProgress: cul.progress,
    diplomaticProgress: dip.progress,
    dominationLeaderProgress: dom.leaderProgress,
    scienceLeaderProgress: sci.leaderProgress,
    cultureLeaderProgress: cul.leaderProgress,
    diplomaticLeaderProgress: dip.leaderProgress,
  };
}

/**
 * Extract player and leader progress from a single victory type field.
 * The field is either a string (unavailable) or a JSON object with:
 * - Per-civ entries keyed by civilization name
 * - A `Contender` field identifying the leader
 */
export function extractVictoryProgress(
  field: unknown,
  civName: string,
  getProgress: (entry: Record<string, unknown> | undefined, obj: unknown) => number | null
): { progress: number | null; leaderProgress: number | null } {
  if (typeof field === 'string' || field == null) {
    return { progress: null, leaderProgress: null };
  }

  const obj = field as Record<string, unknown>;
  const playerEntry = obj[civName] as Record<string, unknown> | undefined;
  const progress = getProgress(playerEntry, obj);

  const contender = obj.Contender as string | null;
  let leaderProgress: number | null = null;
  if (contender) {
    const leaderEntry = obj[contender] as Record<string, unknown> | undefined;
    leaderProgress = getProgress(leaderEntry, obj);
  }

  return { progress, leaderProgress };
}
