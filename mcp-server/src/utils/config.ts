/**
 * Configuration loader for the MCP Server
 */

import fs from 'fs';
import path from 'path';
import { logger } from './logger.js';

/**
 * Transport types supported by the MCP Server
 */
export type TransportType = 'stdio' | 'http';

/**
 * MCP Server configuration structure
 */
export interface MCPServerConfig {
  server: {
    name: string;
    version: string;
  };
  transport: {
    type: TransportType;
    http?: {
      port: number;
      host: string;
      cors: {
        origin: string | string[] | boolean;
        credentials: boolean;
      };
    };
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
  transport: {
    type: 'stdio',
    http: {
      port: 3000,
      host: '0.0.0.0',
      cors: {
        origin: true,
        credentials: true
      }
    }
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

  // Parse transport type from environment
  const transportType = (process.env.MCP_TRANSPORT as TransportType) || 
    fileConfig.transport?.type || 
    defaultConfig.transport.type;

  // Parse CORS origin from environment
  let corsOrigin: string | string[] | boolean = defaultConfig.transport.http!.cors.origin;
  if (process.env.MCP_CORS_ORIGIN) {
    if (process.env.MCP_CORS_ORIGIN === 'true') {
      corsOrigin = true;
    } else if (process.env.MCP_CORS_ORIGIN === 'false') {
      corsOrigin = false;
    } else if (process.env.MCP_CORS_ORIGIN.includes(',')) {
      corsOrigin = process.env.MCP_CORS_ORIGIN.split(',').map(s => s.trim());
    } else {
      corsOrigin = process.env.MCP_CORS_ORIGIN;
    }
  }

  // Build final configuration with environment variable overrides
  const config: MCPServerConfig = {
    server: {
      name: process.env.MCP_SERVER_NAME || fileConfig.server?.name || defaultConfig.server.name,
      version: process.env.MCP_SERVER_VERSION || fileConfig.server?.version || defaultConfig.server.version
    },
    transport: {
      type: transportType,
      http: {
        port: parseInt(process.env.MCP_PORT || '') || 
          fileConfig.transport?.http?.port || 
          defaultConfig.transport.http!.port,
        host: process.env.MCP_HOST || 
          fileConfig.transport?.http?.host || 
          defaultConfig.transport.http!.host,
        cors: {
          origin: corsOrigin,
          credentials: process.env.MCP_CORS_CREDENTIALS === 'false' ? false :
            fileConfig.transport?.http?.cors?.credentials ?? 
            defaultConfig.transport.http!.cors.credentials
        }
      }
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
    transport: config.transport,
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