/**
 * LLM model instance management utilities
 */

import { LanguageModel, wrapLanguageModel } from 'ai';
import { config, type Model } from '../config.js';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { createOpenAI } from '@ai-sdk/openai';
import { gemmaToolMiddleware } from '@ai-sdk-tool/parser';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import dotenv from 'dotenv';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { toolRescueMiddleware } from './tool-rescue.js';

dotenv.config();

/**
 * Get a LLM model config by name
 * @param modelName - Name of the model configuration (default: "default")
 * @returns Model configuration or undefined if not found
 */
export function getModelConfig(name: string = 'default', reasoning?: 'minimal' | 'low' | 'medium' | 'high'): Model {
  const model = config.llms[name];
  if (!model) return getModelConfig("default", reasoning);
  if (typeof(model) === "string")
    return getModelConfig(model, reasoning);
  else if (reasoning) {
    model.options = { ...model.options, reasoningEffort: reasoning };
    return model;
  } else return model;
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
    case "jetstream2":
      result = createOpenAICompatible({
        baseURL: "https://llm-api.jetstream-cloud.org/v1",
        name: "jetstream2",
        apiKey: process.env.JETSTREAM2_API_KEY,
      }).chatModel(config.name);
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
  } else {
    result = wrapLanguageModel({
      model: result,
      middleware: toolRescueMiddleware()
    });
  }
  return result;
}

/**
 * Build provider options from model configuration
 *
 * Converts OpenAI-style reasoningEffort to OpenRouter's reasoning.effort format
 * when using the openrouter provider.
 *
 * @param model - The model configuration
 * @returns Provider options object keyed by provider name
 *
 * @example
 * // OpenAI format
 * buildProviderOptions({
 *   provider: 'openai',
 *   name: 'gpt-5',
 *   options: { reasoningEffort: 'high' }
 * })
 * // Returns: { openai: { reasoningEffort: 'high' } }
 *
 * @example
 * // OpenRouter conversion
 * buildProviderOptions({
 *   provider: 'openrouter',
 *   name: 'deepseek/deepseek-r1',
 *   options: { reasoningEffort: 'medium' }
 * })
 * // Returns: { openrouter: { reasoning: { effort: 'medium' } } }
 */
export function buildProviderOptions(model: Model): Record<string, any> {
  if (!model.options) {
    return { [model.provider]: {} };
  }

  // Handle OpenRouter's reasoning format
  if (model.provider === 'openrouter' && model.options.reasoningEffort) {
    const { reasoningEffort, ...otherOptions } = model.options;
    return {
      openrouter: {
        ...otherOptions,
        reasoning: {
          effort: reasoningEffort
        }
      }
    };
  }

  // Default: pass options through as-is
  return {
    [model.provider]: model.options
  };
}