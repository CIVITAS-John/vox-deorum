/**
 * Event triggered when a player sells a building from one of their cities
 */
export interface CitySoldBuilding {
  /** The unique identifier of the player who sold the building */
  PlayerId: number;
  
  /** The unique identifier of the city from which the building was sold */
  CityId: number;
  
  /** The type/identifier of the building that was sold */
  BuildingType: number;
}