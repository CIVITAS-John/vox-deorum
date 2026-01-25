/**
 * World Congress tool for AI accessibility (Issue #469)
 */

import { ToolBase } from "../base.js";
import * as z from "zod";
import { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { getWorldCongress } from "../../knowledge/getters/world-congress.js";
import { MaxMajorCivs } from "../../knowledge/schema/base.js";

const GetWorldCongressInputSchema = z.object({
  PlayerID: z.number().min(0).max(MaxMajorCivs - 1).optional()
    .describe("Player ID (default: 0)"),
});

const ResolutionSchema = z.object({
  Name: z.string(),
  ProposedBy: z.string(),
  Type: z.enum(["Enact", "Repeal"]).optional(),
  CanPropose: z.boolean().optional(),
});

const MemberSchema = z.object({
  CivName: z.string(),
  Votes: z.number(),
  IsHost: z.boolean(),
});

const GetWorldCongressOutputSchema = z.object({
  Active: z.boolean().describe("Whether World Congress/UN exists"),
  Message: z.string().optional(),

  LeagueName: z.string().optional(),
  IsUnitedNations: z.boolean().optional(),
  HostCiv: z.string().optional(),

  InSession: z.boolean().optional(),
  TurnsUntilSession: z.number().optional(),
  IsSpecialSession: z.boolean().optional(),

  OurVotes: z.number().optional(),
  ProposalsAvailable: z.number().optional(),
  VotesRemaining: z.number().optional(),

  DiploVictoryEnabled: z.boolean().optional(),
  VotesNeededForVictory: z.number().optional(),

  ActiveResolutions: z.array(ResolutionSchema).optional(),
  CurrentProposals: z.array(ResolutionSchema).optional(),
  ProposableResolutions: z.array(ResolutionSchema).optional(),
  Members: z.array(MemberSchema).optional(),
});

class GetWorldCongressTool extends ToolBase {
  readonly name = "get-world-congress";

  readonly description = `Get World Congress / United Nations information.

Shows:
- Session status and turns until next session
- Our votes and proposal slots
- Active resolutions in effect
- Current proposals being voted on
- Available resolutions to propose
- Member civilizations and their votes
- Diplomatic victory progress`;

  readonly inputSchema = GetWorldCongressInputSchema;
  readonly outputSchema = GetWorldCongressOutputSchema;

  readonly annotations: ToolAnnotations = { readOnlyHint: true };

  async execute(args: z.infer<typeof this.inputSchema>): Promise<z.infer<typeof this.outputSchema>> {
    const playerID = args.PlayerID ?? 0;
    const data = await getWorldCongress(playerID);

    if (!data) {
      throw new Error('Failed to get world congress data');
    }

    return data;
  }
}

export default function createGetWorldCongressTool() {
  return new GetWorldCongressTool();
}
