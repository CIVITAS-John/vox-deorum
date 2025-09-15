/**
 * Tool for retrieving static game metadata that doesn't change during gameplay
 */

import { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { LuaFunctionTool } from "../abstract/lua-function.js";
import * as z from "zod";
import { knowledgeManager } from "../../server.js";

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
  VictoryTypes: z.array(z.string()),
  YouAre: z.string().optional()
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
  readonly inputSchema = z.object({
    PlayerID: z.number().optional().describe("Optional player ID to get player-specific information")
  });

  /**
   * Schema for the result data
   */
  protected readonly resultSchema = MetadataSchema;

  /**
   * Lua function arguments
   */
  protected get arguments() { return ["playerID"]; }

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
   * Execute the tool to retrieve metadata and save to knowledge store
   */
  async execute(args: z.infer<typeof this.inputSchema>): Promise<z.infer<typeof this.outputSchema>> {
    const result = await this.call(args.PlayerID ?? -1);
    const metadata = result.Result as z.infer<typeof this.resultSchema>;
    const store = knowledgeManager.getStore();

    // Don't save YouAre to knowledge store - it's transient per-request data
    await Promise.all([
      store.setMetadata('gameSpeed', metadata.GameSpeed),
      store.setMetadata('mapType', metadata.MapType),
      store.setMetadata('mapSize', metadata.MapSize),
      store.setMetadata('difficulty', metadata.Difficulty),
      store.setMetadata('startEra', metadata.StartEra),
      store.setMetadata('maxTurns', metadata.MaxTurns.toString()),
      store.setMetadata('victoryTypes', metadata.VictoryTypes.join(', '))
    ]);

    return result;
  }
}

/**
 * Creates a new instance of the get metadata tool
 */
export default function createGetMetadataTool() {
  return new GetMetadataTool();
}