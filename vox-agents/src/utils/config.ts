/**
 * Configuration loader for the Vox Agents
 */

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { execSync } from 'child_process';
import { createLogger } from './logger.js';

const logger = createLogger('Config');

/**
 * Transport types supported by the MCP Client
 */
export type TransportType = 'stdio' | 'http';

/**
 * LLM model configuration
 */
export interface Model {
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
 * Vox Agents configuration structure
 */
export interface VoxAgentsConfig {
  agent: {
    name: string;
    version: string;
  };
  versionInfo?: VersionInfo;
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
  llms: Record<string, Model | string>;
}

/**
 * Default configuration values
 */
const defaultConfig: VoxAgentsConfig = {
  agent: {
    name: 'vox-agents',
    version: '1.0.0'
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
    default: {
      provider: 'openai',
      name: 'gpt-5-mini'
    }
  }
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
  const configPath = path.join(process.cwd(), filename);

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
 * Load version information from version.json and git
 */
function loadVersionInfo(): VersionInfo | undefined {
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
 * Load configuration from file and environment variables
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
      version: process.env.AGENT_VERSION || fileConfig.agent.version
    },
    versionInfo,
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
    llms: fileConfig.llms
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
 * Singleton configuration instance
 */
export const config = loadConfig();

export default config;