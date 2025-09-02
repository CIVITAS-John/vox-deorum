/**
 * Event triggered when a city purchases or acquires a new plot/tile to expand its territorial boundaries
 */
export interface CityBoughtPlot {
  /** The ID of the player who owns the city that acquired the plot */
  PlayerId: number;
  
  /** The unique identifier of the city that acquired the plot */
  CityId: number;
  
  /** The X coordinate of the acquired plot on the game map */
  PlotX: number;
  
  /** The Y coordinate of the acquired plot on the game map */
  PlotY: number;
  
  /** True if the plot was purchased with gold, false if acquired through culture/faith */
  IsGold: boolean;
  
  /** True if the plot was acquired through culture/faith expansion, false if purchased with gold */
  IsCulture: boolean;
}