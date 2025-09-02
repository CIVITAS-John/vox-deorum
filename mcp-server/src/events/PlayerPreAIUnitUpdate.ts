/**
 * Event triggered immediately before AI unit processing begins in Civilization V.
 * Provides an opportunity to intercept and customize unit behavior before the game's AI systems take control.
 */
export interface PlayerPreAIUnitUpdate {
  /** The unique identifier of the player whose units are about to be processed by AI */
  PlayerId: number;
}