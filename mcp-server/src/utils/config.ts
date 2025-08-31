/**
 * Configuration loader for the MCP Server
 */

import fs from 'fs';
import path from 'path';
import { createLogger } from './logger.js';

const logger = createLogger('Config');

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
    port?: number;
    host?: string;
    cors?: {
      origin?: string | string[] | boolean;
      methods?: string[];
      allowedHeaders?: string[];
      credentials?: boolean;
    };
  };
  bridge?: {
    url: string;
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
    type: 'http',
    port: 3000,
    host: '127.0.0.1',
    cors: {
      origin: true,
      credentials: true,
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization']
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
  let corsOrigin: string | string[] | boolean = defaultConfig.transport.cors?.origin || true;
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
  const bridgeHost = process.env.BRIDGE_SERVICE_HOST || fileConfig.bridgeService?.endpoint?.host || defaultConfig.bridgeService.endpoint.host;
  const bridgePort = parseInt(process.env.BRIDGE_SERVICE_PORT || '') || fileConfig.bridgeService?.endpoint?.port || defaultConfig.bridgeService.endpoint.port;
  
  const config: MCPServerConfig = {
    server: {
      name: process.env.MCP_SERVER_NAME || fileConfig.server?.name || defaultConfig.server.name,
      version: process.env.MCP_SERVER_VERSION || fileConfig.server?.version || defaultConfig.server.version
    },
    transport: {
      type: transportType,
      port: parseInt(process.env.MCP_PORT || '') || 
        fileConfig.transport?.port || 
        defaultConfig.transport.port,
      host: process.env.MCP_HOST || 
        fileConfig.transport?.host || 
        defaultConfig.transport.host,
      cors: {
        origin: corsOrigin,
        credentials: process.env.MCP_CORS_CREDENTIALS === 'false' ? false :
          fileConfig.transport?.cors?.credentials ?? 
          defaultConfig.transport.cors?.credentials,
        methods: fileConfig.transport?.cors?.methods || defaultConfig.transport.cors?.methods,
        allowedHeaders: fileConfig.transport?.cors?.allowedHeaders || defaultConfig.transport.cors?.allowedHeaders
      }
    },
    bridge: {
      url: process.env.BRIDGE_SERVICE_URL || fileConfig.bridge?.url || `http://${bridgeHost}:${bridgePort}`
    },
    bridgeService: {
      endpoint: {
        host: bridgeHost,
        port: bridgePort
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