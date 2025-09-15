/**
 * LLM model instance management utilities
 */

import { LanguageModel, wrapLanguageModel } from 'ai';
import { config, type Model } from '../config.js';
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
  if (typeof(model) === "string")
    return getModelConfig(model);
  else return model;
}

/**
 * Get a LLM model instance by name
 */
export function getModel(config: Model): LanguageModel {
  var result: LanguageModel;
  // Find providers
  switch (config.provider) {
    case "openrouter":
      result = createOpenRouter()(config.name);
      break;
    case "openai":
      result = createOpenAI()(config.name);
      break;
    case "google":
      result = createGoogleGenerativeAI()(config.name);
      break;
    default:
      throw new Error(`Unsupported provider: ${config.provider}`);
  }
  // Wrap it for tool calling
  if (config.name.indexOf("gemma-3") !== -1) {
    result = wrapLanguageModel({
      model: result,
      middleware: gemmaToolMiddleware
    });
  }
  return result;
}