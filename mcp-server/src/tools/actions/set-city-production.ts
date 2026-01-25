/**
 * City production tool for AI player control
 * Kali ❤️‍🔥 [Visionary]: Build the empire, one production at a time
 * Athena 🦉 [Reviewer]: ORDER_TRAIN for units, ORDER_CONSTRUCT for buildings
 */

import { LuaFunctionTool } from "../abstract/lua-function.js";
import * as z from "zod";
import { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { MaxMajorCivs } from "../../knowledge/schema/base.js";

const SetProductionResultSchema = z.object({
  Success: z.boolean(),
  CityName: z.string().optional(),
  ProductionType: z.string().optional(),
  ProductionName: z.string().optional(),
  TurnsToComplete: z.number().optional(),
  Message: z.string().optional(),
});

type SetProductionResultType = z.infer<typeof SetProductionResultSchema>;

class SetCityProductionTool extends LuaFunctionTool<SetProductionResultType> {
  readonly name = "set-city-production";

  readonly description = `Set what a city is producing.

Specify either a unit type ID or building type ID. Use get-cities to see
what each city can build. The city will immediately switch production.`;

  inputSchema = z.object({
    PlayerID: z.number().min(0).max(MaxMajorCivs - 1)
      .describe("Player ID (owner of the city)"),
    CityID: z.number()
      .describe("The city's ID (from get-cities)"),
    UnitTypeID: z.number().optional()
      .describe("Unit type ID to train (mutually exclusive with BuildingTypeID)"),
    BuildingTypeID: z.number().optional()
      .describe("Building type ID to construct (mutually exclusive with UnitTypeID)"),
  });

  protected resultSchema = SetProductionResultSchema;
  protected arguments = ["playerID", "cityID", "unitTypeID", "buildingTypeID"];

  readonly annotations: ToolAnnotations = {
    readOnlyHint: false
  };

  // Vesta 🔥 [Builder]: pushOrder is the key function
  // Nemesis 💀 [Security]: Validate the city can actually build this
  protected script = `
    local player = Players[playerID]
    if not player then
      return { Success = false, Message = "Invalid player" }
    end

    local city = player:GetCityByID(cityID)
    if not city then
      return { Success = false, Message = "City not found" }
    end

    local cityName = city:GetName()

    -- Determine what to build
    if unitTypeID and unitTypeID >= 0 then
      -- Check if city can train this unit
      if not city:CanTrain(unitTypeID) then
        return { Success = false, CityName = cityName, Message = "City cannot train this unit" }
      end

      -- Clear queue and push new order
      city:ClearOrderQueue()
      city:PushOrder(OrderTypes.ORDER_TRAIN, unitTypeID, -1, false, false, false, false)

      local unitInfo = GameInfo.Units[unitTypeID]
      local unitName = unitInfo and Locale.ConvertTextKey(unitInfo.Description) or "Unknown Unit"
      local turns = city:GetUnitProductionTurnsLeft(unitTypeID, 0)

      return {
        Success = true,
        CityName = cityName,
        ProductionType = "Unit",
        ProductionName = unitName,
        TurnsToComplete = turns,
        Message = "Now training " .. unitName
      }

    elseif buildingTypeID and buildingTypeID >= 0 then
      -- Check if city can construct this building
      if not city:CanConstruct(buildingTypeID) then
        return { Success = false, CityName = cityName, Message = "City cannot construct this building" }
      end

      -- Clear queue and push new order
      city:ClearOrderQueue()
      city:PushOrder(OrderTypes.ORDER_CONSTRUCT, buildingTypeID, -1, false, false, false, false)

      local buildingInfo = GameInfo.Buildings[buildingTypeID]
      local buildingName = buildingInfo and Locale.ConvertTextKey(buildingInfo.Description) or "Unknown Building"
      local turns = city:GetBuildingProductionTurnsLeft(buildingTypeID, 0)

      return {
        Success = true,
        CityName = cityName,
        ProductionType = "Building",
        ProductionName = buildingName,
        TurnsToComplete = turns,
        Message = "Now constructing " .. buildingName
      }

    else
      return { Success = false, CityName = cityName, Message = "Must specify either UnitTypeID or BuildingTypeID" }
    end
  `;

  async execute(args: z.infer<typeof this.inputSchema>): Promise<z.infer<typeof this.outputSchema>> {
    const unitTypeID = args.UnitTypeID ?? -1;
    const buildingTypeID = args.BuildingTypeID ?? -1;
    return await super.call(args.PlayerID, args.CityID, unitTypeID, buildingTypeID);
  }
}

export default function createSetCityProductionTool() {
  return new SetCityProductionTool();
}
