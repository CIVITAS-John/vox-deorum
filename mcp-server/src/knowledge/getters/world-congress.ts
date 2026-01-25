/**
 * World Congress getter for AI accessibility (Issue #469)
 */

import { LuaFunction } from '../../bridge/lua-function.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('WorldCongress');

export interface Resolution {
  Name: string;
  ProposedBy: string;
  Type?: 'Enact' | 'Repeal';
  CanPropose?: boolean;
}

export interface CongressMember {
  CivName: string;
  Votes: number;
  IsHost: boolean;
}

export interface WorldCongressData {
  Active: boolean;
  Message?: string;

  LeagueName?: string;
  IsUnitedNations?: boolean;
  HostCiv?: string;

  InSession?: boolean;
  TurnsUntilSession?: number;
  IsSpecialSession?: boolean;

  OurVotes?: number;
  ProposalsAvailable?: number;
  VotesRemaining?: number;

  DiploVictoryEnabled?: boolean;
  VotesNeededForVictory?: number;

  ActiveResolutions?: Resolution[];
  CurrentProposals?: Resolution[];
  ProposableResolutions?: Resolution[];
  Members?: CongressMember[];
}

const luaFunc = LuaFunction.fromFile(
  'get-world-congress.lua',
  'getWorldCongress',
  ['playerID']
);

export async function getWorldCongress(playerID: number): Promise<WorldCongressData | null> {
  const response = await luaFunc.execute(playerID);

  if (!response.success) {
    logger.error('Failed to get world congress from Lua', response);
    return null;
  }

  return response.result as WorldCongressData;
}
