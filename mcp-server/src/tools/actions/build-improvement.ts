/**
 * Worker improvement tool for AI player control
 * Kali ❤️‍🔥 [Visionary]: Farms, mines, roads - the infrastructure of empire
 * Vesta 🔥 [Builder]: MISSION_BUILD with improvement type
 */

import { LuaFunctionTool } from "../abstract/lua-function.js";
import * as z from "zod";
import { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { MaxMajorCivs } from "../../knowledge/schema/base.js";

const BuildImprovementResultSchema = z.object({
  Success: z.boolean(),
  UnitID: z.number(),
  X: z.number(),
  Y: z.number(),
  ImprovementName: z.string().optional(),
  TurnsToComplete: z.number().optional(),
  Message: z.string().optional(),
});

type BuildImprovementResultType = z.infer<typeof BuildImprovementResultSchema>;

class BuildImprovementTool extends LuaFunctionTool<BuildImprovementResultType> {
  readonly name = "build-improvement";

  readonly description = `Order a worker to build an improvement on their current tile.

Common improvement type IDs:
- Farm, Mine, Lumber Mill, Trading Post, etc.
Use get-map-region to see what improvements are valid for each tile.
The worker must be on the tile where you want the improvement.`;

  inputSchema = z.object({
    PlayerID: z.number().min(0).max(MaxMajorCivs - 1)
      .describe("Player ID (owner of the worker)"),
    UnitID: z.number()
      .describe("The worker unit's ID"),
    BuildTypeID: z.number()
      .describe("The build type ID (improvement to construct)"),
  });

  protected resultSchema = BuildImprovementResultSchema;
  protected arguments = ["playerID", "unitID", "buildTypeID"];

  readonly annotations: ToolAnnotations = {
    readOnlyHint: false
  };

  // Athena 🦉 [Reviewer]: Workers use MISSION_BUILD, not improvements directly
  // The buildTypeID maps to a Build entry which creates an improvement
  protected script = `
    local player = Players[playerID]
    if not player then
      return { Success = false, UnitID = unitID, X = -1, Y = -1, Message = "Invalid player" }
    end

    local unit = player:GetUnitByID(unitID)
    if not unit then
      return { Success = false, UnitID = unitID, X = -1, Y = -1, Message = "Unit not found" }
    end

    local x = unit:GetX()
    local y = unit:GetY()
    local plot = unit:GetPlot()

    -- Check if this is a worker-type unit
    if not unit:IsWork() then
      return { Success = false, UnitID = unitID, X = x, Y = y, Message = "Unit cannot build improvements" }
    end

    -- Get build info
    local buildInfo = GameInfo.Builds[buildTypeID]
    if not buildInfo then
      return { Success = false, UnitID = unitID, X = x, Y = y, Message = "Invalid build type" }
    end

    -- Check if this build can be done on this plot
    if not unit:CanBuild(plot, buildTypeID) then
      return { Success = false, UnitID = unitID, X = x, Y = y, Message = "Cannot build this improvement here" }
    end

    -- Push the build mission
    unit:PushMission(MissionTypes.MISSION_BUILD, buildTypeID, -1, 0, false, false, MissionAITypes.MISSIONAI_BUILD, nil, nil)

    -- Get improvement name
    local improvementName = Locale.ConvertTextKey(buildInfo.Description) or buildInfo.Type

    -- Calculate turns (approximate)
    local turnsLeft = unit:GetBuildTurnsLeft(buildTypeID, plot)

    return {
      Success = true,
      UnitID = unitID,
      X = x,
      Y = y,
      ImprovementName = improvementName,
      TurnsToComplete = turnsLeft,
      Message = "Building " .. improvementName
    }
  `;

  async execute(args: z.infer<typeof this.inputSchema>): Promise<z.infer<typeof this.outputSchema>> {
    return await super.call(args.PlayerID, args.UnitID, args.BuildTypeID);
  }
}

export default function createBuildImprovementTool() {
  return new BuildImprovementTool();
}
