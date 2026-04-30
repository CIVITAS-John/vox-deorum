/**
 * @module oracle/batch/batch-api
 *
 * Thin wrapper around the official OpenAI SDK for Batch API operations.
 * Isolates all HTTP communication from the batch manager's state logic.
 *
 * Supports custom baseURL for OpenAI-compatible providers.
 */

import fs from 'node:fs';
import OpenAI from 'openai';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('BatchApi');

/**
 * OpenAI Batch API client.
 * Wraps the official `openai` SDK to provide a focused interface for
 * file upload, batch creation, status polling, and result download.
 */
export class BatchApi {
  protected client: OpenAI;

  /**
   * Create a new Batch API client.
   *
   * @param apiKey - API key for the provider
   * @param baseURL - Base URL (e.g. "https://api.openai.com/v1" or a compatible endpoint)
   */
  constructor(apiKey: string, baseURL: string) {
    this.client = new OpenAI({ apiKey, baseURL });
  }

  /**
   * Upload a JSONL file to the provider for batch processing.
   *
   * @param filePath - Local path to the JSONL file
   * @returns The uploaded file's ID (e.g. "file-abc123")
   */
  async uploadFile(filePath: string): Promise<string> {
    const file = await this.client.files.create({
      file: fs.createReadStream(filePath),
      purpose: 'batch',
    });
    logger.info(`Uploaded JSONL file: ${file.id}`);
    return file.id;
  }

  /**
   * Create a batch from an uploaded JSONL file.
   * Uses the /v1/chat/completions endpoint with a 24-hour completion window.
   *
   * @param fileId - ID of the previously uploaded JSONL file
   * @returns The batch object with ID and initial status
   */
  async createBatch(fileId: string): Promise<OpenAI.Batches.Batch> {
    const batch = await this.client.batches.create({
      input_file_id: fileId,
      endpoint: '/v1/chat/completions',
      completion_window: '24h',
    });
    logger.info(`Created batch: ${batch.id} (status: ${batch.status})`);
    return batch;
  }

  /**
   * Retrieve the current status of a batch.
   * Used for polling until the batch reaches a terminal state.
   *
   * @param batchId - OpenAI batch ID
   * @returns The batch object with current status and metadata
   */
  async getBatchStatus(batchId: string): Promise<OpenAI.Batches.Batch> {
    return await this.client.batches.retrieve(batchId);
  }

  /**
   * Download the content of a file (typically the output JSONL from a completed batch).
   *
   * @param fileId - OpenAI file ID (e.g. the output_file_id from a completed batch)
   * @returns The raw file content as a string (JSONL format)
   */
  async getFileContent(fileId: string): Promise<string> {
    const response = await this.client.files.content(fileId);
    return await response.text();
  }
}
