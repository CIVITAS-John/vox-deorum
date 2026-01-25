/**
 * Happiness breakdown getter for AI accessibility (Issue #469)
 */

import { LuaFunction } from '../../bridge/lua-function.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('Happiness');

export interface CityHappiness {
  Name: string;
  LocalHappiness: number;
  Unhappiness: number;
  IsResistance?: boolean;
  ResistanceTurns?: number;
  IsOccupied?: boolean;
  WLTKD?: number;
}

export interface HappinessData {
  TotalHappiness: number;
  TotalUnhappiness: number;
  NetHappiness: number;

  HappinessSources: {
    FromCities: number;
    FromTradeRoutes: number;
    FromReligion: number;
    FromNaturalWonders: number;
    FromMinorCivs: number;
    FromLeagues: number;
    FromVassals: number;
    FromLuxuries: number;
    FromPolicies: number;
    FromBuildings: number;
    FromExtraHappinessPerCity: number;
  };

  UnhappinessSources: {
    FromCities: number;
    FromPopulation: number;
    FromOccupation: number;
    FromPublicOpinion: number;
    FromUnits: number;
    FromCitySpecialists: number;
    FromWarWeariness: number;
  };

  IsGoldenAge: boolean;
  GoldenAgeProgress: number;
  GoldenAgeThreshold: number;
  GoldenAgeTurnsLeft: number;
  TurnsToGoldenAge?: number;

  CityHappiness: CityHappiness[];
  Warnings: string[];
}

const luaFunc = LuaFunction.fromFile(
  'get-happiness.lua',
  'getHappiness',
  ['playerID']
);

export async function getHappiness(playerID: number): Promise<HappinessData | null> {
  const response = await luaFunc.execute(playerID);

  if (!response.success) {
    logger.error('Failed to get happiness from Lua', response);
    return null;
  }

  return response.result as HappinessData;
}
