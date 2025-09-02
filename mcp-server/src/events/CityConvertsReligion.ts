/**
 * Event triggered when a city converts to a different religion, becoming the majority religion in that city
 */
export interface CityConvertsReligion {
  /** The ID of the player who owns the city that converted */
  PlayerId: number;
  
  /** The ID of the religion that the city converted to (new majority religion) */
  ReligionId: number;
  
  /** The X coordinate of the city on the game map */
  CityX: number;
  
  /** The Y coordinate of the city on the game map */
  CityY: number;
}