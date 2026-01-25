/**
 * Melee attack tool for AI player control
 * Kali ❤️‍🔥 [Visionary]: Combat! The heart of Civ
 * Athena 🦉 [Reviewer]: Use get-combat-preview first to know if this is wise
 */

import { LuaFunctionTool } from "../abstract/lua-function.js";
import * as z from "zod";
import { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { MaxMajorCivs } from "../../knowledge/schema/base.js";

const AttackResultSchema = z.object({
  Success: z.boolean(),
  AttackerID: z.number(),
  TargetX: z.number(),
  TargetY: z.number(),
  AttackerDamageDealt: z.number().optional(),
  AttackerDamageTaken: z.number().optional(),
  DefenderKilled: z.boolean().optional(),
  AttackerKilled: z.boolean().optional(),
  Message: z.string().optional(),
});

type AttackResultType = z.infer<typeof AttackResultSchema>;

class AttackUnitTool extends LuaFunctionTool<AttackResultType> {
  readonly name = "attack-unit";

  readonly description = `Execute a melee attack against a target tile.

The attacking unit will move to the target and engage in combat.
Use get-combat-preview first to see expected damage before committing.
The attacker must have movement points and be able to reach the target.`;

  inputSchema = z.object({
    PlayerID: z.number().min(0).max(MaxMajorCivs - 1)
      .describe("Player ID (owner of the attacking unit)"),
    UnitID: z.number()
      .describe("The attacking unit's ID"),
    TargetX: z.number().min(0)
      .describe("Target tile X coordinate (where the enemy is)"),
    TargetY: z.number().min(0)
      .describe("Target tile Y coordinate (where the enemy is)"),
  });

  protected resultSchema = AttackResultSchema;
  protected arguments = ["playerID", "unitID", "targetX", "targetY"];

  readonly annotations: ToolAnnotations = {
    readOnlyHint: false
  };

  // Nemesis 💀 [Security]: Track damage dealt for strategic learning
  // Vesta 🔥 [Builder]: Return enough info to understand what happened
  protected script = `
    local player = Players[playerID]
    if not player then
      return { Success = false, AttackerID = unitID, TargetX = targetX, TargetY = targetY, Message = "Invalid player" }
    end

    local unit = player:GetUnitByID(unitID)
    if not unit then
      return { Success = false, AttackerID = unitID, TargetX = targetX, TargetY = targetY, Message = "Unit not found" }
    end

    if unit:MovesLeft() <= 0 then
      return { Success = false, AttackerID = unitID, TargetX = targetX, TargetY = targetY, Message = "No movement points" }
    end

    local targetPlot = Map.GetPlot(targetX, targetY)
    if not targetPlot then
      return { Success = false, AttackerID = unitID, TargetX = targetX, TargetY = targetY, Message = "Invalid target coordinates" }
    end

    -- Check for enemy unit at target
    local defenderCount = targetPlot:GetNumUnits()
    if defenderCount == 0 then
      return { Success = false, AttackerID = unitID, TargetX = targetX, TargetY = targetY, Message = "No unit at target" }
    end

    local attackerHPBefore = unit:GetCurrHitPoints()

    -- Get defender info before attack
    local defender = targetPlot:GetUnit(0)
    local defenderHPBefore = defender and defender:GetCurrHitPoints() or 0

    -- Execute the attack by moving to the target (melee attacks happen automatically)
    unit:PushMission(MissionTypes.MISSION_MOVE_TO, targetX, targetY, 0, false, false, MissionAITypes.MISSIONAI_ASSAULT, nil, nil)

    -- Check results
    local attackerAlive = unit:IsAlive() if unit.IsAlive then attackerAlive = unit:IsAlive() else attackerAlive = true end
    local attackerHPAfter = attackerAlive and unit:GetCurrHitPoints() or 0

    -- Try to find if defender still exists
    local defenderAlive = false
    if defender and defender.IsAlive then
      defenderAlive = defender:IsAlive()
    end
    local defenderHPAfter = defenderAlive and defender:GetCurrHitPoints() or 0

    local damageDealt = defenderHPBefore - defenderHPAfter
    local damageTaken = attackerHPBefore - attackerHPAfter

    return {
      Success = true,
      AttackerID = unitID,
      TargetX = targetX,
      TargetY = targetY,
      AttackerDamageDealt = damageDealt,
      AttackerDamageTaken = damageTaken,
      DefenderKilled = not defenderAlive,
      AttackerKilled = not attackerAlive,
      Message = "Attack executed"
    }
  `;

  async execute(args: z.infer<typeof this.inputSchema>): Promise<z.infer<typeof this.outputSchema>> {
    return await super.call(args.PlayerID, args.UnitID, args.TargetX, args.TargetY);
  }
}

export default function createAttackUnitTool() {
  return new AttackUnitTool();
}
