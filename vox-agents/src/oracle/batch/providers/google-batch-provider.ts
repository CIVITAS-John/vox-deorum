/**
 * @module oracle/batch/providers/google-batch-provider
 *
 * Google native Batch API provider using the @google/genai SDK.
 * Supports both Google AI (API key) and Vertex AI Express (API key + vertexai flag).
 *
 * Converts directly from Vercel AI SDK params to Google InlinedRequest,
 * submits via genai.batches.create, and converts responses back to
 * OpenAI ChatCompletion format for the batch manager.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { GoogleGenAI } from '@google/genai';
import type { BatchJob, InlinedResponse } from '@google/genai';
import { createLogger } from '../../../utils/logger.js';
import { mapGoogleJobState } from '../types.js';
import { toInlinedRequest, toResultItem } from './google-format-converter.js';
import { BatchProvider } from './batch-provider.js';
import type {
  BatchSubmitItem,
  BatchCreateResult,
  BatchStatusResult,
  BatchResultItem,
} from './batch-provider.js';
import type { BatchEndpoint } from '../batch-endpoints.js';

const logger = createLogger('GoogleBatchProvider');

/**
 * Batch provider for Google Generative AI.
 * Uses the native genai.batches API with inline requests/responses.
 */
export class GoogleBatchProvider extends BatchProvider {
  private genai: GoogleGenAI;
  /** Stores completed BatchJob objects for getResults() */
  private completedJobs = new Map<string, BatchJob>();

  constructor(apiKey: string, _endpoint: BatchEndpoint) {
    super();
    this.genai = new GoogleGenAI({ apiKey });
  }

  async submitBatch(items: BatchSubmitItem[]): Promise<BatchCreateResult> {
    // Convert Vercel params to Google InlinedRequest with metadata for tracking
    const inlinedRequests = items.map(item => {
      const request = toInlinedRequest(item.params, item.modelConfig);
      return {
        ...request,
        metadata: { custom_id: item.customId },
      };
    });

    // All items in a batch group share the same model
    const model = items[0].modelConfig.name;

    const batchJob = await this.genai.batches.create({
      model,
      src: inlinedRequests,
    });

    const jobName = batchJob.name!;
    const status = mapGoogleJobState(batchJob.state);
    logger.info(`Created Google batch: ${jobName} (state: ${batchJob.state}, status: ${status})`);

    return { id: jobName, status };
  }

  async getBatchStatus(batchId: string): Promise<BatchStatusResult> {
    const batchJob = await this.genai.batches.get({ name: batchId });
    const status = mapGoogleJobState(batchJob.state);

    // Store completed jobs for getResults
    if (status === 'completed') {
      this.completedJobs.set(batchId, batchJob);
    }

    return {
      id: batchId,
      status,
      completedAt: batchJob.endTime ?? undefined,
    };
  }

  async getResults(batchId: string): Promise<BatchResultItem[]> {
    const batchJob = this.completedJobs.get(batchId);
    if (!batchJob) {
      throw new Error(`No completed job found for batch ${batchId}`);
    }

    // Prefer inline responses (most common for our use case)
    const inlinedResponses = batchJob.dest?.inlinedResponses;
    if (inlinedResponses && inlinedResponses.length > 0) {
      logger.info(`Processing ${inlinedResponses.length} inline response(s) for batch ${batchId}`);
      return this.processInlinedResponses(inlinedResponses);
    }

    // Fall back to file-based responses
    const fileName = batchJob.dest?.fileName;
    if (fileName) {
      logger.info(`Downloading file-based results for batch ${batchId}: ${fileName}`);
      return this.processFileResponses(fileName);
    }

    throw new Error(`No results found for batch ${batchId}: no inline responses or output file`);
  }

  /**
   * Process inline responses, using metadata.custom_id for matching.
   */
  private processInlinedResponses(responses: InlinedResponse[]): BatchResultItem[] {
    return responses.map((resp, index) => {
      const customId = resp.metadata?.custom_id ?? `unknown-${index}`;
      return toResultItem(resp, customId);
    });
  }

  /**
   * Download and process file-based responses.
   * Falls back to this path for large batches where Google returns a file instead of inline.
   */
  private async processFileResponses(fileName: string): Promise<BatchResultItem[]> {
    const downloadPath = path.join(os.tmpdir(), `batch-result-${Date.now()}.jsonl`);
    try {
      await this.genai.files.download({ file: fileName, downloadPath });
      const content = fs.readFileSync(downloadPath, 'utf-8');
      const lines = content.split('\n').filter(line => line.trim());

      return lines.map((line, index) => {
        const parsed = JSON.parse(line) as InlinedResponse;
        const customId = parsed.metadata?.custom_id ?? `unknown-${index}`;
        return toResultItem(parsed, customId);
      });
    } finally {
      try { fs.unlinkSync(downloadPath); } catch { /* ignore cleanup errors */ }
    }
  }
}
