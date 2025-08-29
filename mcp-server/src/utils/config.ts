/**
 * Configuration loader for the MCP Server
 */

import fs from 'fs';
import path from 'path';
import { logger } from './logger.js';

/**
 * MCP Server configuration structure
 */
export interface MCPServerConfig {
  server: {
    name: string;
    version: string;
  };
  bridgeService: {
    endpoint: {
      host: string;
      port: number;
    };
  };
  logging: {
    level: string;
  };
}

/**
 * Default configuration values
 */
const defaultConfig: MCPServerConfig = {
  server: {
    name: 'vox-deorum-mcp-server',
    version: '1.0.0'
  },
  bridgeService: {
    endpoint: {
      host: 'localhost',
      port: 8080
    }
  },
  logging: {
    level: 'info'
  }
};

/**
 * Load configuration from file and environment variables
 */
export function loadConfig(): MCPServerConfig {
  const configPath = path.join(process.cwd(), 'config.json');
  let fileConfig: Partial<MCPServerConfig> = {};

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

  // Build final configuration with environment variable overrides
  const config: MCPServerConfig = {
    server: {
      name: process.env.MCP_SERVER_NAME || fileConfig.server?.name || defaultConfig.server.name,
      version: process.env.MCP_SERVER_VERSION || fileConfig.server?.version || defaultConfig.server.version
    },
    bridgeService: {
      endpoint: {
        host: process.env.BRIDGE_SERVICE_HOST || fileConfig.bridgeService?.endpoint?.host || defaultConfig.bridgeService.endpoint.host,
        port: parseInt(process.env.BRIDGE_SERVICE_PORT || '') || fileConfig.bridgeService?.endpoint?.port || defaultConfig.bridgeService.endpoint.port
      }
    },
    logging: {
      level: process.env.LOG_LEVEL || fileConfig.logging?.level || defaultConfig.logging.level
    }
  };

  // Update logger level based on configuration
  logger.level = config.logging.level;

  logger.info('Configuration loaded:', {
    server: config.server,
    bridgeService: config.bridgeService,
    logging: { level: config.logging.level }
  });

  return config;
}

/**
 * Singleton configuration instance
 */
export const config = loadConfig();

export default config;