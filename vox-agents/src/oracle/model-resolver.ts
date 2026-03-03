/**
 * @module oracle/model-resolver
 *
 * Resolves model configurations from telemetry strings.
 * Parses the telemetry model format ({provider}/{name}@{reasoningEffort})
 * and looks up full configurations from config.llms.
 */

import { config } from '../utils/config.js';
import { getModelConfig } from '../utils/models/models.js';
import { createLogger } from '../utils/logger.js';
import type { Model } from '../types/index.js';

const logger = createLogger('OracleModelResolver');

/**
 * Parse a telemetry model string into provider/name and optional reasoning effort.
 *
 * Telemetry stores model as: `{provider}/{name}@{reasoningEffort}`
 * e.g. `openai-compatible/Kimi-K2.5@Medium`, `anthropic/claude-sonnet-4-6@`
 *
 * @param modelString - The model string from span attributes
 * @returns Parsed components
 */
export function parseModelString(modelString: string): {
  fullKey: string;
  provider: string;
  name: string;
  reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high';
} {
  // Split off reasoning effort suffix
  const atIndex = modelString.lastIndexOf('@');
  let baseString: string;
  let reasoningEffort: string | undefined;

  if (atIndex !== -1) {
    baseString = modelString.substring(0, atIndex);
    reasoningEffort = modelString.substring(atIndex + 1).toLowerCase() || undefined;
  } else {
    baseString = modelString;
  }

  // Split provider/name
  const slashIndex = baseString.indexOf('/');
  const provider = slashIndex !== -1 ? baseString.substring(0, slashIndex) : baseString;
  const name = slashIndex !== -1 ? baseString.substring(slashIndex + 1) : baseString;

  // Validate reasoning effort
  const validEfforts = ['minimal', 'low', 'medium', 'high'];
  const normalizedEffort = reasoningEffort && validEfforts.includes(reasoningEffort)
    ? reasoningEffort as 'minimal' | 'low' | 'medium' | 'high'
    : undefined;

  return {
    fullKey: baseString,
    provider,
    name,
    reasoningEffort: normalizedEffort,
  };
}

/**
 * Resolve a telemetry model string into a full Model configuration.
 * Looks up the model in config.llms by its full key (provider/name),
 * then applies reasoning effort if present.
 *
 * @param modelString - The model string from span attributes
 * @returns Resolved Model configuration
 */
export function resolveModelFromTelemetry(modelString: string): Model {
  const parsed = parseModelString(modelString);

  // Try direct lookup in config.llms
  const llmEntry = config.llms[parsed.fullKey];

  if (llmEntry) {
    if (typeof llmEntry === 'string') {
      // It's an alias -- resolve through getModelConfig
      return getModelConfig(llmEntry, parsed.reasoningEffort);
    }

    // Apply reasoning effort if present
    if (parsed.reasoningEffort) {
      return {
        ...llmEntry,
        options: { ...llmEntry.options, reasoningEffort: parsed.reasoningEffort },
      };
    }
    return llmEntry;
  }

  // Not found in config -- construct from parsed components
  logger.warn(`Model "${parsed.fullKey}" not found in config.llms, constructing from telemetry string`);
  return {
    provider: parsed.provider,
    name: parsed.name,
    options: parsed.reasoningEffort ? { reasoningEffort: parsed.reasoningEffort } : undefined,
  };
}

/**
 * Resolve a model override value into a Model configuration.
 * Accepts either a string (looked up in config.llms) or a Model object directly.
 *
 * @param override - String model key or Model object
 * @returns Resolved Model configuration
 */
export function resolveModelOverride(override: string | Model): Model {
  if (typeof override === 'string') {
    // Could be a telemetry-style string or a config.llms key
    const llmEntry = config.llms[override];
    if (llmEntry) {
      return typeof llmEntry === 'string' ? getModelConfig(llmEntry) : llmEntry;
    }
    // Try parsing as telemetry string
    return resolveModelFromTelemetry(override);
  }
  return override;
}
