/**
 * Tool for setting the active player's grand strategy in Civilization V
 */

import { LuaFunctionTool } from "../abstract/lua-function.js";
import * as z from "zod";
import { enumMappings, retrieveEnumValue, retrieveEnumName } from "../../utils/knowledge/enum.js";
import { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { knowledgeManager } from "../../server.js";
import { MaxMajorCivs } from "../../knowledge/schema/base.js";

/**
 * Tool that sets the player's grand strategy using a Lua function
 */
class SetStrategyTool extends LuaFunctionTool {
  name = "set-strategy";
  description = "Set a player's in-game strategy. Inputs must match exact values in the provided schema.";

  /**
   * Input schema for the set-strategy tool
   */
  inputSchema = z.object({
    PlayerID: z.number().min(0).max(MaxMajorCivs - 1).describe("ID of the player"),
    GrandStrategy: z.nativeEnum(enumMappings["GrandStrategy"]).optional().describe("The grand strategy type to optionally set (and override)"),
    EconomicStrategies: z.array(z.nativeEnum(enumMappings["EconomicStrategy"])).optional().describe("The economic strategy types to optionally set (and override)"),
    MilitaryStrategies: z.array(z.nativeEnum(enumMappings["MilitaryStrategy"])).optional().describe("The military strategy types to optionally set (and override)"),
    Rationale: z.string().describe("Explain your rationale behind choosing this strategy set")
  });

  /**
   * Result schema - returns success status and previous strategy
   */
  protected resultSchema = z.object({
    GrandStrategy: z.string().optional(),
    EconomicStrategies: z.array(z.string()).optional(),
    MilitaryStrategies: z.array(z.string()).optional()
  }).optional();

  /**
   * The Lua function arguments
   */
  protected arguments = ["grandId", "economicIds", "militaryIds"];

  /**
   * Optional annotations for the Lua executor tool
   */
  readonly annotations: ToolAnnotations = {
    autoComplete: ["PlayerID"],
    readOnlyHint: false
  }

  /**
   * The Lua script to execute
   */
  protected script = `
    local activePlayer = Players[Game.GetActivePlayer()]

    -- Capture previous strategies before setting new ones
    local previousGrand = activePlayer:GetGrandStrategy()
    local previousEconomic = activePlayer:GetEconomicStrategies()
    local previousMilitary = activePlayer:GetMilitaryStrategies()

    -- Set new strategies
    if grandId ~= -1 then
      activePlayer:SetGrandStrategy(grandId)
    end
    if economicIds ~= nil then
      activePlayer:SetEconomicStrategies(economicIds)
    end
    if militaryIds ~= nil then
      activePlayer:SetMilitaryStrategies(militaryIds)
    end

    -- Return success and previous strategies
    return {
      GrandStrategy = previousGrand,
      EconomicStrategies = previousEconomic,
      MilitaryStrategies = previousMilitary
    }
  `;

  /**
   * Execute the set-strategy command
   */
  async execute(args: z.infer<typeof this.inputSchema>): Promise<z.infer<typeof this.outputSchema>> {
    // Find the strategy ID from the string name
    let grandStrategy = retrieveEnumValue("GrandStrategy", args.GrandStrategy)
    let economicStrategies = args.EconomicStrategies?.map(s => retrieveEnumValue("EconomicStrategy", s));
    let militaryStrategies = args.MilitaryStrategies?.map(s => retrieveEnumValue("MilitaryStrategy", s));

    // Call the parent execute with the strategy ID
    var result = await super.call(grandStrategy, economicStrategies, militaryStrategies);
    if (result.Success) {
      const store = knowledgeManager.getStore();

      // Store the previous strategy with reason "In-Game AI"
      const strategies = result.Result;
      // Postprocessing
      if (Object.keys(strategies.EconomicStrategies).length === 0)
        strategies.EconomicStrategies = [];
      if (Object.keys(strategies.MilitaryStrategies).length === 0)
        strategies.MilitaryStrategies = [];
      // Store the strategy
      await store.storeMutableKnowledge(
        'StrategyChanges',
        args.PlayerID,
        {
          GrandStrategy: strategies.GrandStrategy,
          EconomicStrategies: strategies.EconomicStrategies,
          MilitaryStrategies: strategies.MilitaryStrategies,
          Rationale: "In-Game AI"
        },
        undefined,
        ["Rationale"] // Only ignore Rationale when checking for changes
      );

      // Convert the numeric values back to string names for the response
      result.Result = {
        GrandStrategy: retrieveEnumName("GrandStrategy", result.Result.GrandStrategy),
        EconomicStrategies: result.Result.EconomicStrategies.map((id: number) =>
          retrieveEnumName("EconomicStrategy", id)
        ).filter((name: string | undefined) => name !== undefined),
        MilitaryStrategies: result.Result.MilitaryStrategies.map((id: number) =>
          retrieveEnumName("MilitaryStrategy", id)
        ).filter((name: string | undefined) => name !== undefined)
      };

      // Store the new strategy change in the database
      await store.storeMutableKnowledge(
        'StrategyChanges',
        args.PlayerID,
        {
          GrandStrategy: grandStrategy === -1 ? strategies.GrandStrategy : grandStrategy,
          EconomicStrategies: (economicStrategies ?? strategies.economicStrategies).sort(),
          MilitaryStrategies: (militaryStrategies ?? strategies.militaryStrategies).sort(),
          Rationale: args.Rationale
        },
        undefined,
        ["Rationale"] // Only ignore Rationale when checking for changes
      );
    }

    return result;
  }
}

/**
 * Creates a new instance of the set strategy tool
 */
export default function createSetStrategyTool() {
  return new SetStrategyTool();
}