/**
 * LLM model instance management utilities
 */

import { MastraLanguageModel } from '@mastra/core';
import { config, type Model } from './config.js';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';

/**
 * Get a LLM model config by name
 * @param modelName - Name of the model configuration (default: "default")
 * @returns Model configuration or undefined if not found
 */
export function getModelConfig(name: string = 'default'): Model {
  const model = config.llms[name];
  if (!model) return getModelConfig("default");
  return model;
}

/**
 * Get a LLM model instance by name
 */
export function getModel(name: string): MastraLanguageModel {
  const model = getModelConfig(name);
  switch (model.provider) {
    case "openrouter":
      return createOpenRouter()(model.name);
    default:
      throw new Error(`Unsupported provider: ${model.provider}`);
  }
}