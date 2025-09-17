/**
 * Tool for setting metadata key-value pairs
 */

import { ToolBase } from "../base.js";
import * as z from "zod";
import { knowledgeManager } from "../../server.js";

/**
 * Tool that sets metadata key-value pairs
 */
class SetMetadataTool extends ToolBase {
  /**
   * Unique identifier for the set-metadata tool
   */
  readonly name = "set-metadata";

  /**
   * Human-readable description of the tool
   */
  readonly description = "Set a metadata key-value pair";

  /**
   * Input schema for the set-metadata tool
   */
  readonly inputSchema = z.object({
    Key: z.string().describe("The metadata key"),
    Value: z.string().describe("The metadata value")
  });

  /**
   * Output schema for the tool
   */
  readonly outputSchema = z.boolean();

  /**
   * Execute the set-metadata command
   */
  async execute(args: z.infer<typeof this.inputSchema>): Promise<z.infer<typeof this.outputSchema>> {
    await knowledgeManager.getStore().setMetadata(args.Key, args.Value);
    return true;
  }
}

/**
 * Creates a new instance of the set metadata tool
 */
export default function createSetMetadataTool() {
  return new SetMetadataTool();
}