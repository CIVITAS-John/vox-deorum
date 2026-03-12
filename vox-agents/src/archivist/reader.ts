/**
 * @module archivist/reader
 *
 * Singleton read-only DuckDB connection for the episode retrieval pipeline.
 * Implements a three-stage retrieval process:
 *   Stage 1 - Two-pass composite scoring (fuzzy attributes + vector similarity)
 *   Stage 2 - Outcome fetching at future horizons (5, 10, 15, 20 turns)
 *   Stage 3 - MMR diversity selection to reduce redundancy in final results
 */

import { DuckDBConnection } from '@duckdb/node-api';
import { config } from '../utils/config.js';
import { createLogger } from '../utils/logger.js';
import { buildSimilaritySql, compositeSimilarity, type VectorBundle } from './similarity.js';
import { eraMap, horizons, horizonTolerance } from './types.js';
import { generateEmbeddings } from './embeddings.js';
import { getEpisodeDbInstance } from './episode-db.js';
import type { EpisodeQuery, EpisodeResult, OutcomeSnapshot, EpisodeDelta } from './query-types.js';

const logger = createLogger('Archivist:Reader');

// ---------------------------------------------------------------------------
// Singleton connection
// ---------------------------------------------------------------------------

let connection: DuckDBConnection | null = null;
let dbPath: string | null = null;

