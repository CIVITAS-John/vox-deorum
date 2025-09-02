/**
 * Event triggered when a unit performs a rebase operation to a new location in Civilization V.
 * Primarily used for air units and other units that can relocate without traditional movement.
 */
export interface RebaseTo {
  /** The player ID who owns the unit performing the rebase */
  OwnerId: number;
  
  /** The unique identifier of the unit being rebased */
  UnitId: number;
  
  /** The X coordinate of the target rebase location */
  TargetX: number;
  
  /** The Y coordinate of the target rebase location */
  TargetY: number;
}