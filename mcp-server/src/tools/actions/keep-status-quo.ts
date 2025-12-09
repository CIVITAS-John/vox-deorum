/**
 * Tool for recording the decision to maintain current strategic direction
 */

import { LuaFunctionTool } from "../abstract/lua-function.js";
import * as z from "zod";
import { knowledgeManager } from "../../server.js";
import { MaxMajorCivs } from "../../knowledge/schema/base.js";
import { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";

/**
 * Tool that refreshes the current strategies and records the decision to keep the status quo
 */
class KeepStatusQuoTool extends LuaFunctionTool<boolean> {
  /**
   * Unique identifier for the keep-status-quo tool
   */
  readonly name = "keep-status-quo";

  /**
   * Human-readable description of the tool
   */
  readonly description = "Maintain the current in-game strategy and document the rationale";

  /**
   * Input schema for the keep-status-quo tool
   */
  readonly inputSchema = z.object({
    PlayerID: z.number().min(0).max(MaxMajorCivs - 1).describe("ID of the player"),
    Rationale: z.string().describe("Explanation for why the current strategic direction should be maintained")
  });

  /**
   * Result schema - always true unless execution failed
   */
  protected resultSchema = z.boolean();

  /**
   * The Lua function arguments
   */
  protected arguments = ["playerID"];

  /**
   * Optional annotations for the Lua executor tool
   */
  readonly annotations: ToolAnnotations = {
    readOnlyHint: false
  }

  /**
   * Optional metadata
   */
  readonly metadata = {
    autoComplete: ["PlayerID"]
  }

  /**
   * The Lua script to execute - refreshes current strategies by reading and re-applying them
   */
  protected script = `
    local activePlayer = Players[playerID]

    -- Get current strategies
    local currentGrand = activePlayer:GetGrandStrategy()
    local currentEconomic = activePlayer:GetEconomicStrategies()
    local currentMilitary = activePlayer:GetMilitaryStrategies()

    -- Re-apply the same strategies to refresh them
    activePlayer:SetGrandStrategy(currentGrand)
    activePlayer:SetEconomicStrategies(currentEconomic)
    activePlayer:SetMilitaryStrategies(currentMilitary)

    return true
  `;

  /**
   * Execute the keep-status-quo command
   */
  async execute(args: z.infer<typeof this.inputSchema>): Promise<z.infer<typeof this.outputSchema>> {
    // Call the Lua function to refresh strategies
    const result = await super.call(args.PlayerID);

    if (result.Success) {
      const store = knowledgeManager.getStore();

      // Get the current strategies from the knowledge store
      const previous = await store.getMutableKnowledge("StrategyChanges", args.PlayerID);

      // Store the strategy (always) with the rationale
      await store.storeMutableKnowledge(
        'StrategyChanges',
        args.PlayerID,
        {
          GrandStrategy: previous?.GrandStrategy,
          MilitaryStrategies: previous?.MilitaryStrategies ?? [],
          EconomicStrategies: previous?.EconomicStrategies ?? [],
          Rationale: args.Rationale
        }
      );
    }

    return result;
  }
}

/**
 * Creates a new instance of the keep status quo tool
 */
export default function createKeepStatusQuoTool() {
  return new KeepStatusQuoTool();
}