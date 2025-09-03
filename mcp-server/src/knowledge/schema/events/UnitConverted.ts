import { z } from 'zod';

/**
 * Triggered when a unit is converted from one player to another through various conversion mechanics
 */
export const UnitConverted = z.object({
  /** The ID of the player who originally owned the unit before conversion */
  OriginalOwnerID: z.number(),
  /** The ID of the player who now owns the unit after conversion */
  NewOwnerID: z.number(),
  /** The ID of the unit before conversion */
  OriginalUnitID: z.number(),
  /** The ID of the unit performing the conversion or the new unit ID */
  ConvertingUnitID: z.number(),
  /** Whether this conversion is part of an upgrade process (true) or a direct conversion (false) */
  IsUpgrade: z.boolean(),
});