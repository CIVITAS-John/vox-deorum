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
   * The Lua function arguments in the signature
   */
  protected abstract readonly arguments: string[];

  /**
   * The LuaFunction instance used to execute the script
   */
  function?: LuaFunction

  /**
   * Output schema for Lua execution results
   */
  get outputSchema() {
    return z.object({
      Success: z.boolean(),
      Result: this.resultSchema.optional(),
      Error: z.object({
        Code: z.string(),
        Message: z.string(),
        Details: z.string().optional()
      }).optional(),
    });
  }

  /**
   * Execute the Lua script using BridgeManager
   */
  async execute(args: z.infer<typeof this.inputSchema>): Promise<z.infer<typeof this.outputSchema>> {
    this.function = this.function ?? new LuaFunction("default-func-" + this.name, this.arguments, this.script);
    const response = await this.function.execute(args);
    
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