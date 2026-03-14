/**
 * @module archivist
 *
 * Barrel file re-exporting the public API of the archivist module.
 * External consumers should import from this file to decouple from internal structure.
 */

// Types
export type {
  ArchiveEntry,
  PlayerEntry,
  RawEpisode,
  Episode,
  EpisodesDatabase,
  SimilarityWeights,
  TurnContext,
} from './types.js';
export {
  eraMap,
  horizons,
  horizonTolerance,
  retrievalWeights,
  retrievalNoEmbeddingWeights,
} from './types.js';
export { countPolicies } from './utils/game-data.js';

// Query types
export type {
  EpisodeQuery,
  EpisodeResult,
  OutcomeSnapshot,
  EpisodeDelta,
} from './query-types.js';

// Pipeline (batch processing)
export {
  scanArchive,
  openReadonlyGameDb,
  extractTurnContexts,
  extractPlayerEpisodes,
  loadTurnSummaries,
  transformEpisode,
  EpisodeWriter,
  selectLandmarks,
  generateEmbeddings,
  prepareTelepathist,
  computeTargetTurns,
  parseDiplomatics,
  extractAllVictoryProgress,
  extractVictoryProgress,
} from './pipeline/index.js';
export type {
  DiplomaticCounts,
  VictoryProgressResult,
  DistanceStats,
  PlayerLandmarkStats,
  LandmarkStats,
  WorkerStats,
} from './pipeline/index.js';

// Retrieval (runtime query)
export {
  findEpisodes,
  closeReader,
  compositeSimilarity,
  cosineSimilarity,
  buildSimilaritySql,
  buildPairwiseSimilaritySql,
} from './retrieval/index.js';
export type { VectorBundle } from './retrieval/index.js';

// Episode DB
export { getEpisodeDbInstance, getEpisodeDbConnection } from './episode-db.js';
