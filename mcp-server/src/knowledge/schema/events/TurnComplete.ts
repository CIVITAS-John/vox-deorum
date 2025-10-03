import { z } from 'zod';

/**
 * TurnComplete event - Triggered at various points during turn completion processing
 */
export const TurnComplete = z.object({
  /** The player who is currently the active player during turn completion */
  ActivePlayerID: z.number(),
});