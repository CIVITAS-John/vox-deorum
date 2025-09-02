/**
 * Event triggered when a unit performs a paradrop operation
 */
export interface ParadropAtEvent {
  /** The player ID who owns the unit performing the paradrop */
  Owner: number;
  
  /** The unique identifier of the unit being paradropped */
  UnitId: number;
  
  /** The X coordinate of the plot where the unit originated */
  FromX: number;
  
  /** The Y coordinate of the plot where the unit originated */
  FromY: number;
  
  /** The X coordinate of the target plot where the unit lands */
  ToX: number;
  
  /** The Y coordinate of the target plot where the unit lands */
  ToY: number;
}