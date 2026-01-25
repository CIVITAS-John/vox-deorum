/**
 * General unit command tool for fortify, sleep, pillage, etc.
 */

import { LuaFunctionTool } from "../abstract/lua-function.js";
import * as z from "zod";
import { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { MaxMajorCivs } from "../../knowledge/schema/base.js";

const UnitCommandResultSchema = z.object({
  Success: z.boolean(),
  UnitID: z.number(),
  Command: z.string(),
  Message: z.string().optional(),
});

type UnitCommandResultType = z.infer<typeof UnitCommandResultSchema>;

class UnitCommandTool extends LuaFunctionTool<UnitCommandResultType> {
  readonly name = "unit-command";

  readonly description = `Execute a unit command like fortify, sleep, pillage, skip turn, etc.

Available commands:
- FORTIFY: Unit fortifies and gains defensive bonus over time
- SLEEP: Unit sleeps until enemy approaches
- ALERT: Unit wakes when enemy is spotted
- SKIP: Skip this unit's turn
- PILLAGE: Destroy improvement on current tile (must be enemy territory)
- WAKE: Wake a sleeping/fortified unit
- DELETE: Delete the unit (irreversible)
- HEAL: Fortify until healed`;

  inputSchema = z.object({
    PlayerID: z.number().min(0).max(MaxMajorCivs - 1)
      .describe("Player ID (owner of the unit)"),
    UnitID: z.number()
      .describe("The unit's ID"),
    Command: z.enum(["FORTIFY", "SLEEP", "ALERT", "SKIP", "PILLAGE", "WAKE", "DELETE", "HEAL"])
      .describe("The command to execute"),
  });

  protected resultSchema = UnitCommandResultSchema;
  protected arguments = ["playerID", "unitID", "command"];

  readonly annotations: ToolAnnotations = {
    readOnlyHint: false
  };

  protected script = `
    local player = Players[playerID]
    if not player then
      return { Success = false, UnitID = unitID, Command = command, Message = "Invalid player" }
    end

    local unit = player:GetUnitByID(unitID)
    if not unit then
      return { Success = false, UnitID = unitID, Command = command, Message = "Unit not found" }
    end

    local success = false
    local message = ""

    if command == "FORTIFY" then
      if unit:CanFortify(unit:GetPlot()) then
        unit:PushMission(MissionTypes.MISSION_FORTIFY)
        success = true
        message = "Unit fortifying"
      else
        message = "Unit cannot fortify here"
      end
    elseif command == "SLEEP" then
      unit:PushMission(MissionTypes.MISSION_SLEEP)
      success = true
      message = "Unit sleeping"
    elseif command == "ALERT" then
      unit:PushMission(MissionTypes.MISSION_ALERT)
      success = true
      message = "Unit on alert"
    elseif command == "SKIP" then
      unit:PushMission(MissionTypes.MISSION_SKIP)
      success = true
      message = "Turn skipped"
    elseif command == "PILLAGE" then
      if unit:CanPillage(unit:GetPlot()) then
        unit:PushMission(MissionTypes.MISSION_PILLAGE)
        success = true
        message = "Pillaging improvement"
      else
        message = "Cannot pillage here"
      end
    elseif command == "WAKE" then
      unit:PushMission(MissionTypes.MISSION_WAKE)
      success = true
      message = "Unit woken"
    elseif command == "DELETE" then
      unit:Kill(true)
      success = true
      message = "Unit deleted"
    elseif command == "HEAL" then
      unit:PushMission(MissionTypes.MISSION_HEAL)
      success = true
      message = "Healing until full"
    else
      message = "Unknown command"
    end

    return {
      Success = success,
      UnitID = unitID,
      Command = command,
      Message = message
    }
  `;

  async execute(args: z.infer<typeof this.inputSchema>): Promise<z.infer<typeof this.outputSchema>> {
    return await super.call(args.PlayerID, args.UnitID, args.Command);
  }
}

export default function createUnitCommandTool() {
  return new UnitCommandTool();
}
