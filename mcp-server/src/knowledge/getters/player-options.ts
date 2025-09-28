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
 * Convert numeric strategy IDs to localized names
 */
function convertStrategiesToNames(strategies: number[]): string[] {
  return strategies
    .map(id => retrieveEnumName("EconomicStrategy", id) || retrieveEnumName("MilitaryStrategy", id))
    .filter(name => name !== undefined) as string[];
}

/**
 * Convert numeric technology IDs to localized names
 */
function convertTechnologiesToNames(technologies: number[]): string[] {
  return technologies
    .map(id => retrieveEnumName("TechID", id))
    .filter(name => name !== undefined) as string[];
}

/**
 * Convert numeric policy IDs to localized names
 */
function convertPoliciesToNames(policies: number[]): string[] {
  return policies
    .map(id => retrieveEnumName("PolicyID", id))
    .filter(name => name !== undefined) as string[];
}

/**
 * Convert numeric policy branch IDs to localized names
 */
function convertPolicyBranchesToNames(branches: number[]): string[] {
  return branches
    .map(id => retrieveEnumName("BranchType", id))
    .filter(name => name !== undefined) as string[];
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

  // Process and convert numeric IDs to names for all options
  const processedResults = response.result.map((options: any) => {
    return {
      Key: options.Key,
      EconomicStrategies: convertStrategiesToNames(options.EconomicStrategies || []),
      MilitaryStrategies: convertStrategiesToNames(options.MilitaryStrategies || []),
      Technologies: convertTechnologiesToNames(options.Technologies || []),
      Policies: convertPoliciesToNames(options.Policies || []),
      PolicyBranches: convertPolicyBranchesToNames(options.PolicyBranches || [])
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