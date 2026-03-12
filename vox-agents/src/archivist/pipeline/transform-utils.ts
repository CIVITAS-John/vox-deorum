/**
 * @module archivist/pipeline/transform-utils
 *
 * Pure computation helpers for episode transformation, split from transformer.ts.
 * Includes share computation, gap/per-pop metrics, ideology/religion detection,
 * neighbor vector construction, and game state vector construction.
 */

import type { Selectable } from 'kysely';
import type { CityInformation, PlayerSummary } from '../../../../mcp-server/dist/knowledge/schema/index.js';
import type { Episode, TurnContext } from '../types.js';
import { eraMap, grandStrategyMap, countPolicies } from '../types.js';

// ---------------------------------------------------------------------------
// Math helpers
// ---------------------------------------------------------------------------

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Scale a share value when only partial players are known. */
export function scaleShare(share: number | null, scale: number): number | null {
  if (share == null) return null;
  return share * scale;
}

// ---------------------------------------------------------------------------
// Share computation
// ---------------------------------------------------------------------------

/**
 * Compute a city-adjusted share for a yield metric.
 * cityMultiplier = max(1.05 * (cities - 1), 1.0)
 * adj = value / multiplier
 * share = playerAdj / sum(allAdj)
 */
export function computeCityAdjustedShare(
  playerValue: number | null,
  playerCities: number | null,
  allPlayerData: Array<{ value: number | null; cities: number | null }>
): number | null {
  if (playerValue == null || playerCities == null) return null;

  const playerMultiplier = Math.max(1.05 * (playerCities - 1), 1.0);
  const playerAdj = playerValue / playerMultiplier;

  let totalAdj = 0;
  for (const p of allPlayerData) {
    if (p.value == null || p.cities == null) continue;
    const mult = Math.max(1.05 * (p.cities - 1), 1.0);
    totalAdj += p.value / mult;
  }

  return totalAdj > 0 ? playerAdj / totalAdj : null;
}

/**
 * Compute a raw share (simple ratio).
 * share = playerValue / sum(allValues)
 */
export function computeRawShare(
  playerValue: number | null,
  allValues: (number | null)[]
): number | null {
  if (playerValue == null) return null;
  let total = 0;
  for (const v of allValues) {
    if (v != null) total += v;
  }
  return total > 0 ? playerValue / total : null;
}

/** Compute raw per-population ratio (not scaled). */
export function computePerPop(
  metric: number | null,
  population: number | null
): number | null {
  if (metric == null || population == null || population === 0) return null;
  return metric / population;
}

/**
 * Compute gap relative to leader.
 * Returns player.value - max(all.values). 0 for leader, negative for others.
 */
export function computeGap(
  playerValue: number | null,
  allValues: (number | null)[]
): number {
  if (playerValue == null) return 0;
  let maxVal = -Infinity;
  for (const v of allValues) {
    if (v != null && v > maxVal) maxVal = v;
  }
  return maxVal === -Infinity ? 0 : playerValue - maxVal;
}

// ---------------------------------------------------------------------------
// Ideology
// ---------------------------------------------------------------------------

const ideologyBranches = new Set(['Freedom', 'Order', 'Autocracy']);

/** Detect ideology from PolicyBranches keys. Returns branch name or null. */
export function detectIdeology(policyBranches: Record<string, string[]> | null): string | null {
  if (!policyBranches) return null;
  for (const key of Object.keys(policyBranches)) {
    if (ideologyBranches.has(key)) return key;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Religion
// ---------------------------------------------------------------------------

/** Compute religion percentage: cities with matching FoundedReligion / total cities. */
export function computeReligionPercentage(
  foundedReligion: string | null,
  cityInformations: Selectable<CityInformation>[]
): number {
  if (!foundedReligion || cityInformations.length === 0) return 0;
  let matching = 0;
  for (const city of cityInformations) {
    if (city.MajorityReligion === foundedReligion) matching++;
  }
  return matching / cityInformations.length;
}

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

    // Filter: Neighbors, or Close + hostile (stance >= 3)
    if (distanceRank > 1) continue; // only Neighbors (0) and Close (1)
    if (distanceRank === 1 && stance < 3) continue; // Close requires hostile

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

/** Build the 35-element game state vector from computed Episode fields. */
export function buildGameStateVector(
  ep: Omit<Episode, 'gameStateVector' | 'neighborVector' | 'abstractEmbedding' | 'isLandmark'>
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
    // --- Per-pop metrics (6 elements) ---
    clamp(ep.sciencePerPop ?? 0, 0, 20) / 20,                          // [8]
    clamp(ep.faithPerPop ?? 0, 0, 20) / 20,                            // [9]
    clamp(ep.productionPerPop ?? 0, 0, 20) / 20,                      // [10]
    clamp(ep.foodPerPop ?? 0, 0, 20) / 20,                            // [11]
    clamp(ep.culturePerPop ?? 0, 0, 20) / 20,                         // [12]
    clamp(ep.goldPerPop ?? 0, 0, 20) / 20,                            // [13]
    // --- Gaps & percentages (5 elements, gaps centered at 0.5) ---
    clamp(ep.technologiesGap / 20 + 0.5, 0, 1),                        // [14]
    clamp(ep.policiesGap / 10 + 0.5, 0, 1),                           // [15]
    clamp((ep.happinessPercentage ?? 0) / 100, 0, 1),                 // [16]
    clamp(ep.religionPercentage, 0, 1),                                // [17]
    ep.ideologyShare,                                                  // [18]
    // --- Diplomatic (8 elements) ---
    ep.isVassal,                                                       // [19]
    clamp(ep.vassals / 3, 0, 1),                                      // [20]
    clamp(ep.warWeariness / 100, 0, 1),                                // [21]
    clamp(ep.activeWars / 3, 0, 1),                                    // [22]
    clamp(ep.truces / 3, 0, 1),                                       // [23]
    clamp(ep.friends / 3, 0, 1),                                      // [24]
    clamp(ep.defensivePacts / 3, 0, 1),                                // [25]
    clamp(ep.denouncements / 3, 0, 1),                                 // [26]
    // --- Victory (8 elements) ---
    clamp((ep.dominationProgress ?? 0) / 100, 0, 1),                   // [27]
    clamp((ep.scienceProgress ?? 0) / 100, 0, 1),                      // [28]
    clamp((ep.cultureProgress ?? 0) / 100, 0, 1),                      // [29]
    clamp((ep.diplomaticProgress ?? 0) / 100, 0, 1),                   // [30]
    clamp((ep.dominationLeaderProgress ?? 0) / 100, 0, 1),             // [31]
    clamp((ep.scienceLeaderProgress ?? 0) / 100, 0, 1),                // [32]
    clamp((ep.cultureLeaderProgress ?? 0) / 100, 0, 1),                // [33]
    clamp((ep.diplomaticLeaderProgress ?? 0) / 100, 0, 1),             // [34]
  ];
}
