/**
 * @module archivist/pipeline
 *
 * Barrel file for the batch ETL pipeline (Phases A/B/C).
 */

export { scanArchive } from './scanner.js';
export { extractTurnContexts, extractPlayerEpisodes, loadTurnSummaries } from './extractor.js';
export { transformEpisode } from './transformer.js';
export { EpisodeWriter } from './writer.js';
export { selectLandmarks } from './selector.js';
export type { DistanceStats, PlayerLandmarkStats, LandmarkStats } from './selector.js';
export { generateEmbeddings } from './embeddings.js';
export { prepareTelepathist } from './telepathist-prep.js';
export { computeTargetTurns } from './target-turns.js';
export type { WorkerStats } from './target-turns.js';

// Re-export game data utils (used externally by game-state-vector.ts and archivist barrel)
export {
  parseDiplomatics,
  extractAllVictoryProgress,
  extractVictoryProgress,
  aggregateCityYields,
  countMinorAllies,
  findLatestStrategy,
  WAR_WEARINESS_REGEX,
} from '../utils/game-data.js';
export type { DiplomaticCounts, VictoryProgressResult } from '../utils/game-data.js';
