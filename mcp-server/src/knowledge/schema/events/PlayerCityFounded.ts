import { z } from 'zod';

/**
 * Schema for PlayerCityFounded event data
 * Fired when a player successfully establishes a new city
 */
export const PlayerCityFounded = z.object({
  /** The ID of the player who founded the city */
  PlayerID: z.number(),
  /** The X coordinate of the city's location */
  PlotX: z.number(),
  /** The Y coordinate of the city's location */
  PlotY: z.number()
});