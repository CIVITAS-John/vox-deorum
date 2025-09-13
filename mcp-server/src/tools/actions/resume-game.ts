/**
 * Tool for resuming the game for a specific player
 */

import { ToolBase } from "../base.js";
import * as z from "zod";
import { knowledgeManager } from "../../server.js";
import { MaxMajorCivs } from "../../knowledge/schema/base.js";

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
    // Remove player from paused players list
    await knowledgeManager.removePausedPlayer(args.PlayerID);
    return true;
  }
}

/**
 * Creates a new instance of the resume game tool
 */
export default function createResumeGameTool() {
  return new ResumeGameTool();
}