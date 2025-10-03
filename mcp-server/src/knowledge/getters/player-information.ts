/**
 * Utility functions for extracting player information from the game
 */

import { Selectable } from 'kysely';
import { LuaFunction } from '../../bridge/lua-function.js';
import { PlayerInformation } from '../schema/public.js';

/**
 * Lua function that extracts player information from the game
 */
const luaFunc = LuaFunction.fromFile(
  'get-player-information.lua',
  'getPlayerInformation',
  []
);

/**
 * Get all player information from the current game
 * Filters out players not actually in the game (empty slots)
 * @returns Array of PlayerInformation objects for all active players
 */
export async function getPlayerInformations(): Promise<Selectable<PlayerInformation>[]> {
  const response = await luaFunc.execute();
  if (!response.success) {
    return [];
  }
  return response.result as any;
}