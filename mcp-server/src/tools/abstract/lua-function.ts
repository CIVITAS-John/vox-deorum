import { LuaFunction } from "../../bridge/lua-function.js";
import { ToolBase } from "../base.js";
import * as z from "zod";

/**
 * Tool for executing a pre-defined Lua function in the game context via Bridge Service
 */
export abstract class LuaFunctionTool extends ToolBase {
  /**
   * Schema for the result data returned by the Lua function
   */
  protected abstract readonly resultSchema: z.ZodTypeAny;

  /**
   * The Lua function script to be executed
   */
  protected abstract readonly script: string;

  /**
   * The LuaFunction instance used to execute the script
   */
  function?: LuaFunction

  /**
   * Output schema for Lua execution results
   */
  get outputSchema() {
    return z.object({
      success: z.boolean(),
      result: this.resultSchema.optional(),
      error: z.object({
        code: z.string(),
        message: z.string(),
        details: z.string().optional()
      }).optional(),
    });
  }

  /**
   * Execute the Lua script using BridgeManager
   */
  async execute(args: z.infer<typeof this.inputSchema>): Promise<z.infer<typeof this.outputSchema>> {
    this.function = this.function ?? new LuaFunction("default-func-" + this.name, this.script);
    const response = await this.function.execute(args);
    
    return {
      success: response.success,
      result: response.result,
      error: response.error,
    };
  }
}