/**
 * @module utils/config
 *
 * Configuration loader for Vox Agents.
 * Handles loading configuration from JSON files and environment variables,
 * with support for version information from git and version.json.
 */

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { execSync } from 'child_process';
import { createLogger } from './logger.js';
import type { VoxAgentsConfig, TransportType, VersionInfo } from '../types/index.js';

const logger = createLogger('Config');

/**
 * Default configuration values
 */
export const defaultConfig: VoxAgentsConfig = {
  agent: {
    name: 'vox-agents'
  },
  webui: {
    port: 5555,
    enabled: true
  },
  mcpServer: {
    transport: {
      type: 'http',
      endpoint: 'http://127.0.0.1:4000/mcp'
    }
  },
  logging: {
    level: 'info'
  },
  llms: {
    default: 'openai-compatible/gpt-oss-120b',
    'openai/gpt-5-mini': {
      provider: 'openai',
      name: 'gpt-5-mini'
    },
    'openai/gpt-5-nano': {
      provider: 'openai',
      name: 'gpt-5-nano'
    },
    'openrouter/openai/gpt-oss-120b': {
      provider: 'openrouter',
      name: 'openai/gpt-oss-120b',
      options: {
        toolMiddleware: 'prompt'
      }
    },
    'openrouter/google/gemma3-27b': {
      provider: 'openrouter',
      name: 'google/gemma-3-27b-it',
      options: {
        toolMiddleware: 'gemma'
      }
    },
    'openrouter/google/gemini-2.5-flash-lite': {
      provider: 'openrouter',
      name: 'google/gemini-2.5-flash-lite',
      options: {
        toolMiddleware: 'prompt'
      }
    },
    'anthropic/claude-haiku-4-5': {
      provider: 'anthropic',
      name: 'claude-haiku-4-5'
    },
    'anthropic/claude-sonnet-4-6': {
      provider: 'anthropic',
      name: 'claude-sonnet-4-6'
    },
    'anthropic/claude-opus-4-6': {
      provider: 'anthropic',
      name: 'claude-opus-4-6'
    },
    'aws/anthropic/claude-sonnet-4-5': {
      provider: 'aws',
      name: 'arn:aws:bedrock:us-east-2:147032477449:inference-profile/global.anthropic.claude-sonnet-4-5-20250929-v1:0'
    },
    'chutes/zai-org/glm-4.7': {
      provider: 'chutes',
      name: 'zai-org/GLM-4.7-TEE',
      options: {
        toolMiddleware: 'prompt'
      }
    },
    'chutes/deepseek-ai/DeepSeek-V3.2': {
      provider: 'chutes',
      name: 'deepseek-ai/DeepSeek-V3.2-TEE',
      options: {
        toolMiddleware: 'prompt'
      }
    },
    'synthetic/hf:zai-org/GLM-4.7': {
      provider: 'synthetic',
      name: 'hf:zai-org/GLM-4.7',
      options: {
        toolMiddleware: 'prompt'
      }
    },
    'synthetic/hf:deepseek-ai/DeepSeek-V3.2': {
      provider: 'synthetic',
      name: 'hf:deepseek-ai/DeepSeek-V3.2',
      options: {
        toolMiddleware: 'prompt'
      }
    },
    'synthetic/hf:moonshotai/Kimi-K2.5': {
      provider: 'synthetic',
      name: 'hf:moonshotai/Kimi-K2.5',
      options: {
        toolMiddleware: 'prompt'
      }
    },
    'synthetic/hf:MiniMaxAI/MiniMax-M2.5': {
      provider: 'synthetic',
      name: 'hf:MiniMaxAI/MiniMax-M2.5',
      options: {
        toolMiddleware: 'prompt'
      }
    },
    'openai-compatible/gpt-oss-20b': {
      provider: 'openai-compatible',
      name: 'gpt-oss-120b',
      options: {
        toolMiddleware: 'prompt'
      }
    },
    'openai-compatible/gpt-oss-120b': {
      provider: 'openai-compatible',
      name: 'gpt-oss-120b',
      options: {
        toolMiddleware: 'prompt'
      }
    },
    'openai-compatible/gpt-oss-120b-high': {
      provider: 'openai-compatible',
      name: 'gpt-oss-120b',
      options: {
        toolMiddleware: 'prompt',
        reasoningEffort: 'high'
      }
    },
    'openai-compatible/GLM-4.7': {
      provider: 'openai-compatible',
      name: 'GLM-4.7',
      options: {
        toolMiddleware: 'prompt'
      }
    },
    'openai-compatible/GLM-5': {
      provider: 'openai-compatible',
      name: 'GLM-5',
      options: {
        toolMiddleware: 'prompt'
      }
    },
    'openai-compatible/Qwen-3.5': {
      provider: 'openai-compatible',
      name: 'Qwen-3.5',
      options: {
        systemPromptFirst: true,
        toolMiddleware: 'prompt'
      }
    },
    'openai-compatible/DeepSeek-V3.2': {
      provider: 'openai-compatible',
      name: 'DeepSeek-V3.2',
      options: {
        toolMiddleware: 'prompt'
      }
    },
    'openai-compatible/Kimi-K2-Thinking': {
      provider: 'openai-compatible',
      name: 'Kimi-K2-Thinking',
      options: {
        toolMiddleware: 'prompt'
      }
    },
    'openai-compatible/Kimi-K2.5': {
      provider: 'openai-compatible',
      name: 'Kimi-K2.5',
      options: {
        toolMiddleware: 'prompt'
      }
    },
    'openai-compatible/Minimax-M2.5': {
      provider: 'openai-compatible',
      name: 'Minimax-M2.5',
      options: {
        toolMiddleware: 'prompt',
        thinkMiddleware: 'think'
      }
    },
  },
  configsDir: 'configs'
};

