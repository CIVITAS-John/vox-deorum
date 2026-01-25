/**
 * Spread religion tool for missionaries and prophets
 */

import { LuaFunctionTool } from "../abstract/lua-function.js";
import * as z from "zod";
import { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { MaxMajorCivs } from "../../knowledge/schema/base.js";

const SpreadReligionResultSchema = z.object({
  Success: z.boolean(),
  UnitID: z.number(),
  CityName: z.string().optional(),
  SpreadStrength: z.number().optional(),
  ChargesRemaining: z.number().optional(),
  Message: z.string().optional(),
});

type SpreadReligionResultType = z.infer<typeof SpreadReligionResultSchema>;

class SpreadReligionTool extends LuaFunctionTool<SpreadReligionResultType> {
  readonly name = "spread-religion";

  readonly description = `Use a missionary or prophet to spread religion to a city.

The unit must be in or adjacent to the target city.
Missionaries have limited charges. Great Prophets are consumed.`;

  inputSchema = z.object({
    PlayerID: z.number().min(0).max(MaxMajorCivs - 1)
      .describe("Player ID (owner of the religious unit)"),
    UnitID: z.number()
      .describe("The missionary or prophet unit's ID"),
  });

  protected resultSchema = SpreadReligionResultSchema;
  protected arguments = ["playerID", "unitID"];

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
      return { Success = false, UnitID = unitID, Message = "Unit not found" }
    end

    local plot = unit:GetPlot()
    if not unit:CanSpreadReligion(plot) then
      return { Success = false, UnitID = unitID, Message = "Cannot spread religion here" }
    end

    local city = plot:GetPlotCity()
    if not city then
      -- Check adjacent plots for city
      for i = 0, 5 do
        local adjPlot = Map.PlotDirection(plot:GetX(), plot:GetY(), i)
        if adjPlot then
          city = adjPlot:GetPlotCity()
          if city then break end
        end
      end
    end

    local cityName = city and city:GetName() or "Unknown"
    local spreadStrength = unit:GetReligionSpreads()
    local chargesBefore = unit:GetSpreadsLeft and unit:GetSpreadsLeft() or 1

    unit:DoSpreadReligion()

    local chargesAfter = unit:GetSpreadsLeft and unit:GetSpreadsLeft() or 0

    return {
      Success = true,
      UnitID = unitID,
      CityName = cityName,
      SpreadStrength = spreadStrength,
      ChargesRemaining = chargesAfter,
      Message = "Spread religion to " .. cityName
    }
  `;

  async execute(args: z.infer<typeof this.inputSchema>): Promise<z.infer<typeof this.outputSchema>> {
    return await super.call(args.PlayerID, args.UnitID);
  }
}

export default function createSpreadReligionTool() {
  return new SpreadReligionTool();
}
