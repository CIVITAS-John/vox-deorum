/**
 * Utility functions for extracting player summary information from the game
 */

import { Selectable } from 'kysely';
import { LuaFunction } from '../../bridge/lua-function.js';
import { PlayerSummary } from '../schema/timed.js';
import { getEraName } from '../../utils/database/enums.js';
import { knowledgeManager } from '../../server.js';

/**
 * Lua function that extracts player summary information from the game
 */
const luaFunc = LuaFunction.fromFile(
  'get-player-summary.lua',
  'getPlayerSummary',
  []
);

/**
 * Get all player summary information from the current game
 * Returns summary data for all active players (major civs, minor civs)
 * @returns Array of PlayerSummary objects for all active players
 */
export async function getPlayerSummaries(saving: boolean = true): Promise<Partial<Selectable<PlayerSummary>>[]> {
  const response = await luaFunc.execute();
  if (!response.success)
    return [];
  const store = knowledgeManager.getStore();

  // Process era names for all summaries
  for (var summary of response.result) {
    summary.Era = getEraName(summary.Era);
  }

  // Store all summaries in batch if saving is enabled
  if (saving) {
    await store.storeMutableKnowledgeBatch(
      'PlayerSummaries',
      response.result.map((summary: any) => {
        return {
          key: summary.Key!,
          data: summary
        }})
    );
  }

  return response.result;
}