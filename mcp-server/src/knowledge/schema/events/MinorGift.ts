import { z } from 'zod';

/**
 * Schema for the MinorGift event
 * Triggered when a city-state gives a first contact gift to a major civilization
 */
export const MinorGift = z.object({
  /** The city-state providing the gift */
  MinorCivPlayerID: z.number(),
  
  /** The major civilization receiving the gift */
  MajorCivPlayerID: z.number(),
  
  /** The primary gift value (varies by city-state type) */
  GiftValue: z.number(),
  
  /** The friendship/influence bonus received */
  FriendshipBoost: z.number(),
  
  /** Currently unused parameter (always 0) */
  Reserved1: z.number(),
  
  /** Whether this is the first major civ to meet this city-state */
  IsFirstMajorCiv: z.boolean(),
  
  /** Currently unused boolean parameter (always false) */
  Reserved2: z.boolean(),
  
  /** String identifier for the gift type/notification text */
  TextKeySuffix: z.string(),
});