/**
 * Event triggered when a city creates or completes a project
 */
export interface CityCreated {
  /** The ID of the player who owns the city */
  OwnerId: number;
  
  /** The unique identifier of the city that created the project */
  CityId: number;
  
  /** The type of project that was created/completed */
  ProjectType: number;
  
  /** Indicates whether the project was purchased with gold (true) or completed through normal production (false) */
  IsGold: boolean;
  
  /** Indicates whether the project involved faith or culture (currently always false based on the code references) */
  IsFaith: boolean;
}