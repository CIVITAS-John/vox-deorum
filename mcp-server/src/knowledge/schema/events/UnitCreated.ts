import { z } from 'zod';

/**
 * Schema for the UnitCreated event triggered when a new unit is successfully created in the game
 */
export const UnitCreated = z.object({
  /** The ID of the player who owns the newly created unit */
  PlayerID: z.number(),
  /** The unique identifier assigned to the new unit */
  UnitID: z.number(),
  /** The type identifier of the unit that was created */
  UnitType: z.number(),
  /** The X coordinate where the unit was created */
  X: z.number(),
  /** The Y coordinate where the unit was created */
  Y: z.number(),
});