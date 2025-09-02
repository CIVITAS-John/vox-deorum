import { z } from 'zod';

/**
 * Schema for the GreatPersonExpended event.
 * Triggered when a Great Person unit is consumed or expended to provide a benefit to the player.
 */
export const GreatPersonExpended = z.object({
  /** The unique identifier of the player who owned the Great Person */
  PlayerID: z.number(),
  /** The unique identifier of the specific Great Person unit */
  UnitID: z.number(),
  /** The specific type identifier of the Great Person unit that was expended */
  GreatPersonUnitType: z.number(),
  /** The X map coordinate where the Great Person was expended */
  X: z.number(),
  /** The Y map coordinate where the Great Person was expended */
  Y: z.number()
});