/** Get or create the singleton DuckDB connection using the configured episode DB path. */
async function getConnection(): Promise<DuckDBConnection> {
  if (connection) return connection;
  dbPath = config.episodeDbPath;
  const instance = await getEpisodeDbInstance(dbPath);
  connection = await instance.connect();
  logger.info(`Connected to episode database: ${dbPath}`);
  return connection;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert a JS number array to a DuckDB REAL[] literal for embedding in SQL. */
function toRealArrayLiteral(arr: number[]): string {
  return `[${arr.join(',')}]::REAL[]`;
}

/** Format a numeric delta as a human-readable percentage string. */
function formatDelta(delta: number | null): string | null {
  if (delta == null) return null;
  const pct = Math.round(Math.abs(delta * 100));
  if (delta > 0) return `+${pct}%`;
  if (delta < 0) return `-${pct}%`;
  return '0%';
}

/** Build a SQL CASE expression mapping era strings to ordinal values. */
function buildEraCaseExpr(): string {
  const cases = Object.entries(eraMap)
    .map(([era, ord]) => `WHEN era = '${era}' THEN ${ord}`)
    .join(' ');
  return `CASE ${cases} ELSE 0 END`;
}

/** Escape single quotes for safe SQL string embedding. */
function escapeSql(s: string): string {
  return s.replace(/'/g, "''");
}

/** Map DuckDB result rows to plain objects keyed by column name. */
async function rowsToObjects(result: any): Promise<Record<string, any>[]> {
  const columnCount = result.columnCount;
  const names: string[] = [];
  for (let i = 0; i < columnCount; i++) {
    names.push(result.columnName(i));
  }
  const rows = await result.getRows();
  return rows.map((row: any) => {
    const obj: Record<string, any> = {};
    for (let i = 0; i < columnCount; i++) {
      obj[names[i]] = row[i];
    }
    return obj;
  });
}

// ---------------------------------------------------------------------------
// Stage 1: Two-Pass Composite Score
// ---------------------------------------------------------------------------

interface CandidateRow {
  game_id: string;
  turn: number;
  player_id: number;
  civilization: string;
  era: string;
  grand_strategy: string | null;
  is_winner: boolean;
  abstract: string | null;
  situation: string | null;
  decisions: string | null;
  science_per_pop: number | null;
  faith_per_pop: number | null;
  production_per_pop: number | null;
  food_per_pop: number | null;
  culture_share: number | null;
  gold_share: number | null;
  military_share: number | null;
  population_share: number | null;
  cities_share: number | null;
  active_wars: number;
  domination_progress: number | null;
  science_progress: number | null;
  culture_progress: number | null;
  diplomatic_progress: number | null;
  game_state_vector: number[];
  neighbor_vector: number[];
  abstract_embedding: number[] | null;
  victory_type: string | null;
  score: number;
}

async function fetchCandidates(
  conn: DuckDBConnection,
  query: EpisodeQuery,
  embeddingVector: number[] | null
): Promise<CandidateRow[]> {
  const eraCaseExpr = buildEraCaseExpr();
  const queryEraOrd = eraMap[query.era] ?? 0;
  const hasEmbedding = !!embeddingVector;
  const candidateLimit = query.candidateLimit ?? 20;

  // Build similarity SQL and replace parameter placeholders with literal arrays
  let similaritySql = buildSimilaritySql(hasEmbedding);
  similaritySql = similaritySql.replace(/\$query_gs/g, toRealArrayLiteral(query.gameStateVector));
  similaritySql = similaritySql.replace(/\$query_nb/g, toRealArrayLiteral(query.neighborVector));
  if (embeddingVector) {
    similaritySql = similaritySql.replace(/\$query_emb/g, toRealArrayLiteral(embeddingVector));
  }

  const civEscaped = escapeSql(query.civilization);
  const gsEscaped = query.grandStrategy ? escapeSql(query.grandStrategy) : '';
  const gsClause = query.grandStrategy
    ? `CASE WHEN grand_strategy = '${gsEscaped}' THEN 3 ELSE 0 END`
    : '0';

  const sql = `
    WITH candidates AS (
      SELECT ep.*, g.victory_type,
        8 * GREATEST(0, 1.0 - 0.5 * ABS(
            (${eraCaseExpr}) - ${queryEraOrd}
          ))
        + CASE WHEN civilization = '${civEscaped}' THEN 5 ELSE 0 END
        + ${gsClause}
        + 3 * GREATEST(0, 1.0 - 0.5 * ABS(active_wars - ${query.activeWars}))
        + 2 * GREATEST(0, 1.0 - 0.5 * ABS(friends - ${query.friends}))
        + 2 * GREATEST(0, 1.0 - 0.5 * ABS(defensive_pacts - ${query.defensivePacts}))
        + 2 * GREATEST(0, 1.0 - 0.5 * ABS(truces - ${query.truces}))
        + 2 * GREATEST(0, 1.0 - 0.5 * ABS(denouncements - ${query.denouncements}))
        AS fuzzy_score
      FROM episodes ep
      LEFT JOIN game_outcomes g ON g.game_id = ep.game_id
      WHERE is_landmark = TRUE
        AND game_state_vector IS NOT NULL
      ORDER BY fuzzy_score DESC
      LIMIT 200
    )
    SELECT game_id, turn, player_id, civilization, era, grand_strategy, is_winner,
           abstract, situation, decisions,
           science_per_pop, faith_per_pop, production_per_pop, food_per_pop,
           culture_share, gold_share, military_share, population_share, cities_share,
           active_wars, domination_progress, science_progress, culture_progress, diplomatic_progress,
           game_state_vector, neighbor_vector, abstract_embedding,
           victory_type,
           ${similaritySql} AS score
    FROM candidates
    WHERE score > 0.9
    ORDER BY score DESC
    LIMIT ${candidateLimit}
  `;

  const result = await conn.run(sql);
  return await rowsToObjects(result) as CandidateRow[];
}

// ---------------------------------------------------------------------------
// Stage 2: Fetch Outcomes
// ---------------------------------------------------------------------------

interface OutcomeRow {
  game_id: string;
  turn: number;
  player_id: number;
  actual_horizon: number;
  abstract: string | null;
  situation: string | null;
  decisions: string | null;
  d_science_pp: number | null;
  d_faith_pp: number | null;
  d_production_pp: number | null;
  d_food_pp: number | null;
  d_culture: number | null;
  d_gold: number | null;
  d_military: number | null;
  d_population: number | null;
  d_cities: number | null;
}

async function fetchOutcomes(
  conn: DuckDBConnection,
  candidates: CandidateRow[]
): Promise<Map<string, OutcomeSnapshot[]>> {
  if (candidates.length === 0) return new Map();

  // Build VALUES list from candidates
  const candidateValues = candidates.map(c => {
    const vals = [
      `'${escapeSql(c.game_id)}'`,
      c.turn,
      c.player_id,
      c.science_per_pop ?? 'NULL',
      c.faith_per_pop ?? 'NULL',
      c.production_per_pop ?? 'NULL',
      c.food_per_pop ?? 'NULL',
      c.culture_share ?? 'NULL',
      c.gold_share ?? 'NULL',
      c.military_share ?? 'NULL',
      c.population_share ?? 'NULL',
      c.cities_share ?? 'NULL',
    ];
    return `(${vals.join(', ')})`;
  }).join(',\n    ');

  // Build UNION ALL across all horizons with fuzzy window matching.
  // Each horizon searches within ±horizonTolerance turns for the nearest episode
  // with summary text, capping at game's max turn via game_outcomes.
  const horizonQueries = horizons.map(horizon => `
    SELECT e.game_id, e.turn, e.player_id, ${horizon} AS horizon,
           f.turn AS fetched_turn,
           f.situation, f.decisions, f.abstract,
           (f.science_per_pop - e.science_per_pop) / NULLIF(e.science_per_pop, 0) AS d_science_pp,
           (f.faith_per_pop - e.faith_per_pop) / NULLIF(e.faith_per_pop, 0) AS d_faith_pp,
           (f.production_per_pop - e.production_per_pop) / NULLIF(e.production_per_pop, 0) AS d_production_pp,
           (f.food_per_pop - e.food_per_pop) / NULLIF(e.food_per_pop, 0) AS d_food_pp,
           (f.culture_share - e.culture_share) / NULLIF(e.culture_share, 0) AS d_culture,
           (f.gold_share - e.gold_share) / NULLIF(e.gold_share, 0) AS d_gold,
           (f.military_share - e.military_share) / NULLIF(e.military_share, 0) AS d_military,
           (f.population_share - e.population_share) / NULLIF(e.population_share, 0) AS d_population,
           (f.cities_share - e.cities_share) / NULLIF(e.cities_share, 0) AS d_cities
    FROM (VALUES ${candidateValues}) AS e(game_id, turn, player_id, science_per_pop, faith_per_pop, production_per_pop, food_per_pop, culture_share, gold_share, military_share, population_share, cities_share)
    LEFT JOIN game_outcomes g ON g.game_id = e.game_id
    JOIN episodes f
      ON f.game_id = e.game_id AND f.player_id = e.player_id
      AND f.turn BETWEEN
        GREATEST(e.turn + 1, LEAST(e.turn + ${horizon}, COALESCE(g.max_turn, e.turn + ${horizon})) - ${horizonTolerance})
        AND LEAST(e.turn + ${horizon} + ${horizonTolerance}, COALESCE(g.max_turn, e.turn + ${horizon}))
      AND (f.situation IS NOT NULL OR f.abstract IS NOT NULL)
    WHERE f.turn > e.turn
  `);

  // Two-pass dedup:
  //   1. Pick closest turn per horizon (prefer nearest to ideal offset)
  //   2. If two horizons landed on the same turn, keep the smallest horizon
  const unionSql = horizonQueries.join('\n    UNION ALL\n');
  const sql = `
    WITH raw_outcomes AS (
      ${unionSql}
    ),
    closest_per_horizon AS (
      SELECT *,
        ROW_NUMBER() OVER (
          PARTITION BY game_id, turn, player_id, horizon
          ORDER BY ABS(fetched_turn - (turn + horizon)) ASC
        ) AS rn1
      FROM raw_outcomes
    ),
    deduped AS (
      SELECT *,
        ROW_NUMBER() OVER (
          PARTITION BY game_id, turn, player_id, fetched_turn
          ORDER BY horizon ASC
        ) AS rn2
      FROM closest_per_horizon
      WHERE rn1 = 1
    )
    SELECT game_id, turn, player_id, (fetched_turn - turn) AS actual_horizon, situation, decisions, abstract,
           d_science_pp, d_faith_pp, d_production_pp, d_food_pp,
           d_culture, d_gold, d_military, d_population, d_cities
    FROM deduped
    WHERE rn2 = 1
  `;

  const result = await conn.run(sql);
  const rows = await rowsToObjects(result) as OutcomeRow[];

  // Group outcomes by candidate key
  const outcomeMap = new Map<string, OutcomeSnapshot[]>();
  for (const row of rows) {
    const key = `${row.game_id}|${row.turn}|${row.player_id}`;
    if (!outcomeMap.has(key)) {
      outcomeMap.set(key, []);
    }

    const deltas: EpisodeDelta = {
      sciencePerPop: formatDelta(row.d_science_pp),
      faithPerPop: formatDelta(row.d_faith_pp),
      productionPerPop: formatDelta(row.d_production_pp),
      foodPerPop: formatDelta(row.d_food_pp),
      cultureShare: formatDelta(row.d_culture),
      goldShare: formatDelta(row.d_gold),
      militaryShare: formatDelta(row.d_military),
      populationShare: formatDelta(row.d_population),
      citiesShare: formatDelta(row.d_cities)
    };

    outcomeMap.get(key)!.push({
      horizonTurns: row.actual_horizon,
      abstract: row.abstract,
      decisions: row.actual_horizon >= 20 ? null : row.decisions,
      deltas,
    });
  }

  // Sort each candidate's outcomes by horizon
  for (const outcomes of outcomeMap.values()) {
    outcomes.sort((a, b) => a.horizonTurns - b.horizonTurns);
  }

  return outcomeMap;
}

// ---------------------------------------------------------------------------
// Stage 3: MMR Diversity Selection
// ---------------------------------------------------------------------------

function diversitySelect(
  candidates: CandidateRow[],
  resultLimit: number
): CandidateRow[] {
  if (candidates.length <= resultLimit) return candidates;

  const maxScore = candidates[0].score;
  if (maxScore === 0) return candidates.slice(0, resultLimit);

  // Build vector bundles for pairwise similarity
  const bundles: VectorBundle[] = candidates.map(c => ({
    gameStateVector: c.game_state_vector,
    neighborVector: c.neighbor_vector,
    embedding: c.abstract_embedding,
  }));

  const selected: number[] = [0]; // Start with top-scored candidate
  const remaining = new Set(candidates.map((_, i) => i));
  remaining.delete(0);

  while (selected.length < resultLimit && remaining.size > 0) {
    let bestIdx = -1;
    let bestMmr = -Infinity;

    for (const idx of remaining) {
      const normalizedScore = candidates[idx].score / maxScore;

      // Max similarity to any already-selected candidate
      let maxSim = -Infinity;
      for (const selIdx of selected) {
        const sim = compositeSimilarity(bundles[idx], bundles[selIdx]);
        if (sim > maxSim) maxSim = sim;
      }

      const mmr = 0.7 * normalizedScore - 0.3 * maxSim;
      if (mmr > bestMmr) {
        bestMmr = mmr;
        bestIdx = idx;
      }
    }

    if (bestIdx >= 0) {
      selected.push(bestIdx);
      remaining.delete(bestIdx);
    }
  }

  return selected.map(i => candidates[i]);
}

// ---------------------------------------------------------------------------
// Build EpisodeResult
// ---------------------------------------------------------------------------

function buildResult(
  candidate: CandidateRow,
  outcomes: OutcomeSnapshot[]
): EpisodeResult {
  return {
    gameId: candidate.game_id,
    turn: candidate.turn,
    civilization: candidate.civilization,
    era: candidate.era,
    grandStrategy: candidate.grand_strategy,
    isWinner: candidate.is_winner,
    victoryType: candidate.victory_type,
    similarity: candidate.score,
    abstract: candidate.abstract,
    situation: candidate.situation,
    decisions: candidate.decisions,
    outcomes,
    indicators: {
      sciencePerPop: candidate.science_per_pop,
      faithPerPop: candidate.faith_per_pop,
      productionPerPop: candidate.production_per_pop,
      foodPerPop: candidate.food_per_pop,
      cultureShare: candidate.culture_share,
      goldShare: candidate.gold_share,
      militaryShare: candidate.military_share,
      populationShare: candidate.population_share,
      citiesShare: candidate.cities_share,
      activeWars: candidate.active_wars,
      dominationProgress: candidate.domination_progress,
      scienceProgress: candidate.science_progress,
      cultureProgress: candidate.culture_progress,
      diplomaticProgress: candidate.diplomatic_progress,
    },
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Find episodes similar to the given query using a three-stage pipeline:
 * fuzzy attribute + vector similarity scoring, outcome fetching, and MMR diversity selection.
 */
export async function findEpisodes(query: EpisodeQuery): Promise<EpisodeResult[]> {
  const conn = await getConnection();
  const resultLimit = query.resultLimit ?? 5;

  // Generate embedding from abstract if provided
  let embeddingVector: number[] | null = null;
  if (query.abstract) {
    const embeddings = await generateEmbeddings([query.abstract]);
    embeddingVector = embeddings[0];
  }

  // Stage 1: Two-pass composite scoring
  logger.info(`Stage 1: Fetching candidates (limit=${query.candidateLimit ?? 20})`);
  const candidates = await fetchCandidates(conn, query, embeddingVector);
  logger.info(`Stage 1: Found ${candidates.length} candidates`);

  if (candidates.length === 0) return [];

  // Stage 2: MMR diversity selection
  logger.info(`Stage 2: Diversity selection (limit=${resultLimit})`);
  const selected = diversitySelect(candidates, resultLimit);
  logger.info(`Stage 2: Selected ${selected.length} episodes`);

  // Stage 3: Fetch outcomes at future horizons
  logger.info('Stage 3: Fetching outcomes');
  const outcomeMap = await fetchOutcomes(conn, selected);

  // Build final results
  return selected.map(candidate => {
    const key = `${candidate.game_id}|${candidate.turn}|${candidate.player_id}`;
    const outcomes = outcomeMap.get(key) ?? [];
    return buildResult(candidate, outcomes);
  });
}

/** Close the singleton DuckDB connection and reset state. */
export async function closeReader(): Promise<void> {
  if (connection) {
    connection.disconnectSync();
    connection = null;
    dbPath = null;
    logger.info('Reader connection closed');
  }
}
