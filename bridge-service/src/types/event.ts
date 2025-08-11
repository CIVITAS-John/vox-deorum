/**
 * Type definitions for game event operations
 */

/**
 * Base IPC message structure
 */
export interface IPCMessage {
  type: string;
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