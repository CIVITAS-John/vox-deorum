/**
 * Happiness breakdown tool for AI accessibility (Issue #469)
 */

import { ToolBase } from "../base.js";
import * as z from "zod";
import { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { getHappiness } from "../../knowledge/getters/happiness.js";
import { MaxMajorCivs } from "../../knowledge/schema/base.js";

const GetHappinessInputSchema = z.object({
  PlayerID: z.number().min(0).max(MaxMajorCivs - 1).optional()
    .describe("Player ID (default: 0)"),
});

const CityHappinessSchema = z.object({
  Name: z.string(),
  LocalHappiness: z.number(),
  Unhappiness: z.number(),
  IsResistance: z.boolean().optional(),
  ResistanceTurns: z.number().optional(),
  IsOccupied: z.boolean().optional(),
  WLTKD: z.number().optional().describe("We Love The King Day turns remaining"),
});

const GetHappinessOutputSchema = z.object({
  TotalHappiness: z.number(),
  TotalUnhappiness: z.number(),
  NetHappiness: z.number().describe("Positive = happy, negative = unhappy"),

  HappinessSources: z.object({
    FromCities: z.number(),
    FromTradeRoutes: z.number(),
    FromReligion: z.number(),
    FromNaturalWonders: z.number(),
    FromMinorCivs: z.number(),
    FromLeagues: z.number(),
    FromVassals: z.number(),
    FromLuxuries: z.number(),
    FromPolicies: z.number(),
    FromBuildings: z.number(),
    FromExtraHappinessPerCity: z.number(),
  }),

  UnhappinessSources: z.object({
    FromCities: z.number(),
    FromPopulation: z.number(),
    FromOccupation: z.number(),
    FromPublicOpinion: z.number(),
    FromUnits: z.number(),
    FromCitySpecialists: z.number(),
    FromWarWeariness: z.number(),
  }),

  IsGoldenAge: z.boolean(),
  GoldenAgeProgress: z.number(),
  GoldenAgeThreshold: z.number(),
  GoldenAgeTurnsLeft: z.number(),
  TurnsToGoldenAge: z.number().optional(),

  CityHappiness: z.array(CityHappinessSchema),
  Warnings: z.array(z.string()),
});

class GetHappinessTool extends ToolBase {
  readonly name = "get-happiness";

  readonly description = `Get full happiness/unhappiness breakdown.

Shows:
- Total happiness and unhappiness with net value
- Per-source breakdown (cities, trade, religion, luxuries, etc.)
- Golden age status and progress
- Per-city happiness details
- Warnings about unhappiness issues`;

  readonly inputSchema = GetHappinessInputSchema;
  readonly outputSchema = GetHappinessOutputSchema;

  readonly annotations: ToolAnnotations = { readOnlyHint: true };

  async execute(args: z.infer<typeof this.inputSchema>): Promise<z.infer<typeof this.outputSchema>> {
    const playerID = args.PlayerID ?? 0;
    const data = await getHappiness(playerID);

    if (!data) {
      throw new Error('Failed to get happiness data');
    }

    return data;
  }
}

export default function createGetHappinessTool() {
  return new GetHappinessTool();
}
