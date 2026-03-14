/**
 * @module archivist/retrieval
 *
 * Barrel file for the runtime episode retrieval pathway.
 */

export { findEpisodes, closeReader } from './reader.js';
export { compositeSimilarity, cosineSimilarity, buildSimilaritySql, buildPairwiseSimilaritySql } from '../utils/similarity.js';
export type { VectorBundle } from '../utils/similarity.js';
