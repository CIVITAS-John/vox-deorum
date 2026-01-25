/**
 * Upgrade unit tool for AI player control
 */

import { LuaFunctionTool } from "../abstract/lua-function.js";
import * as z from "zod";
import { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { MaxMajorCivs } from "../../knowledge/schema/base.js";

const UpgradeUnitResultSchema = z.object({
  Success: z.boolean(),
  UnitID: z.number(),
  OldType: z.string().optional(),
  NewType: z.string().optional(),
  GoldCost: z.number().optional(),
  Message: z.string().optional(),
});

type UpgradeUnitResultType = z.infer<typeof UpgradeUnitResultSchema>;

class UpgradeUnitTool extends LuaFunctionTool<UpgradeUnitResultType> {
  readonly name = "upgrade-unit";

  readonly description = `Upgrade a unit to its next available type.

The unit must be in friendly territory and you must have enough gold.
Use summarize-units to see which units can upgrade and the cost.`;

  inputSchema = z.object({
    PlayerID: z.number().min(0).max(MaxMajorCivs - 1)
      .describe("Player ID (owner of the unit)"),
    UnitID: z.number()
      .describe("The unit's ID"),
  });

  protected resultSchema = UpgradeUnitResultSchema;
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

    local oldType = Locale.ConvertTextKey(GameInfo.Units[unit:GetUnitType()].Description)

    -- Check if unit can upgrade
    local upgradeType = unit:GetUpgradeUnitType()
    if upgradeType == -1 then
      return { Success = false, UnitID = unitID, OldType = oldType, Message = "No upgrade available" }
    end

    if not unit:CanUpgradeRightNow() then
      return { Success = false, UnitID = unitID, OldType = oldType, Message = "Cannot upgrade right now (not in friendly territory or other restriction)" }
    end

    local cost = unit:UpgradePrice(upgradeType)
    if player:GetGold() < cost then
      return { Success = false, UnitID = unitID, OldType = oldType, GoldCost = cost, Message = "Not enough gold (need " .. cost .. ")" }
    end

    local newType = Locale.ConvertTextKey(GameInfo.Units[upgradeType].Description)

    -- Do the upgrade
    player:ChangeGold(-cost)
    unit:DoUpgrade()

    return {
      Success = true,
      UnitID = unitID,
      OldType = oldType,
      NewType = newType,
      GoldCost = cost,
      Message = "Upgraded " .. oldType .. " to " .. newType
    }
  `;

  async execute(args: z.infer<typeof this.inputSchema>): Promise<z.infer<typeof this.outputSchema>> {
    return await super.call(args.PlayerID, args.UnitID);
  }
}

export default function createUpgradeUnitTool() {
  return new UpgradeUnitTool();
}
