/**
 * Event triggered when a player successfully acquires (captures, liberates, or receives as a gift) a city from another player
 */
export interface CityCaptureComplete {
  /** The ID of the player who previously owned the city */
  OldOwnerId: number;
  
  /** True if the captured city was the capital of the previous owner */
  WasCapital: boolean;
  
  /** The X coordinate of the city on the game map */
  CityX: number;
  
  /** The Y coordinate of the city on the game map */
  CityY: number;
  
  /** The ID of the player who now owns the city (the acquiring player) */
  NewOwnerId: number;
  
  /** The population of the city at the time of capture */
  Population: number;
  
  /** True if the city was captured through military conquest, false for gifts/liberation */
  IsConquest: boolean;
  
  /** The total number of Great Works that were present in the city */
  TotalGreatWorks: number;
  
  /** The number of Great Works that were successfully captured/transferred */
  CapturedGreatWorks: number;
}