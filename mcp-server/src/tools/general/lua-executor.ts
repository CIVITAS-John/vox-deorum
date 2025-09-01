import { bridgeManager } from "../../server.js";
import { ToolBase } from "../base.js";
import * as z from "zod";

/**
 * Tool for executing raw Lua scripts in the game context via Bridge Service
 */
class LuaExecutorTool extends ToolBase {
  /**
   * Unique identifier for the Lua executor tool
   */
  readonly name = "lua-executor";

  /**
   * Human-readable description of the Lua executor tool
   */
  readonly description = "Executes raw Lua scripts in the Civilization V game context through the Bridge Service";

  /**
   * Input schema defining the Lua script to execute
   */
  readonly inputSchema = z.object({
    script: z.string().describe("Raw Lua script to execute in the game context (e.g., 'return Game.GetActivePlayer()', 'print(\"Hello from Lua\")')"),
    description: z.string().optional().describe("Optional description of what this script does")
  });

  /**
   * Output schema for Lua execution results
   */
  readonly outputSchema = z.object({
    success: z.boolean(),
    result: z.any().optional(),
    error: z.object({
      code: z.string(),
      message: z.string(),
      details: z.string().optional()
    }).optional(),
  });

  /**
   * Optional annotations for the Lua executor tool
   */
  readonly annotations = undefined;

  /**
   * Execute the Lua script using BridgeManager
   */
  async execute(args: z.infer<typeof this.inputSchema>): Promise<z.infer<typeof this.outputSchema>> {
    const response = await bridgeManager.executeLuaScript(args.script);
    
    return {
      success: response.success,
      result: response.result,
      error: response.error,
    };
  }
}

export default new LuaExecutorTool();