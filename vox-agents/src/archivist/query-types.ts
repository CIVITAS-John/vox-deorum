/**
 * @module archivist/query-types
 *
 * Interfaces for the episode retrieval pipeline.
 * EpisodeQuery is the sole input; EpisodeResult is the output with attached outcomes.
 */

/** The ONLY input to the retrieval pipeline */
export interface EpisodeQuery {
  gameStateVector: number[];     // 35d
  neighborVector: number[];      // 32d
  abstract?: string;             // optional — pipeline generates embedding when provided

  // Current state for fuzzy attribute scoring in SQL
  era: string;                   // proximity-scored (neighboring eras get partial credit)
  civilization: string;
  grandStrategy: string | null;
  activeWars: number;            // proximity-scored (±1 = half credit)
  friends: number;               // proximity-scored (±1 = half credit)
  defensivePacts: number;        // proximity-scored (±1 = half credit)
  truces: number;                // proximity-scored (±1 = half credit)
  denouncements: number;         // proximity-scored (±1 = half credit)

  candidateLimit?: number;       // pre-diversity pool (default 20)
  resultLimit?: number;          // final count (default 5)
}

/** Outcome snapshot at a future horizon */
export interface OutcomeSnapshot {
  horizonTurns: number;          // 5, 10, 15, or 20
  abstract: string | null;
  decisions: string | null;      // null for horizon=20
  deltas: EpisodeDelta;
}

/** Quantitative deltas as formatted strings */
export interface EpisodeDelta {
  sciencePerPop: string | null;      // "+3" or "-1" (per-pop ratio change)
  faithPerPop: string | null;
  productionPerPop: string | null;
  foodPerPop: string | null;
  cultureShare: string | null;       // "+3%" or "-1%" (share change)
  goldShare: string | null;
  militaryShare: string | null;
  populationShare: string | null;
  citiesShare: string | null;
}

/** A retrieved episode with outcomes */
export interface EpisodeResult {
  gameId: string;
  turn: number;
  civilization: string;
  era: string;
  grandStrategy: string | null;
  isWinner: boolean;
  similarity: number;
  abstract: string | null;
  situation: string | null;
  decisions: string | null;
  outcomes: OutcomeSnapshot[];   // 0-4 (fewer if game ended early)
  indicators: {
    sciencePerPop: number | null;
    cultureShare: number | null;
    militaryShare: number | null;
    populationShare: number | null;
    activeWars: number;
    dominationProgress: number | null;
    scienceProgress: number | null;
    cultureProgress: number | null;
    diplomaticProgress: number | null;
  };
}
