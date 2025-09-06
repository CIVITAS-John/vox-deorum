/**
 * Tool for setting the active player's grand strategy in Civilization V
 */

import { LuaFunctionTool } from "../abstract/lua-function.js";
import * as z from "zod";
import { enumMappings, retrieveEnumValue } from "../../utils/knowledge/enum.js";
import { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";

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
    GrandStrategy: z.nativeEnum(enumMappings["GrandStrategy"]).describe("The grand strategy name to set"),
    Rationale: z.string().describe("The reasoning behind choosing this strategy")
  });

  /**
   * Result schema - returns success status
   */
  protected resultSchema = z.boolean();

  /**
   * The Lua function arguments
   */
  protected arguments = ["strategyId"];

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
    let activePlayer = Players[Game.GetActivePlayer()]
    if strategyId ~= -1 then
      activePlayer:SetGrandStrategy(strategyId)
    end
    return true
  `;

  /**
   * Execute the set-strategy command
   */
  async execute(args: z.infer<typeof this.inputSchema>): Promise<z.infer<typeof this.outputSchema>> {
    // Find the strategy ID from the string name
    let grandStrategy = retrieveEnumValue("GrandStrategy", args.GrandStrategy)

    // Call the parent execute with the strategy ID
    return super.execute({ grandStrategy });
  }
}

export default new SetStrategyTool();