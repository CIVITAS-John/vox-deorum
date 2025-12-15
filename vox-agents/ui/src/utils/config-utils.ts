/**
 * Configuration utilities for parsing and building LLM configurations
 */

import type { AgentMapping, LLMConfig } from '../utils/types';

/**
 * Predefined agent types available in the system
 */
export const agentTypes = [
  { label: 'Default', value: 'default' },
  { label: 'Simple Briefer', value: 'simple-briefer' },
  { label: 'Simple Strategist', value: 'simple-strategist' },
  { label: 'Simple Strategist (Briefed)', value: 'simple-strategist-briefed' }
];

/**
 * Parse LLM configuration from config.llms into mappings and definitions
 *
 * @param llms - The llms configuration object from config.json
 * @returns Parsed agent mappings and model definitions
 */
export function parseLLMConfig(llms: Record<string, LLMConfig | string>): {
  mappings: AgentMapping[];
  definitions: LLMConfig[];
} {
  const mappings: AgentMapping[] = [];
  const definitions: Record<string, LLMConfig> = {};

  // Collect all model definitions (objects with provider and name)
  for (const [key, value] of Object.entries(llms)) {
    if (typeof value === 'object' && value.provider && value.name) {
      definitions[key] = {
        id: key,
        ...value
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
  definitions: LLMConfig[]
): Record<string, string | LLMConfig> {
  const llms: Record<string, string | LLMConfig> = {};

  // Add all model definitions first
  for (const def of definitions) {
    const modelConfig: LLMConfig = {
      id: def.id,
      provider: def.provider,
      name: def.name
    };
    // Only add options if they exist
    if (def.options) {
      modelConfig.options = def.options;
    }
    llms[def.id!] = modelConfig;
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
export function updateModelId(model: LLMConfig): void {
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
  definitions: LLMConfig[]
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