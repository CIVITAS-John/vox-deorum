/**
 * City founding tool for AI player control
 * Kali ❤️‍🔥 [Visionary]: The birth of a new city!
 * Athena 🦉 [Reviewer]: MISSION_FOUND - settler is consumed
 */

import { LuaFunctionTool } from "../abstract/lua-function.js";
import * as z from "zod";
import { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { MaxMajorCivs } from "../../knowledge/schema/base.js";

const FoundCityResultSchema = z.object({
  Success: z.boolean(),
  SettlerID: z.number(),
  X: z.number(),
  Y: z.number(),
  CityName: z.string().optional(),
  Message: z.string().optional(),
});

type FoundCityResultType = z.infer<typeof FoundCityResultSchema>;

class FoundCityTool extends LuaFunctionTool<FoundCityResultType> {
  readonly name = "found-city";

  readonly description = `Found a new city with a settler.

The settler must be on a valid tile (not too close to other cities,
not on water, etc.). The settler is consumed when the city is founded.
Use get-map-region to find good city locations.`;

  inputSchema = z.object({
    PlayerID: z.number().min(0).max(MaxMajorCivs - 1)
      .describe("Player ID (owner of the settler)"),
    UnitID: z.number()
      .describe("The settler unit's ID"),
  });

  protected resultSchema = FoundCityResultSchema;
  protected arguments = ["playerID", "unitID"];

  readonly annotations: ToolAnnotations = {
    readOnlyHint: false
  };

  // Nemesis 💀 [Security]: Verify settler can actually found here
  // Kali ❤️‍🔥 [User Advocate]: Return the new city name for feedback
  protected script = `
    local player = Players[playerID]
    if not player then
      return { Success = false, SettlerID = unitID, X = -1, Y = -1, Message = "Invalid player" }
    end

    local unit = player:GetUnitByID(unitID)
    if not unit then
      return { Success = false, SettlerID = unitID, X = -1, Y = -1, Message = "Unit not found" }
    end

    local x = unit:GetX()
    local y = unit:GetY()

    -- Check if this is a settler-type unit
    if not unit:IsFound() then
      return { Success = false, SettlerID = unitID, X = x, Y = y, Message = "Unit cannot found cities" }
    end

    -- Check if we can found here
    if not unit:CanFound(unit:GetPlot()) then
      return { Success = false, SettlerID = unitID, X = x, Y = y, Message = "Cannot found city at this location" }
    end

    -- Get city count before founding
    local cityCountBefore = player:GetNumCities()

    -- Found the city
    unit:PushMission(MissionTypes.MISSION_FOUND, -1, -1, 0, false, false, MissionAITypes.MISSIONAI_FOUND, nil, nil)

    -- Check if city was founded
    local cityCountAfter = player:GetNumCities()
    if cityCountAfter <= cityCountBefore then
      return { Success = false, SettlerID = unitID, X = x, Y = y, Message = "City founding failed" }
    end

    -- Find the new city (should be at this location)
    local plot = Map.GetPlot(x, y)
    local newCity = plot:GetPlotCity()
    local cityName = newCity and newCity:GetName() or "Unknown"

    return {
      Success = true,
      SettlerID = unitID,
      X = x,
      Y = y,
      CityName = cityName,
      Message = "Founded " .. cityName
    }
  `;

  async execute(args: z.infer<typeof this.inputSchema>): Promise<z.infer<typeof this.outputSchema>> {
    return await super.call(args.PlayerID, args.UnitID);
  }
}

export default function createFoundCityTool() {
  return new FoundCityTool();
}
