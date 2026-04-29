/**
 * @module oracle/batch/batch-manager
 *
 * Queue-based batch manager for the OpenAI Batch API.
 *
 * Collects LLM requests over a configurable time window, submits them as a
 * single batch, polls for completion, and resolves each caller's promise with
 * the result. Uses SQLite (via BatchDb) for durable state so that in-flight
 * batches survive process crashes and completed results are cached.
 *
 * Modeled after the Lua call queue pattern in mcp-server/src/bridge/manager.ts.
 *
 * Lifecycle:
 *   startBatchManager(apiKey, baseURL, options)  →  active, flush loop running
 *   getBatchManager().enqueue(request)           →  Promise<ChatCompletion>
 *   shutdownBatchManager()                       →  flush remaining, wait, close DB
 */

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createLogger } from '../../utils/logger.js';
import { exponentialRetry } from '../../utils/retry.js';
import { BatchDb } from './batch-db.js';
import { BatchApi } from './batch-api.js';
import { isTerminalBatchStatus } from './types.js';
import type {
  BatchManagerOptions,
  ChatCompletion,
  ChatCompletionRequest,
  QueuedRequest,
} from './types.js';
import type { Model } from '../../types/index.js';

const logger = createLogger('BatchManager');

// ── Singleton ──

/** Singleton batch manager instance */
let instance: BatchManager | null = null;

/**
 * Get the active BatchManager singleton.
 * Throws if not yet initialized via startBatchManager().
 */
export function getBatchManager(): BatchManager {
  if (!instance) {
    throw new Error('BatchManager not initialized. Call startBatchManager() first.');
  }
  return instance;
}

/**
 * Check if a BatchManager singleton exists (without throwing).
 * Used by streamTextWithConcurrency to check before routing.
 */
export function hasBatchManager(): boolean {
  return instance !== null && instance.isActive;
}

/**
 * Initialize and start the batch manager singleton.
 * Creates the SQLite database, resumes any in-flight batches from a previous
 * process, and begins the periodic flush loop.
 *
 * @param apiKey - API key for the OpenAI-compatible provider
 * @param baseURL - Base URL of the API (e.g. "https://api.openai.com/v1")
 * @param options - Batch manager configuration
 * @returns The initialized BatchManager
 */
export async function startBatchManager(
  apiKey: string,
  baseURL: string,
  options: BatchManagerOptions
): Promise<BatchManager> {
  if (instance) {
    logger.warn('BatchManager already initialized, returning existing instance');
    return instance;
  }
  instance = new BatchManager(apiKey, baseURL, options);
  await instance.start();
  return instance;
}

/**
 * Shut down the batch manager singleton.
 * Flushes any remaining queued requests, waits for in-flight batches,
 * and closes the database connection.
 */
export async function shutdownBatchManager(): Promise<void> {
  if (instance) {
    await instance.shutdown();
    instance = null;
  }
}

// ── Provider Routing ──

/**
 * Resolve the batch API endpoint and credentials for a model's provider.
 * Throws for unsupported providers — no silent fallback.
 *
 * @param model - Model configuration
 * @returns Base URL and API key for the batch API
 * @throws Error if the provider doesn't support batch mode
 */
export function getBatchEndpoint(model: Model): { baseURL: string; apiKey: string } {
  switch (model.provider) {
    case 'openai':
      return {
        baseURL: 'https://api.openai.com/v1',
        apiKey: process.env.OPENAI_API_KEY!,
      };
    case 'openai-compatible':
      if (!process.env.OPENAI_COMPATIBLE_URL) {
        throw new Error('OPENAI_COMPATIBLE_URL not set for batch mode');
      }
      return {
        baseURL: process.env.OPENAI_COMPATIBLE_URL,
        apiKey: process.env.OPENAI_COMPATIBLE_API_KEY!,
      };
    case 'google':
      return {
        baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai',
        apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY!,
      };
    default:
      throw new Error(
        `Batch mode not supported for provider '${model.provider}'. Use openai or openai-compatible.`
      );
  }
}

// ── Batch Manager ──

/**
 * Core batch manager class.
 * Not exported directly — use the singleton functions above.
 */
