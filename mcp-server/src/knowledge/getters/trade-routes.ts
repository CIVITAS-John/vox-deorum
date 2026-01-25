/**
 * Trade routes getter for AI accessibility (Issue #469)
 */

import { LuaFunction } from '../../bridge/lua-function.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('TradeRoutes');

export interface TradeRoute {
  Domain: 'Land' | 'Sea';
  FromCity: string;
  ToCity: string;
  ToCiv: string;
  TurnsRemaining: number;
  IsInternal: boolean;

  FromGold: number;
  ToGold: number;
  FromFood?: number;
  FromProduction?: number;
  FromScience?: number;
  ToScience?: number;
  FromReligiousPressure?: number;
  ToReligiousPressure?: number;
}

export interface IdleTradeUnit {
  ID: number;
  Name: string;
  X: number;
  Y: number;
  InCity?: string;
  Domain: 'Land' | 'Sea';
}

export interface TradeRoutesData {
  TotalRoutes: number;
  AvailableSlots: number;
  MaxRoutes: number;
  ActiveRoutes: TradeRoute[];
  IdleTradeUnits: IdleTradeUnit[];
}

const luaFunc = LuaFunction.fromFile(
  'get-trade-routes.lua',
  'getTradeRoutes',
  ['playerID']
);

export async function getTradeRoutes(playerID: number): Promise<TradeRoutesData | null> {
  const response = await luaFunc.execute(playerID);

  if (!response.success) {
    logger.error('Failed to get trade routes from Lua', response);
    return null;
  }

  return response.result as TradeRoutesData;
}
