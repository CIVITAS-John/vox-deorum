/**
 * Culture/Tourism influence tool for AI accessibility (Issue #469)
 */

import { ToolBase } from "../base.js";
import * as z from "zod";
import { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { getCultureInfluence } from "../../knowledge/getters/culture-influence.js";
import { MaxMajorCivs } from "../../knowledge/schema/base.js";

const GetCultureInfluenceInputSchema = z.object({
  PlayerID: z.number().min(0).max(MaxMajorCivs - 1).optional()
    .describe("Player ID (default: 0)"),
});

const InfluenceSchema = z.object({
  CivName: z.string(),
  InfluenceLevel: z.enum(["Unknown", "Exotic", "Familiar", "Popular", "Influential", "Dominant"]),
  InfluencePercent: z.number(),
  TheirCulturePerTurn: z.number().optional(),
  TourismTowardThem: z.number().optional(),
  TurnsToNextLevel: z.number().optional(),
});

const CityCultureSchema = z.object({
  Name: z.string(),
  CulturePerTurn: z.number(),
  TourismPerTurn: z.number(),
  GreatWorks: z.number(),
});

const GetCultureInfluenceOutputSchema = z.object({
  OurCulturePerTurn: z.number(),
  OurTourismPerTurn: z.number(),

  OurIdeology: z.string().optional(),
  IdeologyLevel: z.number().describe("Number of tenets adopted"),

  InfluenceOnOthers: z.array(InfluenceSchema).describe("Our cultural influence on other civs"),
  InfluenceOnUs: z.array(InfluenceSchema).describe("Other civs' influence on us"),

  PublicOpinion: z.enum(["Content", "Dissidents", "Civil Resistance", "Revolutionary Wave"]),
  PublicOpinionUnhappiness: z.number(),
  PreferredIdeology: z.string().optional().describe("What ideology people want if unhappy"),

  GreatWorksCount: z.number(),
  ThemedBonuses: z.number(),

  CultureByCity: z.array(CityCultureSchema),
});

class GetCultureInfluenceTool extends ToolBase {
  readonly name = "get-culture-influence";

  readonly description = `Get tourism, cultural influence, and ideology status.

Shows:
- Our culture and tourism output
- Influence level on each civilization (Unknown → Dominant)
- Other civs' influence on us
- Public opinion and ideology pressure
- Great works count per city
- Turns to next influence level`;

  readonly inputSchema = GetCultureInfluenceInputSchema;
  readonly outputSchema = GetCultureInfluenceOutputSchema;

  readonly annotations: ToolAnnotations = { readOnlyHint: true };

  async execute(args: z.infer<typeof this.inputSchema>): Promise<z.infer<typeof this.outputSchema>> {
    const playerID = args.PlayerID ?? 0;
    const data = await getCultureInfluence(playerID);

    if (!data) {
      throw new Error('Failed to get culture influence data');
    }

    return data;
  }
}

export default function createGetCultureInfluenceTool() {
  return new GetCultureInfluenceTool();
}