class BatchManager {
  private batchDb: BatchDb;
  private batchApi: BatchApi;
  private queue: QueuedRequest[] = [];
  /**
   * Promises waiting on in-flight batches.
   * Outer map: batch_id → inner map: custom_id → {resolve, reject}
   */
  private inFlightPromises = new Map<
    string,
    Map<string, { resolve: QueuedRequest['resolve']; reject: QueuedRequest['reject'] }>
  >();
  private flushTimer: NodeJS.Timeout | null = null;
  private active = false;
  private shuttingDown = false;
  /** Tracks all poll loops so shutdown can await them */
  private pollPromises: Promise<void>[] = [];
  /**
   * Counts how many times the same base content hash has been enqueued.
   * Oracle intentionally sends the same prompt multiple times (repetitions);
   * the occurrence index is appended to the hash so each run is unique.
   * On restart the counter resets to 0, but the DB already has hash:0, hash:1, etc.
   * so they match up via cache hits in order.
   */
  private hashOccurrences = new Map<string, number>();
  /** Monotonic counter for generating unique custom_ids within this process */
  private customIdCounter = 0;

  private readonly stateDir: string;
  private readonly flushInterval: number;
  private readonly pollInterval: number;
  private readonly maxItemRetries: number;
  private readonly maxBatchRetries: number;

  constructor(apiKey: string, baseURL: string, options: BatchManagerOptions) {
    this.stateDir = options.stateDir;
    this.flushInterval = options.flushInterval ?? 15_000;
    this.pollInterval = options.pollInterval ?? 30_000;
    this.maxItemRetries = options.maxItemRetries ?? 3;
    this.maxBatchRetries = options.maxBatchRetries ?? 3;

    // Ensure state directory exists for JSONL temp files
    fs.mkdirSync(this.stateDir, { recursive: true });

    // Initialize database and API client
    const dbPath = path.join(this.stateDir, 'batch.db');
    this.batchDb = new BatchDb(dbPath);
    this.batchApi = new BatchApi(apiKey, baseURL.replace(/\/+$/, ''));
  }

  /** Whether the batch manager is active and accepting requests */
  get isActive(): boolean {
    return this.active;
  }

  /**
   * Start the batch manager: create schema, resume in-flight batches, begin flush loop.
   */
  async start(): Promise<void> {
    if (this.active) return;

    await this.batchDb.createSchema();
    this.active = true;
    logger.info(
      `BatchManager started (flush=${this.flushInterval}ms, poll=${this.pollInterval}ms)`
    );

    // Resume any batches that were in-flight when the process last exited
    await this.resumeInFlightBatches();

    // Start the periodic flush loop
    this.flushTimer = setInterval(() => {
      if (this.queue.length > 0 && !this.shuttingDown) {
        this.flush().catch(err => logger.error('Flush error:', err));
      }
    }, this.flushInterval);
  }

  /**
   * Shut down gracefully: flush remaining queue, wait for polls, close DB.
   */
  async shutdown(): Promise<void> {
    if (!this.active) return;
    this.shuttingDown = true;

    // Stop the flush timer
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    // Flush any remaining queued requests
    if (this.queue.length > 0) {
      logger.info(`Flushing ${this.queue.length} remaining request(s) before shutdown`);
      await this.flush();
    }

    // Wait for all in-flight batch polls to complete
    if (this.pollPromises.length > 0) {
      logger.info(`Waiting for ${this.pollPromises.length} in-flight batch(es)...`);
      await Promise.allSettled(this.pollPromises);
    }

    this.active = false;
    await this.batchDb.destroy();
    logger.info('BatchManager shut down');
  }

