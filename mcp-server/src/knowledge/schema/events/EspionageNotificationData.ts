import { z } from 'zod';

/**
 * Schema for EspionageNotificationData event
 * Triggered when espionage activities generate notification data for players
 */
export const EspionageNotificationData = z.object({
  /** The X coordinate of the city where the espionage activity occurred */
  CityX: z.number(),
  
  /** The Y coordinate of the city where the espionage activity occurred */
  CityY: z.number(),
  
  /** The unique identifier of the player conducting the espionage operation */
  AttackingPlayerID: z.number(),
  
  /** The unique identifier of the player being targeted by the espionage operation */
  TargetPlayerID: z.number(),
  
  /** The outcome or result code of the espionage operation */
  SpyResult: z.number(),
  
  /** The identifier of the technology that was stolen (if applicable) */
  StolenTechID: z.number(),
  
  /** The quantity or value of resources/information stolen during the operation */
  AmountStolen: z.number()
});