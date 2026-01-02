/**
 * Utility functions for extracting victory progress from the game
 * Includes domination, science, cultural, and diplomatic victory tracking
 */

import { Selectable } from 'kysely';
import { LuaFunction } from '../../bridge/lua-function.js';
import { VictoryProgress } from '../schema/timed.js';
import { knowledgeManager } from '../../server.js';
import { stripTags } from '../../utils/database/localized.js';

/**
 * Lua function that extracts victory progress information from the game
 */
const luaFunc = LuaFunction.fromFile(
  'get-victory-progress.lua',
  'getVictoryProgress',
  []
);

/**
 * Get victory progress from the current game
 * Returns a single global victory progress object for all victory types
 * Visible to all players (global knowledge) - Key is always 0
 * @returns A single VictoryProgress object
 */
export async function getVictoryProgress(saving: boolean = true): Promise<Partial<Selectable<VictoryProgress>> | null> {
  const response = await luaFunc.execute();
  if (!response.success || !response.result || response.result.length === 0)
    return null;

  const store = knowledgeManager.getStore();
  const victoryData = response.result[0];

  // Strip localization markers from diplomatic victory resolution descriptions
  if (victoryData.DiplomaticVictory &&
      victoryData.DiplomaticVictory.ActiveResolutions) {
    for (const resolutionName in victoryData.DiplomaticVictory.ActiveResolutions) {
      const resolution = victoryData.DiplomaticVictory.ActiveResolutions[resolutionName];
      resolution.Description = stripTags(resolution.Description);
    }
  }

  // Strip localization markers from proposal descriptions
  if (victoryData.DiplomaticVictory &&
      victoryData.DiplomaticVictory.Proposals) {
    for (const proposalName in victoryData.DiplomaticVictory.Proposals) {
      const proposal = victoryData.DiplomaticVictory.Proposals[proposalName];
      proposal.Description = stripTags(proposal.Description);
    }
  }

  // Store the victory progress if saving is enabled (always use Key = 0)
  if (saving) {
    // Visible to all players (constrained by visibility for player's identity)
    await store.storeMutableKnowledge(
      'VictoryProgress',
      0,  // Key is always 0 for global victory progress
      victoryData,
    );
  }

  return victoryData;
}
