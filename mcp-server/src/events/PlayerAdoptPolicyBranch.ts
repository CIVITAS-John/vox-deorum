/**
 * Event triggered when a player adopts (opens) a new policy branch in Civilization V.
 * This event is fired during the policy selection process when a player chooses to unlock a specific policy tree.
 */
export interface PlayerAdoptPolicyBranch {
  /** The unique identifier of the player who is adopting the policy branch */
  PlayerId: number;
  
  /** The identifier of the policy branch being adopted (e.g., Tradition, Liberty, Honor, etc.) */
  PolicyBranchId: number;
}