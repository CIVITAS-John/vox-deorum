/**
 * @module utils/models/concurrency
 *
 * Concurrency-limited streamText wrapper with exponential retry.
 * Provides per-model concurrency limiting to prevent overwhelming API endpoints.
 */

import pLimit from 'p-limit';
import { streamText } from 'ai';
import type { Logger } from 'winston';
import { exponentialRetry } from '../retry.js';
import type { Model } from '../../types/index.js';

/** Map of model IDs to their p-limit instances */
const modelLimiters = new Map<string, ReturnType<typeof pLimit>>();

/**
 * Get or create a p-limit instance for a specific model.
 * Each model gets its own isolated concurrency limiter.
 *
 * @param model - Model configuration containing provider, name, and optional concurrencyLimit
 * @returns p-limit instance for the model
 */
function getModelLimiter(model: Model): ReturnType<typeof pLimit> {
  // Create a unique ID for the model
  const modelId = `${model.provider}/${model.name}`;

  // Check if we already have a limiter for this model
  let limiter = modelLimiters.get(modelId);

  if (!limiter) {
    // Create a new limiter with the model's concurrency limit (default 3)
    const concurrencyLimit = model.options?.concurrencyLimit ?? 3;
    limiter = pLimit(concurrencyLimit);
    modelLimiters.set(modelId, limiter);
  }

  return limiter;
}

/**
 * Wrapper for streamText that adds per-model concurrency limiting and exponential retry.
 * This is a drop-in replacement for streamText that ensures only a limited number of
 * concurrent requests are made per model. It also properly handles errors that occur
 * during streaming by awaiting the steps Promise within the retry mechanism.
 *
 * @param params - Same parameters as streamText, but model must be a Model object from getModel()
 * @param logger - Winston logger for retry logging
 * @param awaitSteps - Whether to await the steps Promise within the retry (default: true)
 * @returns Promise that resolves to either StreamTextResult or the resolved steps array
 *
 * @example
 * ```typescript
 * // Get the full result with steps awaited
 * const stepResults = await streamTextWithConcurrency({
 *   model: getModel(stepModel),
 *   messages: messages,
 *   // ... other streamText parameters
 * }, logger);
 * ```
 */
export async function streamTextWithConcurrency<T extends Parameters<typeof streamText>[0]>(
  params: T & { model: any }, // model is from getModel() which returns LanguageModel
  logger: Logger
) {
  // Extract the model config from params
  // The model parameter comes from getModel(stepModel) where stepModel is our Model type
  // We need to get the original Model config to determine concurrency limits
  // This is a bit of a hack but works since we control the call site
  const modelConfig = (params as any).__modelConfig as Model | undefined;

  // If we don't have the config, use a default limiter
  const limiter = modelConfig
    ? getModelLimiter(modelConfig)
    : pLimit(3); // Default fallback

  // Wrap the streamText call with both concurrency limiting and exponential retry
  return limiter(async () =>
    exponentialRetry(async (update) => {
      if (params.abortSignal?.aborted) return;
      
      // Call streamText with all the original parameters
      // Modify onChunk to call the update function for retry timeout reset
      const originalOnChunk = params.onChunk;
      const originalOnStepFinish = params.onStepFinish;
      const modifiedParams = {
        ...params,
        onChunk: (args: any) => {
          update(); // Reset the timeout
          originalOnChunk?.(args);
        },
        onStepFinish: (results: any) => {
          update(true);
          originalOnStepFinish?.(results);
        }
      };

      const result = streamText(modifiedParams);
      return {
        ...result,
        steps: await result.steps
      };
    }, logger)
  );
}

/**
 * Helper to attach model config to the parameters for concurrency tracking.
 * Use this when calling streamTextWithConcurrency to ensure proper per-model limiting.
 *
 * @param params - streamText parameters
 * @param modelConfig - The Model configuration object
 * @returns Parameters with attached model config
 */
export function withModelConfig<T extends Parameters<typeof streamText>[0]>(
  params: T,
  modelConfig: Model
): T & { __modelConfig: Model } {
  return {
    ...params,
    __modelConfig: modelConfig
  } as T & { __modelConfig: Model };
}