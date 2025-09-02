/**
 * Event triggered when a player adopts (purchases or unlocks) a social policy in Civilization V.
 * This event provides essential information about policy adoption decisions.
 */
export interface PlayerAdoptPolicy {
  /** The unique identifier of the player who adopted the policy */
  PlayerId: number;
  
  /** The unique identifier of the social policy that was adopted */
  PolicyId: number;
}