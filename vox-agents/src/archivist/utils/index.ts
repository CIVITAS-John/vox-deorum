/**
 * @module archivist/utils
 *
 * Barrel file re-exporting all archivist utility functions.
 * Organized by domain: math, game data, vectors, similarity, and SQL.
 */

export {
  clamp,
  scaleShare,
  computeCityAdjustedShare,
  computeRawShare,
  computePerPop,
  computeGap,
  relativeDelta,
  relativePerPopDelta,
  formatDelta,
} from './math.js';

export {
  countPolicies,
  WAR_WEARINESS_REGEX,
  parseDiplomatics,
  aggregateCityYields,
  countMinorAllies,
  findLatestStrategy,
  extractAllVictoryProgress,
  extractVictoryProgress,
  detectIdeology,
  computeReligionPercentage,
} from './game-data.js';
export type { DiplomaticCounts, VictoryProgressResult } from './game-data.js';

export {
  parseDistance,
  parseStance,
  NEUTRAL_PAD,
  buildNeighborVector,
  buildGameStateVector,
} from './vectors.js';
export type { NeighborFeatures } from './vectors.js';

export {
  cosineSimilarity,
  compositeSimilarity,
  buildSimilaritySql,
  buildPairwiseSimilaritySql,
  diversitySelect,
} from './similarity.js';
export type { VectorBundle, CandidateRow } from './similarity.js';

export {
  toRealArrayLiteral,
  buildEraCaseExpr,
  escapeSql,
  rowsToObjects,
} from './sql.js';
