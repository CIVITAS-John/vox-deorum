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

/**
 * Base configuration for all session types.
 * Contains common settings shared across different session implementations.
 */
export interface SessionConfig {
  /** Configuration name (typically derived from filename) */
  name: string;

  /** Session type - currently only 'strategist' is implemented */
  type: 'strategist';

  /** Whether to automatically continue playing when it's the AI's turn */
  autoPlay: boolean;

  /** How to start the game session */
  gameMode: 'start' | 'load' | 'wait';

  /** Number of games to play in sequence (optional) */
  repetition?: number;
}

/**
 * Player-specific configuration for LLM control
 */
export interface PlayerConfig {
  /** Strategist type to use for this player */
  strategist: string;
  /** Optional LLM model overrides per voxcontext (e.g., per agent name) */
  llms?: Record<string, Model | string>;
}

/**
 * Configuration specific to Strategist sessions.
 * Extends base config with player-specific LLM settings.
 */
export interface StrategistSessionConfig extends SessionConfig {
  /** Must be 'strategist' for this config type */
  type: 'strategist';

  /** Map of player IDs to their LLM configurations */
  llmPlayers: Record<number, PlayerConfig>;
}