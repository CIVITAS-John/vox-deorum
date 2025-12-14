/**
 * @module utils/models/models
 *
 * LLM model instance management utilities.
 * Handles creation and configuration of language models from various providers with middleware support.
 */

import { LanguageModel, ProviderMetadata, wrapLanguageModel } from 'ai';
import { config } from '../config.js';
import type { Model } from '../types.js';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { gemmaToolMiddleware } from '@ai-sdk-tool/parser';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import dotenv from 'dotenv';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { toolRescueMiddleware } from './tool-rescue.js';

dotenv.config();

/**
 * Get a LLM model config by name.
 * Supports model aliasing, reasoning effort configuration, and config overrides.
 *
 * @param name - Name of the model configuration (default: "default")
 * @param reasoning - Optional reasoning effort level for reasoning models
 * @param overrides - Optional model configuration overrides to replace config.json definitions
 * @returns Model configuration object
 *
 * @example
 * ```typescript
 * const model = getModelConfig('default', 'high');
 * const model = getModelConfig('default', undefined, { 'default': { provider: 'openai', name: 'gpt-4' } });
 * ```
 */
export function getModelConfig(
  name: string = 'default',
  reasoning?: 'minimal' | 'low' | 'medium' | 'high',
  overrides?: Record<string, Model | string>
): Model {
  // Check overrides first
  if (overrides && overrides[name]) {
    const override = overrides[name];
    if (typeof override === 'string')
      return getModelConfig(override, reasoning, overrides);
    // It's a Model object - apply reasoning if needed
    if (reasoning) {
      return {
        ...override,
        options: { ...override.options, reasoningEffort: reasoning }
      };
    }
    return override;
  }

  // Fall back to config.llms
  const model = config.llms[name];
  if (!model) {
    if (name === "default") throw new Error("The model assignment for `default` is not found. Please check your settings!")
    return getModelConfig("default", reasoning);
  }
  if (typeof(model) === "string")
    return getModelConfig(model, reasoning);
  else if (reasoning) {
    return {
      ...model,
      options: { ...model.options, reasoningEffort: reasoning }
    };
  } else return model;
}


/**
 * Get a LLM model instance by name.
 * Creates a language model from the specified provider and wraps it with
 * appropriate middleware (gemmaToolMiddleware for Gemma models, toolRescueMiddleware for others).
 *
 * @param config - Model configuration object
 * @param options - Additional options for model configuration
 * @returns Wrapped LanguageModel instance ready for use
 * @throws Error if the provider is not supported
 *
 * @example
 * ```typescript
 * const modelConfig = getModelConfig('default');
 * const model = getModel(modelConfig);
 * // Or with tool prompt middleware:
 * const model = getModel(modelConfig, { useToolPrompt: true });
 * ```
 */
export function getModel(config: Model, options?: { useToolPrompt?: boolean }): LanguageModel {
  var result: LanguageModel;
  // Find providers
  switch (config.provider) {
    case "openrouter":
      result = createOpenRouter()(config.name);
      break;
    case "chutes":
      result = createOpenAICompatible({
        baseURL: "https://llm.chutes.ai/v1",
        name: "chutes",
        apiKey: process.env.CHUTES_API_KEY,
      }).chatModel(config.name);
      break;
    case "openai":
      result = createOpenAI()(config.name);
      break;
    case "google":
      result = createGoogleGenerativeAI()(config.name);
      break;
    case "anthropic":
      result = createAnthropic()(config.name);
      break;
    default:
      result = createOpenAICompatible({
        baseURL: process.env.OPENAI_COMPATIBLE_URL!,
        name: config.provider,
        apiKey: process.env.OPENAI_COMPATIBLE_API_KEY,
      }).chatModel(config.name);
      break;
  }
  // Wrap it for tool calling
  switch (config.options?.toolMiddleware) {
    case "gemma":
      result = wrapLanguageModel({
        model: result,
        middleware: gemmaToolMiddleware
      });
      break;
    case "prompt":
      result = wrapLanguageModel({
        model: result,
        middleware: toolRescueMiddleware({ prompt: true })
      });
      break;
    default:
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
export function buildProviderOptions(model: Model): ProviderMetadata {
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