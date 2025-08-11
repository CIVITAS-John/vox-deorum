/**
 * Type definitions for game event operations
 */

/**
 * Base IPC message structure
 */
export interface IPCMessage {
  type: string;
  // only for messages that would ask for a return value
  id?: string;
}

/**
 * Game event structure for SSE broadcast
 */
export interface GameEvent {
  type: string;
  payload: any;
  timestamp: string;
}

/**
 * IPC message for game event
 */
export interface GameEventMessage extends IPCMessage {
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