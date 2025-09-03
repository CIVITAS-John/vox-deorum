import { z } from 'zod';

/**
 * Event triggered when a player adopts or switches to a new policy branch (ideology)
 * in the social policy system.
 */
export const PlayerAdoptPolicyBranch = z.object({
  /** The ID of the player who adopted the policy branch */
  PlayerID: z.number(),
  /** The type of policy branch that was adopted */
  BranchType: z.number()
});