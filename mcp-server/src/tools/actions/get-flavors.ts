/**
 * Tool for getting the current custom flavor values for a player in Civilization V
 */

import { LuaFunctionTool } from "../abstract/lua-function.js";
import * as z from "zod";
import { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { MaxMajorCivs } from "../../knowledge/schema/base.js";
import { pascalCase } from "change-case";

/**
 * Schema for the result returned by the Lua script
 * Returns a record of FLAVOR_XXX keys to numeric values
 */
const GetFlavorsResultSchema = z.record(z.string(), z.number());

type GetFlavorsResultType = z.infer<typeof GetFlavorsResultSchema>;

/**
 * Convert FLAVOR_ format keys to PascalCase for the response
 */
function convertFromFlavorFormat(key: string): string {
  // Remove FLAVOR_ prefix and convert to PascalCase
  const withoutPrefix = key.replace(/^FLAVOR_/, '');
  return pascalCase(withoutPrefix);
}

/**
 * Tool that gets the current flavor values for a player using a Lua function
 */
class GetFlavorsTool extends LuaFunctionTool<GetFlavorsResultType> {
  /**
   * Unique identifier for the get-flavors tool
   */
  readonly name = "get-flavors";

  /**
   * Human-readable description of the tool
   */
  readonly description = "Get the current non-zero flavor values for a player.";

  /**
   * Input schema for the get-flavors tool
   */
  inputSchema = z.object({
    PlayerID: z.number().min(0).max(MaxMajorCivs - 1).describe("ID of the player")
  });

  /**
   * Result schema - returns a record of flavor values
   */
  protected resultSchema = GetFlavorsResultSchema;

  /**
   * The Lua function arguments
   */
  protected arguments = ["playerID"];

  /**
   * Optional annotations for the Lua executor tool
   */
  readonly annotations: ToolAnnotations = {
    readOnlyHint: true
  }

  /**
   * Optional metadata
   */
  readonly metadata = {
    autoComplete: ["PlayerID"]
  }

  /**
   * The Lua script to execute
   */
  protected script = `
    local activePlayer = Players[playerID]
    if not activePlayer then
      return {}
    end

    -- Get custom flavors (returns a table with FLAVOR_XXX keys)
    local customFlavors = activePlayer:GetCustomFlavors()
    return customFlavors or {}
  `;

  /**
   * Execute the get-flavors command
   */
  async execute(args: z.infer<typeof this.inputSchema>): Promise<z.infer<typeof this.outputSchema>> {
    // Call the parent execute
    const result = await super.call(args.PlayerID);

    if (result.Success && result.Result) {
      // Convert FLAVOR_XXX keys to PascalCase for consistency
      const convertedResult: Record<string, number> = {};
      for (const [key, value] of Object.entries(result.Result)) {
        const pascalCaseKey = convertFromFlavorFormat(key);
        convertedResult[pascalCaseKey] = value as number;
      }

      return {
        Success: true,
        Result: convertedResult
      };
    }

    return result;
  }
}

/**
 * Creates a new instance of the get flavors tool
 */
export default function createGetFlavorsTool() {
  return new GetFlavorsTool();
}