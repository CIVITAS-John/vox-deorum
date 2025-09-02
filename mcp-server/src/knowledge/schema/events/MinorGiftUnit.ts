import { z } from 'zod';

/**
 * Schema for the MinorGiftUnit event
 * Triggered when a militaristic city-state spawns and gifts a unit to a major civilization
 */
export const MinorGiftUnit = z.object({
  /** The militaristic city-state gifting the unit */
  MinorCivPlayerID: z.number(),
  /** The major civilization receiving the unit */
  MajorCivPlayerID: z.number(),
  /** The type identifier of the spawned unit */
  UnitType: z.number(),
});