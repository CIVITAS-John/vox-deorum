/**
 * @module types/constants
 *
 * UI constants and configuration for Vox Agents frontend.
 * Contains provider lists and form field definitions.
 */

/**
 * Supported LLM providers for UI selection
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
 * API key field definitions for UI forms
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