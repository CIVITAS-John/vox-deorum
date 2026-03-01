/**
 * Tool for unsetting (clearing) custom flavor values for a player in Civilization V
 */

import { LuaFunctionTool } from "../abstract/lua-function.js";
import * as z from "zod";
import { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { knowledgeManager } from "../../server.js";
import { MaxMajorCivs } from "../../knowledge/schema/base.js";
import { pushPlayerAction } from "../../utils/lua/player-actions.js";

/**
 * Schema for the result returned by the Lua script
 */
const UnsetFlavorsResultSchema = z.object({
  Success: z.boolean(),
  Message: z.string().optional()
});

type UnsetFlavorsResultType = z.infer<typeof UnsetFlavorsResultSchema>;

/**
 * Tool that unsets (clears) flavor values for a player using a Lua function
 */
class UnsetFlavorsTool extends LuaFunctionTool<UnsetFlavorsResultType> {
  /**
   * Unique identifier for the unset-flavors tool
   */
  readonly name = "unset-flavors";

  /**
   * Human-readable description of the tool
   */
  readonly description = "Clear all custom flavor values for a player, reverting to default AI preferences.";

  /**
   * Input schema for the unset-flavors tool
   */
  inputSchema = z.object({
    PlayerID: z.number().min(0).max(MaxMajorCivs - 1).describe("ID of the player")
  });

  /**
   * Result schema - returns success status and optional message
   */
  protected resultSchema = UnsetFlavorsResultSchema;

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
   * The Lua script to execute
   */
  protected script = `
    local activePlayer = Players[playerID]
    if not activePlayer then
      return { Success = false, Message = "Invalid player ID" }
    end

    -- Unset custom flavors
    local success = activePlayer:UnsetCustomFlavors()

    if success then
      return { Success = true, Message = "Custom flavors cleared successfully" }
    else
      return { Success = false, Message = "Failed to clear custom flavors" }
    end
  `;

  /**
   * Execute the unset-flavors command
   */
  async execute(args: z.infer<typeof this.inputSchema>): Promise<z.infer<typeof this.outputSchema>> {
    // Call the parent execute
    const result = await super.call(args.PlayerID);

    if (result.Success) {
      // Delete the flavor change record from the knowledge store
      const store = knowledgeManager.getStore();

      // Mark any existing FlavorChanges for this player as not latest
      // (We don't actually delete, just mark as historical)
      const db = await store.getDatabase();
      await db
        .updateTable('FlavorChanges')
        .set({ IsLatest: 0 })
        .where('Key', '=', args.PlayerID)
        .where('IsLatest', '=', 1)
        .execute();

      // Fire action event and replay message
      await pushPlayerAction(args.PlayerID, "unset-flavors", "Cleared custom flavors, reverting to default AI preferences", "", "");
    }

    return result;
  }
}

/**
 * Creates a new instance of the unset flavors tool
 */
export default function createUnsetFlavorsTool() {
  return new UnsetFlavorsTool();
}