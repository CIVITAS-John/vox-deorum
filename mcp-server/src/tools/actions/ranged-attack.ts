/**
 * Ranged attack tool for AI player control
 * Kali ❤️‍🔥 [Visionary]: Archers, crossbows, artillery - strike from afar
 * Athena 🦉 [Reviewer]: Ranged units don't take counter-damage (usually)
 */

import { LuaFunctionTool } from "../abstract/lua-function.js";
import * as z from "zod";
import { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { MaxMajorCivs } from "../../knowledge/schema/base.js";

const RangedAttackResultSchema = z.object({
  Success: z.boolean(),
  AttackerID: z.number(),
  TargetX: z.number(),
  TargetY: z.number(),
  DamageDealt: z.number().optional(),
  TargetKilled: z.boolean().optional(),
  Message: z.string().optional(),
});

type RangedAttackResultType = z.infer<typeof RangedAttackResultSchema>;

class RangedAttackTool extends LuaFunctionTool<RangedAttackResultType> {
  readonly name = "ranged-attack";

  readonly description = `Execute a ranged attack against a target tile.

The unit fires at the target without moving. Ranged attacks typically
don't trigger counter-attacks. The target must be within range.
Use get-combat-preview to check range and expected damage.`;

  inputSchema = z.object({
    PlayerID: z.number().min(0).max(MaxMajorCivs - 1)
      .describe("Player ID (owner of the attacking unit)"),
    UnitID: z.number()
      .describe("The ranged unit's ID"),
    TargetX: z.number().min(0)
      .describe("Target tile X coordinate"),
    TargetY: z.number().min(0)
      .describe("Target tile Y coordinate"),
  });

  protected resultSchema = RangedAttackResultSchema;
  protected arguments = ["playerID", "unitID", "targetX", "targetY"];

  readonly annotations: ToolAnnotations = {
    readOnlyHint: false
  };

  // Vesta 🔥 [Builder]: MISSION_RANGE_ATTACK is the key
  protected script = `
    local player = Players[playerID]
    if not player then
      return { Success = false, AttackerID = unitID, TargetX = targetX, TargetY = targetY, Message = "Invalid player" }
    end

    local unit = player:GetUnitByID(unitID)
    if not unit then
      return { Success = false, AttackerID = unitID, TargetX = targetX, TargetY = targetY, Message = "Unit not found" }
    end

    -- Check if unit can do ranged attacks
    if not unit:IsRanged() then
      return { Success = false, AttackerID = unitID, TargetX = targetX, TargetY = targetY, Message = "Unit is not ranged" }
    end

    if not unit:CanRangeStrikeAt(targetX, targetY) then
      return { Success = false, AttackerID = unitID, TargetX = targetX, TargetY = targetY, Message = "Target out of range or invalid" }
    end

    local targetPlot = Map.GetPlot(targetX, targetY)
    if not targetPlot then
      return { Success = false, AttackerID = unitID, TargetX = targetX, TargetY = targetY, Message = "Invalid target coordinates" }
    end

    -- Get target info before attack
    local defender = targetPlot:GetUnit(0)
    local defenderHPBefore = defender and defender:GetCurrHitPoints() or 0
    local targetCity = targetPlot:GetPlotCity()
    local cityHPBefore = targetCity and targetCity:GetDamage() or 0

    -- Execute the ranged attack
    unit:PushMission(MissionTypes.MISSION_RANGE_ATTACK, targetX, targetY, 0, false, false, MissionAITypes.NO_MISSIONAI, nil, nil)

    -- Check results
    local damageDealt = 0
    local targetKilled = false

    if defender then
      local defenderAlive = defender.IsAlive and defender:IsAlive() or false
      local defenderHPAfter = defenderAlive and defender:GetCurrHitPoints() or 0
      damageDealt = defenderHPBefore - defenderHPAfter
      targetKilled = not defenderAlive
    elseif targetCity then
      local cityHPAfter = targetCity:GetDamage()
      damageDealt = cityHPAfter - cityHPBefore  -- Damage increases for cities
    end

    return {
      Success = true,
      AttackerID = unitID,
      TargetX = targetX,
      TargetY = targetY,
      DamageDealt = damageDealt,
      TargetKilled = targetKilled,
      Message = "Ranged attack executed"
    }
  `;

  async execute(args: z.infer<typeof this.inputSchema>): Promise<z.infer<typeof this.outputSchema>> {
    return await super.call(args.PlayerID, args.UnitID, args.TargetX, args.TargetY);
  }
}

export default function createRangedAttackTool() {
  return new RangedAttackTool();
}
