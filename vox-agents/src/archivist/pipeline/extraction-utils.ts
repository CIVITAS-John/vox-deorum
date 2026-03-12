/**
 * @module archivist/pipeline/extraction-utils
 *
 * Helper functions for game data extraction, split from extractor.ts.
 * Includes diplomatic parsing, victory progress extraction, city yield
 * aggregation, minor ally counting, and strategy lookup.
 */

import type { Selectable } from 'kysely';
import type { CityInformation, VictoryProgress } from '../../../../mcp-server/dist/knowledge/schema/index.js';
import type { TurnContext } from '../types.js';

/** War weariness extraction regex */
export const WAR_WEARINESS_REGEX = /Our War Weariness: (\d+)%/;

/** Diplomatic count result */
export interface DiplomaticCounts {
  isVassal: number;
  activeWars: number;
  truces: number;
  defensivePacts: number;
  friends: number;
  denouncements: number;
  vassals: number;
  warWeariness: number;
}

/**
 * Parse diplomatic relationship counts from the Relationships JSON.
 * Only counts relationships with major civilizations.
 */
export function parseDiplomatics(
  relationships: Record<string, string | string[]> | null,
  majorCivNames: Set<string>
): DiplomaticCounts {
  const result: DiplomaticCounts = {
    isVassal: 0,
    activeWars: 0,
    truces: 0,
    defensivePacts: 0,
    friends: 0,
    denouncements: 0,
    vassals: 0,
    warWeariness: 0,
  };

  if (!relationships) return result;

  for (const [civName, statuses] of Object.entries(relationships)) {
    // Only count major civ relationships
    if (!majorCivNames.has(civName)) continue;

    const statusArray = Array.isArray(statuses) ? statuses : [statuses];
    let hasWar = false;

    for (const status of statusArray) {
      // War detection: "War (Our Score: ...)" — check for "War" followed by space or paren
      if (!hasWar && (status.startsWith('War ') || status === 'War')) {
        result.activeWars++;
        hasWar = true;
        // Extract war weariness
        const match = WAR_WEARINESS_REGEX.exec(status);
        if (match) {
          const weariness = parseInt(match[1], 10);
          if (weariness > result.warWeariness) {
            result.warWeariness = weariness;
          }
        }
      }
      if (status.includes('Peace Treaty')) result.truces++;
      if (status.includes('Defensive Pact')) result.defensivePacts++;
      if (status.includes('Declaration of Friendship')) result.friends++;
      if (status.includes('Denounced Them') || status.includes('Denounced By Them')) {
        result.denouncements++;
      }
      if (status.includes('Our Vassal')) result.vassals++;
      if (status.includes('Our Master')) result.isVassal = 1;
    }
  }

  return result;
}

/** Sum production and food per turn from cities owned by this player's civilization. */
export function aggregateCityYields(
  cityInformations: Selectable<CityInformation>[],
  civilization: string
): { productionPerTurn: number | null; foodPerTurn: number | null } {
  let production = 0;
  let food = 0;
  let found = false;

  for (const city of cityInformations) {
    if (city.Owner === civilization) {
      found = true;
      production += (city.ProductionPerTurn as number) ?? 0;
      food += (city.FoodPerTurn as number) ?? 0;
    }
  }

  return {
    productionPerTurn: found ? production : null,
    foodPerTurn: found ? food : null,
  };
}

/** Count minor civs allied to this player (where MajorAlly matches civilization name). */
export function countMinorAllies(ctx: TurnContext, civilization: string): number | null {
  let count = 0;
  for (const [key, summary] of ctx.playerSummaries) {
    const info = ctx.playerInfos.get(key);
    if (!info || info.IsMajor === 1) continue; // Skip major civs
    if ((summary.MajorAlly as string) === civilization) {
      count++;
    }
  }
  return count;
}

/**
 * Find the latest grand strategy at or before the given turn.
 * Strategy rows must be sorted by Turn ascending.
 */
