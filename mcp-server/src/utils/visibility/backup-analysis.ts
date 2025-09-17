/**
 * Backup visibility analysis using cached game knowledge
 * Used when Lua-based visibility analysis fails
 */

import { EventVisibilityResult } from '../lua/event-visibility.js';
import { MaxMajorCivs } from '../../knowledge/schema/base.js';
import { knowledgeManager } from '../../server.js';
import { createLogger } from '../logger.js';

const logger = createLogger('BackupVisibility');

/**
 * Event types that are visible to met players
 */
const metPlayerEventTypes = new Set([
  "CircumnavigatedGlobe", "CapitalChanged", 
  "NuclearDetonation", "PantheonFounded", "IdeologyAdopted", "IdeologySwitched", "PlayerAnarchy", "PlayerGoldenAge", "PlayerLiberated",
  "ReligionFounded", "ReligionReformed", "ReligionEnhanced", "StateReligionAdopted", "StateReligionChanged", 
  "DeclareWar", "MakePeace", "DealMade"
]);

/**
 * Extract player ID from various payload field patterns
 */
function extractPlayerIds(payload: any): number[] {
  const playerIds: number[] = [];

  for (const [key, value] of Object.entries(payload)) {
    if (typeof value !== 'number') continue;

    // Check for player-related field patterns
    if (key.match(/PlayerID$|OwnerID$/i)) {
      playerIds.push(value);
    }
  }

  return playerIds;
}

/**
 * Perform backup visibility analysis using cached knowledge
 * This function attempts to determine event visibility based on:
 * - Event type patterns
 * - Cached player relationships (teams, met status)
 * - Cached city information
 * - Basic heuristics when cache data is unavailable
 */
export async function performBackupVisibilityAnalysis(
  eventType: string,
  payload: any
): Promise<EventVisibilityResult | undefined> {
  logger.info(`Performing backup visibility analysis for event type: ${eventType}`);

  // Initialize visibility flags (0=invisible, 1=partial, 2=full)
  const visibilityFlags: number[] = new Array(MaxMajorCivs + 1).fill(0);
  const extraPayload: Record<string, any> = {};

  try {
    const store = knowledgeManager.getStore();

    // Extract player IDs from payload
    const playerIds = extractPlayerIds(payload);

    // Handle player-specific events
    if (playerIds.length > 0) {
      const playerInfos = await store.getAllPublicKnowledge('PlayerInformations');

      for (const playerId of playerIds) {
        if (playerId < 0 || playerId > MaxMajorCivs) continue;

        // Owner always has full visibility
        visibilityFlags[playerId] = 2;

        // Get some information
        const playerInfo = playerInfos.find(p => p.Key === playerId);

        if (playerInfo) {
          // Only add enrichment data, not data already in the payload
          extraPayload["Player"] = {
            Name: playerInfo.Leader,
            Civilization: playerInfo.Civilization
          }

          // Add team members if available
          if (playerInfo.TeamID !== undefined) {
            // Find all team members
            for (const otherPlayer of playerInfos) {
              const otherData = otherPlayer.Data as any;
              if (otherData && otherData.TeamID === playerInfo.TeamID && otherPlayer.Key <= MaxMajorCivs) {
                visibilityFlags[otherPlayer.Key] = 2;
              }
            }
          }

          // Check if event should be visible to met players
          if (metPlayerEventTypes.has(eventType)) {
          }
        }
      }
    }

    // If no specific visibility determined, default to conservative approach
    const hasVisibility = visibilityFlags.some(v => v > 0);
    if (!hasVisibility) {
      logger.warn(`No visibility rules matched for event ${eventType}, using conservative default`);
    }

  } catch (error) {
    logger.warn('Error during backup visibility analysis:', error);
    return undefined;
  }

  logger.debug(`Backup visibility analysis complete. Flags: [${visibilityFlags}]`);
  return { visibilityFlags, extraPayload };
}
