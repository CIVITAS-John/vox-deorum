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
  Player0: Generated<boolean>; // Whether Player 0 knows this
  Player1: Generated<boolean>; // Whether Player 1 knows this
  Player2: Generated<boolean>; // Whether Player 2 knows this
  Player3: Generated<boolean>; // Whether Player 3 knows this
  Player4: Generated<boolean>; // Whether Player 4 knows this
  Player5: Generated<boolean>; // Whether Player 5 knows this
  Player6: Generated<boolean>; // Whether Player 6 knows this
  Player7: Generated<boolean>; // Whether Player 7 knows this
  Player8: Generated<boolean>; // Whether Player 8 knows this
  Player9: Generated<boolean>; // Whether Player 9 knows this
  Player10: Generated<boolean>; // Whether Player 10 knows this
  Player11: Generated<boolean>; // Whether Player 11 knows this
  Player12: Generated<boolean>; // Whether Player 12 knows this
  Player13: Generated<boolean>; // Whether Player 13 knows this
  Player14: Generated<boolean>; // Whether Player 14 knows this
  Player15: Generated<boolean>; // Whether Player 15 knows this
  Payload: JSONColumnType<Record<string, unknown>>;
  CreatedAt: Generated<number>; // Unix timestamp in milliseconds
}

/**
 * Mutable knowledge that can be updated
 * Tracks changes between versions
 */
export interface MutableKnowledge extends TimedKnowledge {
  Key: number; // Item identifier
  Version: number;
  IsLatest: boolean; 
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