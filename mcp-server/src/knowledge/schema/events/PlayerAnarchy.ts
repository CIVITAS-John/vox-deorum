import { z } from 'zod';

/**
 * PlayerAnarchy event - triggered when a player's civilization enters or exits an anarchy state
 */
export const PlayerAnarchy = z.object({
  /** The ID of the player whose anarchy state changed */
  PlayerID: z.number(),
  /** Whether the player is entering anarchy (true) or exiting (false) */
  IsEntering: z.boolean(),
  /** The duration of anarchy in turns (when entering), or 0 (when exiting) */
  Duration: z.number()
});