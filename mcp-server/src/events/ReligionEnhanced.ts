/**
 * Event triggered when a player enhances their religion by adding beliefs to it in Civilization V.
 * Provides information about the religion enhancement process and the beliefs being added.
 */
export interface ReligionEnhanced {
  /** The player ID who is enhancing their religion */
  PlayerId: number;
  
  /** The religion being enhanced */
  ReligionId: number;
  
  /** The first belief being added during enhancement */
  Belief1Id: number;
  
  /** The second belief being added during enhancement */
  Belief2Id: number;
}