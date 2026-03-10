/**
 * @module archivist/selector
 *
 * Diversity-first landmark selection for episodes.
 * After all episodes for a game are written, selects a diverse subset per player
 * and marks them as landmarks (is_landmark = TRUE) for efficient retrieval.
 * Uses greedy max-marginal diversity with in-house TypeScript composite similarity.
 */

import { createLogger } from '../utils/logger.js';
import { landmarkWeights } from './types.js';
import { compositeSimilarity, type VectorBundle } from './similarity.js';
import type { EpisodeWriter } from './writer.js';

const logger = createLogger('Selector');

interface EpisodeCandidate {
  turn: number;
  playerId: number;
  vectors: VectorBundle;
}

/**
 * Select diverse landmark episodes for each player in a game independently.
 * Each player's episode trajectory is treated as a separate sequence.
 */
export async function selectLandmarks(writer: EpisodeWriter, gameId: string): Promise<void> {
  const rows = await writer.getGameEpisodeVectors(gameId);

  if (rows.length === 0) {
    logger.warn(`No episodes with vectors for game ${gameId}, skipping landmark selection`);
    return;
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

  for (const [playerId, candidates] of byPlayer) {
    const targetCount = Math.max(1, Math.min(candidates.length, Math.round(candidates.length / 10)));
    const selected = selectDiverse(candidates, targetCount);
    for (const idx of selected) {
      allKeys.push({ turn: candidates[idx].turn, playerId });
    }
  }

  await writer.markLandmarks(gameId, allKeys);

  logger.info(`Selected ${allKeys.length} landmarks for game ${gameId}`, {
    totalEpisodes: rows.length,
    players: byPlayer.size,
    perPlayer: [...byPlayer.entries()].map(([pid, eps]) => ({
      playerId: pid,
      episodes: eps.length,
      landmarks: allKeys.filter(k => k.playerId === pid).length,
    })),
  });
}

/**
 * Greedy max-min diversity selection on a single player's episode list.
 *
 * 1. Seed with episode closest to median turn
 * 2. Iteratively add the candidate most dissimilar from all already-selected
 * 3. Return selected indices
 */
function selectDiverse(candidates: EpisodeCandidate[], targetCount: number): Set<number> {
  // Seed: pick episode closest to the median turn
  const sortedTurns = [...new Set(candidates.map(c => c.turn))].sort((a, b) => a - b);
  const medianTurn = sortedTurns[Math.floor(sortedTurns.length / 2)];
  let seedIdx = 0;
  let minDist = Infinity;
  for (let i = 0; i < candidates.length; i++) {
    const dist = Math.abs(candidates[i].turn - medianTurn);
    if (dist < minDist) {
      minDist = dist;
      seedIdx = i;
    }
  }

  const selectedIndices = new Set<number>([seedIdx]);
  // Track maximum similarity to any selected episode for each candidate (nearest-neighbor)
  const maxSimToSelected = new Float64Array(candidates.length).fill(-Infinity);

  // Initialize min similarities from the seed
  for (let i = 0; i < candidates.length; i++) {
    if (i === seedIdx) continue;
    maxSimToSelected[i] = compositeSimilarity(
      candidates[i].vectors, candidates[seedIdx].vectors, landmarkWeights
    );
  }

  while (selectedIndices.size < targetCount) {
    // Find candidate with lowest max-similarity to selected (most diverse nearest-neighbor)
    let bestIdx = -1;
    let bestMaxSim = Infinity;
    for (let i = 0; i < candidates.length; i++) {
      if (selectedIndices.has(i)) continue;
      if (maxSimToSelected[i] < bestMaxSim) {
        bestMaxSim = maxSimToSelected[i];
        bestIdx = i;
      }
    }

    if (bestIdx === -1) break;
    selectedIndices.add(bestIdx);

    // Update max similarities with the newly selected episode
    for (let i = 0; i < candidates.length; i++) {
      if (selectedIndices.has(i)) continue;
      const sim = compositeSimilarity(
        candidates[i].vectors, candidates[bestIdx].vectors, landmarkWeights
      );
      if (sim > maxSimToSelected[i]) {
        maxSimToSelected[i] = sim;
      }
    }
  }

  return selectedIndices;
}
