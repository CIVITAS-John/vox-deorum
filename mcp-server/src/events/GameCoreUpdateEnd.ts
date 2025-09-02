/**
 * Event triggered at the end of the game's core update cycle
 * This event provides a hook point for post-processing after all game logic has completed
 * Note: This event is blacklisted in the Bridge Service due to its high frequency
 */
export interface GameCoreUpdateEndEvent {
  // No parameters - empty event
}