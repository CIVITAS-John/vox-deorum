/**
 * Event triggered when a player begins the process of ending their turn in Civilization V.
 * Part of the RED (Really Extended Diplomacy) event system.
 */
export interface PlayerEndTurnInitiated {
  /** The unique identifier of the player who is initiating the end of their turn */
  PlayerId: number;
}