  /**
   * Enqueue a chat completion request for batch processing.
   *
   * Returns a promise that resolves when the batch completes and the response
   * is available. If the same request (identified by content hash including
   * model ID) was already completed in a previous run, resolves immediately
   * from the SQLite cache.
   *
   * @param request - OpenAI chat completion request body (must include `model` field)
   * @returns Promise resolving to the chat completion response
   */
  async enqueue(request: ChatCompletionRequest): Promise<ChatCompletion> {
    const modelId = request.model;
    // Compute a base hash from the content, then append an occurrence index
    // so that identical requests (Oracle repetitions) get distinct hashes.
    const baseHash = this.hashRequest(modelId, request);
    const occurrence = this.hashOccurrences.get(baseHash) ?? 0;
    this.hashOccurrences.set(baseHash, occurrence + 1);
    const hash = `${baseHash}:${occurrence}`;

    // Check SQLite for an existing record with this hash
    const existing = await this.batchDb.findByHash(hash);

    if (existing) {
      // Already completed — resolve from cache
      if (existing.status === 'completed' && existing.responseBody) {
        logger.debug(`Cache hit for ${modelId} request ${hash.slice(0, 8)}`);
        return existing.responseBody as unknown as ChatCompletion;
      }

      // Already submitted in an in-flight batch — attach a new promise
      if (existing.status === 'submitted' && existing.batchId) {
        const batchPromises = this.inFlightPromises.get(existing.batchId);
        if (batchPromises) {
          logger.debug(`Attaching to in-flight batch ${existing.batchId} for ${hash.slice(0, 8)}`);
          return new Promise<ChatCompletion>((resolve, reject) => {
            batchPromises.set(existing.customId, { resolve, reject });
          });
        }
        // Batch promises map gone (stale from previous run with no resume) — fall through
      }

      // Failed but retriable — reset and re-enqueue
      if (existing.status === 'failed' && existing.retries < this.maxItemRetries) {
        await this.batchDb.resetForRetry(hash);
        // Fall through to enqueue
      } else if (existing.status === 'failed') {
        // Exhausted retries — reject immediately
        throw new Error(
          `Batch request failed after ${existing.retries} retries: ${existing.error}`
        );
      }

      // Status is 'pending' — already in DB from a previous run, just queue it
    } else {
      // New request — insert as 'pending' in the database
      const customId = this.generateCustomId(modelId);
      await this.batchDb.insertRequest({
        hash,
        modelId,
        customId,
        requestBody: JSON.stringify(request) as any,
        responseBody: null,
        error: null,
        status: 'pending',
        batchId: null,
        createdAt: new Date().toISOString(),
        completedAt: null,
      });
    }

    // Re-fetch to get the custom_id (may have been set in a previous run)
    const row = (await this.batchDb.findByHash(hash))!;

    return new Promise<ChatCompletion>((resolve, reject) => {
      this.queue.push({
        hash,
        customId: row.customId,
        modelId,
        request,
        resolve,
        reject,
        timestamp: Date.now(),
      });
    });
  }

  // ── Internal: Flush & Submit ──

