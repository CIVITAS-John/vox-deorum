/**
 * UiDiploEvent
 * 
 * Triggered during diplomatic interactions between the human player and AI players in Civilization V.
 * This event is fired when the UI communicates diplomatic actions or responses back to the game engine.
 */
export interface UiDiploEvent {
  /** The specific type of diplomatic event that occurred (FromUIDiploEventTypes enum) */
  EventType: number;
  
  /** The ID of the AI player involved in the diplomatic interaction */
  AIPlayer: number;
  
  /** Context-specific argument that provides additional data for the diplomatic event */
  Arg1: number;
  
  /** Second context-specific argument for additional event data */
  Arg2: number;
}