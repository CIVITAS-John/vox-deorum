/**
 * Tool for recording the decision to maintain current strategic direction
 */

import { ToolBase } from "../base.js";
import * as z from "zod";
import { knowledgeManager } from "../../server.js";
import { MaxMajorCivs } from "../../knowledge/schema/base.js";
import { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";

/**
 * Tool that records the decision to keep the status quo without changing game state
 */
class KeepStatusQuoTool extends ToolBase {
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
   * Output schema for the tool
   */
  readonly outputSchema = z.boolean();

  /**
   * Optional annotations for the Lua executor tool
   */
  readonly annotations: ToolAnnotations = {
    autoComplete: ["PlayerID"],
    readOnlyHint: false
  }

  /**
   * Execute the keep-status-quo command
   */
  async execute(args: z.infer<typeof this.inputSchema>): Promise<boolean> {
    const store = knowledgeManager.getStore();
    const previous = await store.getMutableKnowledge("StrategyChanges", args.PlayerID);
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
    return true;
  }
}

/**
 * Creates a new instance of the keep status quo tool
 */
export default function createKeepStatusQuoTool() {
  return new KeepStatusQuoTool();
}