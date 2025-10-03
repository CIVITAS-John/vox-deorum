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
   * The Lua function arguments in the signature
   */
  protected abstract readonly arguments: string[];

  /**
   * The Lua function script to be executed (optional if scriptFile is provided)
   */
  protected readonly script?: string;

  /**
   * Path to the Lua script file relative to the lua/ directory (optional if script is provided)
   */
  protected readonly scriptFile?: string;

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
  protected async call(...args: any[]): Promise<z.infer<typeof this.outputSchema>> {
    // Initialize function if not already done
    if (!this.function) {
      if (this.scriptFile) {
        // Use LuaFunction.fromFile for file-based scripts
        this.function = LuaFunction.fromFile(
          this.scriptFile,
          "default-func-" + this.name,
          this.arguments
        );
      } else if (this.script) {
        // Use direct constructor for inline scripts
        this.function = new LuaFunction("default-func-" + this.name, this.arguments, this.script);
      } else {
        throw new Error(`${this.name}: Either 'script' or 'scriptFile' must be provided`);
      }
    }

    const response = await this.function.execute(...args);

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