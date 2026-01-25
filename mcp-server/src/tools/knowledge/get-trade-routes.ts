/**
 * Trade routes tool for AI accessibility (Issue #469)
 */

import { ToolBase } from "../base.js";
import * as z from "zod";
import { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { getTradeRoutes } from "../../knowledge/getters/trade-routes.js";
import { MaxMajorCivs } from "../../knowledge/schema/base.js";

const GetTradeRoutesInputSchema = z.object({
  PlayerID: z.number().min(0).max(MaxMajorCivs - 1).optional()
    .describe("Player ID (default: 0)"),
});

const TradeRouteSchema = z.object({
  Domain: z.enum(["Land", "Sea"]),
  FromCity: z.string(),
  ToCity: z.string(),
  ToCiv: z.string(),
  TurnsRemaining: z.number(),
  IsInternal: z.boolean(),

  FromGold: z.number(),
  ToGold: z.number(),
  FromFood: z.number().optional(),
  FromProduction: z.number().optional(),
  FromScience: z.number().optional(),
  ToScience: z.number().optional(),
  FromReligiousPressure: z.number().optional(),
  ToReligiousPressure: z.number().optional(),
});

const IdleTradeUnitSchema = z.object({
  ID: z.number(),
  Name: z.string(),
  X: z.number(),
  Y: z.number(),
  InCity: z.string().optional(),
  Domain: z.enum(["Land", "Sea"]),
});

const GetTradeRoutesOutputSchema = z.object({
  TotalRoutes: z.number(),
  AvailableSlots: z.number(),
  MaxRoutes: z.number(),
  ActiveRoutes: z.array(TradeRouteSchema),
  IdleTradeUnits: z.array(IdleTradeUnitSchema).describe("Trade units that can establish new routes"),
});

class GetTradeRoutesTool extends ToolBase {
  readonly name = "get-trade-routes";

  readonly description = `Get all trade route information with yields.

Shows:
- Active routes with gold, food, production, science yields
- Turns remaining on each route
- Internal vs international routes
- Religious pressure from routes
- Available trade route slots
- Idle trade units that can establish new routes`;

  readonly inputSchema = GetTradeRoutesInputSchema;
  readonly outputSchema = GetTradeRoutesOutputSchema;

  readonly annotations: ToolAnnotations = { readOnlyHint: true };

  async execute(args: z.infer<typeof this.inputSchema>): Promise<z.infer<typeof this.outputSchema>> {
    const playerID = args.PlayerID ?? 0;
    const data = await getTradeRoutes(playerID);

    if (!data) {
      throw new Error('Failed to get trade routes data');
    }

    return data;
  }
}

export default function createGetTradeRoutesTool() {
  return new GetTradeRoutesTool();
}
