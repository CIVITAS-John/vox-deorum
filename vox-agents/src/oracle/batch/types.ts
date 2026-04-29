/**
 * @module oracle/batch/types
 *
 * Batch manager configuration, internal queue types, and helpers.
 * OpenAI API types are imported from the official `openai` npm package.
 */

import type OpenAI from 'openai';

/** Re-export commonly used OpenAI types for convenience */
export type ChatCompletionRequest = OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming;
export type ChatCompletion = OpenAI.Chat.Completions.ChatCompletion;
export type ChatCompletionMessageParam = OpenAI.Chat.Completions.ChatCompletionMessageParam;
export type ChatCompletionTool = OpenAI.Chat.Completions.ChatCompletionTool;

// ── Batch Manager Configuration ──

/** Options for initializing the batch manager */
export interface BatchManagerOptions {
  /** Directory for SQLite DB and temp JSONL files */
  stateDir: string;
  /** Time window to collect requests before flushing (ms, default 15000) */
  flushInterval?: number;
  /** How often to poll batch status (ms, default 30000) */
  pollInterval?: number;
  /** Max item-level retries before giving up (default 3) */
  maxItemRetries?: number;
  /** Max batch-level retries before giving up (default 3) */
  maxBatchRetries?: number;
}

// ── Internal Queue Types ──

/** A request waiting in the in-memory queue for the next batch flush */
export interface QueuedRequest {
  /** SHA-256 hash of modelId + request body, used as DB primary key */
  hash: string;
  /** Unique ID for this request within the JSONL batch file */
  customId: string;
  /** Model identifier (e.g. "gpt-4o") included in the hash for cross-model dedup */
  modelId: string;
  /** The full OpenAI chat completion request body */
  request: ChatCompletionRequest;
  /** Resolves the caller's promise with the completion response */
  resolve: (response: ChatCompletion) => void;
  /** Rejects the caller's promise on failure */
  reject: (error: Error) => void;
  /** Timestamp when this request was enqueued */
  timestamp: number;
}

// ── Batch Status Helpers ──

/** All possible OpenAI batch status values */
export type BatchStatus =
  | 'validating'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'expired'
  | 'cancelling'
  | 'cancelled';

/**
 * Whether a batch status is terminal (no more polling needed).
 * Terminal statuses: completed, failed, expired, cancelled.
 */
export function isTerminalBatchStatus(status: string): boolean {
  return status === 'completed'
    || status === 'failed'
    || status === 'expired'
    || status === 'cancelled';
}
