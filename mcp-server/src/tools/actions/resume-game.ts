/**
 * Tool for resuming the game for a specific player
 */

import { ToolBase } from "../base.js";
import * as z from "zod";
import { MaxMajorCivs } from "../../knowledge/schema/base.js";
import { createLogger } from "../../utils/logger.js";
import { fetch } from "undici";
import { config } from "../../utils/config.js";

const logger = createLogger('ResumeGameTool');

/**
 * Tool that resumes the game for a specific player
 */
class ResumeGameTool extends ToolBase {
  /**
   * Unique identifier for the resume-game tool
   */
  readonly name = "resume-game";

  /**
   * Human-readable description of the tool
   */
  readonly description = "Resume the game during the turn of a specific player";

  /**
   * Input schema for the resume-game tool
   */
  readonly inputSchema = z.object({
    PlayerID: z.number().min(0).max(MaxMajorCivs - 1).describe("ID of the player to resume the game for")
  });

  /**
   * Output schema for the tool
   */
  readonly outputSchema = z.boolean();

  /**
   * Execute the resume-game command
   */
  async execute(args: z.infer<typeof this.inputSchema>): Promise<z.infer<typeof this.outputSchema>> {
    try {
      const bridgeUrl = config.bridge?.url || 'http://127.0.0.1:5000';
      await fetch(`${bridgeUrl}/external/pause-player/${args.PlayerID}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      logger.info(`Player ${args.PlayerID} unregistered from auto-pause`);
      return true;
    } catch (error) {
      logger.error(`Failed to unregister player ${args.PlayerID} from auto-pause:`, error);
      return false;
    }
  }
}

/**
 * Creates a new instance of the resume game tool
 */
export default function createResumeGameTool() {
  return new ResumeGameTool();
}