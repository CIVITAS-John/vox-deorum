/**
 * @module envoy/envoy-thread
 *
 * Data structure for Envoy's chat thread input/output.
 * Contains the metadata and messages for a conversation thread.
 */

import { ModelMessage } from "ai";

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

  /** The conversation messages in this thread */
  messages: ModelMessage[];

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