/**
 * Event triggered when a player establishes a pantheon (early religious beliefs)
 */
export interface PantheonFoundedEvent {
  /** The ID of the player's capital city where the pantheon is founded (0 if no capital) */
  CapitalCityId: number;
  
  /** Always set to RELIGION_PANTHEON, indicating this is a pantheon founding */
  ReligionType: number;
  
  /** The unique identifier of the pantheon belief that was selected */
  BeliefId: number;
}