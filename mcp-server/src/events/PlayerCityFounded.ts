/**
 * Event triggered when a player establishes a new city in Civilization V.
 * This event provides essential information about the newly founded city.
 */
export interface PlayerCityFounded {
  /** The unique identifier of the player who founded the city */
  PlayerId: number;
  
  /** The X coordinate of the city's location on the game map */
  CityX: number;
  
  /** The Y coordinate of the city's location on the game map */
  CityY: number;
}