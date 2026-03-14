/**
 * @module archivist/retrieval/reader-utils
 *
 * Helper functions for the episode retrieval pipeline, split from reader.ts.
 * Includes SQL builders, formatters, result mappers, and MMR diversity selection.
 */

import { compositeSimilarity, type VectorBundle } from './similarity.js';
import { eraMap } from '../types.js';

/** Convert a JS number array to a DuckDB REAL[] literal for embedding in SQL. */
export function toRealArrayLiteral(arr: number[]): string {
  return `[${arr.join(',')}]::REAL[]`;
}

/** Format a numeric delta as a human-readable percentage string. */
export function formatDelta(delta: number | null): string | null {
  if (delta == null) return null;
  const pct = Math.round(Math.abs(delta * 100));
  if (delta > 0) return `+${pct}%`;
  if (delta < 0) return `-${pct}%`;
  return '0%';
}

/** Build a SQL CASE expression mapping era strings to ordinal values. */
export function buildEraCaseExpr(): string {
  const cases = Object.entries(eraMap)
    .map(([era, ord]) => `WHEN era = '${era}' THEN ${ord}`)
    .join(' ');
  return `CASE ${cases} ELSE 0 END`;
}

/** Escape single quotes for safe SQL string embedding. */
export function escapeSql(s: string): string {
  return s.replace(/'/g, "''");
}

/** Map DuckDB result rows to plain objects keyed by column name. */
export async function rowsToObjects(result: any): Promise<Record<string, any>[]> {
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

/** Compute relative delta: (future - base) / base, or null if base is zero/null. */
export function relativeDelta(base: number | null, future: number | null): number | null {
  if (base == null || future == null || base === 0) return null;
  return (future - base) / base;
}

/** Like relativeDelta but clamps base to at least 1 for per-pop metrics. */
export function relativePerPopDelta(base: number | null, future: number | null): number | null {
  if (base == null || future == null) return null;
  return (future - base) / Math.max(base, 1);
}

/** Candidate row from Stage 1 scoring */
export interface CandidateRow {
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
  culture_per_pop: number | null;
  gold_per_pop: number | null;
  tourism_share: number | null;
  military_share: number | null;
  population_share: number | null;
  cities_share: number | null;
  active_wars: number;
  truces: number;
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

/** MMR diversity selection on scored candidates. */
export function diversitySelect(
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

      // Major penalty for same game+player as any selected candidate
      for (const selIdx of selected) {
        if (candidates[idx].game_id === candidates[selIdx].game_id &&
            candidates[idx].player_id === candidates[selIdx].player_id) {
          maxSim = Math.max(maxSim, 1.5);
          break;
        }
      }

      // Gradual win/lose balance penalty
      let winners = 0;
      let losers = 0;
      for (const selIdx of selected) {
        if (candidates[selIdx].is_winner) winners++;
        else losers++;
      }
      const imbalance = candidates[idx].is_winner ? (winners - losers) : (losers - winners);
      if (imbalance > 0) maxSim += imbalance * 0.15;

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
