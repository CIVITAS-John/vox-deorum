/**
 * @module archivist/retrieval/reader
 *
 * Singleton read-only DuckDB connection for the episode retrieval pipeline.
 * Implements a three-stage retrieval process:
 *   Stage 1 - Two-pass composite scoring (fuzzy attributes + vector similarity)
 *   Stage 2 - Outcome fetching at future horizons (5, 10, 15, 20 turns)
 *   Stage 3 - MMR diversity selection to reduce redundancy in final results
 */

import { DuckDBConnection } from '@duckdb/node-api';
import { config } from '../../utils/config.js';
import { createLogger } from '../../utils/logger.js';
import { buildSimilaritySql } from './similarity.js';
import { eraMap, horizons, horizonTolerance } from '../types.js';
import { generateEmbeddings } from '../pipeline/embeddings.js';
import { getEpisodeDbInstance } from '../episode-db.js';
import type { EpisodeQuery, EpisodeResult, OutcomeSnapshot, EpisodeDelta } from '../query-types.js';
import {
  toRealArrayLiteral,
  formatDelta,
  buildEraCaseExpr,
  escapeSql,
  rowsToObjects,
  relativeDelta,
  relativePerPopDelta,
  diversitySelect,
  type CandidateRow,
} from './reader-utils.js';

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
// Stage 1: Two-Pass Composite Score
// ---------------------------------------------------------------------------

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
           culture_per_pop, gold_per_pop, tourism_share, military_share, population_share, cities_share,
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

interface FetchedEpisode {
  turn: number;
  situation: string | null;
  decisions: string | null;
  abstract: string | null;
  science_per_pop: number | null;
  faith_per_pop: number | null;
  production_per_pop: number | null;
  food_per_pop: number | null;
  culture_per_pop: number | null;
  gold_per_pop: number | null;
  tourism_share: number | null;
  military_share: number | null;
  population_share: number | null;
  cities_share: number | null;
}

async function fetchOutcomes(
  conn: DuckDBConnection,
  candidates: CandidateRow[]
): Promise<Map<string, OutcomeSnapshot[]>> {
  if (candidates.length === 0) return new Map();

  // Step 1: Collect all unique (game_id, player_id, target_turn) triples
  const targetTurns = new Set<string>();
  for (const c of candidates) {
    for (const h of horizons) {
      for (let offset = -horizonTolerance; offset <= horizonTolerance; offset++) {
        const t = c.turn + h + offset;
        if (t > c.turn) targetTurns.add(`('${escapeSql(c.game_id)}', ${c.player_id}, ${t})`);
      }
    }
  }

  // Step 2: Single flat query for all target turns
  const valuesList = [...targetTurns].join(',\n    ');
  const sql = `
    SELECT f.game_id, f.player_id, f.turn, f.situation, f.decisions, f.abstract,
           f.science_per_pop, f.faith_per_pop, f.production_per_pop, f.food_per_pop,
           f.culture_per_pop, f.gold_per_pop, f.tourism_share, f.military_share, f.population_share, f.cities_share
    FROM (VALUES ${valuesList}) AS t(game_id, player_id, turn)
    JOIN episodes f ON f.game_id = t.game_id AND f.player_id = t.player_id AND f.turn = t.turn
    WHERE f.situation IS NOT NULL OR f.abstract IS NOT NULL
  `;

  const result = await conn.run(sql);
  const rows = await rowsToObjects(result) as (FetchedEpisode & { game_id: string; player_id: number })[];

  // Index fetched episodes by (game_id, player_id, turn)
  const episodeIndex = new Map<string, FetchedEpisode>();
  for (const row of rows) {
    episodeIndex.set(`${row.game_id}|${row.player_id}|${row.turn}`, row);
  }

  // Step 3: Map results back to candidates and horizons
  const outcomeMap = new Map<string, OutcomeSnapshot[]>();
  for (const c of candidates) {
    const key = `${c.game_id}|${c.turn}|${c.player_id}`;
    const usedTurns = new Set<number>();
    const outcomes: OutcomeSnapshot[] = [];

    // Process horizons smallest-first so smaller horizons claim turns first
    for (const h of horizons) {
      const idealTurn = c.turn + h;

      // Find closest available episode within tolerance window
      let bestEp: FetchedEpisode | undefined;
      let bestDist = Infinity;
      for (let offset = -horizonTolerance; offset <= horizonTolerance; offset++) {
        const t = idealTurn + offset;
        if (t <= c.turn || usedTurns.has(t)) continue;
        const ep = episodeIndex.get(`${c.game_id}|${c.player_id}|${t}`);
        if (ep && Math.abs(offset) < bestDist) {
          bestDist = Math.abs(offset);
          bestEp = ep;
        }
      }

      if (!bestEp) continue;
      usedTurns.add(bestEp.turn);

      const actualHorizon = bestEp.turn - c.turn;
      const deltas: EpisodeDelta = {
        sciencePerPop: formatDelta(relativePerPopDelta(c.science_per_pop, bestEp.science_per_pop)),
        faithPerPop: formatDelta(relativePerPopDelta(c.faith_per_pop, bestEp.faith_per_pop)),
        productionPerPop: formatDelta(relativePerPopDelta(c.production_per_pop, bestEp.production_per_pop)),
        foodPerPop: formatDelta(relativePerPopDelta(c.food_per_pop, bestEp.food_per_pop)),
        culturePerPop: formatDelta(relativePerPopDelta(c.culture_per_pop, bestEp.culture_per_pop)),
        goldPerPop: formatDelta(relativePerPopDelta(c.gold_per_pop, bestEp.gold_per_pop)),
        tourismShare: formatDelta(relativeDelta(c.tourism_share, bestEp.tourism_share)),
        militaryShare: formatDelta(relativeDelta(c.military_share, bestEp.military_share)),
        populationShare: formatDelta(relativeDelta(c.population_share, bestEp.population_share)),
        citiesShare: formatDelta(relativeDelta(c.cities_share, bestEp.cities_share)),
      };

      outcomes.push({
        horizonTurns: actualHorizon,
        abstract: bestEp.abstract,
        decisions: actualHorizon >= 20 ? null : bestEp.decisions,
        deltas,
      });
    }

    if (outcomes.length > 0) {
      outcomes.sort((a, b) => a.horizonTurns - b.horizonTurns);
      outcomeMap.set(key, outcomes);
    }
  }

  return outcomeMap;
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
      culturePerPop: candidate.culture_per_pop,
      goldPerPop: candidate.gold_per_pop,
      tourismShare: candidate.tourism_share,
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
