/**
 * @module oracle/batch/google-batch-api
 *
 * Google-specific Batch API client.
 *
 * Google's OpenAI-compatible endpoint supports batch creation and polling
 * but NOT file upload/download. Those operations must go through the native
 * Google GenAI SDK (`@google/genai`).
 *
 * Extends BatchApi so batch creation and status polling reuse the OpenAI SDK,
 * while file upload and download are overridden to use the GenAI SDK.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { GoogleGenAI } from '@google/genai';
import { createLogger } from '../../utils/logger.js';
import { BatchApi } from './batch-api.js';

const logger = createLogger('GoogleBatchApi');

/**
 * Batch API client for Google Generative AI.
 * Uses the GenAI SDK for file operations and the OpenAI SDK for batch ops.
 */
export class GoogleBatchApi extends BatchApi {
  private genai: GoogleGenAI;

  constructor(apiKey: string, baseURL: string) {
    super(apiKey, baseURL);
    this.genai = new GoogleGenAI({ apiKey });
  }

  /**
   * Upload a JSONL file via the Google GenAI Files API.
   * Returns the file name (e.g. "files/abc123") which serves as the file ID
   * for the OpenAI-compatible batch creation endpoint.
   */
  override async uploadFile(filePath: string): Promise<string> {
    const uploaded = await this.genai.files.upload({
      file: filePath,
      config: { mimeType: 'jsonl' },
    });
    const fileId = uploaded.name!;
    logger.info(`Uploaded JSONL file via GenAI: ${fileId}`);
    return fileId;
  }

  /**
   * Download file content via the Google GenAI Files API.
   * The JS SDK writes to disk, so we download to a temp file and read it back.
   */
  override async getFileContent(fileId: string): Promise<string> {
    const downloadPath = path.join(os.tmpdir(), `batch-result-${Date.now()}.jsonl`);
    try {
      await this.genai.files.download({ file: fileId, downloadPath });
      return fs.readFileSync(downloadPath, 'utf-8');
    } finally {
      try { fs.unlinkSync(downloadPath); } catch { /* ignore cleanup errors */ }
    }
  }
}
