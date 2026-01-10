/**
 * Getter function to read a player's custom flavor values from the game
 */

import { LuaFunction } from "../../bridge/lua-function.js";
import { createLogger } from "../../utils/logger.js";
import { knowledgeManager } from "../../server.js";
import { composeVisibility } from "../../utils/knowledge/visibility.js";
import { FlavorChange } from "../schema/timed.js";
import { loadFlavorDescriptions } from "../../utils/strategies/loader.js";

const logger = createLogger("ReadPlayerFlavors");

// Create a reusable LuaFunction for reading player custom flavors
const readPlayerFlavorsFunction = new LuaFunction(
  "readPlayerFlavors",
  ["playerId"],
  `
    local player = Players[playerId]
    if player == nil then
      return nil
    end

    -- Get custom flavor values (only those explicitly set via SetCustomFlavors)
    local flavors = player:GetCustomFlavors()
    return flavors
  `
);

/**
 * Reads the current custom flavor values and stores them in the knowledge database
 *
 * @param playerId - The ID of the player (0 to MaxMajorCivs - 1)
 * @returns Object containing the current custom flavors or null if none are set
 */
export async function getPlayerFlavors(playerId: number): Promise<FlavorChange | null> {
  // Execute the Lua function to get custom flavors
  const result = await readPlayerFlavorsFunction.execute(playerId);

  if (!result || !result.success || !result.result) {
    logger.error(`Failed to read flavors for player ${playerId}`);
    return null;
  }

  const flavors = result.result;

  // Check if any custom flavors are set
  if (!flavors || Object.keys(flavors).length === 0) {
    logger.debug(`No custom flavors set for player ${playerId}`);
    return null;
  }

  // Load all available flavors from the cache to ensure we include zeros
  const allFlavors = await loadFlavorDescriptions();

  // Initialize cleanedFlavors with all flavors set to 50 (balanced in MCP range)
  const cleanedFlavors: Record<string, number> = {};
  for (const flavorName of Object.keys(allFlavors)) {
    cleanedFlavors[flavorName] = 50;
  }

  // Update with actual values from the game, removing "FLAVOR_" prefix
  // GetCustomFlavors now returns MCP range (0-100) directly
  for (const [key, value] of Object.entries(flavors)) {
    const cleanKey = key.replace(/^FLAVOR_/, '');
    cleanedFlavors[cleanKey] = value as number; // Already in MCP range
  }

  // Store the flavors in the knowledge database
  const store = knowledgeManager.getStore();
  const lastRationale = (await store.getMutableKnowledge("FlavorChanges", playerId))?.Rationale ?? "Unknown";

  await store.storeMutableKnowledge(
    'FlavorChanges',
    playerId,
    {
      PlayerID: playerId,
      ...cleanedFlavors,
      Rationale: lastRationale.startsWith("Tweaked by In-Game AI") ? lastRationale : `Tweaked by In-Game AI(${lastRationale.trim()})`
    },
    composeVisibility([playerId]),
    ["Rationale"] // Only ignore Rationale when checking for changes
  );

  return {
    Key: playerId,
    ...cleanedFlavors,
    Rationale: lastRationale
  } as FlavorChange;
}