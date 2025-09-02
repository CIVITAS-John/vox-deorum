/**
 * Event triggered when a city completes construction of a building
 */
export interface CityConstructed {
  /** The ID of the player who owns the city */
  OwnerId: number;
  
  /** The unique identifier of the city that constructed the building */
  CityId: number;
  
  /** The type/ID of the building that was constructed */
  BuildingType: number;
  
  /** True if the building was purchased with gold, false otherwise */
  IsGold: boolean;
  
  /** True if the building was purchased with faith/culture, false otherwise */
  IsFaith: boolean;
}