import { z } from 'zod';

/**
 * TeamTechResearched event schema
 * Triggered when a team completes technology research through the Lua scripting system
 */
export const TeamTechResearched = z.object({
  /** The team that completed the technology research */
  TeamID: z.number(),
  /** The technology type identifier that was researched */
  TechnologyType: z.number(),
  /** The amount of change (typically 1 for research completion, could be negative for tech loss) */
  ChangeAmount: z.number()
});