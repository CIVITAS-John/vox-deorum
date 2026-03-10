/**
 * @module archivist/similarity
 *
 * Composite similarity scoring for episode vectors.
 * Two pathways: in-house TypeScript for batch/pre-selection (selector.ts),
 * and DuckDB SQL expression builders for runtime retrieval (reader.ts).
 */

import type { SimilarityWeights } from './types.js';
import { retrievalWeights, retrievalNoEmbeddingWeights } from './types.js';

/** Vectorized input for similarity computation */
export interface VectorBundle {
  gameStateVector: number[];
  neighborVector: number[];
  embedding?: number[] | null;
}

/** Resolve default weights based on whether embeddings are available */
function defaultWeights(hasEmbedding: boolean): SimilarityWeights {
  return hasEmbedding ? retrievalWeights : retrievalNoEmbeddingWeights;
}

/** Compute cosine similarity between two equal-length vectors. Returns 0 for zero-magnitude vectors. */
export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Compute weighted composite similarity across game state, neighbor, and optional embedding vectors.
 * Defaults weights based on whether both bundles have embeddings.
 */
export function compositeSimilarity(
  a: VectorBundle,
  b: VectorBundle,
  weights: SimilarityWeights = defaultWeights(!!(a.embedding && b.embedding))
): number {
  let score = weights.gameState * cosineSimilarity(a.gameStateVector, b.gameStateVector)
    + weights.neighbor * cosineSimilarity(a.neighborVector, b.neighborVector);

  if (weights.embedding > 0 && a.embedding && b.embedding) {
    score += weights.embedding * cosineSimilarity(a.embedding, b.embedding);
  }

  return score;
}

/**
 * Build a SQL expression for composite similarity scoring against query parameters.
 * Uses DuckDB's list_cosine_similarity() for vector operations.
 * Parameters are referenced as $query_gs, $query_nb, $query_emb.
 * Defaults weights based on hasEmbedding.
 */
export function buildSimilaritySql(hasEmbedding: boolean, weights: SimilarityWeights = defaultWeights(hasEmbedding)): string {
  const parts: string[] = [
    `${weights.gameState} * list_cosine_similarity(game_state_vector, $query_gs)`,
    `${weights.neighbor} * list_cosine_similarity(neighbor_vector, $query_nb)`,
  ];

  if (hasEmbedding && weights.embedding > 0) {
    parts.push(
      `${weights.embedding} * COALESCE(list_cosine_similarity(abstract_embedding, $query_emb), 0)`
    );
  }

  return parts.join('\n    + ');
}

/**
 * Build a SQL expression for pairwise similarity between two candidate rows (a and b).
 * Used by reader.ts for MMR diversity selection within the candidate pool.
 * Defaults weights based on hasEmbedding.
 */
export function buildPairwiseSimilaritySql(hasEmbedding: boolean, weights: SimilarityWeights = defaultWeights(hasEmbedding)): string {
  const parts: string[] = [
    `${weights.gameState} * list_cosine_similarity(a.game_state_vector, b.game_state_vector)`,
    `${weights.neighbor} * list_cosine_similarity(a.neighbor_vector, b.neighbor_vector)`,
  ];

  if (hasEmbedding && weights.embedding > 0) {
    parts.push(
      `${weights.embedding} * COALESCE(list_cosine_similarity(a.abstract_embedding, b.abstract_embedding), 0)`
    );
  }

  return parts.join('\n    + ');
}
