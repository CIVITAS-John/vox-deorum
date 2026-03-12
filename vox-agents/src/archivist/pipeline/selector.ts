/**
 * @module archivist/pipeline/selector
 *
 * Diversity-first landmark selection for episodes.
 * After all episodes for a game are written, selects a diverse subset per player
 * and marks them as landmarks (is_landmark = TRUE) for efficient retrieval.
 * Uses greedy max-marginal diversity with in-house TypeScript composite similarity.
 */

import { createLogger } from '../../utils/logger.js';
import { compositeSimilarity, type VectorBundle } from '../retrieval/similarity.js';
import type { EpisodeWriter } from './writer.js';

const logger = createLogger('Selector');

/** Min/median/max of nearest-neighbor similarities collected during greedy selection. */
export interface DistanceStats {
  min: number;   // lowest nearest-neighbor sim (most diverse addition)
  median: number;
  max: number;   // highest nearest-neighbor sim (least diverse addition)
}

/** Per-player landmark selection summary. */
export interface PlayerLandmarkStats {
  playerId: number;
  episodes: number;
  landmarks: number;
  distances: DistanceStats | null;  // null when ≤1 landmark
}

/** Aggregate landmark stats for a game. */
export interface LandmarkStats {
  totalLandmarks: number;
  totalEpisodes: number;
  players: PlayerLandmarkStats[];
}

interface EpisodeCandidate {
  turn: number;
  playerId: number;
  vectors: VectorBundle;
}

/**
 * Select diverse landmark episodes for each player in a game independently.
 * Each player's episode trajectory is treated as a separate sequence.
 */
export async function selectLandmarks(writer: EpisodeWriter, gameId: string): Promise<LandmarkStats | null> {
  const rows = await writer.getGameEpisodeVectors(gameId);

  if (rows.length === 0) {
    logger.warn(`No episodes with vectors for game ${gameId}, skipping landmark selection`);
    return null;
  }

  // Group episodes by player
  const byPlayer = new Map<number, EpisodeCandidate[]>();
  for (const r of rows) {
    const candidate: EpisodeCandidate = {
      turn: r.turn,
      playerId: r.playerId,
      vectors: {
        gameStateVector: r.gameStateVector,
        neighborVector: r.neighborVector,
        embedding: r.abstractEmbedding,
      },
    };
    let list = byPlayer.get(r.playerId);
    if (!list) {
      list = [];
      byPlayer.set(r.playerId, list);
    }
    list.push(candidate);
  }

  // Select landmarks independently per player
  const allKeys: Array<{ turn: number; playerId: number }> = [];
  const playerStats: PlayerLandmarkStats[] = [];

  for (const [playerId, candidates] of byPlayer) {
    const targetCount = Math.max(1, Math.min(candidates.length, Math.round(candidates.length / 10)));
    const { indices, distances } = selectDiverse(candidates, targetCount);
    for (const idx of indices) {
      allKeys.push({ turn: candidates[idx].turn, playerId });
    }
    const landmarkCount = indices.size;
    playerStats.push({ playerId, episodes: candidates.length, landmarks: landmarkCount, distances });

    const distStr = distances
      ? `nn-similarity: min=${distances.min.toFixed(2)} median=${distances.median.toFixed(2)} max=${distances.max.toFixed(2)}`
      : 'nn-similarity: n/a';
    logger.info(`Player ${playerId}: ${landmarkCount} landmarks from ${candidates.length} episodes — ${distStr}`);
  }

  await writer.markLandmarks(gameId, allKeys);

  const stats: LandmarkStats = {
    totalLandmarks: allKeys.length,
    totalEpisodes: rows.length,
    players: playerStats,
  };

  logger.info(`Selected ${allKeys.length} landmarks for game ${gameId}`, {
    totalEpisodes: rows.length,
    players: byPlayer.size,
  });

  return stats;
}

/**
 * Greedy max-min diversity selection on a single player's episode list.
 *
 * 1. Seed with an episode farthest from the centroid
 * 2. Iteratively add the candidate most dissimilar from all already-selected
 * 3. Return selected indices
 */