/**
 * Load configuration from a JSON file with fallback to defaults
 * @param filename - Name of the config file to load
 * @param defaultConfig - Default configuration object
 * @param overrides - Optional overrides to apply after loading
 * @returns Merged configuration object
 */
export function loadConfigFromFile<T extends object>(
  filename: string,
  defaultConfig: T,
  overrides?: Partial<T>
): T {
  const configPath = path.isAbsolute(filename)
    ? filename
    : path.join(process.cwd(), filename);

  let fileConfig: Partial<T> = {};

  if (fs.existsSync(configPath)) {
    try {
      const fileContent = fs.readFileSync(configPath, 'utf-8');
      fileConfig = JSON.parse(fileContent) as Partial<T>;
      logger.info(`Loaded configuration from ${filename}`);
    } catch (error) {
      logger.warn(`Failed to load ${filename}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      logger.info('Using default configuration');
    }
  } else {
    logger.info(`No ${filename} found, using default configuration`);
  }

  // Merge in order: defaults -> file config -> overrides
  return { ...defaultConfig, ...fileConfig, ...(overrides || {}) };
}

/**
 * Load version information from version.json and git.
 * Combines major.minor.revision from version.json with git commit hash.
 *
 * @returns Version information object or undefined if loading fails
 */
export function loadVersionInfo(): VersionInfo | undefined {
  try {
    // Load version.json from project root
    const versionPath = path.join(process.cwd(), '..', 'version.json');
    if (!fs.existsSync(versionPath)) {
      logger.warn('version.json not found');
      return undefined;
    }

    const versionData = JSON.parse(fs.readFileSync(versionPath, 'utf-8'));
    const { major = 0, minor = 0, revision = 0 } = versionData;

    // Try to get git commit hash
    let commit: string | undefined;
    try {
      commit = execSync('git rev-parse --short HEAD', {
        encoding: 'utf-8',
        cwd: path.join(process.cwd(), '..')
      }).trim();
    } catch (error) {
      logger.debug('Failed to get git commit hash:', error);
    }

    // Build version string
    const versionString = commit
      ? `${major}.${minor}.${revision} (${commit})`
      : `${major}.${minor}.${revision}`;

    return {
      version: versionString,
      major,
      minor,
      revision,
      commit
    };
  } catch (error) {
    logger.warn('Failed to load version info:', error instanceof Error ? error.message : 'Unknown error');
    return undefined;
  }
}

/**
 * Load configuration from file and environment variables.
 * Environment variables override file configuration values.
 * Supports both file-based and environment-based transport configuration.
 *
 * @returns Complete configuration object with all settings merged
 */
function loadConfig(): VoxAgentsConfig {
  dotenv.config();

  // Load base config from file
  const fileConfig = loadConfigFromFile('config.json', defaultConfig);

  // Parse transport type from environment
  const transportType = (process.env.MCP_TRANSPORT as TransportType) ||
    fileConfig.mcpServer.transport.type;

  // Load version info
  const versionInfo = loadVersionInfo();

  // Build final configuration with environment variable overrides
  const config: VoxAgentsConfig = {
    agent: {
      name: process.env.AGENT_NAME || fileConfig.agent.name,
    },
    versionInfo,
    webui: {
      port: process.env.WEBUI_PORT ? parseInt(process.env.WEBUI_PORT) : fileConfig.webui.port,
      enabled: process.env.WEBUI_ENABLED ? process.env.WEBUI_ENABLED === 'true' : fileConfig.webui.enabled
    },
    mcpServer: {
      transport: {
        type: transportType,
        endpoint: process.env.MCP_ENDPOINT || fileConfig.mcpServer.transport.endpoint,
        command: process.env.MCP_COMMAND || fileConfig.mcpServer.transport.command,
        args: process.env.MCP_ARGS?.split(' ') || fileConfig.mcpServer.transport.args
      }
    },
    logging: {
      level: process.env.LOG_LEVEL || fileConfig.logging.level
    },
    llms: fileConfig.llms,
    configsDir: process.env.CONFIGS_DIR || fileConfig.configsDir
  };

  // Update logger level based on configuration
  logger.level = config.logging.level;

  logger.info('Configuration loaded:', {
    agent: config.agent,
    version: versionInfo?.version || 'unknown',
    mcpServer: config.mcpServer,
    logging: { level: config.logging.level }
  });

  return config;
}

/**
 * Singleton configuration instance.
 * Loaded once at module initialization and reused throughout the application.
 *
 * @example
 * ```typescript
 * import { config } from './utils/config.js';
 * console.log(config.agent.name); // 'vox-agents'
 * ```
 */
export let config = loadConfig();

/**
 * Refresh the configuration by reloading from config.json and environment variables.
 * Updates the singleton instance with fresh values by mutating the existing object
 * to preserve references held by other modules.
 *
 * @returns The refreshed configuration object
 */
export function refreshConfig(): VoxAgentsConfig {
  logger.info('Refreshing configuration...');
  const newConfig = loadConfig();

  // Clear existing properties (except those we're about to replace)
  for (const key in config) {
    if (config.hasOwnProperty(key)) {
      delete (config as any)[key];
    }
  }

  // Copy all properties from new config to existing config object
  // This preserves the object reference while updating its contents
  Object.assign(config, newConfig);

  return config;
}

/**
 * Get the absolute path to the configs directory.
 * Uses the CONFIGS_DIR environment variable if set, otherwise defaults to 'configs'.
 * Supports both relative paths (resolved from cwd) and absolute paths.
 *
 * @returns Absolute path to the configs directory
 *
 * @example
 * ```typescript
 * import { getConfigsDir } from './utils/config.js';
 * const configPath = path.join(getConfigsDir(), 'play-simple.json');
 * ```
 */
export function getConfigsDir(): string {
  return path.isAbsolute(config.configsDir)
    ? config.configsDir
    : path.join(process.cwd(), config.configsDir);
}

export default config;