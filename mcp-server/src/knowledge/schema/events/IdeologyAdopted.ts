import { z } from 'zod';

/**
 * Schema for the IdeologyAdopted event
 * Triggered when a player adopts an ideology (Freedom, Order, or Autocracy) for the first time
 */
export const IdeologyAdopted = z.object({
  /** The unique identifier of the player adopting the ideology */
  PlayerID: z.number(),
  /** The policy branch type identifier representing which ideology was adopted */
  BranchType: z.number()
});