function selectDiverse(candidates: EpisodeCandidate[], targetCount: number): { indices: Set<number>; distances: DistanceStats | null } {
  const n = candidates.length;

  // Lazy pairwise similarity cache using flat typed arrays
  const simCache = new Float64Array(n * n);
  const computed = new Uint8Array(n * n);

  /** Return cached similarity or compute, store symmetrically, and return. */
  function getSim(i: number, j: number): number {
    const key = i * n + j;
    if (computed[key]) return simCache[key];
    const val = compositeSimilarity(candidates[i].vectors, candidates[j].vectors);
    simCache[key] = val;
    simCache[j * n + i] = val;
    computed[key] = 1;
    computed[j * n + i] = 1;
    return val;
  }

  // Seed: pick episode farthest from the centroid (most distinctive game state)
  const gsLen = candidates[0].vectors.gameStateVector.length;
  const nbLen = candidates[0].vectors.neighborVector.length;
  const centroidGs = new Array<number>(gsLen).fill(0);
  const centroidNb = new Array<number>(nbLen).fill(0);
  for (let i = 0; i < n; i++) {
    const gs = candidates[i].vectors.gameStateVector;
    const nb = candidates[i].vectors.neighborVector;
    for (let j = 0; j < gsLen; j++) centroidGs[j] += gs[j];
    for (let j = 0; j < nbLen; j++) centroidNb[j] += nb[j];
  }
  for (let j = 0; j < gsLen; j++) centroidGs[j] /= n;
  for (let j = 0; j < nbLen; j++) centroidNb[j] /= n;
  const centroid: VectorBundle = { gameStateVector: centroidGs, neighborVector: centroidNb };

  let seedIdx = 0;
  let minSim = Infinity;
  for (let i = 0; i < n; i++) {
    const sim = compositeSimilarity(candidates[i].vectors, centroid);
    if (sim < minSim) {
      minSim = sim;
      seedIdx = i;
    }
  }

  const selectedIndices = new Set<number>([seedIdx]);
  // Track maximum similarity to any selected episode for each candidate (nearest-neighbor)
  const maxSimToSelected = new Float64Array(n).fill(-Infinity);
  // Collect nearest-neighbor similarities for each greedy addition
  const nearestNeighborSims: number[] = [];

  // Initialize min similarities from the seed
  for (let i = 0; i < n; i++) {
    if (i === seedIdx) continue;
    maxSimToSelected[i] = getSim(i, seedIdx);
  }

  while (selectedIndices.size < targetCount) {
    // Find candidate with lowest max-similarity to selected (most diverse nearest-neighbor)
    let bestIdx = -1;
    let bestMaxSim = Infinity;
    for (let i = 0; i < n; i++) {
      if (selectedIndices.has(i)) continue;
      if (maxSimToSelected[i] < bestMaxSim) {
        bestMaxSim = maxSimToSelected[i];
        bestIdx = i;
      }
    }

    // Landmarks must have a max similarity > 0.9
    if (bestIdx === -1 || bestMaxSim > 0.9) break;
    selectedIndices.add(bestIdx);
    nearestNeighborSims.push(bestMaxSim);

    // Update max similarities with the newly selected episode
    for (let i = 0; i < n; i++) {
      if (selectedIndices.has(i)) continue;
      const sim = getSim(i, bestIdx);
      if (sim > maxSimToSelected[i]) {
        maxSimToSelected[i] = sim;
      }
    }
  }

  // Compute distance stats from collected nearest-neighbor similarities
  let distances: DistanceStats | null = null;
  if (nearestNeighborSims.length > 0) {
    nearestNeighborSims.sort((a, b) => a - b);
    const len = nearestNeighborSims.length;
    const median = len % 2 === 1
      ? nearestNeighborSims[Math.floor(len / 2)]
      : (nearestNeighborSims[len / 2 - 1] + nearestNeighborSims[len / 2]) / 2;
    distances = {
      min: nearestNeighborSims[0],
      median,
      max: nearestNeighborSims[len - 1],
    };
  }

  return { indices: selectedIndices, distances };
}
