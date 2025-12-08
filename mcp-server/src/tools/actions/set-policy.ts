/**
 * Tool for setting a player's next policy selection in Civilization V
 */

import { LuaFunctionTool } from "../abstract/lua-function.js";
import * as z from "zod";
import { knowledgeManager } from "../../server.js";
import { MaxMajorCivs } from "../../knowledge/schema/base.js";
import { ExtendedToolAnnotations } from "../types/tool-annotations.js";
import { retrieveEnumValue, retrieveEnumName } from "../../utils/knowledge/enum.js";
import { addReplayMessages } from "../../utils/lua/replay-messages.js";

/**
 * Schema for the result returned by the Lua script
 */
const SetPolicyResultSchema = z.object({
  PreviousPolicy: z.number().optional(),
  PreviousBranch: z.number().optional(),
  // These properties are added by the execute method
  Previous: z.string().optional(),
  IsBranch: z.boolean().optional()
});

type SetPolicyResultType = z.infer<typeof SetPolicyResultSchema>;

/**
 * Tool that sets a player's next policy selection using a Lua function
 * Can accept either a PolicyBranchType or PolicyID
 */
class SetPolicyTool extends LuaFunctionTool<SetPolicyResultType> {
  name = "set-policy";
  description = "Set a player's next policy selection by name. The in-game AI will be forced to select this policy or policy branch when making its next policy choice.";

  /**
   * Input schema for the set-policy tool
   */
  inputSchema = z.object({
    PlayerID: z.number().min(0).max(MaxMajorCivs - 1).describe("ID of the player"),
    Policy: z.string().describe("Policy name or branch name to adopt next (None to clear)"),
    Rationale: z.string().describe("Explain your rationale for selecting this policy")
  });

  /**
   * Result schema - returns the previous policy selection
   */
  protected resultSchema = SetPolicyResultSchema;

  /**
   * The Lua function arguments
   */
  protected arguments = ["playerID", "policyID", "branchID"];

  /**
   * Optional annotations for the Lua executor tool
   */
  readonly annotations: ExtendedToolAnnotations = {
    autoComplete: ["PlayerID"],
    readOnlyHint: false
  }

  /**
   * The Lua script to execute
   */
  protected script = `
    local activePlayer = Players[playerID]

    -- Get the previous forced policy (if any)
    -- GetNextPolicy returns (policyID, branchID)
    local prevPolicy, prevBranch = activePlayer:GetNextPolicy()

    -- Set the new policy selection
    -- SetNextPolicy takes (policyID, branchID)
    activePlayer:SetNextPolicy(policyID, branchID)

    -- Return the previous selections
    return {
      PreviousPolicy = prevPolicy,
      PreviousBranch = prevBranch
    }
  `;

  /**
   * Execute the set-policy command
   */
  async execute(args: z.infer<typeof this.inputSchema>): Promise<z.infer<typeof this.outputSchema>> {
    // Extract the arguments
    var { PlayerID, Policy, Rationale } = args;

    // Convert policy name to ID - first try as a branch, then as a policy
    let policyID = -1;
    let branchID = -1;
    let isBranch = false;

    if (Policy.toLowerCase() === "none") {
      // Clear both
      policyID = -1;
      branchID = -1;
    } else {
      // Try as a branch first
      branchID = retrieveEnumValue("BranchType", Policy);
      if (branchID !== -1) {
        isBranch = true;
      } else {
        // Try as an individual policy
        policyID = retrieveEnumValue("PolicyID", Policy);
        if (policyID === -1) {
          Policy = "None"
        // throw new Error(`Policy or branch "${Policy}" not found. Please use a valid policy/branch name or 'None' to clear.`);
        }
      }
    }

    // Call the parent execute with policyID and branchID
    const result = await super.call(PlayerID, policyID, branchID);

    if (result.Success) {
      const store = knowledgeManager.getStore();

      // Convert the previous policy/branch IDs back to names
      if (result.Result) {
        if (result.Result.PreviousPolicy !== -1) {
          const policyName = retrieveEnumName("PolicyID", result.Result.PreviousPolicy);
          result.Result.Previous = policyName || "None";
          result.Result.IsBranch = false;
        } else if (result.Result.PreviousBranch !== -1) {
          const branchName = retrieveEnumName("BranchType", result.Result.PreviousBranch);
          result.Result.Previous = branchName || "None";
          result.Result.IsBranch = true;
        } else {
          result.Result.Previous = "None";
          result.Result.IsBranch = false;
        }
        delete result.Result.PreviousPolicy;
        delete result.Result.PreviousBranch;
      }

      // Store the policy decision in the knowledge database
      await store.storeMutableKnowledge(
        'PolicyChanges',
        PlayerID,
        {
          Policy: Policy,
          IsBranch: isBranch ? 1 : 0,
          Rationale: Rationale
        }
      );

      // Send replay message if the policy actually changed
      const previousPolicy = result.Result?.Previous;
      if (Policy !== previousPolicy && !(Policy === "None" && previousPolicy === "Unknown")) {
        const beforeDesc = previousPolicy || "None";
        const afterDesc = Policy;
        const typeDesc = isBranch ? "policy branch" : "policy";
        const message = `Changed next ${typeDesc}: ${beforeDesc} → ${afterDesc}. Rationale: ${Rationale}`;
        await addReplayMessages(PlayerID, message);
      }
    }

    delete result.Result;
    return result;
  }
}

/**
 * Creates a new instance of the set policy tool
 */
export default function createSetPolicyTool() {
  return new SetPolicyTool();
}