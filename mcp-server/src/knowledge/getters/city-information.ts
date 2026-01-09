/**
 * Utility functions for extracting city information from the game
 */

import { LuaFunction } from '../../bridge/lua-function.js';
import { CityInformation, CityInformationBasic } from '../schema/timed.js';
import { knowledgeManager, gameDatabase } from '../../server.js';
import { createLogger } from '../../utils/logger.js';
import { Selectable } from 'kysely';

const logger = createLogger('CityInformation');

// Cache for prerequisite map (module-level) - maps display names
let prereqNameMapCache: Map<string, string> | null = null;

/**
 * Get prerequisite relationships from database, cached for performance
 * Maps building display names to their prerequisite display names
 */
async function getPrerequisiteNameMap(): Promise<Map<string, string>> {
  // Return cached data if available
  if (prereqNameMapCache !== null) {
    return prereqNameMapCache;
  }

  const db = gameDatabase.getDatabase();

  // Query database for prerequisite relationships
  // We need to map both building type and building class relationships
  // to handle unique buildings properly
  const prereqsByClass = await db
    .selectFrom('Building_ClassesNeededInCity as bcn')
    .innerJoin('Buildings as b', 'b.Type', 'bcn.BuildingType')
    .innerJoin('BuildingClasses as bc1', 'bc1.Type', 'b.BuildingClass')
    .innerJoin('BuildingClasses as bc2', 'bc2.Type', 'bcn.BuildingClassType')
    .where('bc1.MaxGlobalInstances', 'is', null) // Not a world wonder
    .where('bc1.MaxPlayerInstances', 'is', null) // Not a national wonder
    .select([
      'b.Description as BuildingName',
      'bc2.Description as PrereqClassName'
    ])
    .execute();

  // Also get all buildings in each class for mapping
  const buildingsByClass = await db
    .selectFrom('Buildings as b')
    .innerJoin('BuildingClasses as bc', 'bc.Type', 'b.BuildingClass')
    .where('bc.MaxGlobalInstances', 'is', null) // Not a world wonder
    .where('bc.MaxPlayerInstances', 'is', null) // Not a national wonder
    .select([
      'b.Description as BuildingName',
      'bc.Description as ClassName'
    ])
    .execute();

  // Build a map from building class to all buildings in that class
  const classToBuildingNames = new Map<string, string[]>();
  for (const row of buildingsByClass) {
    if (row.ClassName) {
      const buildings = classToBuildingNames.get(row.ClassName) || [];
      buildings.push(row.BuildingName || '');
      classToBuildingNames.set(row.ClassName, buildings);
    }
  }

  // Build the prerequisite map
  // For each building, map it to all possible prerequisite buildings
  prereqNameMapCache = new Map<string, string>();
  for (const row of prereqsByClass) {
    if (row.BuildingName && row.PrereqClassName) {
      // Get all buildings in the prerequisite class
      const prereqBuildings = classToBuildingNames.get(row.PrereqClassName) || [];
      // For each prerequisite building, map it as a prerequisite
      for (const prereqBuilding of prereqBuildings) {
        prereqNameMapCache.set(row.BuildingName, prereqBuilding);
      }
    }
  }

  logger.info(`Cached ${prereqNameMapCache.size} building prerequisite relationships`);
  console.log(JSON.stringify(prereqNameMapCache));
  return prereqNameMapCache;
}

/**
 * Filter buildings to show only the most advanced in each chain
 * Removes any building that is a prerequisite for another building in the list
 */
async function filterBuildings(allBuildings: string[]): Promise<string[]> {
  if (!allBuildings || allBuildings.length === 0) {
    return [];
  }

  const prereqMap = await getPrerequisiteNameMap();

  // Simple filter: if prerequisite is also in list, hide the prerequisite
  const filtered: string[] = [];

  for (const building of allBuildings) {
    // Check if this building is a prerequisite for another building in the list
    let isPrereqForAnother = false;
    for (const other of allBuildings) {
      if (prereqMap.get(other) === building) {
        isPrereqForAnother = true;
        break;
      }
    }

    if (!isPrereqForAnother) {
      filtered.push(building);
    }
  }

  return filtered;
}

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

  // Filter building lists to show only most advanced buildings
  for (const city of cities) {
    if (city.RecentBuildings && Array.isArray(city.RecentBuildings))
      city.RecentBuildings = await filterBuildings(city.RecentBuildings);
  }

  // Store all cities as mutable knowledge in batch
  try {
  // Visibility handled by Lua script
    await knowledgeManager.getStore().storeMutableKnowledgeBatch(
      'CityInformations',
      cities.map(city => ({
        key: city.Key,
        data: city as any
      }))
    );

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
    IsCapital: city.IsCapital,
    IsCoastal: city.IsCoastal,
    IsPuppet: city.IsPuppet,
    IsOccupied: city.IsOccupied,
  };
}
