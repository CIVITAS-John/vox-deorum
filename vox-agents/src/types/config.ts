/**
 * @module types/config
 *
 * Core configuration types for Vox Agents.
 * Contains transport, LLM, and main configuration structures.
 */

/**
 * Transport types supported by the MCP Client
 */
export type TransportType = 'stdio' | 'http';

/**
 * LLM model configuration for backend processing
 */
export interface LLMConfig {
  id?: string;
  provider: string;
  name: string;
  options?: Record<string, any>;
}

/**
 * Version information structure
 */
export interface VersionInfo {
  version: string;  // Full version string like "0.1.0 (b559c18)"
  major: number;
  minor: number;
  revision: number;
  commit?: string;  // Git commit hash
}

/**
 * Main Vox Agents configuration structure
 */
export interface VoxAgentsConfig {
  agent: {
    name: string;
  };
  versionInfo?: VersionInfo;
  webui: {
    port: number;
    enabled: boolean;
  };
  mcpServer: {
    transport: {
      type: TransportType;
      endpoint?: string;
      command?: string;
      args?: string[];
    };
  };
  logging: {
    level: string;
  };
  llms: Record<string, string | LLMConfig>;
}

/**
 * Type alias for backward compatibility
 */
export type Model = LLMConfig;

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
 * Represents a configuration file for Vox Agents
 */
export interface ConfigFile {
  /** Configuration filename */
  name: string;
  /** Configuration content as JSON object */
  content: Record<string, any>;
  /** ISO timestamp of last modification */
  lastModified?: string;
}