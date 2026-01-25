/**
 * Culture/Tourism influence getter for AI accessibility (Issue #469)
 */

import { LuaFunction } from '../../bridge/lua-function.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('CultureInfluence');

export interface InfluenceData {
  CivName: string;
  InfluenceLevel: 'Unknown' | 'Exotic' | 'Familiar' | 'Popular' | 'Influential' | 'Dominant';
  InfluencePercent: number;
  TheirCulturePerTurn?: number;
  TourismTowardThem?: number;
  TurnsToNextLevel?: number;
}

export interface CityCulture {
  Name: string;
  CulturePerTurn: number;
  TourismPerTurn: number;
  GreatWorks: number;
}

export interface CultureInfluenceData {
  OurCulturePerTurn: number;
  OurTourismPerTurn: number;

  OurIdeology?: string;
  IdeologyLevel: number;

  InfluenceOnOthers: InfluenceData[];
  InfluenceOnUs: InfluenceData[];

  PublicOpinion: 'Content' | 'Dissidents' | 'Civil Resistance' | 'Revolutionary Wave';
  PublicOpinionUnhappiness: number;
  PreferredIdeology?: string;

  GreatWorksCount: number;
  ThemedBonuses: number;

  CultureByCity: CityCulture[];
}

const luaFunc = LuaFunction.fromFile(
  'get-culture-influence.lua',
  'getCultureInfluence',
  ['playerID']
);

export async function getCultureInfluence(playerID: number): Promise<CultureInfluenceData | null> {
  const response = await luaFunc.execute(playerID);

  if (!response.success) {
    logger.error('Failed to get culture influence from Lua', response);
    return null;
  }

  return response.result as CultureInfluenceData;
}
