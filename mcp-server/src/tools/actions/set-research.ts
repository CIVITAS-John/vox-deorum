/**
 * Tool for setting a player's next research technology in Civilization V
 */

import { LuaFunctionTool } from "../abstract/lua-function.js";
import * as z from "zod";
import { knowledgeManager } from "../../server.js";
import { MaxMajorCivs } from "../../knowledge/schema/base.js";
import { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { retrieveEnumValue, retrieveEnumName } from "../../utils/knowledge/enum.js";

/**
 * Tool that sets a player's next research technology using a Lua function
 */
class SetResearchTool extends LuaFunctionTool {
  name = "set-research";
  description = "Set a player's next research technology by name. The in-game AI will be forced to select this technology when making its next tech choice.";

  /**
   * Input schema for the set-research tool
   */
  inputSchema = z.object({
    PlayerID: z.number().min(0).max(MaxMajorCivs - 1).describe("ID of the player"),
    Technology: z.string().describe("Technology name to research next (None to clear)"),
    Rationale: z.string().describe("Explain your rationale for selecting this technology")
  });

  /**
   * Result schema - returns the previous technology selection
   */
  protected resultSchema = z.object({
    Previous: z.string().optional().describe("The previously forced technology selection, if any")
  }).optional();

  /**
   * The Lua function arguments
   */
  protected arguments = ["playerID", "techID"];

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
    local activePlayer = Players[playerID]

    -- Get the previous forced research (if any)
    local previousTechID = activePlayer:GetNextResearch()

    -- Set the new research technology
    activePlayer:SetNextResearch(techID)

    -- Return the previous technology ID
    return {
      Previous = previousTechID
    }
  `;

  /**
   * Execute the set-research command
   */
  async execute(args: z.infer<typeof this.inputSchema>): Promise<z.infer<typeof this.outputSchema>> {
    // Extract the arguments
    const { PlayerID, Technology, Rationale } = args;

    // Convert technology name to ID
    const techID = Technology.toLowerCase() === "none" ? -1 : retrieveEnumValue("TechID", Technology);

    if (techID === -1 && Technology.toLowerCase() !== "none") {
      throw new Error(`Technology "${Technology}" not found. Please use a valid technology name or 'None' to clear.`);
    }

    // Call the parent execute with the technology ID
    const result = await super.call(PlayerID, techID);

    if (result.Success) {
      const store = knowledgeManager.getStore();

      // Convert the previous tech ID back to a name
      if (result.Result?.Previous !== undefined) {
        const previousTechName = retrieveEnumName("TechID", result.Result.Previous);
        if (previousTechName) {
          result.Result.Previous = previousTechName;
        } else if (result.Result.Previous === -1) {
          result.Result.Previous = "None";
        }
      }

      // Store the research decision in the knowledge database
      await store.storeMutableKnowledge(
        'ResearchChanges',
        PlayerID,
        {
          Technology: Technology,
          Rationale: Rationale
        }
      );
    }

    return result;
  }
}

/**
 * Creates a new instance of the set research tool
 */
export default function createSetResearchTool() {
  return new SetResearchTool();
}