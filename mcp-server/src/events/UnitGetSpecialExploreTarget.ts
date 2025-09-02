/**
 * UnitGetSpecialExploreTarget Event
 * 
 * Triggered during the Homeland AI's exploration target selection process.
 * This event allows external systems to influence or override the default exploration behavior for units.
 */
export interface UnitGetSpecialExploreTarget {
  /** The ID of the player who owns the unit */
  PlayerId: number;
  
  /** The unique identifier of the unit being processed for exploration */
  UnitId: number;
}