/**
 * Tool for setting the active player's grand strategy in Civilization V
 */

import { LuaFunctionTool } from "../abstract/lua-function.js";
import * as z from "zod";
import { enumMappings, retrieveEnumValue } from "../../utils/knowledge/enum.js";
import { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { knowledgeManager } from "../../server.js";

/**
 * Tool that sets the player's grand strategy using a Lua function
 */
class SetStrategyTool extends LuaFunctionTool {
  name = "set-strategy";
  description = "Set a player's in-game strategy";

  /**
   * Input schema for the set-strategy tool
   */
  inputSchema = z.object({
    PlayerID: z.number().min(0).max(21).describe("ID of the player"),
    GrandStrategy: z.nativeEnum(enumMappings["GrandStrategy"]).optional().describe("The grand strategy type to optionally set (and override)"),
    EconomicStrategies: z.array(z.nativeEnum(enumMappings["EconomicStrategy"])).optional().describe("The economic strategy types to optionally set (and override)"),
    MilitaryStrategies: z.array(z.nativeEnum(enumMappings["MilitaryStrategy"])).optional().describe("The military strategy types to optionally set (and override)"),
    Rationale: z.string().describe("The reasoning behind choosing this strategy set")
  });

  /**
   * Result schema - returns success status
   */
  protected resultSchema = z.boolean();

  /**
   * The Lua function arguments
   */
  protected arguments = ["grandId", "economicIds", "militaryIds"];

  /**
   * Optional annotations for the Lua executor tool
   */
  readonly annotations: ToolAnnotations = {
    audience: ["user", "strategist"],
    autoComplete: ["PlayerID"],
    readOnlyHint: false
  }

  /**
   * The Lua script to execute
   */
  protected script = `
    local activePlayer = Players[Game.GetActivePlayer()]
    if grandId ~= -1 then
      activePlayer:SetGrandStrategy(grandId)
    end
    if economicIds ~= nil then
      activePlayer:SetEconomicStrategies(economicIds)
    end
    if militaryIds ~= nil then
      activePlayer:SetMilitaryStrategies(militaryIds)
    end
    return true
  `;

  /**
   * Execute the set-strategy command
   */
  async execute(args: z.infer<typeof this.inputSchema>): Promise<z.infer<typeof this.outputSchema>> {
    // Find the strategy ID from the string name
    let grandStrategy = retrieveEnumValue("GrandStrategy", args.GrandStrategy)
    let economicStrategies = args.EconomicStrategies?.map(s => retrieveEnumValue("EconomicStrategy", s));
    let militaryStrategies = args.MilitaryStrategies?.map(s => retrieveEnumValue("MilitaryStrategy", s));
    
    // Store the strategy change in the database
    const store = knowledgeManager.getStore();
    await store.storeMutableKnowledge(
      'StrategyChanges',
      args.PlayerID,
      {
        GrandStrategy: grandStrategy ?? null,
        EconomicStrategies: economicStrategies ? JSON.stringify(economicStrategies) : null,
        MilitaryStrategies: militaryStrategies ? JSON.stringify(militaryStrategies) : null,
        Rationale: args.Rationale
      }
    );
    
    // Call the parent execute with the strategy ID
    return super.call(grandStrategy, economicStrategies, militaryStrategies);
  }
}

/**
 * Creates a new instance of the set strategy tool
 */
export default function createSetStrategyTool() {
  return new SetStrategyTool();
}