  /**
   * Drain the in-memory queue, write a JSONL file, upload it, create a batch,
   * and start polling. Each queued request's promise will be resolved when
   * the batch completes.
   */
  private async flush(): Promise<void> {
    if (this.queue.length === 0) return;

    // Drain the entire queue
    const batch = this.queue.splice(0);
    logger.info(`Flushing ${batch.length} request(s) to batch API`);

    // Build JSONL content — one request per line
    const jsonlLines = batch.map(q =>
      JSON.stringify({
        custom_id: q.customId,
        method: 'POST',
        url: '/v1/chat/completions',
        body: q.request,
      })
    );
    const jsonlContent = jsonlLines.join('\n');

    // Write to a temp file in the state directory
    const jsonlPath = path.join(this.stateDir, `requests-${Date.now()}.jsonl`);
    fs.writeFileSync(jsonlPath, jsonlContent, 'utf-8');

    try {
      // Upload the JSONL file with retry
      const fileId = await exponentialRetry(
        async (update) => {
          const result = await this.batchApi.uploadFile(jsonlPath);
          update(true);
          return result;
        },
        logger, undefined, 'batch-upload', this.maxBatchRetries, 5000, 60000
      );

      // Create the batch with retry
      const batchObj = await exponentialRetry(
        async (update) => {
          const result = await this.batchApi.createBatch(fileId);
          update(true);
          return result;
        },
        logger, undefined, 'batch-create', this.maxBatchRetries, 5000, 60000
      );

      const batchId = batchObj.id;
      const modelIds = [...new Set(batch.map(q => q.modelId))].join(',');

      // Record the batch in the database
      await this.batchDb.insertBatch({
        batchId,
        modelId: modelIds,
        fileId,
        status: batchObj.status,
        outputFileId: null,
        errorFileId: null,
        createdAt: new Date().toISOString(),
        completedAt: null,
        requestCount: batch.length,
      });

      // Mark all requests as submitted
      const hashes = batch.map(q => q.hash);
      await this.batchDb.markSubmitted(hashes, batchId);

      // Register promises for resolution when results arrive
      const promiseMap = new Map<
        string,
        { resolve: QueuedRequest['resolve']; reject: QueuedRequest['reject'] }
      >();
      for (const q of batch) {
        promiseMap.set(q.customId, { resolve: q.resolve, reject: q.reject });
      }
      this.inFlightPromises.set(batchId, promiseMap);

      // Start polling in the background (tracked for shutdown)
      const pollPromise = this.pollBatch(batchId);
      this.pollPromises.push(pollPromise);
      pollPromise.finally(() => {
        this.pollPromises = this.pollPromises.filter(p => p !== pollPromise);
      });

      logger.info(`Batch ${batchId} submitted with ${batch.length} request(s)`);
    } catch (error) {
      // Batch submission failed entirely — reject all promises and mark as failed
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`Batch submission failed: ${errorMsg}`);

      for (const q of batch) {
        await this.batchDb.markFailed(q.customId, '', errorMsg);
        q.reject(new Error(`Batch submission failed: ${errorMsg}`));
      }
    } finally {
      // Clean up the temp JSONL file
      try {
        fs.unlinkSync(jsonlPath);
      } catch { /* ignore cleanup errors */ }
    }
  }

  // ── Internal: Polling ──

  /**
   * Poll a batch until it reaches a terminal status.
   * Updates the database on each poll and resolves/rejects promises on completion.
   *
   * @param batchId - OpenAI batch ID to poll
   */
  private async pollBatch(batchId: string): Promise<void> {
    logger.info(`Polling batch ${batchId}...`);

    while (true) {
      // Wait before polling (delay-first so the batch has time to process)
      await new Promise(resolve => setTimeout(resolve, this.pollInterval));

      try {
        const batchObj = await this.batchApi.getBatchStatus(batchId);
        const status = batchObj.status;

        // Update the database with current status
        await this.batchDb.updateBatchStatus(batchId, status, {
          outputFileId: batchObj.output_file_id ?? undefined,
          errorFileId: batchObj.error_file_id ?? undefined,
          completedAt: batchObj.completed_at
            ? new Date(batchObj.completed_at * 1000).toISOString()
            : undefined,
        });

        // Log progress if request counts are available
        if (batchObj.request_counts) {
          const { total, completed, failed } = batchObj.request_counts;
          logger.info(
            `Batch ${batchId}: ${completed}/${total} completed, ${failed} failed (status: ${status})`
          );
        }

        // Handle terminal states
        if (status === 'completed') {
          await this.downloadResults(batchId, batchObj.output_file_id!);
          return;
        }

        if (isTerminalBatchStatus(status)) {
          // Failed, expired, or cancelled — reject all waiting promises
          const errorMsg = `Batch ${batchId} ended with status: ${status}`;
          logger.error(errorMsg);
          this.rejectBatchPromises(batchId, new Error(errorMsg));
          await this.batchDb.markBatchRequestsFailed(batchId, errorMsg);
          return;
        }
      } catch (error) {
        // Network error during poll — log and keep polling
        logger.warn(
          `Error polling batch ${batchId}: ${error instanceof Error ? error.message : error}`
        );
      }
    }
  }

  /**
   * Download results from a completed batch, save to DB, and resolve promises.
   *
   * @param batchId - The completed batch ID
   * @param outputFileId - The output JSONL file ID from the batch object
   */
  private async downloadResults(batchId: string, outputFileId: string): Promise<void> {
    logger.info(`Downloading results for batch ${batchId}`);

    const content = await this.batchApi.getFileContent(outputFileId);
    const lines = content.split('\n').filter(line => line.trim());

    // Parse each line as a batch response object
    const responses = lines.map(line => JSON.parse(line) as {
      id: string;
      custom_id: string;
      response: { status_code: number; body: ChatCompletion } | null;
      error: { code: string; message: string } | null;
    });

    const promiseMap = this.inFlightPromises.get(batchId);

    // Process each response: save to DB and resolve/reject the corresponding promise
    for (const resp of responses) {
      if (resp.response && resp.response.status_code === 200) {
        // Success — save response and resolve
        await this.batchDb.markCompleted(resp.custom_id, batchId, resp.response.body);
        promiseMap?.get(resp.custom_id)?.resolve(resp.response.body);
      } else {
        // Failure — save error and reject
        const errorMsg = resp.error?.message
          ?? `HTTP ${resp.response?.status_code ?? 'unknown'}`;
        await this.batchDb.markFailed(resp.custom_id, batchId, errorMsg);
        promiseMap?.get(resp.custom_id)?.reject(
          new Error(`Batch request failed: ${errorMsg}`)
        );
      }
      promiseMap?.delete(resp.custom_id);
    }

    // Handle any promises that didn't get a response (shouldn't happen, but be safe)
    if (promiseMap) {
      for (const [customId, promise] of promiseMap) {
        logger.warn(`No response found for custom_id ${customId} in batch ${batchId}`);
        promise.reject(new Error(`No response received for request ${customId}`));
      }
      this.inFlightPromises.delete(batchId);
    }

    logger.info(`Batch ${batchId} completed: ${responses.length} result(s) processed`);
  }

  // ── Internal: Resume ──

  /**
   * Resume polling for batches that were in-flight when the process last exited.
   * Loads non-terminal batches from the database and starts polling each one.
   * When callers re-enqueue the same requests, their promises get attached
   * to the appropriate batch's promise map.
   */
  private async resumeInFlightBatches(): Promise<void> {
    const batches = await this.batchDb.getInFlightBatches();
    if (batches.length === 0) return;

    logger.info(`Resuming ${batches.length} in-flight batch(es) from previous run`);

    for (const batch of batches) {
      // Create an empty promise map — callers will attach when they re-enqueue
      this.inFlightPromises.set(batch.batchId, new Map());

      // Start polling in the background
      const pollPromise = this.pollBatch(batch.batchId);
      this.pollPromises.push(pollPromise);
      pollPromise.finally(() => {
        this.pollPromises = this.pollPromises.filter(p => p !== pollPromise);
      });
    }
  }

  // ── Internal: Helpers ──

  /**
   * Compute a SHA-256 hash of the model ID and request body for deduplication.
   * Including the model ID in the hash prevents the same prompt sent to
   * different models from colliding.
   *
   * @param modelId - Model identifier (e.g. "gpt-4o")
   * @param request - The chat completion request body
   * @returns Hex-encoded SHA-256 hash
   */
  private hashRequest(modelId: string, request: ChatCompletionRequest): string {
    const content = modelId + '\0' + JSON.stringify(request);
    return createHash('sha256').update(content).digest('hex');
  }

  /**
   * Generate a unique custom_id for a request within a JSONL batch file.
   * Scoped by model name to make IDs easier to debug in batch output.
   *
   * @param modelId - Model identifier for prefixing
   * @returns A unique custom_id string
   */
  private generateCustomId(modelId: string): string {
    const safeModel = modelId.replace(/[^a-zA-Z0-9._-]/g, '-');
    return `${safeModel}-${Date.now()}-${this.customIdCounter++}`;
  }

  /**
   * Reject all promises waiting on a specific batch.
   * Called when a batch reaches a terminal failure state.
   *
   * @param batchId - The batch whose promises should be rejected
   * @param error - The error to reject with
   */
  private rejectBatchPromises(batchId: string, error: Error): void {
    const promiseMap = this.inFlightPromises.get(batchId);
    if (promiseMap) {
      for (const [, promise] of promiseMap) {
        promise.reject(error);
      }
      this.inFlightPromises.delete(batchId);
    }
  }
}
