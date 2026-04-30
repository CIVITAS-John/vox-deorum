/**
 * @module oracle/batch/providers/batch-provider
 *
 * Abstract base class for batch API providers.
 * Each provider handles the full submit-poll-download lifecycle internally,
 * converting from Vercel AI SDK format to its native API format.
 */

import type { Model } from '../../../types/index.js';
import type { ChatCompletion } from '../types.js';

// ── Submit Types ──

/** What the batch manager hands to the provider — raw Vercel AI SDK params */
export interface BatchSubmitItem {
  /** Unique ID for this request within the batch */
  customId: string;
  /** Vercel streamText params (messages, tools, toolChoice, etc.) */
  params: Record<string, any>;
  /** Model configuration (provider, name, options) */
  modelConfig: Model;
}

// ── Result Types ──

/** Provider-neutral batch creation result */
export interface BatchCreateResult {
  /** Batch identifier (OpenAI batch ID or Google job name) */
  id: string;
  /** Normalized status string */
  status: string;
}

/** Provider-neutral batch status result */
export interface BatchStatusResult {
  /** Batch identifier */
  id: string;
  /** Normalized status: 'validating'|'in_progress'|'completed'|'failed'|'expired'|'cancelled'|'cancelling' */
  status: string;
  /** ISO timestamp when batch completed */
  completedAt?: string;
  /** Request progress counts */
  requestCounts?: { total: number; completed: number; failed: number };
}

/** Provider-neutral result item — ChatCompletion for DB caching and convertToStepResult() */
export interface BatchResultItem {
  /** The custom_id matching the submitted request */
  customId: string;
  /** ChatCompletion response (null on error) */
  response: ChatCompletion | null;
  /** Error details (null on success) */
  error: { code: string; message: string } | null;
}

// ── Base Class ──

/**
 * Abstract batch provider.
 * Subclasses handle serialization, upload, creation, polling, and result
 * retrieval using their provider's native API.
 */
export abstract class BatchProvider {
  /**
   * Submit a batch of requests.
   * The provider converts Vercel params to its native format, uploads/creates
   * the batch, and returns a batch identifier with initial status.
   */
  abstract submitBatch(items: BatchSubmitItem[]): Promise<BatchCreateResult>;

  /**
   * Poll batch status.
   * Returns normalized status so the batch manager can decide when to
   * download results or handle failures.
   */
  abstract getBatchStatus(batchId: string): Promise<BatchStatusResult>;

  /**
   * Download and parse results from a completed batch.
   * Returns results as ChatCompletion items keyed by customId so the
   * batch manager can resolve caller promises and cache in the DB.
   */
  abstract getResults(batchId: string): Promise<BatchResultItem[]>;
}
