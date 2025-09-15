/**
 * Utility functions for extracting city information from the game
 */

import { LuaFunction } from '../../bridge/lua-function.js';
import { CityInformation, CityInformationBasic } from '../schema/timed.js';

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
 * @returns Array of CityInformation objects for all cities
 */
export async function getCityInformations(): Promise<CityInformation[]> {
  const response = await luaFunc.execute();
  if (!response.success) {
    return [];
  }
  return response.result as CityInformation[];
}

/**
 * Filter city information based on visibility level
 * Returns only basic information for cities with visibility level 1
 * @param cities Full city information array
 * @param playerID The player ID to filter visibility for
 * @returns Array of city info filtered by visibility
 */
export function filterCityInfoByVisibility(
  cities: CityInformation[],
  playerID: number
): Array<CityInformationBasic | CityInformation> {
  return cities.map(city => {
    const visibilityField = `Player${playerID}` as keyof CityInformation;
    const visibility = city[visibilityField] as number;

    if (visibility === 0) {
      // Not visible - shouldn't be included
      return null;
    } else if (visibility === 1) {
      // Basic visibility - return only basic info
      const basicInfo: CityInformationBasic = {
        Key: city.Key,
        OwnerID: city.OwnerID,
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
        IsRazing: city.IsRazing
      };
      return basicInfo;
    } else {
      // Full visibility - return all info
      return city;
    }
  }).filter(city => city !== null) as Array<CityInformationBasic | CityInformation>;
}

/**
 * Get cities owned by a specific player
 * @param cities Full city information array
 * @param playerID The owner player ID
 * @returns Array of cities owned by the player
 */
export function getCitiesByOwner(
  cities: CityInformation[],
  playerID: number
): CityInformation[] {
  return cities.filter(city => city.OwnerID === playerID);
}

/**
 * Get cities visible to a specific player
 * @param cities Full city information array
 * @param playerID The player ID to check visibility for
 * @param minVisibility Minimum visibility level (1 = revealed, 2 = full)
 * @returns Array of cities visible to the player
 */
export function getVisibleCities(
  cities: CityInformation[],
  playerID: number,
  minVisibility: number = 1
): CityInformation[] {
  const visibilityField = `Player${playerID}` as keyof CityInformation;
  return cities.filter(city => {
    const visibility = city[visibilityField] as number;
    return visibility >= minVisibility;
  });
}