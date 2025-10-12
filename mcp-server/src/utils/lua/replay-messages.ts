/**
 * Utility functions for managing replay messages in Civilization V
 */

import { bridgeManager } from "../../server.js";
import { createLogger } from "../logger.js";

const logger = createLogger('ReplayMessages');

/**
 * Add one or more replay messages for a specific player
 *
 * @param playerID - The ID of the player to add messages for
 * @param messages - A single message string or array of message strings
 * @returns Promise resolving to success status
 */
export async function addReplayMessages(
  playerID: number,
  messages: string | string[]
): Promise<boolean> {
  // Normalize to array
  const messageArray = Array.isArray(messages) ? messages : [messages];

  // Escape strings and build Lua calls
  const luaCalls = messageArray.map(text => {
    const escaped = text
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');

    return `Players[${playerID}]:AddReplayMessage("${escaped}")`;
  });

  // Execute the Lua script
  const script = luaCalls.join('\n') + '\nreturn true';
  const response = await bridgeManager.executeLuaScript(script);

  if (response.success) {
    logger.info(`Successfully added ${messageArray.length} message(s) for player ${playerID}`);
  } else {
    logger.error(`Failed to add messages for player ${playerID}`, { error: response.error });
  }

  return response.success;
}