/**
 * Tool for pausing the game when it's a specific player's turn
 */

import { ToolBase } from "../base.js";
import * as z from "zod";
import { knowledgeManager } from "../../server.js";
import { MaxMajorCivs } from "../../knowledge/schema/base.js";

/**
 * Tool that pauses the game when it's the specified player's turn
 */
class PauseGameTool extends ToolBase {
  /**
   * Unique identifier for the pause-game tool
   */
  readonly name = "pause-game";

  /**
   * Human-readable description of the tool
   */
  readonly description = "Pause the game during the turn of a specific player";

  /**
   * Input schema for the pause-game tool
   */
  readonly inputSchema = z.object({
    PlayerID: z.number().min(0).max(MaxMajorCivs - 1).describe("ID of the player whose turn should trigger a pause")
  });

  /**
   * Output schema for the tool
   */
  readonly outputSchema = z.boolean();

  /**
   * Execute the pause-game command
   */
  async execute(args: z.infer<typeof this.inputSchema>): Promise<z.infer<typeof this.outputSchema>> {
    await knowledgeManager.addPausedPlayer(args.PlayerID);
    return true;
  }
}

/**
 * Creates a new instance of the pause game tool
 */
export default function createPauseGameTool() {
  return new PauseGameTool();
}