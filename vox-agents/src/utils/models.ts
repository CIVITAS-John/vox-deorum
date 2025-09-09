/**
 * LLM model instance management utilities
 */

import { LanguageModel, wrapLanguageModel } from 'ai';
import { config, type Model } from './config.js';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { createOpenAI } from '@ai-sdk/openai';
import { gemmaToolMiddleware } from '@ai-sdk-tool/parser';
import { createGoogleGenerativeAI } from '@ai-sdk/google';

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
export function getModel(name: string): LanguageModel {
  const model = getModelConfig(name);
  var result: LanguageModel;
  // Find providers
  switch (model.provider) {
    case "openrouter":
      result = createOpenRouter()(model.name);
      break;
    case "openai":
      result = createOpenAI()(model.name);
      break;
    case "google":
      result = createGoogleGenerativeAI()(model.name);
      break;
    default:
      throw new Error(`Unsupported provider: ${model.provider}`);
  }
  // Wrap it for tool calling
  if (model.name.indexOf("gemma3") !== -1) {
    result = wrapLanguageModel({
      model: result,
      middleware: gemmaToolMiddleware
    });
  }
  return result;
}