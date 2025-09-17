/**
 * Lua-based visibility analyzer for game events
 * Determines which players can see specific events based on game state
 */

import { LuaFunction } from '../../bridge/lua-function.js';
import { MaxMajorCivs } from '../../knowledge/schema/base.js';
import { performBackupVisibilityAnalysis } from '../visibility/backup-analysis.js';
import { createLogger } from '../logger.js';

const logger = createLogger('EventVisibility');

/**
 * Lua function that analyzes event visibility
 */
const analyzeVisibilityFunc = LuaFunction.fromFile(
  'event-visibility.lua',
  'analyzeEventVisibility',
  ['eventType', 'payload'],
  { '${MaxMajorCivs}': String(MaxMajorCivs) }
);

/**
 * Result of event visibility analysis
 */
export interface EventVisibilityResult {
  /** Array of visibility flags for each player (0=invisible, 1=partial, 2=full) */
  visibilityFlags: number[];
  /** Summary information about each referenced identity */
  extraPayload: Record<string, any>;
}

/**
 * Analyze event visibility to determine which players can see it
 * Uses Lua-based analysis first, falls back to backup analysis if needed
 * @param eventType The type of the event
 * @param payload The event payload data
 * @returns Visibility analysis result containing flags and invalidations, or undefined on error
 */
export async function analyzeEventVisibility(eventType: string, payload: any): Promise<EventVisibilityResult | undefined> {
  // Try primary Lua-based analysis
  const response = await analyzeVisibilityFunc.execute(eventType, payload);

  if (response.success && Array.isArray(response.result) && response.result.length === 2) {
    return {
      visibilityFlags: response.result[0],
      extraPayload: response.result[1]
    };
  }

  // Primary analysis failed, try backup analysis
  logger.warn(`Lua visibility analysis failed for event: ${eventType}, attempting backup analysis`);
  return await performBackupVisibilityAnalysis(eventType, payload);
}