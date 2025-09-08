/**
 * Utility functions for extracting player summary information from the game
 */

import { Selectable } from 'kysely';
import { LuaFunction } from '../../bridge/lua-function.js';
import { PlayerSummary } from '../schema/timed.js';

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
export async function getPlayerSummaries(): Promise<Partial<Selectable<PlayerSummary>>[]> {
  const response = await luaFunc.execute();
  if (!response.success) {
    return [];
  }
  return response.result;
}