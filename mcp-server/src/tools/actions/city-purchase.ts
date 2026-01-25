/**
 * City purchase tool for buying units/buildings with gold
 */

import { LuaFunctionTool } from "../abstract/lua-function.js";
import * as z from "zod";
import { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { MaxMajorCivs } from "../../knowledge/schema/base.js";

const CityPurchaseResultSchema = z.object({
  Success: z.boolean(),
  CityName: z.string().optional(),
  PurchaseType: z.string().optional(),
  ItemName: z.string().optional(),
  GoldCost: z.number().optional(),
  Message: z.string().optional(),
});

type CityPurchaseResultType = z.infer<typeof CityPurchaseResultSchema>;

class CityPurchaseTool extends LuaFunctionTool<CityPurchaseResultType> {
  readonly name = "city-purchase";

  readonly description = `Purchase a unit or building instantly with gold.

Specify either UnitTypeID or BuildingTypeID (not both).
Use get-cities to see purchasable items and costs.`;

  inputSchema = z.object({
    PlayerID: z.number().min(0).max(MaxMajorCivs - 1)
      .describe("Player ID (owner of the city)"),
    CityID: z.number()
      .describe("The city's ID"),
    UnitTypeID: z.number().optional()
      .describe("Unit type ID to purchase"),
    BuildingTypeID: z.number().optional()
      .describe("Building type ID to purchase"),
  });

  protected resultSchema = CityPurchaseResultSchema;
  protected arguments = ["playerID", "cityID", "unitTypeID", "buildingTypeID"];

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
    local gold = player:GetGold()

    if unitTypeID and unitTypeID >= 0 then
      local unitInfo = GameInfo.Units[unitTypeID]
      if not unitInfo then
        return { Success = false, CityName = cityName, Message = "Invalid unit type" }
      end

      local unitName = Locale.ConvertTextKey(unitInfo.Description)

      if not city:IsCanPurchase(true, true, unitTypeID, -1, -1, YieldTypes.YIELD_GOLD) then
        return { Success = false, CityName = cityName, ItemName = unitName, Message = "Cannot purchase this unit" }
      end

      local cost = city:GetUnitPurchaseCost(unitTypeID)
      if gold < cost then
        return { Success = false, CityName = cityName, ItemName = unitName, GoldCost = cost, Message = "Not enough gold" }
      end

      city:PurchaseUnit(unitTypeID, YieldTypes.YIELD_GOLD)

      return {
        Success = true,
        CityName = cityName,
        PurchaseType = "Unit",
        ItemName = unitName,
        GoldCost = cost,
        Message = "Purchased " .. unitName
      }

    elseif buildingTypeID and buildingTypeID >= 0 then
      local buildingInfo = GameInfo.Buildings[buildingTypeID]
      if not buildingInfo then
        return { Success = false, CityName = cityName, Message = "Invalid building type" }
      end

      local buildingName = Locale.ConvertTextKey(buildingInfo.Description)

      if not city:IsCanPurchase(true, true, -1, buildingTypeID, -1, YieldTypes.YIELD_GOLD) then
        return { Success = false, CityName = cityName, ItemName = buildingName, Message = "Cannot purchase this building" }
      end

      local cost = city:GetBuildingPurchaseCost(buildingTypeID)
      if gold < cost then
        return { Success = false, CityName = cityName, ItemName = buildingName, GoldCost = cost, Message = "Not enough gold" }
      end

      city:PurchaseBuilding(buildingTypeID, YieldTypes.YIELD_GOLD)

      return {
        Success = true,
        CityName = cityName,
        PurchaseType = "Building",
        ItemName = buildingName,
        GoldCost = cost,
        Message = "Purchased " .. buildingName
      }

    else
      return { Success = false, CityName = cityName, Message = "Must specify UnitTypeID or BuildingTypeID" }
    end
  `;

  async execute(args: z.infer<typeof this.inputSchema>): Promise<z.infer<typeof this.outputSchema>> {
    const unitTypeID = args.UnitTypeID ?? -1;
    const buildingTypeID = args.BuildingTypeID ?? -1;
    return await super.call(args.PlayerID, args.CityID, unitTypeID, buildingTypeID);
  }
}

export default function createCityPurchaseTool() {
  return new CityPurchaseTool();
}
