import { LuaFunctionTool } from "../abstract/lua-function.js";
import * as z from "zod";
import { enumMappings } from "../../utils/knowledge/enum.js";

/**
 * Schema for unit overview result
 */
const UnitOverviewResultSchema = z.record(
  z.string(), // Civilization name
  z.record(z.string(), z.number()) // AI type -> count
);

/**
 * Tool for getting an overview of all visible units for a given player
 * Groups units by civilization owner and AI type with counts only
 */
class GetUnitOverviewTool extends LuaFunctionTool {
  /**
   * Unique identifier for the get unit overview tool
   */
  readonly name = "get-unit-overview";

  /**
   * Human-readable description of the tool
   */
  readonly description = "Gets an overview of all visible units for a player, grouped by civilization and AI type";

  /**
   * Schema for validating tool inputs
   */
  readonly inputSchema = z.object({
    playerID: z.number().describe("The player ID to get unit visibility for")
  });

  /**
   * Schema for the result data
   */
  protected readonly resultSchema = UnitOverviewResultSchema;

  /**
   * Lua function arguments
   */
  protected readonly arguments = ["playerID"];

  /**
   * Path to the Lua script file
   */
  protected readonly scriptFile = "get-unit-overview.lua";

  /**
   * Execute the tool with the provided arguments
   */
  async execute(args: z.infer<typeof this.inputSchema>) {
    const result = await this.call(args.playerID);

    if (!result.Success) {
      throw new Error(`Failed to get unit overview: ${result.Error?.Message || 'Unknown error'}`);
    }

    // Convert numeric AI type enums to their string representations
    if (result.Result) {
      for (const civName in result.Result) {
        const unitsByAIType = result.Result[civName];
        const convertedUnits: Record<string, number> = {};

        for (const [aiTypeNum, count] of Object.entries(unitsByAIType)) {
          // Convert the AI type enum to string using explainEnums
          const aiType = enumMappings["AIType"][Number(aiTypeNum)] ?? `Unknown_${aiTypeNum}`;
          convertedUnits[aiType] = count as number;
        }

        result.Result[civName] = convertedUnits;
      }
    }

    return result.Result;
  }
}

/**
 * Creates a new instance of the get unit overview tool
 */
export default function createGetUnitOverviewTool() {
  return new GetUnitOverviewTool();
}