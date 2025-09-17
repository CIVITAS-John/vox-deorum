/**
 * Tool for pausing the game when it's a specific player's turn
 */

import { ToolBase } from "../base.js";
import * as z from "zod";
import { MaxMajorCivs } from "../../knowledge/schema/base.js";
import { createLogger } from "../../utils/logger.js";
import { fetch } from "undici";
import { config } from "../../utils/config.js";

const logger = createLogger('PauseGameTool');

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
    try {
      const bridgeUrl = config.bridge?.url || 'http://localhost:5000';
      await fetch(`${bridgeUrl}/external/pause-player/${args.PlayerID}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      logger.info(`Player ${args.PlayerID} registered for auto-pause`);
      return true;
    } catch (error) {
      logger.warn(`Failed to register player ${args.PlayerID} for auto-pause:`, error);
      return false;
    }
  }
}

/**
 * Creates a new instance of the pause game tool
 */
export default function createPauseGameTool() {
  return new PauseGameTool();
}