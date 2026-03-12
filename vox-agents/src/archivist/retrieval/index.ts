/**
 * @module archivist/retrieval
 *
 * Barrel file for the runtime episode retrieval pathway.
 */

export { findEpisodes, closeReader } from './reader.js';
export { compositeSimilarity, cosineSimilarity, buildSimilaritySql, buildPairwiseSimilaritySql } from './similarity.js';
export type { VectorBundle } from './similarity.js';
