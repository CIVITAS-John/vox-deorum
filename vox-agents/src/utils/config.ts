/**
 * Configuration loader for the Vox Agents
 */

import fs from 'fs';
import path from 'path';
import { createLogger } from './logger.js';

const logger = createLogger('Config');

/**
 * Transport types supported by the MCP Client
 */
export type TransportType = 'stdio' | 'http';

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
      port?: number;
      host?: string;
      command?: string;
      args?: string[];
    };
  };
  logging: {
    level: string;
  };
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
      port: 3000,
      host: '127.0.0.1'
    }
  },
  logging: {
    level: 'info'
  }
};

/**
 * Load configuration from file and environment variables
 */
export function loadConfig(): VoxAgentsConfig {
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
        port: parseInt(process.env.MCP_PORT || '') || 
          fileConfig.mcpServer?.transport?.port || 
          defaultConfig.mcpServer.transport.port,
        host: process.env.MCP_HOST || 
          fileConfig.mcpServer?.transport?.host || 
          defaultConfig.mcpServer.transport.host,
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
    }
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