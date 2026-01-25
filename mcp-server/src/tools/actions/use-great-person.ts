/**
 * Great person ability tool for AI player control
 */

import { LuaFunctionTool } from "../abstract/lua-function.js";
import * as z from "zod";
import { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { MaxMajorCivs } from "../../knowledge/schema/base.js";

const UseGreatPersonResultSchema = z.object({
  Success: z.boolean(),
  UnitID: z.number(),
  UnitType: z.string().optional(),
  Action: z.string().optional(),
  Message: z.string().optional(),
});

type UseGreatPersonResultType = z.infer<typeof UseGreatPersonResultSchema>;

class UseGreatPersonTool extends LuaFunctionTool<UseGreatPersonResultType> {
  readonly name = "use-great-person";

  readonly description = `Use a great person's special ability.

Actions depend on the great person type:
- Great Artist: Create great work OR start golden age
- Great Scientist: Discover tech OR build academy
- Great Engineer: Hurry production OR build manufactory
- Great Merchant: Trade mission OR build customs house
- Great General: Build citadel
- Great Admiral: Repair fleet
- Great Prophet: Spread religion, build holy site, enhance religion
- Great Writer: Create great work OR political treatise
- Great Musician: Create great work OR concert tour`;

  inputSchema = z.object({
    PlayerID: z.number().min(0).max(MaxMajorCivs - 1)
      .describe("Player ID (owner of the great person)"),
    UnitID: z.number()
      .describe("The great person unit's ID"),
    Action: z.enum([
      "GOLDEN_AGE",      // Great Artist
      "CREATE_WORK",     // Artist, Writer, Musician
      "DISCOVER_TECH",   // Great Scientist
      "BUILD_IMPROVEMENT", // All (academy, manufactory, etc.)
      "HURRY_PRODUCTION", // Great Engineer
      "TRADE_MISSION",   // Great Merchant
      "BUILD_CITADEL",   // Great General
      "REPAIR_FLEET",    // Great Admiral
      "SPREAD_RELIGION", // Great Prophet
      "CONCERT_TOUR",    // Great Musician
      "POLITICAL_TREATISE" // Great Writer
    ]).describe("The action to perform"),
  });

  protected resultSchema = UseGreatPersonResultSchema;
  protected arguments = ["playerID", "unitID", "action"];

  readonly annotations: ToolAnnotations = {
    readOnlyHint: false
  };

  protected script = `
    local player = Players[playerID]
    if not player then
      return { Success = false, UnitID = unitID, Action = action, Message = "Invalid player" }
    end

    local unit = player:GetUnitByID(unitID)
    if not unit then
      return { Success = false, UnitID = unitID, Action = action, Message = "Unit not found" }
    end

    local unitInfo = GameInfo.Units[unit:GetUnitType()]
    local unitTypeName = Locale.ConvertTextKey(unitInfo.Description)

    local success = false
    local message = ""

    if action == "GOLDEN_AGE" then
      if unit:CanGoldenAge(unit:GetPlot()) then
        unit:DoGoldenAge()
        success = true
        message = "Golden age started"
      else
        message = "Cannot trigger golden age"
      end
    elseif action == "CREATE_WORK" then
      if unit:CanGreatWork(unit:GetPlot()) then
        unit:DoGreatWork()
        success = true
        message = "Great work created"
      else
        message = "Cannot create great work here"
      end
    elseif action == "DISCOVER_TECH" then
      if unit:CanDiscover(unit:GetPlot()) then
        unit:Discover()
        success = true
        message = "Technology discovered"
      else
        message = "Cannot discover technology"
      end
    elseif action == "BUILD_IMPROVEMENT" then
      if unit:CanConstruct(unit:GetPlot()) then
        unit:DoConstruct()
        success = true
        message = "Special improvement built"
      else
        message = "Cannot build improvement here"
      end
    elseif action == "HURRY_PRODUCTION" then
      if unit:CanHurry(unit:GetPlot()) then
        unit:Hurry()
        success = true
        message = "Production hurried"
      else
        message = "Cannot hurry production"
      end
    elseif action == "TRADE_MISSION" then
      if unit:CanTrade(unit:GetPlot()) then
        unit:DoTrade()
        success = true
        message = "Trade mission completed"
      else
        message = "Cannot perform trade mission"
      end
    elseif action == "BUILD_CITADEL" then
      if unit:CanGeneralTactic(unit:GetPlot()) then
        unit:DoGeneralTactic()
        success = true
        message = "Citadel built"
      else
        message = "Cannot build citadel here"
      end
    elseif action == "REPAIR_FLEET" then
      if unit:CanRepairFleet(unit:GetPlot()) then
        unit:DoRepairFleet()
        success = true
        message = "Fleet repaired"
      else
        message = "Cannot repair fleet"
      end
    elseif action == "SPREAD_RELIGION" then
      if unit:CanSpreadReligion(unit:GetPlot()) then
        unit:DoSpreadReligion()
        success = true
        message = "Religion spread"
      else
        message = "Cannot spread religion here"
      end
    elseif action == "CONCERT_TOUR" then
      if unit:CanBlastTourism(unit:GetPlot()) then
        unit:DoBlastTourism()
        success = true
        message = "Concert tour performed"
      else
        message = "Cannot perform concert tour"
      end
    elseif action == "POLITICAL_TREATISE" then
      if unit:CanPoliticalTreatise(unit:GetPlot()) then
        unit:DoPoliticalTreatise()
        success = true
        message = "Political treatise written"
      else
        message = "Cannot write political treatise"
      end
    else
      message = "Unknown action"
    end

    return {
      Success = success,
      UnitID = unitID,
      UnitType = unitTypeName,
      Action = action,
      Message = message
    }
  `;

  async execute(args: z.infer<typeof this.inputSchema>): Promise<z.infer<typeof this.outputSchema>> {
    return await super.call(args.PlayerID, args.UnitID, args.Action);
  }
}

export default function createUseGreatPersonTool() {
  return new UseGreatPersonTool();
}
