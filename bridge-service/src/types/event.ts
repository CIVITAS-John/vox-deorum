/**
 * Type definitions for game event operations
 */

/**
 * Base IPC message structure
 */
export interface IPCMessage {
  type: string;
  // only for messages that would ask for a return value
  id?: string | number;
}

/**
 * Pause/unpause message structure
 */
export interface PauseMessage extends IPCMessage {
  playerID: number;
}

/**
 * Game event structure for SSE broadcast
 */
export interface GameEvent {
  id?: number;
  type: string;
  payload: Record<string, any>;
  extraPayload?: Record<string, any>;
  visibility?: number[];
}

/**
 * IPC message for game event
 */
export interface GameEventMessage extends IPCMessage {
  type: 'game_event';
  id?: number;
  event: string;
  payload: any;
  extraPayload?: Record<string, any>;
  visibility?: number[];
}

/**
 * SSE client connection
 */
export interface SSEClient {
  id: string;
  response: any; // Express Response object
  connectedAt: Date;
}