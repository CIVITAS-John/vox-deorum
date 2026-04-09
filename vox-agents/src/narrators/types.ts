/**
 * @module narrators/types
 *
 * Shared types for the narrator pipeline.
 * Defines config interfaces, workspace context, and output data structures.
 */

import type { Selectable } from 'kysely';
import type { SessionConfig, SessionType } from '../types/config.js';
import type { PlayerInformation } from '../../../mcp-server/dist/knowledge/schema/index.js';

// ---------------------------------------------------------------------------
// Config types
// ---------------------------------------------------------------------------

/** Narrator-specific session types */
export type NarratorStageType = Exclude<SessionType, 'strategist'>;

/** Base config for all narrator stages */
export interface NarratorStageConfig extends SessionConfig {
  type: NarratorStageType;
  /** Path to the shared workspace directory */
  workspace: string;
}

/** Stage 1 config — only stage that receives game-level parameters */
export interface AssembleConfig extends NarratorStageConfig {
  type: 'narrator-assemble';
  /** Game identifier */
  gameID: string;
  /** Path to recording directory containing segments.jsonl + video files */
  recordingDir: string;
  /** Path to knowledge SQLite DB — if omitted, searches mcp-server/archive */
  knowledgePath?: string;
}

// ---------------------------------------------------------------------------
// Workspace context (shared across stages via narrator-context.json)
// ---------------------------------------------------------------------------

/** Game-level context written by Stage 1, read by all later stages */
export interface NarratorContext {
  /** Game identifier */
  gameID: string;
  /** Resolved absolute path to the knowledge SQLite DB */
  knowledgePath: string;
  /** Resolved absolute path to the recording directory */
  recordingDir: string;
}

// ---------------------------------------------------------------------------
// Segment parsing types (from ProductionController's segments.jsonl)
// ---------------------------------------------------------------------------

/** A single entry in the segments.jsonl log */
export interface SegmentEntry {
  event: 'start' | 'switch' | 'stop';
  turn: number;
  playerID: number;
  /** Wall-clock Unix milliseconds (Date.now()) */
  at: number;
  /** OBS output filename — present on 'stop' entries */
  file?: string;
}

/** A validated segment group: start → switch* → stop */
export interface Segment {
  entries: SegmentEntry[];
  /** Wall-clock anchor (start.at) */
  startAt: number;
  /** Wall-clock end (stop.at) */
  stopAt: number;
  /** OBS output filename (stop.file) */
  sourceFile: string;
}

// ---------------------------------------------------------------------------
// Stage 1 output types (episodes.json)
// ---------------------------------------------------------------------------

/** Top-level episode manifest — output of Stage 1 */
export interface Episodes {
  gameID: string;
  totalTurns: number;
  players: Selectable<PlayerInformation>[];
  /** playerID -> friendly label (e.g., "Staffed LLM Strategist (deepseek-r1)") */
  playerTypes: Record<number, string>;
  winner?: { playerID: number; victoryType: string };
  episodes: Episode[];
}

/** Individual episode with video timing and event counts */
export interface Episode {
  /** Turn number */
  turn: number;
  /** Player whose UI is visible; -1 for minor civ episodes */
  playerID: number;
  /** OBS output filename (from stop.file) */
  sourceFile: string;
  /** Offset from start of source video file (ms) */
  offset: number;
  /** Duration of this episode within the source file (ms) */
  duration: number;
  /** Sparse map: event Type -> count for the current player in this turn */
  eventCounts: Record<string, number>;
  /** Only on minor civ episodes (playerID = -1) with ResolutionResult events */
  worldCongress?: boolean;
}
