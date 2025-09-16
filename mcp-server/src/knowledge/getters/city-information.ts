/**
 * Utility functions for extracting city information from the game
 */

import { LuaFunction } from '../../bridge/lua-function.js';
import { CityInformation, CityInformationBasic } from '../schema/timed.js';
import { knowledgeManager } from '../../server.js';
import { createLogger } from '../../utils/logger.js';
import { Selectable } from 'kysely';

const logger = createLogger('CityInformation');

/**
 * Lua function that extracts city information from the game
 */
const luaFunc = LuaFunction.fromFile(
  'get-city-information.lua',
  'getCityInformation',
  []
);

/**
 * Get all city information from the current game
 * Returns full city data with visibility-based access control
 * Also stores each city as mutable knowledge in the database
 * @returns Array of CityInformation objects for all cities
 */
export async function getCityInformations(): Promise<Selectable<CityInformation>[]> {
  const response = await luaFunc.execute();
  if (!response.success) {
    logger.error('Failed to get city information from Lua', response);
    return [];
  }

  const cities = response.result as Selectable<CityInformation>[];

  // Store each city as mutable knowledge
  try {
    for (const city of cities) {
      // Store the city information as mutable knowledge
      await knowledgeManager.getStore().storeMutableKnowledge(
        'CityInformations',
        city.Key,
        city as any
      );
    }

    logger.info(`Stored ${cities.length} cities as mutable knowledge`);
  } catch (error) {
    logger.error('Failed to store city information as mutable knowledge', error);
    // Don't fail the function if storage fails - still return the cities
  }

  return cities;
}

/**
 * Get basic city information from a full city information object
 * Extracts only the publicly visible fields
 * @param city Full city information object
 * @returns Basic city information
 */
export function getCityBasicInfo(city: CityInformation | Selectable<CityInformation>): CityInformationBasic {
  return {
    Key: city.Key,
    Owner: city.Owner,
    Name: city.Name,
    X: city.X,
    Y: city.Y,
    Population: city.Population,
    MajorityReligion: city.MajorityReligion,
    DefenseStrength: city.DefenseStrength,
    HitPoints: city.HitPoints,
    MaxHitPoints: city.MaxHitPoints,
    IsCoastal: city.IsCoastal,
    IsPuppet: city.IsPuppet,
    IsOccupied: city.IsOccupied,
  };
}
