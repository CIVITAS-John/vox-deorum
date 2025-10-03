import { z } from 'zod';

/**
 * Schema for the PlayerDoTurn event
 * Triggered during the post-diplomacy phase of a player's turn processing
 */
export const PlayerDoTurn = z.object({
  /** The ID of the player whose turn is being processed */
  PlayerID: z.number(),
});