export function findLatestStrategy(
  strategyRows: Array<{ Turn: number; GrandStrategy: string | null }>,
  turn: number
): string | null {
  let result: string | null = null;
  for (const row of strategyRows) {
    if (row.Turn > turn) break;
    result = row.GrandStrategy;
  }
  return result;
}

/** Victory progress extraction result */
export interface VictoryProgressResult {
  dominationProgress: number | null;
  scienceProgress: number | null;
  cultureProgress: number | null;
  diplomaticProgress: number | null;
  dominationLeaderProgress: number | null;
  scienceLeaderProgress: number | null;
  cultureLeaderProgress: number | null;
  diplomaticLeaderProgress: number | null;
}

/**
 * Extract victory progress for a player from the VictoryProgress row.
 * Each victory type field can be a string (unavailable) or a JSON object with per-civ entries.
 */
export function extractAllVictoryProgress(
  victoryRow: Selectable<VictoryProgress> | null,
  civName: string
): VictoryProgressResult {
  const empty: VictoryProgressResult = {
    dominationProgress: null,
    scienceProgress: null,
    cultureProgress: null,
    diplomaticProgress: null,
    dominationLeaderProgress: null,
    scienceLeaderProgress: null,
    cultureLeaderProgress: null,
    diplomaticLeaderProgress: null,
  };

  if (!victoryRow) return empty;

  // Domination: CapitalsPercentage
  const dom = extractVictoryProgress(
    victoryRow.DominationVictory,
    civName,
    (entry) => (entry?.CapitalsPercentage as number) ?? null
  );

  // Science: PartsPercentage
  const sci = extractVictoryProgress(
    victoryRow.ScienceVictory,
    civName,
    (entry) => (entry?.PartsPercentage as number) ?? null
  );

  // Culture: InfluentialCivs / CivsNeeded * 100
  const cul = extractVictoryProgress(
    victoryRow.CulturalVictory,
    civName,
    (entry, obj) => {
      const influential = entry?.InfluentialCivs as number | undefined;
      if (influential == null) return null;
      const needed = (obj as Record<string, unknown>).CivsNeeded as number;
      if (!needed) return null;
      return (influential / needed) * 100;
    }
  );

  // Diplomatic: VictoryPercentage
  const dip = extractVictoryProgress(
    victoryRow.DiplomaticVictory,
    civName,
    (entry) => (entry?.VictoryPercentage as number) ?? null
  );

  return {
    dominationProgress: dom.progress,
    scienceProgress: sci.progress,
    cultureProgress: cul.progress,
    diplomaticProgress: dip.progress,
    dominationLeaderProgress: dom.leaderProgress,
    scienceLeaderProgress: sci.leaderProgress,
    cultureLeaderProgress: cul.leaderProgress,
    diplomaticLeaderProgress: dip.leaderProgress,
  };
}

/**
 * Extract player and leader progress from a single victory type field.
 * The field is either a string (unavailable) or a JSON object with:
 * - Per-civ entries keyed by civilization name
 * - A `Contender` field identifying the leader
 */
export function extractVictoryProgress(
  field: unknown,
  civName: string,
  getProgress: (entry: Record<string, unknown> | undefined, obj: unknown) => number | null
): { progress: number | null; leaderProgress: number | null } {
  if (typeof field === 'string' || field == null) {
    return { progress: null, leaderProgress: null };
  }

  const obj = field as Record<string, unknown>;
  const playerEntry = obj[civName] as Record<string, unknown> | undefined;
  const progress = getProgress(playerEntry, obj);

  const contender = obj.Contender as string | null;
  let leaderProgress: number | null = null;
  if (contender) {
    const leaderEntry = obj[contender] as Record<string, unknown> | undefined;
    leaderProgress = getProgress(leaderEntry, obj);
  }

  return { progress, leaderProgress };
}
