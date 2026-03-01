/**
 * Tool for setting a player's next research technology in Civilization V
 */

import { LuaFunctionTool } from "../abstract/lua-function.js";
import * as z from "zod";
import { knowledgeManager } from "../../server.js";
import { MaxMajorCivs } from "../../knowledge/schema/base.js";
import { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { retrieveEnumValue, retrieveEnumName } from "../../utils/knowledge/enum.js";
import { pushPlayerAction } from "../../utils/lua/player-actions.js";
import { trimRationale } from "../../utils/text.js";

/**
 * Schema for the result returned by the Lua script
 */
const SetResearchResultSchema = z.object({
  Previous: z.number().optional(),
  Next: z.number().optional(), // Used for validation failures
  // This property is added by the execute method
  PreviousTech: z.string().optional()
});

type SetResearchResultType = z.infer<typeof SetResearchResultSchema>;

/**
 * Tool that sets a player's next research technology using a Lua function
 */
class SetResearchTool extends LuaFunctionTool<SetResearchResultType> {
  /**
   * Unique identifier for the set-research tool
   */
  readonly name = "set-research";

  /**
   * Human-readable description of the tool
   */
  readonly description = "Set a player's next research technology by name. The in-game AI will start researching it after completing the current one.";

  /**
   * Input schema for the set-research tool
   */
  inputSchema = z.object({
    PlayerID: z.number().min(0).max(MaxMajorCivs - 1).describe("ID of the player"),
    Technology: z.string().describe("Technology name to research next (None to clear)"),
    Rationale: z.string().describe("Briefly explain your rationale for selecting this technology")
  });

  /**
   * Result schema - returns the previous technology selection
   */
  protected resultSchema = SetResearchResultSchema;

  /**
   * The Lua function arguments
   */
  protected arguments = ["playerID", "techID"];

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

    -- Validate that the technology is available if not clearing (-1)
    if techID ~= -1 then
      local possibleTechs = activePlayer:GetPossibleTechs(true)
      local isValid = false
      for _, id in ipairs(possibleTechs) do
        if id == techID then isValid = true break end
      end
      if not isValid then return { Next = -1 } end
    end

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
    // Extract the arguments and trim rationale
    const { PlayerID, Technology, Rationale: rawRationale } = args;
    const Rationale = trimRationale(rawRationale);

    // Convert technology name to ID
    const techID = Technology.toLowerCase() === "none" ? -1 : retrieveEnumValue("TechID", Technology);

    if (techID === -1 && Technology.toLowerCase() !== "none") {
      throw new Error(`Technology "${Technology}" not found.`);
    }

    // Call the parent execute with the technology ID
    const result = await super.call(PlayerID, techID);

    if (result.Success) {
      // Check for validation failure
      if (result.Result?.Next === -1)
        throw new Error(`Technology "${Technology}" is not currently available for this player.`);

      // Convert the previous tech ID back to a name
      if (result.Result?.Previous !== undefined) {
        const previousTechName = retrieveEnumName("TechID", result.Result.Previous);
        if (previousTechName) {
          result.Result.PreviousTech = previousTechName;
        } else if (result.Result.Previous === -1) {
          result.Result.PreviousTech = "None";
        } else {
          result.Result.PreviousTech = "Unknown";
        }
        delete result.Result.Previous;
      }

      // Store the research decision in the knowledge database
      const store = knowledgeManager.getStore();
      await store.storeMutableKnowledge(
        'ResearchChanges',
        PlayerID,
        {
          Technology: Technology,
          Rationale: Rationale
        }
      );

      // Send action event and replay message if the technology actually changed
      const previousTech = result.Result?.PreviousTech;
      if (Technology !== previousTech) {
        const summary = `${previousTech || "None"} → ${Technology}`;
        await pushPlayerAction(PlayerID, "research", summary, Rationale, "Changed next research");
      }
    }

    delete result.Result;
    return result;
  }
}

/**
 * Creates a new instance of the set research tool
 */
export default function createSetResearchTool() {
  return new SetResearchTool();
}