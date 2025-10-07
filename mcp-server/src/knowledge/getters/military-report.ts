/**
 * Utility functions for extracting military report from the game
 * Includes unit types and tactical zones with unit assignments
 */

import { LuaFunction } from '../../bridge/lua-function.js';
import { knowledgeManager } from '../../server.js';

/**
 * Lua function that extracts military report from the game
 */
const luaFunc = LuaFunction.fromFile(
  'get-military-report.lua',
  'getMilitaryReport',
  ['playerID']
);

/**
 * Get military report for a specific player
 * Returns units organized by AI type and tactical zones with unit assignments
 * Saves tactical zone information to TacticalZones table
 * @param playerID - The player ID to get the report for
 * @param saving - Whether to save zone data to the database
 * @returns Military report with units and zones
 */
export async function getMilitaryReport(
  playerID: number,
  saving: boolean = true
): Promise<{ units: any; zones: any } | null> {
  const response = await luaFunc.execute(playerID);
  if (!response.success || !response.result || response.result.length < 2)
    return null;

  const [units, zones] = response.result;
  const store = knowledgeManager.getStore();

  // Save tactical zone information with units in batch
  if (saving && zones) {
    // Convert zones object to array for batch processing
    const zoneItems = Object.entries(zones as Record<string, any>)
      .map(([_, zone]) => ({
        data: zone,
        extra: {
          PlayerID: playerID
        }
      }));

    if (zoneItems.length > 0) {
      await store.storeTimedKnowledgeBatch('TacticalZones', zoneItems);
    }
  }

  return { units, zones };
}
