/**
 * Utility function to read a player's current strategy and store it with "In-Game AI" rationale
 */

import { knowledgeManager } from "../../server.js";
import { retrieveEnumName } from "../knowledge/enum.js";
import { LuaFunction } from "../../bridge/lua-function.js";

// Create a reusable LuaFunction for reading player strategies
const readPlayerStrategiesFunction = new LuaFunction(
  "ReadPlayerStrategies",
  ["playerId"],
  `
    local player = Players[playerId]
    if player == nil then
      return nil
    end

    -- Get current strategies
    local grandStrategy = player:GetGrandStrategy()
    local economicStrategies = player:GetEconomicStrategies()
    local militaryStrategies = player:GetMilitaryStrategies()

    return {
      GrandStrategy = grandStrategy,
      EconomicStrategies = economicStrategies,
      MilitaryStrategies = militaryStrategies
    }
  `
);

/**
 * Reads the current strategy of a player and stores it in the knowledge database
 * with the rationale set as "In-Game AI"
 *
 * @param playerId - The ID of the player (0 to MaxMajorCivs - 1)
 * @returns Object containing the current strategies or null if failed
 */
export async function readAndStorePlayerStrategy(playerId: number): Promise<{
  GrandStrategy: string | undefined;
  EconomicStrategies: string[];
  MilitaryStrategies: string[];
} | null> {
  try {
    // Execute the registered Lua function to get current strategies
    const result = await readPlayerStrategiesFunction.execute(playerId);

    if (!result || !result.success || !result.result) {
      console.error(`Failed to read strategies for player ${playerId}`);
      return null;
    }

    const strategies = result.result;

    // Handle empty table conversion (Lua returns empty tables as objects)
    if (Object.keys(strategies.EconomicStrategies).length === 0) {
      strategies.EconomicStrategies = [];
    }
    if (Object.keys(strategies.MilitaryStrategies).length === 0) {
      strategies.MilitaryStrategies = [];
    }

    // Store the strategy in the knowledge database with "In-Game AI" rationale
    const store = knowledgeManager.getStore();
    await store.storeMutableKnowledge(
      'StrategyChanges',
      playerId,
      {
        GrandStrategy: strategies.GrandStrategy,
        EconomicStrategies: strategies.EconomicStrategies.sort(),
        MilitaryStrategies: strategies.MilitaryStrategies.sort(),
        Rationale: "In-Game AI"
      },
      undefined,
      ["Rationale"] // Only ignore Rationale when checking for changes
    );

    // Convert numeric IDs to string names for return value
    const readableStrategies = {
      GrandStrategy: retrieveEnumName("GrandStrategy", strategies.GrandStrategy),
      EconomicStrategies: strategies.EconomicStrategies
        .map((id: number) => retrieveEnumName("EconomicStrategy", id))
        .filter((name: string | undefined) => name !== undefined) as string[],
      MilitaryStrategies: strategies.MilitaryStrategies
        .map((id: number) => retrieveEnumName("MilitaryStrategy", id))
        .filter((name: string | undefined) => name !== undefined) as string[]
    };

    return readableStrategies;
  } catch (error) {
    console.error(`Error reading and storing strategy for player ${playerId}:`, error);
    return null;
  }
}