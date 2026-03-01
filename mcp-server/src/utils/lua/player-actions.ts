/**
 * Unified player action dispatch for observer mods and replay messages.
 * Fires LuaEvents for observer consumption and optionally writes replay messages.
 */

import { bridgeManager } from "../../server.js";
import { createLogger } from "../logger.js";

const logger = createLogger('PlayerActions');

/**
 * Strip control characters that could break C++ JSON parsing or Lua strings.
 * Preserves tabs (\t), newlines (\n), and carriage returns (\r).
 */
function sanitize(text: string): string {
  return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

/**
 * Wrap text in a Lua long-string literal that requires no escaping.
 * Automatically chooses the delimiter level to avoid collisions.
 */
function toLuaLongString(text: string): string {
  const clean = sanitize(text);
  let level = 0;
  while (clean.includes(']' + '='.repeat(level) + ']')) level++;
  const d = '='.repeat(level);
  return `[${d}[${clean}]${d}]`;
}

/**
 * Push a player action: fires a LuaEvent for observer mods and optionally writes a replay message.
 *
 * @param playerID - The player performing the action
 * @param actionType - Action category (strategy, research, policy, relationship, persona, flavors, unset-flavors, status-quo)
 * @param summary - Clean summary of what changed (no prefix)
 * @param rationale - Why the action was taken
 * @param replayPrefix - Controls replay behavior:
 *   - undefined (omitted): event only, no replay message
 *   - "" (empty): replay without prefix: "{summary}. Rationale: {rationale}"
 *   - "Strategies" etc.: replay with prefix: "{prefix}: {summary}. Rationale: {rationale}"
 */
export async function pushPlayerAction(
  playerID: number,
  actionType: string,
  summary: string,
  rationale: string,
  replayPrefix?: string
): Promise<void> {
  const sumLua = toLuaLongString(summary);
  const ratLua = toLuaLongString(rationale);

  let script = `local turn = Game.GetGameTurn()\n`;
  script += `LuaEvents.VoxDeorumAction(${playerID}, turn, ${toLuaLongString(actionType)}, ${sumLua}, ${ratLua})\n`;

  if (replayPrefix !== undefined) {
    // Build replay message in Lua
    script += `local summary = ${sumLua}\n`;
    script += `local rationale = ${ratLua}\n`;
    script += `local msg = ""\n`;

    if (replayPrefix !== "") {
      script += `msg = ${toLuaLongString(replayPrefix)} .. ": " .. summary\n`;
    } else {
      script += `msg = summary\n`;
    }

    script += `if rationale ~= "" then msg = msg .. ". Rationale: " .. rationale end\n`;
    script += `Players[${playerID}]:AddReplayMessage(msg)\n`;
  }

  script += `return true`;

  const response = await bridgeManager.executeLuaScript(script);
  if (response.success) {
    logger.debug(`Pushed ${actionType} action for player ${playerID}`);
  } else {
    logger.error(`Failed to push ${actionType} action for player ${playerID}`, { error: response.error });
  }
}

/**
 * Push player info event: fires LuaEvents.VoxDeorumPlayerInfo for observer mods.
 *
 * @param playerID - The player ID
 * @param label - Combined model/strategist label (e.g. "deepseek-r1 / simple-strategist")
 */
export async function pushPlayerInfo(
  playerID: number,
  label: string
): Promise<void> {
  const script = `LuaEvents.VoxDeorumPlayerInfo(${playerID}, ${toLuaLongString(label)})\nreturn true`;

  const response = await bridgeManager.executeLuaScript(script);
  if (response.success) {
    logger.debug(`Pushed player info for player ${playerID}: ${label}`);
  } else {
    logger.error(`Failed to push player info for player ${playerID}`, { error: response.error });
  }
}
