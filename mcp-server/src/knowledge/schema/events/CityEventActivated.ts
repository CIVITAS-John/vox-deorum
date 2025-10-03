import { z } from 'zod';

/**
 * Schema for the CityEventActivated event
 * Triggered when a city event begins in Civilization V
 */
export const CityEventActivated = z.object({
  /** The ID of the player who owns the city where the event is activated */
  PlayerID: z.number(),
  
  /** The unique identifier of the city where the event is activated */
  CityID: z.number(),
  
  /** The identifier of the specific city event type being activated */
  EventID: z.number()
});