/**
 * Espionage tool for AI accessibility (Issue #469)
 */

import { ToolBase } from "../base.js";
import * as z from "zod";
import { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { getEspionage } from "../../knowledge/getters/espionage.js";
import { MaxMajorCivs } from "../../knowledge/schema/base.js";

const GetEspionageInputSchema = z.object({
  PlayerID: z.number().min(0).max(MaxMajorCivs - 1).optional()
    .describe("Player ID (default: 0)"),
});

const SpySchema = z.object({
  Name: z.string(),
  Rank: z.number(),
  Location: z.string().optional(),
  LocationOwner: z.string().optional(),
  State: z.enum([
    "Unassigned", "Travelling", "GatheringIntel", "CounterIntelligence",
    "Schmoozing", "RiggingElection", "StagingCoup", "Diplomat", "Surveillance", "Unknown"
  ]),
  TurnsInState: z.number().optional(),
});

const CityIntelSchema = z.object({
  CityName: z.string(),
  Owner: z.string(),
  Population: z.number().optional(),
  HasOurSpy: z.boolean(),
  EspionagePotential: z.number().optional().describe("Higher = more valuable target"),
  IsCapital: z.boolean().optional(),
  IsOurCity: z.boolean().optional(),
});

const IntrigueSchema = z.object({
  Turn: z.number(),
  Message: z.string(),
  SpyName: z.string().optional(),
});

const GetEspionageOutputSchema = z.object({
  Spies: z.array(SpySchema),
  CityIntelligence: z.array(CityIntelSchema),
  IntrigueMessages: z.array(IntrigueSchema).describe("Recent intelligence reports"),
});

class GetEspionageTool extends ToolBase {
  readonly name = "get-espionage";

  readonly description = `Get spy locations, states, and intelligence.

Shows:
- All spies with their locations and current activities
- City espionage potential ratings
- Intrigue messages (intelligence reports)
- Counterintelligence status in our cities`;

  readonly inputSchema = GetEspionageInputSchema;
  readonly outputSchema = GetEspionageOutputSchema;

  readonly annotations: ToolAnnotations = { readOnlyHint: true };

  async execute(args: z.infer<typeof this.inputSchema>): Promise<z.infer<typeof this.outputSchema>> {
    const playerID = args.PlayerID ?? 0;
    const data = await getEspionage(playerID);

    if (!data) {
      throw new Error('Failed to get espionage data');
    }

    return data;
  }
}

export default function createGetEspionageTool() {
  return new GetEspionageTool();
}
