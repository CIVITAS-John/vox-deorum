/**
 * SetPopulation Event
 * 
 * Triggered when a city's population changes in Civilization V.
 * This event provides information about the city location and both the old and new population values.
 */
export interface SetPopulation {
  /** The X coordinate of the city on the game map */
  X: number;
  
  /** The Y coordinate of the city on the game map */
  Y: number;
  
  /** The previous population value before the change */
  OldPopulation: number;
  
  /** The new population value after the change */
  NewPopulation: number;
}