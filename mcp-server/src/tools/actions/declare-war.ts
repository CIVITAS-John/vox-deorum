/**
 * Declare war tool for AI player control
 */

import { LuaFunctionTool } from "../abstract/lua-function.js";
import * as z from "zod";
import { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { MaxMajorCivs } from "../../knowledge/schema/base.js";

const DeclareWarResultSchema = z.object({
  Success: z.boolean(),
  TargetCiv: z.string().optional(),
  Message: z.string().optional(),
});

type DeclareWarResultType = z.infer<typeof DeclareWarResultSchema>;

class DeclareWarTool extends LuaFunctionTool<DeclareWarResultType> {
  readonly name = "declare-war";

  readonly description = `Declare war on another civilization.

This is a major diplomatic action with lasting consequences.
Use get-players to see other civilizations and their IDs.`;

  inputSchema = z.object({
    PlayerID: z.number().min(0).max(MaxMajorCivs - 1)
      .describe("Your player ID"),
    TargetPlayerID: z.number().min(0).max(MaxMajorCivs - 1)
      .describe("Target civilization's player ID"),
  });

  protected resultSchema = DeclareWarResultSchema;
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

    if not myTeam:CanDeclareWar(targetTeam) then
      return { Success = false, TargetCiv = targetCivName, Message = "Cannot declare war (peace treaty or other restriction)" }
    end

    myTeam:DeclareWar(targetTeam)

    return {
      Success = true,
      TargetCiv = targetCivName,
      Message = "War declared on " .. targetCivName
    }
  `;

  async execute(args: z.infer<typeof this.inputSchema>): Promise<z.infer<typeof this.outputSchema>> {
    return await super.call(args.PlayerID, args.TargetPlayerID);
  }
}

export default function createDeclareWarTool() {
  return new DeclareWarTool();
}
