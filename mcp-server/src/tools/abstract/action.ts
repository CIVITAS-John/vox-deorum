/**
 * Base class for Lua-based action tools that modify game state.
 * Centralizes Turn handling, default autoComplete/annotations, and common utilities.
 */

import { LuaFunctionTool } from "./lua-function.js";
import { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { knowledgeManager } from "../../server.js";
import { pushPlayerAction } from "../../utils/lua/player-actions.js";
import { trimRationale } from "../../utils/text.js";
import * as z from "zod";

/**
 * Zod field for source turn tracking.
 * Extend your inputSchema with this: `inputSchema = z.object({...}).extend(sourceTurnField)`
 */
export const sourceTurnField = {
  Turn: z.number().default(-1).describe("Source turn for this action (-1 = use server's current turn)")
};

/**
 * Base class for action tools that modify game state via Lua.
 * Provides common autoComplete defaults, turn resolution, and shared utilities.
 */
export abstract class ActionTool<TResult = any> extends LuaFunctionTool<TResult> {
  readonly annotations: ToolAnnotations = { readOnlyHint: false };
  readonly metadata = { autoComplete: ["PlayerID", "Turn"] };

  /** Resolve effective turn from the optional Turn arg. */
  protected resolveSourceTurn(args: { Turn?: number }): number {
    return args.Turn !== undefined && args.Turn >= 0 ? args.Turn : knowledgeManager.getTurn();
  }

  /** Push a player action event with source turn. */
  protected async pushAction(
    playerID: number,
    actionType: string,
    summary: string,
    rationale: string,
    replayPrefix?: string,
    turn?: number
  ): Promise<void> {
    await pushPlayerAction(playerID, actionType, summary, rationale, replayPrefix, turn);
  }

  /** Get the knowledge store for database operations. */
  protected getStore() {
    return knowledgeManager.getStore();
  }

  /** Trim rationale text for consistency. */
  protected trimRationale(rationale: string): string {
    return trimRationale(rationale);
  }
}
