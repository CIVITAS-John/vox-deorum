/**
 * Event triggered when a team discovers a natural wonder
 */
export interface NaturalWonderDiscoveredEvent {
  /** The ID of the team that discovered the natural wonder */
  Team: number;
  
  /** The type/ID of the natural wonder feature that was discovered */
  FeatureType: number;
  
  /** The X coordinate of the plot containing the natural wonder */
  X: number;
  
  /** The Y coordinate of the plot containing the natural wonder */
  Y: number;
  
  /** True if this is the first major civilization to discover this natural wonder */
  IsFirstDiscovery: boolean;
}