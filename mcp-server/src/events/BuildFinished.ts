/**
 * Event triggered when a build operation (such as constructing an improvement) is completed on a plot
 */
export interface BuildFinished {
  /** The ID of the player who owns the unit that completed the build */
  PlayerId: number;
  
  /** The X coordinate of the plot where the build was completed */
  X: number;
  
  /** The Y coordinate of the plot where the build was completed */
  Y: number;
  
  /** The type of improvement that was built on the plot */
  ImprovementId: number;
}