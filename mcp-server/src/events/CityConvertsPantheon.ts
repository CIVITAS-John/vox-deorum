/**
 * Event triggered when a city converts to following a pantheon belief
 */
export interface CityConvertsPantheon {
  /** The ID of the player who owns the city that converted to the pantheon */
  PlayerId: number;
  
  /** The X coordinate of the city on the game map */
  CityX: number;
  
  /** The Y coordinate of the city on the game map */
  CityY: number;
}