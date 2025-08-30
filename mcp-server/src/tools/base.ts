import { ToolAnnotations } from "@modelcontextprotocol/sdk/types";
import * as z from "zod";

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
  abstract readonly inputSchema: z.ZodTypeAny;

  /**
   * JSON schema for the tool's output parameters
   */
  abstract readonly outputSchema: z.ZodTypeAny;

  /**
   * Optional annotations for the tool
   */
  abstract readonly annotations?: ToolAnnotations

  /**
   * Execute the tool with the given arguments
   */
  abstract execute(args: z.infer<typeof this.inputSchema>): Promise<z.infer<typeof this.outputSchema>>;
}

