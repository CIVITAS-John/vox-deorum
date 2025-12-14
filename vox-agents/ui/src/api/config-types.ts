/**
 * Configuration types for Vox Agents
 * Defines structures for API keys, LLM models, and agent configurations
 */

/**
 * Agent-to-model mapping
 * Maps an agent name to a model identifier
 */
export interface AgentMapping {
  /** Name of the agent (e.g., 'default', 'briefer', 'strategist') */
  agent: string;
  /** Model identifier to use for this agent (e.g., 'openai/gpt-4') */
  model: string;
}

/**
 * Model definition with provider details
 * Defines a language model configuration
 */
export interface ModelDefinition {
  /** Auto-generated ID in format: {provider}/{name} */
  id: string;
  /** LLM provider (openrouter, openai, google, jetstream2, chutes) */
  provider: string;
  /** Model name specific to the provider */
  name: string;
}

/**
 * LLM configuration object structure
 * Used internally by the backend
 */
export interface LLMConfig {
  /** Provider for the model */
  provider: string;
  /** Model name */
  name: string;
  /** Optional settings (not exposed in UI currently) */
  options?: Record<string, any>;
}

/**
 * Main Vox Agents configuration structure
 */
export interface VoxAgentsConfig {
  /** Agent configuration */
  agent: {
    name: string;
  };
  /** Version information */
  versionInfo?: {
    version: string;
    major: number;
    minor: number;
    revision: number;
    commit?: string;
  };
  /** Web UI configuration */
  webui?: {
    port: number;
    enabled: boolean;
  };
  /** MCP Server configuration */
  mcpServer?: {
    transport: {
      type: string;
      endpoint?: string;
    };
  };
  /** Logging configuration */
  logging: {
    level: string;
  };
  /** LLM configurations - mix of string aliases and model definitions */
  llms: Record<string, string | LLMConfig>;
}

/**
 * API response for configuration endpoint
 */
export interface ConfigResponse {
  /** Main configuration from config.json */
  config: VoxAgentsConfig;
  /** API keys from .env file */
  apiKeys: Record<string, string>;
}

/**
 * Supported LLM providers
 */
export const llmProviders = [
  { label: 'OpenRouter', value: 'openrouter' },
  { label: 'Anthropic', value: 'anthropic' },
  { label: 'OpenAI', value: 'openai' },
  { label: 'Google AI', value: 'google' },
  { label: 'OpenAI Compatible', value: 'openai-compatible' },
  { label: 'Chutes', value: 'chutes' }
];

/**
 * API key field definitions
 */
export const apiKeyFields = [
  { key: 'OPENAI_API_KEY', label: 'OpenAI API Key', type: 'password' },
  { key: 'ANTHROPIC_API_KEY', label: 'Anthropic API Key', type: 'password' },
  { key: 'GOOGLE_GENERATIVE_AI_API_KEY', label: 'Google Generative AI API Key', type: 'password' },
  { key: 'CHUTES_API_KEY', label: 'Chutes API Key', type: 'password' },
  { key: 'OPENROUTER_API_KEY', label: 'OpenRouter API Key', type: 'password' },
  { key: 'OPENAI_COMPATIBLE_URL', label: 'OpenAI Compatible URL (e.g. llama.cpp, ollama)', type: 'text', placeholder: 'http://127.0.0.1:11434' },
  { key: 'OPENAI_COMPATIBLE_API_KEY', label: 'OpenAI Compatible API Key', type: 'password' }
];