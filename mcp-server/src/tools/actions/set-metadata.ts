/**
 * Tool for setting metadata key-value pairs
 */

import { ToolBase } from "../base.js";
import * as z from "zod";
import { knowledgeManager } from "../../server.js";
import { pushPlayerInfo } from "../../utils/lua/player-actions.js";

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
    const store = knowledgeManager.getStore();
    await store.setMetadata(args.Key, args.Value);

    // When model-{N} is set, combine with strategist-{N} and fire player info event
    const match = args.Key.match(/^model-(\d+)$/);
    if (match) {
      const pid = parseInt(match[1]);
      const strategist = await store.getMetadata(`strategist-${pid}`);
      await pushPlayerInfo(pid, `${args.Value} / ${strategist || 'unknown'}`);
    }

    return true;
  }
}

/**
 * Creates a new instance of the set metadata tool
 */
export default function createSetMetadataTool() {
  return new SetMetadataTool();
}