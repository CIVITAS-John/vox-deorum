/**
 * Game Event Types
 *
 * @module bridge-service/types/event
 *
 * @description
 * Type definitions for IPC messages and game events. These types define the structure
 * of messages exchanged between the Bridge Service and the Community Patch DLL.
 */

/**
 * Base IPC message structure
 *
 * @interface IPCMessage
 *
 * @description
 * Base structure for all IPC messages sent between Bridge Service and DLL.
 * All messages must have a type field, and messages expecting responses include an id.
 *
 * @property type - Message type identifier
 * @property id - Optional message ID for tracking request/response pairs
 *
 * @example
 * ```typescript
 * const message: IPCMessage = {
 *   type: 'lua_call',
 *   id: '123e4567-e89b-12d3-a456-426614174000'
 * };
 * ```
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
 *
 * @interface GameEvent
 *
 * @description
 * Structure for game events that are broadcast to clients via Server-Sent Events (SSE)
 * and the event pipe. Events include game state changes, player actions, and system notifications.
 *
 * @property id - Optional unique event identifier
 * @property type - Event type (e.g., 'PlayerDoTurn', 'CityFounded')
 * @property payload - Event-specific data
 * @property extraPayload - Optional additional event data
 * @property visibility - Optional array of player IDs who can see this event
 *
 * @example
 * ```typescript
 * const event: GameEvent = {
 *   id: 1234,
 *   type: 'PlayerDoTurn',
 *   payload: { PlayerID: 0, Turn: 42 },
 *   visibility: [0] // Only visible to player 0
 * };
 * ```
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