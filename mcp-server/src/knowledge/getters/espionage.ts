/**
 * Espionage getter for AI accessibility (Issue #469)
 */

import { LuaFunction } from '../../bridge/lua-function.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('Espionage');

export interface Spy {
  Name: string;
  Rank: number;
  Location?: string;
  LocationOwner?: string;
  State: 'Unassigned' | 'Travelling' | 'GatheringIntel' | 'CounterIntelligence' |
         'Schmoozing' | 'RiggingElection' | 'StagingCoup' | 'Diplomat' | 'Surveillance' | 'Unknown';
  TurnsInState?: number;
}

export interface CityIntel {
  CityName: string;
  Owner: string;
  Population?: number;
  HasOurSpy: boolean;
  EspionagePotential?: number;
  IsCapital?: boolean;
  IsOurCity?: boolean;
}

export interface IntrigueMessage {
  Turn: number;
  Message: string;
  SpyName?: string;
}

export interface EspionageData {
  Spies: Spy[];
  CityIntelligence: CityIntel[];
  IntrigueMessages: IntrigueMessage[];
}

const luaFunc = LuaFunction.fromFile(
  'get-espionage.lua',
  'getEspionage',
  ['playerID']
);

export async function getEspionage(playerID: number): Promise<EspionageData | null> {
  const response = await luaFunc.execute(playerID);

  if (!response.success) {
    logger.error('Failed to get espionage from Lua', response);
    return null;
  }

  return response.result as EspionageData;
}
