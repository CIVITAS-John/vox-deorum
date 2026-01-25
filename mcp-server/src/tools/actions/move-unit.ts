/**
 * Direct unit movement tool for AI player control
 * Kali ❤️‍🔥 [Visionary]: This is it - the foundation of direct play
 * Athena 🦉 [Reviewer]: Structured tool > raw Lua for reliability
 */

import { LuaFunctionTool } from "../abstract/lua-function.js";
import * as z from "zod";
import { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { MaxMajorCivs } from "../../knowledge/schema/base.js";

const MoveUnitResultSchema = z.object({
  Success: z.boolean(),
  UnitID: z.number(),
  FromX: z.number(),
  FromY: z.number(),
  ToX: z.number(),
  ToY: z.number(),
  MovesRemaining: z.number(),
  Message: z.string().optional(),
});

type MoveUnitResultType = z.infer<typeof MoveUnitResultSchema>;

class MoveUnitTool extends LuaFunctionTool<MoveUnitResultType> {
  readonly name = "move-unit";

  readonly description = `Move a unit to a target tile.

The unit will path toward the destination using available movement points.
If the destination is unreachable this turn, the unit moves as far as possible.
Use get-map-region first to understand terrain and valid destinations.`;

  inputSchema = z.object({
    PlayerID: z.number().min(0).max(MaxMajorCivs - 1)
      .describe("Player ID (owner of the unit)"),
    UnitID: z.number()
      .describe("The unit's ID (from summarize-units or get-map-region)"),
    TargetX: z.number().min(0)
      .describe("Target tile X coordinate"),
    TargetY: z.number().min(0)
      .describe("Target tile Y coordinate"),
  });

  protected resultSchema = MoveUnitResultSchema;
  protected arguments = ["playerID", "unitID", "targetX", "targetY"];

  readonly annotations: ToolAnnotations = {
    readOnlyHint: false
  };

  // Kali ❤️‍🔥 [User Advocate]: Clear feedback on what happened
  // Nemesis 💀 [Security]: Verify unit ownership before moving
  protected script = `
    local player = Players[playerID]
    if not player then
      return { Success = false, UnitID = unitID, FromX = -1, FromY = -1, ToX = targetX, ToY = targetY, MovesRemaining = 0, Message = "Invalid player" }
    end

    local unit = player:GetUnitByID(unitID)
    if not unit then
      return { Success = false, UnitID = unitID, FromX = -1, FromY = -1, ToX = targetX, ToY = targetY, MovesRemaining = 0, Message = "Unit not found" }
    end

    local fromX = unit:GetX()
    local fromY = unit:GetY()
    local movesBefore = unit:MovesLeft()

    -- Push the move mission
    unit:PushMission(MissionTypes.MISSION_MOVE_TO, targetX, targetY, 0, false, false, MissionAITypes.NO_MISSIONAI, nil, nil)

    local movesAfter = unit:MovesLeft()
    local newX = unit:GetX()
    local newY = unit:GetY()

    -- Check if we actually moved
    local moved = (newX ~= fromX or newY ~= fromY)
    local reachedTarget = (newX == targetX and newY == targetY)

    local message = nil
    if reachedTarget then
      message = "Reached destination"
    elseif moved then
      message = "Moved toward destination (not enough movement to reach)"
    else
      message = "Could not move (blocked or no path)"
    end

    return {
      Success = moved,
      UnitID = unitID,
      FromX = fromX,
      FromY = fromY,
      ToX = newX,
      ToY = newY,
      MovesRemaining = movesAfter,
      Message = message
    }
  `;

  async execute(args: z.infer<typeof this.inputSchema>): Promise<z.infer<typeof this.outputSchema>> {
    return await super.call(args.PlayerID, args.UnitID, args.TargetX, args.TargetY);
  }
}

export default function createMoveUnitTool() {
  return new MoveUnitTool();
}
