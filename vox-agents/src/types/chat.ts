/**
 * @module types/agents
 *
 * Chat-related types for Vox Agents.
 * Contains core agent definitions.
 */

import type { StreamTextOnChunkCallback, ToolSet } from "ai";

export interface StreamingEventCallback {
  OnChunk: StreamTextOnChunkCallback<ToolSet>
}
/**
 * @module envoy/envoy-thread
 *
 * Data structure for Envoy's chat thread input/output.
 * Contains the metadata and messages for a conversation thread.
 */

import type { ModelMessage } from "ai";

/**
 * Configuration for a special message type that triggers specific agent behavior.
 * Special messages are triple-brace-enclosed tokens (e.g., "{{{Greeting}}}") sent by the UI
 * to instruct the agent to produce a context-aware response without appearing as user text.
 */
export interface SpecialMessageConfig {
  /** The instruction prompt for this special message type */
  prompt: string;
}

/**
 * Represents a message with associated metadata.
 * Wraps a ModelMessage with additional context about when and where it was created.
 */
export interface MessageWithMetadata {
  /** The actual message content */
  message: ModelMessage;

  /** Metadata about this message */
  metadata: {
    /** When this message was created */
    datetime: Date;

    /** Game turn when this message was created */
    turn: number;
  };
}

/**
 * Represents the user's identity in a conversation.
 * Describes who is talking to the agent and their affiliation.
 */
export interface UserIdentity {
  /** The user's role in the conversation (e.g., "a diplomat", "the leader") */
  role: string;

  /** Player ID the user is representing (undefined for observer) */
  playerID?: number;

  /** Display name for the user's affiliation (e.g., "Bismarck of Germany") */
  displayName?: string;
}

/**
 * Represents a chat thread for the Envoy agent.
 * Contains all the metadata and messages for a conversation.
 */
export interface EnvoyThread {
  /** Unique identifier for this thread */
  id: string;

  /** Agent used in this thread */
  agent: string;

  /** Title of this thread */
  title?: string;

  /** Game ID this thread is associated with */
  gameID: string;

  /** Player ID this thread is associated with */
  playerID: number;

  /** Civilization name for the thread's player (e.g., "Germany") */
  civilizationName?: string;

  /** The user's identity for this conversation */
  userIdentity?: UserIdentity;

  /** Type of context: live VoxContext or database */
  contextType: 'live' | 'database';

  /** VoxContext ID for live sessions */
  contextId: string;

  /** Database file path for database sessions */
  databasePath?: string;

  /** The conversation messages in this thread with metadata */
  messages: MessageWithMetadata[];

  /** Optional metadata for the thread */
  metadata?: {
    /** When the thread was created */
    createdAt?: Date;

    /** When the thread was last updated */
    updatedAt?: Date;

    /** Current game turn when thread was last active */
    turn?: number;
  };
}