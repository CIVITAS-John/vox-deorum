import { z } from 'zod';

/**
 * Schema for the MinorAlliesChanged event.
 * Triggered when a city-state's ally relationship with a major civilization changes.
 */
export const MinorAlliesChanged = z.object({
  /** The city-state whose ally relationship changed */
  MinorCivPlayerID: z.number(),
  
  /** The major civilization involved in the ally change */
  MajorCivPlayerID: z.number(),
  
  /** Boolean indicating whether the major civ is now an ally */
  IsNowAlly: z.boolean(),
  
  /** The previous friendship level (before change) */
  OldFriendship: z.number(),
  
  /** The current friendship level (after change) */
  NewFriendship: z.number()
});