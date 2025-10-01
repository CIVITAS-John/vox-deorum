/**
 * Utility functions for extracting player strategic options from the game
 * Includes available technologies, policies, and strategies
 */

import { Selectable } from 'kysely';
import { LuaFunction } from '../../bridge/lua-function.js';
import { PlayerOptions } from '../schema/timed.js';
import { knowledgeManager } from '../../server.js';
import { retrieveEnumName } from '../../utils/knowledge/enum.js';

/**
 * Lua function that extracts player options information from the game
 */
const luaFunc = LuaFunction.fromFile(
  'get-player-options.lua',
  'getPlayerOptions',
  []
);

/**
 * Convert array of IDs to localized names using the appropriate enum
 */
function convertToNames(ids: number[] | undefined, enumType: string, alternateEnumType?: string): string[] {
  if (!Array.isArray(ids)) return [];
  return ids
    .map(id => {
      const name = retrieveEnumName(enumType, id);
      return name || (alternateEnumType ? retrieveEnumName(alternateEnumType, id) : undefined);
    })
    .filter(name => name !== undefined) as string[];
}

/**
 * Convert a single ID to localized name
 */
function convertToName(id: number | null | undefined, enumType: string): string | null {
  if (id === null || id === undefined) return null;
  return retrieveEnumName(enumType, id) || null;
}

/**
 * Get all player options from the current game
 * Returns strategic options for all active players (technologies, policies, strategies)
 * Note: Each player can only see their own options due to visibility constraints
 * @returns Array of PlayerOptions objects for all active players
 */
export async function getPlayerOptions(saving: boolean = true): Promise<Partial<Selectable<PlayerOptions>>[]> {
  const response = await luaFunc.execute();
  if (!response.success)
    return [];
  const store = knowledgeManager.getStore();

  // Blacklist strategies that have immediate effects or are not suitable for LLM decision-making
  const blacklistedEconomicStrategies = [
    'TradeWithCityState',     // Immediate effect: triggers trade routes with city-states
    'FoundCity',               // Immediate effect: triggers city founding operations
    'InfluenceCityState',      // Immediate effect: purchases influence with city-states
    'ConcertTour',             // Immediate effect: triggers great musician concert tour
  ];
  const blacklistedMilitaryStrategies: string[] = [

  ];  // Currently no military strategies need blacklisting

  // Process and convert numeric IDs to names for all options
  const processedResults = response.result.map((options: any) => {
    return {
      Key: options.Key,
      EconomicStrategies: convertToNames(options.EconomicStrategies, "EconomicStrategy", "MilitaryStrategy")?.filter(
        (strategy: string) => !blacklistedEconomicStrategies.includes(strategy)
      ),
      MilitaryStrategies: convertToNames(options.MilitaryStrategies, "MilitaryStrategy", "EconomicStrategy")?.filter(
        (strategy: string) => !blacklistedMilitaryStrategies.includes(strategy)
      ),
      Technologies: convertToNames(options.Technologies, "TechID"),
      NextResearch: convertToName(options.NextResearch, "TechID"),
      Policies: convertToNames(options.Policies, "PolicyID"),
      PolicyBranches: convertToNames(options.PolicyBranches, "BranchType"),
      NextPolicy: convertToName(options.NextPolicy, "PolicyID"),
      NextBranch: convertToName(options.NextBranch, "BranchType")
    };
  });

  // Store all options in batch if saving is enabled
  if (saving) {
    await store.storeTimedKnowledgeBatch(
      'PlayerOptions',
      processedResults.map((options: any) => {
        return {
          key: options.Key!,
          data: options,
          visibilityFlags: [options.Key] // Only visible to the player themselves
        }})
    );
  }

  return processedResults;
}