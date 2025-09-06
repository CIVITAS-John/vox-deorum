import { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
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
    Script: z.string().describe("Raw Lua script to execute in the game context (e.g., 'return Game.GetActivePlayer()', 'print(\"Hello from Lua\")')"),
    Description: z.string().optional().describe("Description of what this script does")
  });

  /**
   * Output schema for Lua execution results
   */
  readonly outputSchema = z.object({
    Success: z.boolean(),
    Result: z.any().optional(),
    Error: z.object({
      Code: z.string(),
      Message: z.string(),
      Details: z.string().optional()
    }).optional(),
  });

  /**
   * Optional annotations for the Lua executor tool
   */
  readonly annotations: ToolAnnotations = {
    audience: ["user"],
    readOnlyHint: false,
    destructiveHint: true
  }

  /**
   * Execute the Lua script using BridgeManager
   */
  async execute(args: z.infer<typeof this.inputSchema>): Promise<z.infer<typeof this.outputSchema>> {
    const response = await bridgeManager.executeLuaScript(args.Script);
    
    return {
      Success: response.success,
      Result: response.result,
      Error: response.error ? {
        Code: response.error.code,
        Message: response.error.message,
        Details: response.error.details
      } : undefined,
    };
  }
}

/**
 * Creates a new instance of the Lua executor tool
 */
export default function createLuaExecutorTool() {
  return new LuaExecutorTool();
}