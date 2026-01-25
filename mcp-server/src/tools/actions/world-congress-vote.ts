/**
 * World Congress voting tool for AI player control
 */

import { LuaFunctionTool } from "../abstract/lua-function.js";
import * as z from "zod";
import { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { MaxMajorCivs } from "../../knowledge/schema/base.js";

const WorldCongressVoteResultSchema = z.object({
  Success: z.boolean(),
  ResolutionName: z.string().optional(),
  VotesUsed: z.number().optional(),
  VoteChoice: z.string().optional(),
  Message: z.string().optional(),
});

type WorldCongressVoteResultType = z.infer<typeof WorldCongressVoteResultSchema>;

class WorldCongressVoteTool extends LuaFunctionTool<WorldCongressVoteResultType> {
  readonly name = "world-congress-vote";

  readonly description = `Cast votes in World Congress / United Nations.

Use get-world-congress to see current proposals and available votes.
You can vote YES, NO, or for a specific CHOICE (for targeted resolutions).`;

  inputSchema = z.object({
    PlayerID: z.number().min(0).max(MaxMajorCivs - 1)
      .describe("Your player ID"),
    ResolutionIndex: z.number().min(0)
      .describe("Index of the resolution to vote on"),
    Choice: z.number()
      .describe("Vote choice: 0=NO, 1=YES, or specific choice ID for targeted resolutions"),
    NumVotes: z.number().min(1)
      .describe("Number of votes to commit to this choice"),
  });

  protected resultSchema = WorldCongressVoteResultSchema;
  protected arguments = ["playerID", "resolutionIndex", "choice", "numVotes"];

  readonly annotations: ToolAnnotations = {
    readOnlyHint: false
  };

  protected script = `
    local player = Players[playerID]
    if not player then
      return { Success = false, Message = "Invalid player" }
    end

    local league = Game.GetActiveLeague()
    if not league then
      return { Success = false, Message = "World Congress not active" }
    end

    if not league:IsInSession() then
      return { Success = false, Message = "Congress is not in session" }
    end

    -- Get available votes
    local votesAvailable = league:GetRemainingVotesForMember(playerID)
    if votesAvailable < numVotes then
      return { Success = false, Message = "Not enough votes (have " .. votesAvailable .. ", need " .. numVotes .. ")" }
    end

    -- Get the proposal
    local proposals = league:GetProposals()
    if resolutionIndex >= #proposals then
      return { Success = false, Message = "Invalid resolution index" }
    end

    local proposal = proposals[resolutionIndex + 1]
    local resolutionInfo = GameInfo.Resolutions[proposal.Type]
    local resolutionName = resolutionInfo and Locale.ConvertTextKey(resolutionInfo.Description) or "Unknown Resolution"

    -- Cast the vote
    local success = league:DoVoteCommit(playerID, resolutionIndex, choice, numVotes)

    local choiceStr = choice == 0 and "NO" or (choice == 1 and "YES" or "Choice " .. choice)

    if success then
      return {
        Success = true,
        ResolutionName = resolutionName,
        VotesUsed = numVotes,
        VoteChoice = choiceStr,
        Message = "Cast " .. numVotes .. " vote(s) " .. choiceStr .. " on " .. resolutionName
      }
    else
      return {
        Success = false,
        ResolutionName = resolutionName,
        Message = "Failed to cast vote"
      }
    end
  `;

  async execute(args: z.infer<typeof this.inputSchema>): Promise<z.infer<typeof this.outputSchema>> {
    return await super.call(args.PlayerID, args.ResolutionIndex, args.Choice, args.NumVotes);
  }
}

export default function createWorldCongressVoteTool() {
  return new WorldCongressVoteTool();
}
