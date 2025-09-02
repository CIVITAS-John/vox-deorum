/**
 * Event triggered when a player has fully completed their turn in Civilization V.
 * Part of the RED (Really Extended Diplomacy) event system.
 */
export interface PlayerEndTurnCompleted {
  /** The unique identifier of the player who has completed their turn */
  PlayerId: number;
}