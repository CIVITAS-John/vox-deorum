/**
 * Move spy tool for AI player control
 */

import { LuaFunctionTool } from "../abstract/lua-function.js";
import * as z from "zod";
import { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { MaxMajorCivs } from "../../knowledge/schema/base.js";

const MoveSpyResultSchema = z.object({
  Success: z.boolean(),
  SpyName: z.string().optional(),
  DestinationCity: z.string().optional(),
  Message: z.string().optional(),
});

type MoveSpyResultType = z.infer<typeof MoveSpyResultSchema>;

class MoveSpyTool extends LuaFunctionTool<MoveSpyResultType> {
  readonly name = "move-spy";

  readonly description = `Move a spy to a city for espionage.

Use get-espionage to see your spies and available cities.
Spies can be sent to enemy cities (steal tech, gather intel),
city-states (rig elections, coup), or your own cities (counterintelligence).`;

  inputSchema = z.object({
    PlayerID: z.number().min(0).max(MaxMajorCivs - 1)
      .describe("Your player ID"),
    SpyIndex: z.number().min(0)
      .describe("Index of the spy (0-based, from get-espionage)"),
    TargetCityOwnerID: z.number()
      .describe("Player ID of the city owner"),
    TargetCityID: z.number()
      .describe("Target city's ID"),
  });

  protected resultSchema = MoveSpyResultSchema;
  protected arguments = ["playerID", "spyIndex", "targetOwnerID", "targetCityID"];

  readonly annotations: ToolAnnotations = {
    readOnlyHint: false
  };

  protected script = `
    local player = Players[playerID]
    if not player then
      return { Success = false, Message = "Invalid player" }
    end

    local espionage = player:GetEspionage()
    if not espionage then
      return { Success = false, Message = "Espionage not available" }
    end

    local numSpies = espionage:GetNumSpies()
    if spyIndex >= numSpies then
      return { Success = false, Message = "Invalid spy index" }
    end

    local spyName = espionage:GetSpyName(spyIndex)

    local targetPlayer = Players[targetOwnerID]
    if not targetPlayer then
      return { Success = false, SpyName = spyName, Message = "Invalid target owner" }
    end

    local targetCity = targetPlayer:GetCityByID(targetCityID)
    if not targetCity then
      return { Success = false, SpyName = spyName, Message = "Target city not found" }
    end

    local cityName = targetCity:GetName()

    -- Move the spy
    local success = espionage:MoveSpyTo(spyIndex, targetCity)

    if success then
      return {
        Success = true,
        SpyName = spyName,
        DestinationCity = cityName,
        Message = spyName .. " sent to " .. cityName
      }
    else
      return {
        Success = false,
        SpyName = spyName,
        DestinationCity = cityName,
        Message = "Failed to move spy to " .. cityName
      }
    end
  `;

  async execute(args: z.infer<typeof this.inputSchema>): Promise<z.infer<typeof this.outputSchema>> {
    return await super.call(args.PlayerID, args.SpyIndex, args.TargetCityOwnerID, args.TargetCityID);
  }
}

export default function createMoveSpyTool() {
  return new MoveSpyTool();
}
