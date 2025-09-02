/**
 * UnitSetXY Event
 * 
 * Triggered when a unit's position is being set or updated on the game map.
 * This event provides information about the unit and its new coordinates.
 */
export interface UnitSetXY {
  /** The player ID who owns the unit */
  Owner: number;
  
  /** The unique identifier of the unit being positioned */
  UnitId: number;
  
  /** The X coordinate on the game map where the unit is being placed */
  X: number;
  
  /** The Y coordinate on the game map where the unit is being placed */
  Y: number;
}