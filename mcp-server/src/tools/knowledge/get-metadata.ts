/**
 * Tool for retrieving static game metadata that doesn't change during gameplay
 */

import { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { LuaFunctionTool } from "../abstract/lua-function.js";
import * as z from "zod";

/**
 * Schema for static game metadata
 */
const MetadataSchema = z.object({
  GameSpeed: z.string(),
  MapType: z.string(),
  MapSize: z.string(),
  Difficulty: z.string(),
  StartEra: z.string(),
  MaxTurns: z.number(),
  VictoryTypes: z.array(z.string())
});

/**
 * Tool for retrieving static game metadata
 */
class GetMetadataTool extends LuaFunctionTool {
  /**
   * Unique identifier for the tool
   */
  readonly name = "get-metadata";

  /**
   * Human-readable description of the tool
   */
  readonly description = "Retrieves static game metadata including game speed, map type/size, difficulty, start era, max turns, and enabled victory types";

  /**
   * Input schema for the tool (no input required)
   */
  readonly inputSchema = z.object({});

  /**
   * Schema for the result data
   */
  protected readonly resultSchema = MetadataSchema;

  /**
   * Lua function arguments (none needed)
   */
  protected readonly arguments: string[] = [];

  /**
   * Path to the Lua script file relative to the lua/ directory
   */
  protected readonly scriptFile = "get-metadata.lua";

  /**
   * Optional annotations for the tool
   */
  readonly annotations: ToolAnnotations = {
    readOnlyHint: true,
    destructiveHint: false
  };

  /**
   * Execute the tool to retrieve metadata
   */
  async execute(_args: z.infer<typeof this.inputSchema>): Promise<z.infer<typeof this.outputSchema>> {
    return await this.call();
  }
}

/**
 * Creates a new instance of the get metadata tool
 */
export default function createGetMetadataTool() {
  return new GetMetadataTool();
}