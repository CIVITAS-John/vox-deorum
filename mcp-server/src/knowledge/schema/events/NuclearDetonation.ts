import { z } from 'zod';

/**
 * Schema for the NuclearDetonation event.
 * Triggered when a nuclear weapon is detonated in the game.
 */
export const NuclearDetonation = z.object({
  /** The player ID of the civilization that launched the nuclear weapon */
  PlayerID: z.number(),
  
  /** The X coordinate where the nuclear weapon detonated */
  PlotX: z.number(),
  
  /** The Y coordinate where the nuclear weapon detonated */
  PlotY: z.number(),
  
  /** Whether the nuclear attack was against a civilization currently at war */
  IsWar: z.boolean(),
  
  /** Whether the nuclear strike affected neutral or non-combatant civilizations */
  IsBystander: z.boolean()
});