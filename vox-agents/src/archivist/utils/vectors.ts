/**
 * @module archivist/utils/vectors
 *
 * Feature vector construction for the archivist pipeline.
 * Builds the 32-element game state vector and 32-element neighbor vector
 * used for similarity search and diversity selection.
 */

import type { Selectable } from 'kysely';
import type { PlayerSummary } from '../../../../mcp-server/dist/knowledge/schema/index.js';
import type { Episode, TurnContext } from '../types.js';
import { eraMap, grandStrategyMap } from '../types.js';
import { clamp } from './math.js';
import { countPolicies } from './game-data.js';

// ---------------------------------------------------------------------------
// Neighbor vector helpers
// ---------------------------------------------------------------------------

/** Distance rank: lower = closer. */
export function parseDistance(statuses: string[]): number {
  for (const s of statuses) {
    if (s.includes('Distance: Neighbors')) return 0;
    if (s.includes('Distance: Close')) return 1;
    if (s.includes('Distance: Far')) return 2;
    if (s.includes('Distance: Distant')) return 3;
  }
  return 3; // default: distant
}

/** Parse stance from relationship status strings. Higher = more hostile. */
export function parseStance(statuses: string[]): number {
  let stance = 2; // default: neutral
  for (const s of statuses) {
    if (s.startsWith('War ') || s === 'War') return 4;
    if (s.includes('Denounced') || s.includes('Our Master')) {
      if (stance < 3) stance = 3;
    }
    if (s.includes('Declaration of Friendship') || s.includes('Our Vassal')) {
      if (stance > 1) stance = 1;
    }
    if (s.includes('Defensive Pact')) {
      stance = 0;
    }
  }
  return stance;
}

export interface NeighborFeatures {
  distanceRank: number;
  strengthRatio: number;
  stanceNorm: number;
  techGap: number;
  policyGap: number;
}

export const NEUTRAL_PAD: [number, number, number, number] = [0.2, 0.5, 0.5, 0.5];

/**
 * Build the 32-element neighbor vector.
 * 8 slots × 4 features. Sorted by distance rank first, then strength_ratio descending.
 */
export function buildNeighborVector(
  playerSummary: Selectable<PlayerSummary>,
  turnContext: TurnContext,
  civToPlayerId: Map<string, number>,
  playerTech: number | null,
  playerPolicies: number | null,
  playerMilitary: number | null
): number[] {
  const relationships = playerSummary.Relationships as Record<string, string | string[]> | null;
  if (!relationships) {
    return Array(32).fill(0).map((_, i) => NEUTRAL_PAD[i % 4]);
  }

  const safeMilitary = (playerMilitary != null && playerMilitary > 0) ? playerMilitary : 1;
  const neighbors: NeighborFeatures[] = [];

  for (const [civName, statuses] of Object.entries(relationships)) {
    const statusArray = Array.isArray(statuses) ? statuses : [statuses];

    // Only major civs
    const neighborPid = civToPlayerId.get(civName);
    if (neighborPid == null) continue;
    const neighborInfo = turnContext.playerInfos.get(neighborPid);
    if (!neighborInfo || neighborInfo.IsMajor !== 1) continue;

    const distanceRank = parseDistance(statusArray);
    const stance = parseStance(statusArray);

    // Filter: only Neighbors (0) and Close (1)
    if (distanceRank > 1) continue;

    const neighborSummary = turnContext.playerSummaries.get(neighborPid);
    if (!neighborSummary) continue;

    const nMilitary = (neighborSummary.MilitaryStrength as number) ?? 0;
    const nTech = (neighborSummary.Technologies as number) ?? 0;
    const nPolicies = countPolicies(neighborSummary.PolicyBranches as Record<string, string[]> | null) ?? 0;

    const rawRatio = nMilitary / safeMilitary;
    const strengthRatio = clamp(rawRatio, 0, 5) / 5;
    const stanceNorm = stance / 4;
    const techGap = clamp((nTech - (playerTech ?? 0)) / 20 + 0.5, 0, 1);
    const policyGap = clamp((nPolicies - (playerPolicies ?? 0)) / 10 + 0.5, 0, 1);

    neighbors.push({ distanceRank, strengthRatio, stanceNorm, techGap, policyGap });
  }

  // Sort by distance rank ascending, then strength ratio descending
  neighbors.sort((a, b) => {
    if (a.distanceRank !== b.distanceRank) return a.distanceRank - b.distanceRank;
    return b.strengthRatio - a.strengthRatio;
  });

  // Build 32-element vector: 8 slots × 4 features
  const vector: number[] = [];
  for (let i = 0; i < 8; i++) {
    if (i < neighbors.length) {
      const n = neighbors[i];
      vector.push(n.strengthRatio, n.stanceNorm, n.techGap, n.policyGap);
    } else {
      vector.push(...NEUTRAL_PAD);
    }
  }
  return vector;
}

