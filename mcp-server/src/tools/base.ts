import { RegisteredTool } from "@modelcontextprotocol/sdk/server/mcp";
import * as z from "zod";
import { ExtendedToolAnnotations } from "./types/tool-annotations.js";

/**
 * Base class for MCP server tools
 */
export abstract class ToolBase {
  /**
   * Unique identifier for the tool
   */
  abstract readonly name: string;

  /**
   * Human-readable description of the tool
   */
  abstract readonly description: string;

  /**
   * JSON schema for the tool's input parameters
   */
  abstract readonly inputSchema: z.ZodObject<any>;

  /**
   * JSON schema for the tool's output parameters
   */
  abstract readonly outputSchema: z.ZodObject<any> | z.ZodTypeAny;

  /**
   * Get the actual output schema.
   */
  getOutputSchema() {
    return this.outputSchema;
  }

  /**
   * Optional annotations for the tool
   */
  readonly annotations?: ExtendedToolAnnotations;

  /**
   * Registered tool instance after registration with MCP server
   */
  public registered?: RegisteredTool;

  /**
   * Execute the tool with the given arguments
   */
  abstract execute(args: z.infer<typeof this.inputSchema>): Promise<z.infer<typeof this.outputSchema>>;
}
