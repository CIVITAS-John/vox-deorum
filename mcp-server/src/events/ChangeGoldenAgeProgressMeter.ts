/**
 * Event triggered when a player's golden age progress meter is modified
 */
export interface ChangeGoldenAgeProgressMeter {
  /** The unique identifier of the player whose golden age progress meter is being changed */
  PlayerId: number;
  
  /** The amount of change applied to the golden age progress meter (positive for gains, negative for losses) */
  Change: number;
}