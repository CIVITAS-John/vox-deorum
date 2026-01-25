/**
 * Sell building tool for AI player control
 */

import { LuaFunctionTool } from "../abstract/lua-function.js";
import * as z from "zod";
import { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { MaxMajorCivs } from "../../knowledge/schema/base.js";

const SellBuildingResultSchema = z.object({
  Success: z.boolean(),
  CityName: z.string().optional(),
  BuildingName: z.string().optional(),
  GoldReceived: z.number().optional(),
  Message: z.string().optional(),
});

type SellBuildingResultType = z.infer<typeof SellBuildingResultSchema>;

class SellBuildingTool extends LuaFunctionTool<SellBuildingResultType> {
  readonly name = "sell-building";

  readonly description = `Sell a building in a city for gold.

Not all buildings can be sold (wonders, etc. cannot).
Use get-cities to see which buildings exist in each city.`;

  inputSchema = z.object({
    PlayerID: z.number().min(0).max(MaxMajorCivs - 1)
      .describe("Player ID (owner of the city)"),
    CityID: z.number()
      .describe("The city's ID"),
    BuildingTypeID: z.number()
      .describe("Building type ID to sell"),
  });

  protected resultSchema = SellBuildingResultSchema;
  protected arguments = ["playerID", "cityID", "buildingTypeID"];

  readonly annotations: ToolAnnotations = {
    readOnlyHint: false
  };

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
    local buildingInfo = GameInfo.Buildings[buildingTypeID]

    if not buildingInfo then
      return { Success = false, CityName = cityName, Message = "Invalid building type" }
    end

    local buildingName = Locale.ConvertTextKey(buildingInfo.Description)

    if not city:IsHasBuilding(buildingTypeID) then
      return { Success = false, CityName = cityName, BuildingName = buildingName, Message = "City does not have this building" }
    end

    if not city:IsBuildingSellable(buildingTypeID) then
      return { Success = false, CityName = cityName, BuildingName = buildingName, Message = "This building cannot be sold" }
    end

    local goldValue = city:GetSellBuildingRefund(buildingTypeID)

    city:SetNumRealBuilding(buildingTypeID, 0)
    player:ChangeGold(goldValue)

    return {
      Success = true,
      CityName = cityName,
      BuildingName = buildingName,
      GoldReceived = goldValue,
      Message = "Sold " .. buildingName .. " for " .. goldValue .. " gold"
    }
  `;

  async execute(args: z.infer<typeof this.inputSchema>): Promise<z.infer<typeof this.outputSchema>> {
    return await super.call(args.PlayerID, args.CityID, args.BuildingTypeID);
  }
}

export default function createSellBuildingTool() {
  return new SellBuildingTool();
}
