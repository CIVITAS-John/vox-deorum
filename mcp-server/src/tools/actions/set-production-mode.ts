/**
 * Tool for setting production mode (enables AI turn cooldown in DLL)
 */

import { ToolBase } from "../base.js";
import * as z from "zod";
import { bridgeManager } from "../../server.js";

/**
 * Tool that sets production mode on the DLL via the bridge service
 */
class SetProductionModeTool extends ToolBase {
  readonly name = "set-production-mode";

  readonly description = "Enable or disable production mode (AI turn cooldown) in the DLL";

  readonly inputSchema = z.object({
    enabled: z.boolean().describe("Whether to enable production mode")
  });

  readonly outputSchema = z.boolean();

  async execute(args: z.infer<typeof this.inputSchema>): Promise<z.infer<typeof this.outputSchema>> {
    return await bridgeManager.setProductionMode(args.enabled);
  }
}

export default function createSetProductionModeTool() {
  return new SetProductionModeTool();
}
