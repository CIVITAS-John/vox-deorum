/**
 * @module archivist/transformer
 *
 * Pure computation module that transforms RawEpisode + TurnContext into Episode.
 * Computes city-adjusted shares, per-pop metrics, gaps, ideology, religion,
 * game state vector (35d), and neighbor vector (32d).
 * No async, no I/O — all data comes from the extraction phase.
 */

import type { Selectable } from 'kysely';
import type { CityInformation, PlayerSummary } from '../../../mcp-server/dist/knowledge/schema/index.js';
import type { RawEpisode, Episode, TurnContext } from './types.js';
import { eraMap, grandStrategyMap, countPolicies } from './types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// countPolicies imported from types.ts (shared with extractor.ts and game-state-vector.ts)

/** Scale a share value when only partial players are known. */
function scaleShare(share: number | null, scale: number): number | null {
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
function computeCityAdjustedShare(
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
function computeRawShare(
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
function computePerPop(
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
function computeGap(
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
function detectIdeology(policyBranches: Record<string, string[]> | null): string | null {
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
function computeReligionPercentage(
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
function parseDistance(statuses: string[]): number {
  for (const s of statuses) {
    if (s.includes('Distance: Neighbors')) return 0;
    if (s.includes('Distance: Close')) return 1;
    if (s.includes('Distance: Far')) return 2;
    if (s.includes('Distance: Distant')) return 3;
  }
  return 3; // default: distant
}

/** Parse stance from relationship status strings. Higher = more hostile. */
function parseStance(statuses: string[]): number {
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

interface NeighborFeatures {
  distanceRank: number;
  strengthRatio: number;
  stanceNorm: number;
  techGap: number;
  policyGap: number;
}

const NEUTRAL_PAD: [number, number, number, number] = [0.2, 0.5, 0.5, 0.5];

/**
 * Build the 32-element neighbor vector.
 * 8 slots × 4 features. Sorted by distance rank first, then strength_ratio descending.
 */
function buildNeighborVector(
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
function buildGameStateVector(
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

// ---------------------------------------------------------------------------
// Main transform function
// ---------------------------------------------------------------------------

/**
 * Transform a raw episode into a full episode with computed fields.
 * Pure computation — no I/O.
 */
export function transformEpisode(raw: RawEpisode, turnContext: TurnContext): Episode {
  // Build civ name → player ID lookup
  const civToPlayerId = new Map<string, number>();
  for (const [pid, info] of turnContext.playerInfos) {
    civToPlayerId.set(info.Civilization, pid);
  }

  // Collect all alive major players' data for share computation
  const majorPlayerData: Array<{
    playerId: number;
    cities: number | null;
    population: number | null;
    culture: number | null;
    tourism: number | null;
    gold: number | null;
    military: number | null;
    technologies: number | null;
    policies: number | null;
    votes: number | null;
    minorAllies: number | null;
    policyBranches: Record<string, string[]> | null;
  }> = [];

  for (const [pid, summary] of turnContext.playerSummaries) {
    const info = turnContext.playerInfos.get(pid);
    if (!info || info.IsMajor !== 1) continue;

    majorPlayerData.push({
      playerId: pid,
      cities: summary.Cities as number | null,
      population: summary.Population as number | null,
      culture: summary.CulturePerTurn as number | null,
      tourism: summary.TourismPerTurn as number | null,
      gold: summary.GoldPerTurn as number | null,
      military: summary.MilitaryStrength as number | null,
      technologies: summary.Technologies as number | null,
      policies: countPolicies(summary.PolicyBranches as Record<string, string[]> | null),
      votes: summary.Votes as number | null,
      minorAllies: null, // computed separately below
      policyBranches: summary.PolicyBranches as Record<string, string[]> | null,
    });
  }

  // Compute minor allies for all majors (needed for share)
  for (const p of majorPlayerData) {
    const info = turnContext.playerInfos.get(p.playerId);
    if (!info) continue;
    let count = 0;
    for (const [sid, summary] of turnContext.playerSummaries) {
      const sInfo = turnContext.playerInfos.get(sid);
      if (!sInfo || sInfo.IsMajor === 1) continue;
      if ((summary.MajorAlly as string) === info.Civilization) count++;
    }
    p.minorAllies = count;
  }

  // Scale shares when only partial players are known
  const knownMajors = majorPlayerData.length;
  const totalMajors = turnContext.totalMajors ?? knownMajors;
  const shareScale = totalMajors > 0 ? knownMajors / totalMajors : 1;

  // City-adjusted shares
  const tourismShare = scaleShare(computeCityAdjustedShare(raw.tourismPerTurn, raw.cities,
    majorPlayerData.map(p => ({ value: p.tourism, cities: p.cities }))), shareScale);
  const militaryShare = scaleShare(computeCityAdjustedShare(raw.militaryStrength, raw.cities,
    majorPlayerData.map(p => ({ value: p.military, cities: p.cities }))), shareScale);

  // Raw shares
  const citiesShare = scaleShare(computeRawShare(raw.cities, majorPlayerData.map(p => p.cities)), shareScale);
  const populationShare = scaleShare(computeRawShare(raw.population, majorPlayerData.map(p => p.population)), shareScale);
  const votesShare = scaleShare(computeRawShare(raw.votes, majorPlayerData.map(p => p.votes)), shareScale);
  const minorAlliesShare = scaleShare(computeRawShare(raw.minorAllies, majorPlayerData.map(p => p.minorAllies)), shareScale);

  // Player summary for this player (needed for per-pop, religion, ideology)
  const playerSummary = turnContext.playerSummaries.get(raw.playerId);

  // Per-pop (science/faith sourced from PlayerSummary since they're not stored as raw columns)
  const sciencePerTurnValue = (playerSummary?.SciencePerTurn as number | null) ?? null;
  const faithPerTurnValue = (playerSummary?.FaithPerTurn as number | null) ?? null;
  const sciencePerPop = computePerPop(sciencePerTurnValue, raw.population);
  const faithPerPop = computePerPop(faithPerTurnValue, raw.population);
  const productionPerPop = computePerPop(raw.productionPerTurn, raw.population);
  const foodPerPop = computePerPop(raw.foodPerTurn, raw.population);
  const culturePerPop = computePerPop(raw.culturePerTurn, raw.population);
  const goldPerPop = computePerPop(raw.goldPerTurn, raw.population);

  // Gaps
  const technologiesGap = computeGap(raw.technologies, majorPlayerData.map(p => p.technologies));
  const policiesGap = computeGap(raw.policies, majorPlayerData.map(p => p.policies));

  // Religion
  const foundedReligion = (playerSummary?.FoundedReligion as string | null) ?? null;
  const religionPercentage = computeReligionPercentage(foundedReligion, turnContext.cityInformations);

  // Ideology
  const playerPolicyBranches = playerSummary?.PolicyBranches as Record<string, string[]> | null;
  const playerIdeology = detectIdeology(playerPolicyBranches);
  let ideologyAllies = 0;
  if (playerIdeology) {
    for (const p of majorPlayerData) {
      if (detectIdeology(p.policyBranches) === playerIdeology) ideologyAllies++;
    }
  }
  const ideologyShare = majorPlayerData.length > 0 && playerIdeology
    ? ideologyAllies / majorPlayerData.length
    : 0;

  // Build partial episode (without vectors)
  const partial = {
    ...raw,
    tourismShare,
    militaryShare,
    citiesShare,
    populationShare,
    votesShare,
    minorAlliesShare,
    sciencePerPop,
    faithPerPop,
    productionPerPop,
    foodPerPop,
    culturePerPop,
    goldPerPop,
    technologiesGap,
    policiesGap,
    religionPercentage,
    ideologyAllies,
    ideologyShare,
  };

  // Game state vector (35 elements)
  const gameStateVector = buildGameStateVector(partial);

  // Neighbor vector (32 elements)
  const neighborVector = playerSummary
    ? buildNeighborVector(
        playerSummary,
        turnContext,
        civToPlayerId,
        raw.technologies,
        raw.policies,
        raw.militaryStrength
      )
    : Array(32).fill(0).map((_: number, i: number) => NEUTRAL_PAD[i % 4]);

  return {
    ...partial,
    gameStateVector,
    neighborVector,
    abstractEmbedding: null,
    isLandmark: false,
  };
}
