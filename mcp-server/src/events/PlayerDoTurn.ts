/**
 * Event triggered during a player's turn processing in Civilization V.
 * Occurs after the AI turn post-processing has completed but before unit processing begins.
 */
export interface PlayerDoTurn {
  /** The unique identifier of the player whose turn is being processed */
  PlayerId: number;
}