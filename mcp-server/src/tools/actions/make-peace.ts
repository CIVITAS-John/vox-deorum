/**
 * Make peace tool for AI player control
 */

import { LuaFunctionTool } from "../abstract/lua-function.js";
import * as z from "zod";
import { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { MaxMajorCivs } from "../../knowledge/schema/base.js";

const MakePeaceResultSchema = z.object({
  Success: z.boolean(),
  TargetCiv: z.string().optional(),
  Message: z.string().optional(),
});

type MakePeaceResultType = z.infer<typeof MakePeaceResultSchema>;

class MakePeaceTool extends LuaFunctionTool<MakePeaceResultType> {
  readonly name = "make-peace";

  readonly description = `Make peace with a civilization you are at war with.

Note: In normal gameplay, peace requires negotiation. This forces peace.
There may be a minimum war duration before peace is possible.`;

  inputSchema = z.object({
    PlayerID: z.number().min(0).max(MaxMajorCivs - 1)
      .describe("Your player ID"),
    TargetPlayerID: z.number().min(0).max(MaxMajorCivs - 1)
      .describe("Target civilization's player ID"),
  });

  protected resultSchema = MakePeaceResultSchema;
  protected arguments = ["playerID", "targetPlayerID"];

  readonly annotations: ToolAnnotations = {
    readOnlyHint: false
  };

  protected script = `
    local player = Players[playerID]
    local targetPlayer = Players[targetPlayerID]

    if not player or not targetPlayer then
      return { Success = false, Message = "Invalid player ID" }
    end

    local myTeam = Teams[player:GetTeam()]
    local targetTeam = targetPlayer:GetTeam()
    local targetCivName = Locale.ConvertTextKey(GameInfo.Civilizations[targetPlayer:GetCivilizationType()].ShortDescription)

    if not myTeam:IsAtWar(targetTeam) then
      return { Success = false, TargetCiv = targetCivName, Message = "Not at war with " .. targetCivName }
    end

    local turnsLocked = myTeam:GetNumTurnsLockedIntoWar(targetTeam)
    if turnsLocked > 0 then
      return { Success = false, TargetCiv = targetCivName, Message = "Locked into war for " .. turnsLocked .. " more turns" }
    end

    myTeam:MakePeace(targetTeam)

    return {
      Success = true,
      TargetCiv = targetCivName,
      Message = "Peace made with " .. targetCivName
    }
  `;

  async execute(args: z.infer<typeof this.inputSchema>): Promise<z.infer<typeof this.outputSchema>> {
    return await super.call(args.PlayerID, args.TargetPlayerID);
  }
}

export default function createMakePeaceTool() {
  return new MakePeaceTool();
}
