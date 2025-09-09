/**
 * Configuration loader for the Vox Agents
 */

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
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
 * Vox Agents configuration structure
 */
export interface VoxAgentsConfig {
  agent: {
    name: string;
    version: string;
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
  llms: Record<string, Model>;
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
 * Load configuration from file and environment variables
 */
function loadConfig(): VoxAgentsConfig {
  dotenv.config();
  const configPath = path.join(process.cwd(), 'config.json');
  let fileConfig: Partial<VoxAgentsConfig> = {};

  // Load from config file if exists
  if (fs.existsSync(configPath)) {
    try {
      const configContent = fs.readFileSync(configPath, 'utf-8');
      fileConfig = JSON.parse(configContent);
      logger.info('Configuration loaded from config.json');
    } catch (error) {
      logger.error('Failed to load config.json:', error);
    }
  }

  // Parse transport type from environment
  const transportType = (process.env.MCP_TRANSPORT as TransportType) || 
    fileConfig.mcpServer?.transport?.type || 
    defaultConfig.mcpServer.transport.type;

  // Build final configuration with environment variable overrides
  const config: VoxAgentsConfig = {
    agent: {
      name: process.env.AGENT_NAME || fileConfig.agent?.name || defaultConfig.agent.name,
      version: process.env.AGENT_VERSION || fileConfig.agent?.version || defaultConfig.agent.version
    },
    mcpServer: {
      transport: {
        type: transportType,
        endpoint: process.env.MCP_ENDPOINT || 
          fileConfig.mcpServer?.transport?.endpoint || 
          defaultConfig.mcpServer.transport.endpoint,
        command: process.env.MCP_COMMAND || 
          fileConfig.mcpServer?.transport?.command ||
          defaultConfig.mcpServer.transport.command,
        args: process.env.MCP_ARGS?.split(' ') || 
          fileConfig.mcpServer?.transport?.args ||
          defaultConfig.mcpServer.transport.args
      }
    },
    logging: {
      level: process.env.LOG_LEVEL || fileConfig.logging?.level || defaultConfig.logging.level
    },
    llms: fileConfig.llms || defaultConfig.llms
  };

  // Update logger level based on configuration
  logger.level = config.logging.level;

  logger.info('Configuration loaded:', {
    agent: config.agent,
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