import { z } from 'zod';

/**
 * Schema for the BarbariansCampFounded event
 * Triggered when a new barbarian camp is established on the game map
 */
export const BarbariansCampFounded = z.object({
  /** The X coordinate of the plot where the barbarian camp was founded */
  PlotX: z.number(),
  /** The Y coordinate of the plot where the barbarian camp was founded */
  PlotY: z.number()
});