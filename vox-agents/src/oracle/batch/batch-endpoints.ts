/**
 * @module oracle/batch/batch-endpoints
 *
 * Resolve batch API endpoints and credentials per provider.
 * Extracted from batch-manager.ts so endpoint logic is reusable
 * and the batch manager can maintain multiple BatchProvider instances.
 */

import type { Model } from '../../types/index.js';

/** Resolved batch API endpoint with credentials */
export interface BatchEndpoint {
  /** Provider name (determines which BatchProvider implementation to use) */
  provider: string;
  baseURL: string;
  apiKey: string;
  /** Google environment: 'vertexai' for Vertex AI Express, undefined for Google AI */
  environment?: 'vertexai';
}

/**
 * Resolve the batch API endpoint and credentials for a model's provider.
 * Throws for unsupported providers — no silent fallback.
 *
 * @param model - Model configuration (provider, options.environment)
 * @returns Base URL, API key, and optional environment for the batch provider
 * @throws Error if the provider doesn't support batch mode
 */
export function getBatchEndpoint(model: Model): BatchEndpoint {
  switch (model.provider) {
    case 'openai':
      return {
        provider: 'openai',
        baseURL: 'https://api.openai.com/v1',
        apiKey: process.env.OPENAI_API_KEY!,
      };
    case 'openai-compatible':
      if (!process.env.OPENAI_COMPATIBLE_URL) {
        throw new Error('OPENAI_COMPATIBLE_URL not set for batch mode');
      }
      return {
        provider: 'openai-compatible',
        baseURL: process.env.OPENAI_COMPATIBLE_URL,
        apiKey: process.env.OPENAI_COMPATIBLE_API_KEY!,
      };
    case 'google':
      return {
        provider: 'google',
        baseURL: 'google-native',
        apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY!,
        environment: model.options?.environment === 'vertexai' || process.env.GOOGLE_GENAI_USE_VERTEXAI === 'true'
          ? 'vertexai' : undefined,
      };
    default:
      throw new Error(
        `Batch mode not supported for provider '${model.provider}'. Use openai, openai-compatible, or google.`
      );
  }
}
