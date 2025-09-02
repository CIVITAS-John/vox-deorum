/**
 * Knowledge Management System Database Schema
 * Defines TypeScript interfaces and types for knowledge persistence using Kysely
 */

import type { Generated, JSONColumnType } from 'kysely';

/**
 * Metadata key-value store for game state
 */
export interface GameMetadata {
  Key: string;
  Value: string;
}

// #region Knowledge Templates
/**
 * Base interface for all knowledge entries
 * All knowledge items inherit from this base class
 */
export interface Knowledge {
  ID: Generated<number>;
}

/**
 * Public knowledge accessible to all players
 * Example: Basic player information, civilizations, etc.
 */
export interface PublicKnowledge extends Knowledge {
  Data: JSONColumnType<Record<string, unknown>>;
}

/**
 * Time-based knowledge with turn-based access control
 * Base class for knowledge that changes over turns
 */
export interface TimedKnowledge extends Knowledge {
  Turn: number;
  Key: number; // Item identifier
  OwnerID?: number;
  KnownByIDs: JSONColumnType<number[]>; // Array of player IDs who know this item
  Payload: JSONColumnType<Record<string, unknown>>;
  IsLatest: boolean; 
  CreatedAt: Generated<number>; // Unix timestamp in milliseconds
}

/**
 * Mutable knowledge that can be updated
 * Tracks changes between versions
 */
export interface MutableKnowledge extends TimedKnowledge {
  Version: number;
  Changes: JSONColumnType<string[]>; // Array of changed field names
}
// #endregion

// #region Timed Knowledge
/**
 * Game events with typed payloads
 * Example implementation of dynamic content with JSONColumnType
 */
export interface GameEvent extends TimedKnowledge {
  Type: string;
  Payload: JSONColumnType<Record<string, unknown>>;
}
// #endregion

// #region Public Knowledge
/**
 * Immutable information about players
 */
export interface PlayerInformation extends PublicKnowledge {
  PlayerId: number;
  TeamId: number;
  Civilization: string;
  Leader: string;
  IsHuman: boolean;
}
// #endregion

/**
 * Database schema combining all s
 */
export interface KnowledgeDatabase {
  GameMetadata: GameMetadata;
  // Timed Knowledge
  GameEvents: GameEvent;
  // Public Knowledge
  PlayerInformation: PlayerInformation; 
}