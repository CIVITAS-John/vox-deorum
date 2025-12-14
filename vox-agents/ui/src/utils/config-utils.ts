/**
 * Configuration utilities for parsing and building LLM configurations
 */

import type { AgentMapping, ModelDefinition, LLMConfig } from '../api/config-types';

/**
 * Parse LLM configuration from config.llms into mappings and definitions
 *
 * @param llms - The llms configuration object from config.json
 * @returns Parsed agent mappings and model definitions
 */
export function parseLLMConfig(llms: Record<string, any>): {
  mappings: AgentMapping[];
  definitions: ModelDefinition[];
} {
  const mappings: AgentMapping[] = [];
  const definitions: Record<string, ModelDefinition> = {}

  // Collect all model definitions (objects with provider and name)
  for (const [key, value] of Object.entries(llms)) {
    if (typeof value === 'object' && value.provider && value.name) {
      definitions[key] = {
        id: key,
        provider: value.provider,
        name: value.name
      };
    }
  }

  // Collect all mappings
  for (const [key, value] of Object.entries(llms)) {
    if (typeof value === 'string') {
      // It's a string alias/mapping
      mappings.push({
        agent: key,
        model: value
      });
    }
  }

  return { mappings, definitions: Object.values(definitions) };
}

/**
 * Build LLM configuration object from mappings and definitions
 *
 * @param mappings - Agent-to-model mappings
 * @param definitions - Model definitions
 * @returns Configuration object suitable for config.llms
 */
export function buildLLMConfig(
  mappings: AgentMapping[],
  definitions: ModelDefinition[]
): Record<string, string | LLMConfig> {
  const llms: Record<string, string | LLMConfig> = {};

  // Add all model definitions first
  for (const def of definitions) {
    llms[def.id] = {
      provider: def.provider,
      name: def.name
    };
  }

  // Add all mappings (these will overwrite if the key already exists)
  for (const mapping of mappings) {
    if (mapping.agent && mapping.model) {
      llms[mapping.agent] = mapping.model;
    }
  }

  return llms;
}

/**
 * Update model ID based on provider and name
 *
 * @param model - Model definition to update
 */
export function updateModelId(model: ModelDefinition): void {
  if (model.provider && model.name) {
    model.id = `${model.provider}/${model.name}`;
  } else {
    model.id = '';
  }
}

/**
 * Check which agents are using a specific model
 *
 * @param modelId - Model ID to check
 * @param mappings - Current agent mappings
 * @returns List of agent names using the model
 */
export function getAgentsUsingModel(
  modelId: string,
  mappings: AgentMapping[]
): string[] {
  return mappings
    .filter(m => m.model === modelId)
    .map(m => m.agent);
}

/**
 * Validate that all mappings reference existing models
 *
 * @param mappings - Agent mappings to validate
 * @param definitions - Available model definitions
 * @returns Validation result with any errors
 */
export function validateMappings(
  mappings: AgentMapping[],
  definitions: ModelDefinition[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const availableModels = new Set(definitions.map(d => d.id));

  for (const mapping of mappings) {
    if (!mapping.agent) {
      errors.push('Agent name is required for all mappings');
    }
    if (!mapping.model) {
      errors.push(`Model is required for agent "${mapping.agent}"`);
    } else if (!availableModels.has(mapping.model)) {
      errors.push(`Model "${mapping.model}" used by agent "${mapping.agent}" does not exist`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}