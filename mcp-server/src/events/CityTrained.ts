/**
 * Event triggered when a city completes training a unit
 */
export interface CityTrained {
  /** The ID of the player who owns the city that trained the unit */
  PlayerId: number;
  
  /** The unique ID of the city that trained the unit */
  CityId: number;
  
  /** The unique ID of the newly trained unit */
  UnitId: number;
  
  /** True if the unit was purchased with gold, false otherwise */
  IsGold: boolean;
  
  /** True if the unit was purchased with faith or culture, false otherwise */
  IsFaithCulture: boolean;
}