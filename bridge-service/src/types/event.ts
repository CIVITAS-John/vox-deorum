/**
 * Type definitions for game event operations
 */

/**
 * Game event from Lua
 */
export interface GameEvent {
  type: string;
  payload: any;
  timestamp: string;
}

/**
 * IPC message for game event
 */
export interface GameEventMessage {
  type: 'game_event';
  event: string;
  payload: any;
  timestamp: string;
}

/**
 * SSE client connection
 */
export interface SSEClient {
  id: string;
  response: any; // Express Response object
  connectedAt: Date;
}