/**
 * Trade route assignment tool for AI player control
 */

import { LuaFunctionTool } from "../abstract/lua-function.js";
import * as z from "zod";
import { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { MaxMajorCivs } from "../../knowledge/schema/base.js";

const AssignTradeRouteResultSchema = z.object({
  Success: z.boolean(),
  UnitID: z.number(),
  FromCity: z.string().optional(),
  ToCity: z.string().optional(),
  Message: z.string().optional(),
});

type AssignTradeRouteResultType = z.infer<typeof AssignTradeRouteResultSchema>;

class AssignTradeRouteTool extends LuaFunctionTool<AssignTradeRouteResultType> {
  readonly name = "assign-trade-route";

  readonly description = `Assign a trade unit (caravan or cargo ship) to a trade route.

The trade unit must be in a city. Use get-trade-routes to see idle trade
units and potential destinations.`;

  inputSchema = z.object({
    PlayerID: z.number().min(0).max(MaxMajorCivs - 1)
      .describe("Player ID (owner of the trade unit)"),
    UnitID: z.number()
      .describe("The trade unit's ID (caravan or cargo ship)"),
    DestinationCityOwnerID: z.number()
      .describe("Player ID of the destination city owner"),
    DestinationCityID: z.number()
      .describe("Destination city's ID"),
  });

  protected resultSchema = AssignTradeRouteResultSchema;
  protected arguments = ["playerID", "unitID", "destOwnerID", "destCityID"];

  readonly annotations: ToolAnnotations = {
    readOnlyHint: false
  };

  protected script = `
    local player = Players[playerID]
    if not player then
      return { Success = false, UnitID = unitID, Message = "Invalid player" }
    end

    local unit = player:GetUnitByID(unitID)
    if not unit then
      return { Success = false, UnitID = unitID, Message = "Trade unit not found" }
    end

    -- Check if this is a trade unit
    if not unit:IsTrade() then
      return { Success = false, UnitID = unitID, Message = "Unit is not a trade unit" }
    end

    local destPlayer = Players[destOwnerID]
    if not destPlayer then
      return { Success = false, UnitID = unitID, Message = "Invalid destination owner" }
    end

    local destCity = destPlayer:GetCityByID(destCityID)
    if not destCity then
      return { Success = false, UnitID = unitID, Message = "Destination city not found" }
    end

    local destPlot = destCity:Plot()
    local fromPlot = unit:GetPlot()
    local fromCity = fromPlot:GetPlotCity()
    local fromCityName = fromCity and fromCity:GetName() or "Unknown"
    local toCityName = destCity:GetName()

    -- Check if we can make this trade route
    if not unit:CanMakeTradeRouteAt(destPlot, destPlot:GetX(), destPlot:GetY()) then
      return { Success = false, UnitID = unitID, FromCity = fromCityName, ToCity = toCityName, Message = "Cannot establish trade route to this city" }
    end

    -- Establish the trade route
    unit:PushMission(MissionTypes.MISSION_ESTABLISH_TRADE_ROUTE, destPlot:GetX(), destPlot:GetY())

    return {
      Success = true,
      UnitID = unitID,
      FromCity = fromCityName,
      ToCity = toCityName,
      Message = "Trade route established from " .. fromCityName .. " to " .. toCityName
    }
  `;

  async execute(args: z.infer<typeof this.inputSchema>): Promise<z.infer<typeof this.outputSchema>> {
    return await super.call(args.PlayerID, args.UnitID, args.DestinationCityOwnerID, args.DestinationCityID);
  }
}

export default function createAssignTradeRouteTool() {
  return new AssignTradeRouteTool();
}
