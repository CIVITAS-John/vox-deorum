import { z } from 'zod';

/**
 * Event triggered when a player successfully founds a religion.
 * This transforms a civilization's pantheon into a full religion with additional beliefs,
 * a holy city, and enhanced religious spread and influence.
 */
export const ReligionFounded = z.object({
  /** The unique identifier of the player founding the religion */
  PlayerID: z.number(),
  
  /** The unique identifier of the city designated as the religion's holy city */
  HolyCityID: z.number(),
  
  /** The specific religion being founded */
  ReligionType: z.number(),
  
  /** The pantheon belief carried over from the player's pantheon */
  PantheonBelief: z.number(),
  
  /** The first founder belief selected */
  FounderBelief1: z.number(),
  
  /** The second founder belief selected */
  FounderBelief2: z.number(),
  
  /** The first follower belief selected */
  FollowerBelief1: z.number(),
  
  /** The second follower belief selected */
  FollowerBelief2: z.number(),
});