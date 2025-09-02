/**
 * Event triggered when a religion is founded in Civilization V.
 * Captures the moment when a player establishes a new religion with selected beliefs.
 */
export interface ReligionFounded {
  /** The ID of the player who founded the religion */
  PlayerId: number;
  
  /** The ID of the city that becomes the holy city for this religion */
  HolyCityId: number;
  
  /** The type/ID of the religion being founded */
  ReligionId: number;
  
  /** The founder belief selected for this religion */
  FounderBeliefId: number;
  
  /** The first follower belief selected */
  Belief1Id: number;
  
  /** The second follower belief selected */
  Belief2Id: number;
  
  /** The third belief (may be enhancer or additional follower belief) */
  Belief3Id: number;
  
  /** The fourth belief (may be enhancer or additional follower belief) */
  Belief4Id: number;
}