// ---------------------------------------------------------------------------
// Game state vector
// ---------------------------------------------------------------------------

/** Build the 32-element game state vector from computed Episode fields. */
export function buildGameStateVector(
  ep: Omit<Episode, 'gameStateVector' | 'neighborVector' | 'situationAbstractEmbedding' | 'isLandmark'>
): number[] {
  const eraOrdinal = eraMap[ep.era] ?? 0;
  const gsOrdinal = (ep.grandStrategy ? grandStrategyMap[ep.grandStrategy] : 0) ?? 0;

  return [
    eraOrdinal / 8,                                                    // [0]
    gsOrdinal / 4,                                                     // [1]
    // --- Shares (city-adjusted, 6 elements) ---
    ep.tourismShare ?? 0,                                              // [2]
    ep.militaryShare ?? 0,                                             // [3]
    ep.citiesShare ?? 0,                                               // [4]
    ep.populationShare ?? 0,                                           // [5]
    ep.votesShare ?? 0,                                                // [6]
    ep.minorAlliesShare ?? 0,                                          // [7]
    // --- Per-pop metrics (6 elements, clamped [1, 10] → [0, 1]) ---
    (clamp(ep.sciencePerPop ?? 1, 1, 10) - 1) / 9,                    // [8]
    (clamp(ep.faithPerPop ?? 1, 1, 10) - 1) / 9,                      // [9]
    (clamp(ep.productionPerPop ?? 1, 1, 10) - 1) / 9,                 // [10]
    (clamp(ep.foodPerPop ?? 1, 1, 10) - 1) / 9,                       // [11]
    (clamp(ep.culturePerPop ?? 1, 1, 10) - 1) / 9,                    // [12]
    (clamp(ep.goldPerPop ?? 1, 1, 10) - 1) / 9,                       // [13]
    // --- Bidirectional gaps (negative = leading, positive = behind) ---
    clamp(ep.technologiesGap / 20 + 0.5, 0, 1),                       // [14]  range [-10, +10]
    clamp(ep.policiesGap / 10 + 0.5, 0, 1),                           // [15]  range [-5, +5]
    // --- Percentages (4 elements) ---
    clamp((ep.happinessPercentage ?? 0) / 100, 0, 1),                 // [16]
    clamp(ep.religionPercentage, 0, 1),                                // [17]
    clamp(ep.ideologyShare, 0, 1),                                     // [18]
    clamp(ep.supplyUtilization ?? 0, 0, 1),                            // [19]
    // --- Diplomatic (8 elements) ---
    ep.isVassal,                                                       // [20]
    clamp(ep.vassals / 3, 0, 1),                                       // [21]
    clamp(ep.warWeariness / 100, 0, 1),                                // [22]
    clamp(ep.activeWars / 3, 0, 1),                                    // [23]
    clamp(ep.truces / 3, 0, 1),                                        // [24]
    clamp(ep.friends / 3, 0, 1),                                       // [25]
    clamp(ep.defensivePacts / 3, 0, 1),                                // [26]
    clamp(ep.denouncements / 3, 0, 1),                                 // [27]
    // --- Victory gaps (4 elements, leaderProgress - playerProgress, range [-50, +50]) ---
    clamp(((ep.dominationLeaderProgress ?? 0) - (ep.dominationProgress ?? 0) + 50) / 100, 0, 1),  // [28]
    clamp(((ep.scienceLeaderProgress ?? 0) - (ep.scienceProgress ?? 0) + 50) / 100, 0, 1),        // [29]
    clamp(((ep.cultureLeaderProgress ?? 0) - (ep.cultureProgress ?? 0) + 50) / 100, 0, 1),        // [30]
    clamp(((ep.diplomaticLeaderProgress ?? 0) - (ep.diplomaticProgress ?? 0) + 50) / 100, 0, 1),  // [31]
  ];
}
