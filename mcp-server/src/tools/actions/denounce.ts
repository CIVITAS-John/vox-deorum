/**
 * Denounce tool for AI player control
 */

import { LuaFunctionTool } from "../abstract/lua-function.js";
import * as z from "zod";
import { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { MaxMajorCivs } from "../../knowledge/schema/base.js";

const DenounceResultSchema = z.object({
  Success: z.boolean(),
  TargetCiv: z.string().optional(),
  Message: z.string().optional(),
});

type DenounceResultType = z.infer<typeof DenounceResultSchema>;

class DenounceTool extends LuaFunctionTool<DenounceResultType> {
  readonly name = "denounce";

  readonly description = `Publicly denounce another civilization.

Denouncing damages your relationship and signals hostility to other civs.
Can only denounce once per civilization every 50 turns.`;

  inputSchema = z.object({
    PlayerID: z.number().min(0).max(MaxMajorCivs - 1)
      .describe("Your player ID"),
    TargetPlayerID: z.number().min(0).max(MaxMajorCivs - 1)
      .describe("Target civilization's player ID"),
  });

  protected resultSchema = DenounceResultSchema;
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

    local targetCivName = Locale.ConvertTextKey(GameInfo.Civilizations[targetPlayer:GetCivilizationType()].ShortDescription)

    if not player:CanDenounce(targetPlayerID) then
      return { Success = false, TargetCiv = targetCivName, Message = "Cannot denounce (cooldown or other restriction)" }
    end

    player:Denounce(targetPlayerID)

    return {
      Success = true,
      TargetCiv = targetCivName,
      Message = "Denounced " .. targetCivName
    }
  `;

  async execute(args: z.infer<typeof this.inputSchema>): Promise<z.infer<typeof this.outputSchema>> {
    return await super.call(args.PlayerID, args.TargetPlayerID);
  }
}

export default function createDenounceTool() {
  return new DenounceTool();
}
