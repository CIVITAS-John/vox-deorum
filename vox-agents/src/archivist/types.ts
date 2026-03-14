/**
 * @module archivist/types
 *
 * Strong-typed interfaces and shared constants for the archivist pipeline.
 * The archivist processes archived Civ 5 game databases into a DuckDB episodes table,
 * where each row represents one player-turn snapshot for LLM-controlled players.
 * Types defined here are shared across scanner, extractor, transformer, writer,
 * similarity, selector, and reader modules.
 */

import type { Selectable } from 'kysely';
import type {
  KnowledgeDatabase,
  PlayerSummary,
  CityInformation,
  VictoryProgress,
  PlayerInformation,
} from '../../../mcp-server/dist/knowledge/schema/index.js';
import type { TelepathistDatabase, TurnSummaryRecord } from '../telepathist/telepathist-parameters.js';

// Re-export imported types for convenience within the archivist pipeline
export type { KnowledgeDatabase, TelepathistDatabase, TurnSummaryRecord };

/** An archived game entry discovered by the scanner */
export interface ArchiveEntry {
  /** Experiment subdirectory name */
  experiment: string;
  /** Unique game identifier extracted from the DB filename */
  gameId: string;
  /** Absolute path to the game knowledge database */
  gameDbPath: string;
  /** LLM-controlled players found for this game */
  players: PlayerEntry[];
}

/** A single LLM-controlled player within an archived game */
export interface PlayerEntry {
  /** Player ID (matches PlayerSummaries.Key) */
  playerId: number;
  /** Absolute path to the telemetry database */
  telemetryDbPath: string;
  /** Absolute path to the telepathist database (may not exist yet) */
  telepathistDbPath: string;
}

/** Raw episode data extracted directly from source databases (non-computed columns) */
export interface RawEpisode {
  // Identity
  gameId: string;
  turn: number;
  playerId: number;
  civilization: string;
  isWinner: boolean;

  // Basic state
  era: string;
  grandStrategy: string | null;

  // Diplomatic counts
  isVassal: number;
  activeWars: number;
  truces: number;
  defensivePacts: number;
  friends: number;
  denouncements: number;
  vassals: number;
  warWeariness: number;

  // Raw values (nullable because data may be missing)
  score: number | null;
  cities: number | null;
  population: number | null;
  goldPerTurn: number | null;
  culturePerTurn: number | null;
  tourismPerTurn: number | null;
  militaryStrength: number | null;
  technologies: number | null;
  votes: number | null;
  happinessPercentage: number | null;
  productionPerTurn: number | null;
  foodPerTurn: number | null;
  policies: number | null;
  minorAllies: number | null;
  militaryUnits: number | null;
  militarySupply: number | null;

  // Victory progress (nullable when victory type unavailable)
  dominationProgress: number | null;
  scienceProgress: number | null;
  cultureProgress: number | null;
  diplomaticProgress: number | null;
  dominationLeaderProgress: number | null;
  scienceLeaderProgress: number | null;
  cultureLeaderProgress: number | null;
  diplomaticLeaderProgress: number | null;

  // Telepathist text (nullable when summaries not yet generated)
  situationAbstract: string | null;
  decisionAbstract: string | null;
  situation: string | null;
  decisions: string | null;
}

/** Full episode with computed fields added by the transformer */
export interface Episode extends RawEpisode {
  // City-adjusted shares (nullable when source data missing)
  tourismShare: number | null;
  militaryShare: number | null;
  citiesShare: number | null;
  populationShare: number | null;
  votesShare: number | null;
  minorAlliesShare: number | null;

  // Per-population metrics (raw ratio: metric / population)
  sciencePerPop: number | null;
  faithPerPop: number | null;
  productionPerPop: number | null;
  foodPerPop: number | null;
  culturePerPop: number | null;
  goldPerPop: number | null;

  // Bidirectional gap values (bestOther - player). Negative = leading, positive = behind.
  technologiesGap: number;
  policiesGap: number;

  // Derived percentages
  supplyUtilization: number | null;
  religionPercentage: number;
  ideologyAllies: number;
  ideologyShare: number;

  // Feature vectors for similarity computation
  gameStateVector: number[];
  neighborVector: number[];
  situationAbstractEmbedding: number[] | null;

  // Landmark flag set by the diversity-first selector
  isLandmark: boolean;
}

/** Kysely database interface for the DuckDB episodes table */
export interface EpisodesDatabase {
  episodes: Episode;
}

/** Weight configuration for composite similarity scoring */
export interface SimilarityWeights {
  gameState: number;
  neighbor: number;
  embedding: number;
}

/** Per-turn cross-player context used during extraction and transformation */
export interface TurnContext {
  /** All alive major players' summaries for this turn, keyed by player ID */
  playerSummaries: Map<number, Selectable<PlayerSummary>>;
  /** All city informations for this turn (all players, major + minor) */
  cityInformations: Selectable<CityInformation>[];
  /** Global victory progress for this turn (null if not available) */
  victoryProgress: Selectable<VictoryProgress> | null;
  /** Player information (immutable) keyed by player ID */
  playerInfos: Map<number, Selectable<PlayerInformation>>;
  /** Total number of major players in the game (for share scaling when only partial players are known) */
  totalMajors?: number;
}

// ---------------------------------------------------------------------------
// Shared constants
// ---------------------------------------------------------------------------

/** Maps era display strings to ordinal values (0-7) for vector normalization */
export const eraMap: Record<string, number> = {
  'Ancient Era': 0,
  'Classical Era': 1,
  'Medieval Era': 2,
  'Renaissance Era': 3,
  'Industrial Era': 4,
  'Modern Era': 5,
  'Atomic Era': 6,
  'Information Era': 7,
};

/** Maps grand strategy names to numeric codes for vector normalization */
export const grandStrategyMap: Record<string, number> = {
  'Conquest': 1,
  'Culture': 2,
  'United Nations': 3,
  'Spaceship': 4,
};

/** Maps numeric Civ 5 VictoryType IDs to display strings */
export const victoryTypeMap: Record<number, string> = {
  0: 'Time',
  1: 'Science',
  2: 'Domination',
  3: 'Cultural',
  4: 'Diplomatic',
};

/** Consequence turn offsets for outcome fetching in the reader pipeline */
export const horizons = [5, 10, 20, 30] as const;

/** Maximum turn distance for snapping a consequence turn to a nearby existing summary */
export const horizonTolerance = 1;

/** Weights for runtime retrieval with abstract embedding available */
export const retrievalWeights: SimilarityWeights = {
  gameState: 0.4,
  neighbor: 0.3,
  embedding: 0.3,
};

/** Weights for runtime retrieval without abstract embedding */
export const retrievalNoEmbeddingWeights: SimilarityWeights = {
  gameState: 0.6,
  neighbor: 0.4,
  embedding: 0,
};
