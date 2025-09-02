/**
 * Event triggered at the beginning of the game's main update cycle
 * This event provides an entry point for custom scripts at the start of each game update iteration
 * Note: This event is blacklisted in the Bridge Service due to its high frequency
 */
export interface GameCoreUpdateBeginEvent {
  // No parameters - empty event
}