/**
 * @module archivist/reader
 *
 * Singleton read-only DuckDB connection for the episode retrieval pipeline.
 * Implements a three-stage retrieval process:
 *   Stage 1 - Two-pass composite scoring (fuzzy attributes + vector similarity)
 *   Stage 2 - Outcome fetching at future horizons (5, 10, 15, 20 turns)
 *   Stage 3 - MMR diversity selection to reduce redundancy in final results
 */

import { DuckDBInstance, DuckDBConnection } from '@duckdb/node-api';
import { createLogger } from '../utils/logger.js';
import { buildSimilaritySql, buildPairwiseSimilaritySql, compositeSimilarity, type VectorBundle } from './similarity.js';
import { eraMap, retrievalWeights, retrievalNoEmbeddingWeights } from './types.js';
import { generateEmbeddings } from './embeddings.js';
import type { EpisodeQuery, EpisodeResult, OutcomeSnapshot, ShareDelta } from './query-types.js';

const logger = createLogger('Archivist:Reader');

// ---------------------------------------------------------------------------
// Singleton connection
// ---------------------------------------------------------------------------

let connection: DuckDBConnection | null = null;
let dbPath: string | null = null;

/** Get or create the singleton DuckDB connection from EPISODE_DB_PATH env var. */
async function getConnection(): Promise<DuckDBConnection> {
  if (connection) return connection;
  dbPath = process.env.EPISODE_DB_PATH ?? null;
  if (!dbPath) throw new Error('EPISODE_DB_PATH environment variable is not set');
  const instance = await DuckDBInstance.create(dbPath);
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
function rowsToObjects(result: any): Record<string, any>[] {
  const columnCount = result.columnCount;
  const names: string[] = [];
  for (let i = 0; i < columnCount; i++) {
    names.push(result.columnName(i));
  }
  return result.getRows().map((row: any) => {
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
  science_share: number | null;
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
  const weights = hasEmbedding ? retrievalWeights : retrievalNoEmbeddingWeights;
  const candidateLimit = query.candidateLimit ?? 20;

  // Build similarity SQL and replace parameter placeholders with literal arrays
  let similaritySql = buildSimilaritySql(weights, hasEmbedding);
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
      SELECT *,
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
      FROM episodes
      WHERE is_landmark = TRUE
        AND game_state_vector IS NOT NULL
      ORDER BY fuzzy_score DESC
      LIMIT 200
    )
    SELECT game_id, turn, player_id, civilization, era, grand_strategy, is_winner,
           abstract, situation, decisions,
           science_share, culture_share, gold_share, military_share, population_share, cities_share,
           active_wars, domination_progress, science_progress, culture_progress, diplomatic_progress,
           game_state_vector, neighbor_vector, abstract_embedding,
           ${similaritySql} AS score
    FROM candidates
    ORDER BY score DESC
    LIMIT ${candidateLimit}
  `;

  const result = await conn.run(sql);
  return rowsToObjects(result) as CandidateRow[];
}

// ---------------------------------------------------------------------------
// Stage 2: Fetch Outcomes
// ---------------------------------------------------------------------------

const HORIZONS = [5, 10, 15, 20] as const;

interface OutcomeRow {
  game_id: string;
  turn: number;
  player_id: number;
  horizon: number;
  situation: string | null;
  decisions: string | null;
  d_science: number | null;
  d_culture: number | null;
  d_gold: number | null;
  d_military: number | null;
  d_population: number | null;
  d_cities: number | null;
  d_domination: number | null;
  d_science_prog: number | null;
  d_culture_prog: number | null;
  d_diplomatic: number | null;
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
      c.science_share ?? 'NULL',
      c.culture_share ?? 'NULL',
      c.gold_share ?? 'NULL',
      c.military_share ?? 'NULL',
      c.population_share ?? 'NULL',
      c.cities_share ?? 'NULL',
      c.domination_progress ?? 'NULL',
      c.science_progress ?? 'NULL',
      c.culture_progress ?? 'NULL',
      c.diplomatic_progress ?? 'NULL',
    ];
    return `(${vals.join(', ')})`;
  }).join(',\n    ');

  // Build UNION ALL across all horizons
  const horizonQueries = HORIZONS.map(horizon => `
    SELECT e.game_id, e.turn, e.player_id, ${horizon} AS horizon,
           f.situation, f.decisions,
           f.science_share - e.science_share AS d_science,
           f.culture_share - e.culture_share AS d_culture,
           f.gold_share - e.gold_share AS d_gold,
           f.military_share - e.military_share AS d_military,
           f.population_share - e.population_share AS d_population,
           f.cities_share - e.cities_share AS d_cities,
           f.domination_progress - e.domination_progress AS d_domination,
           f.science_progress - e.science_progress AS d_science_prog,
           f.culture_progress - e.culture_progress AS d_culture_prog,
           f.diplomatic_progress - e.diplomatic_progress AS d_diplomatic
    FROM (VALUES ${candidateValues}) AS e(game_id, turn, player_id, science_share, culture_share, gold_share, military_share, population_share, cities_share, domination_progress, science_progress, culture_progress, diplomatic_progress)
    JOIN episodes f
      ON f.game_id = e.game_id AND f.player_id = e.player_id
      AND f.turn = e.turn + ${horizon}
  `);

  const sql = horizonQueries.join('\n    UNION ALL\n');
  const result = await conn.run(sql);
  const rows = rowsToObjects(result) as OutcomeRow[];

  // Group outcomes by candidate key
  const outcomeMap = new Map<string, OutcomeSnapshot[]>();
  for (const row of rows) {
    const key = `${row.game_id}|${row.turn}|${row.player_id}`;
    if (!outcomeMap.has(key)) {
      outcomeMap.set(key, []);
    }

    const deltas: ShareDelta = {
      scienceShare: formatDelta(row.d_science),
      cultureShare: formatDelta(row.d_culture),
      goldShare: formatDelta(row.d_gold),
      militaryShare: formatDelta(row.d_military),
      populationShare: formatDelta(row.d_population),
      citiesShare: formatDelta(row.d_cities),
      dominationProgress: formatDelta(row.d_domination),
      scienceProgress: formatDelta(row.d_science_prog),
      cultureProgress: formatDelta(row.d_culture_prog),
      diplomaticProgress: formatDelta(row.d_diplomatic),
    };

    outcomeMap.get(key)!.push({
      horizonTurns: row.horizon,
      situation: row.situation,
      decisions: row.horizon === 20 ? null : row.decisions,
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

  const weights = candidates[0].abstract_embedding
    ? retrievalWeights
    : retrievalNoEmbeddingWeights;

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
        const sim = compositeSimilarity(bundles[idx], bundles[selIdx], weights);
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
    similarity: candidate.score,
    abstract: candidate.abstract,
    situation: candidate.situation,
    decisions: candidate.decisions,
    outcomes,
    indicators: {
      scienceShare: candidate.science_share,
      cultureShare: candidate.culture_share,
      militaryShare: candidate.military_share,
      populationShare: candidate.population_share,
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

  // Stage 2: Fetch outcomes at future horizons
  logger.info('Stage 2: Fetching outcomes');
  const outcomeMap = await fetchOutcomes(conn, candidates);

  // Stage 3: MMR diversity selection
  logger.info(`Stage 3: Diversity selection (limit=${resultLimit})`);
  const selected = diversitySelect(candidates, resultLimit);
  logger.info(`Stage 3: Selected ${selected.length} episodes`);

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
