/**
 * TurnComplete Event
 * 
 * Core game event in Civilization V that signals the completion of a player's turn.
 * This event is essential for tracking game progression and implementing turn-based AI behaviors.
 */
export interface TurnComplete {
  /** The ID of the player whose turn has just completed */
  ActivePlayer: number;
}