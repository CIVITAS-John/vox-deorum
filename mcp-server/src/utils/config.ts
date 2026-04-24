/**
 * Configuration loader for the MCP Server
 */

import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { createLogger } from './logger.js';

const execAsync = promisify(exec);

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
    eventPipe?: {
      enabled: boolean;
      name: string;
    };
  };
  database?: {
    language?: string;
    documentsPath?: string;
    civ5UserDataPath?: string;
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
    port: 4000,
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
      host: '127.0.0.1',
      port: 5000
    },
    eventPipe: {
      enabled: false,
      name: 'vox-deorum-events'
    }
  },
  database: {
    language: 'en_US',
    documentsPath: undefined, // Will be auto-detected if not specified
    civ5UserDataPath: undefined
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
  const eventPipeEnabledOverride = process.env.EVENTPIPE_ENABLED === undefined
    ? undefined
    : process.env.EVENTPIPE_ENABLED === 'true';
  const eventPipeEnabled = eventPipeEnabledOverride ?? fileConfig.bridgeService?.eventPipe?.enabled ?? defaultConfig.bridgeService.eventPipe?.enabled ?? false;
  const eventPipeName = process.env.EVENTPIPE_NAME || fileConfig.bridgeService?.eventPipe?.name || defaultConfig.bridgeService.eventPipe?.name || 'vox-deorum-events';
  const rawEventPipeEnabled = eventPipeEnabled;
  const platformEventPipeEnabled = rawEventPipeEnabled && process.platform === 'win32';

  if (rawEventPipeEnabled && !platformEventPipeEnabled) {
    logger.warn('Event pipe disabled: Windows named pipes are only supported on win32. SSE remains available.');
  }

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
      },
      eventPipe: {
        enabled: platformEventPipeEnabled,
        name: eventPipeName
      }
    },
    database: {
      language: process.env.DB_LANGUAGE || fileConfig.database?.language || defaultConfig.database?.language,
      documentsPath: process.env.DB_DOCUMENTS_PATH || fileConfig.database?.documentsPath || defaultConfig.database?.documentsPath,
      civ5UserDataPath: process.env.CIV5_USER_DATA_PATH || fileConfig.database?.civ5UserDataPath || defaultConfig.database?.civ5UserDataPath
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
 * Get the Documents folder path (configurable or auto-detected)
 * This function caches the result after first call
 */
let cachedDocumentsPath: string | undefined;
let cachedCiv5UserDataPath: string | undefined;

export async function getDocumentsPath(): Promise<string> {
  // Return cached value if available
  if (cachedDocumentsPath) {
    return cachedDocumentsPath;
  }

  // First check if a custom path is configured
  if (config.database?.documentsPath) {
    cachedDocumentsPath = config.database.documentsPath;
    logger.info(`Using configured documents path: ${cachedDocumentsPath}`);
    return cachedDocumentsPath;
  }

  if (process.platform !== 'win32') {
    cachedDocumentsPath = path.join(process.env.HOME || process.env.USERPROFILE || '.', 'Documents');
    logger.info(`Using standard documents folder path: ${cachedDocumentsPath}`);
    return cachedDocumentsPath;
  }

  // Fall back to auto-detection using PowerShell on Windows
  try {
    const { stdout } = await execAsync(
      'powershell -Command "[Environment]::GetFolderPath(\'MyDocuments\')"'
    );
    cachedDocumentsPath = stdout.trim();
    logger.info(`Auto-detected documents folder path: ${cachedDocumentsPath}`);
    return cachedDocumentsPath;
  } catch (error) {
    logger.error('Failed to get Documents folder path:', error);
    // Fall back to a reasonable default
    cachedDocumentsPath = path.join(process.env.USERPROFILE || process.env.HOME || '.', 'Documents');
    logger.warn(`Using fallback documents path: ${cachedDocumentsPath}`);
    return cachedDocumentsPath;
  }
}

export function getCiv5UserDataPathCandidates(platform: NodeJS.Platform, homeDir: string, documentsPath: string): string[] {
  if (platform === 'darwin') {
    return [
      path.join(homeDir, 'Library', 'Application Support', 'Sid Meier\'s Civilization 5'),
      path.join(homeDir, 'Documents', 'Aspyr', 'Sid Meier\'s Civilization 5'),
      path.join(homeDir, 'Library', 'Containers', 'com.aspyr.civ5campaign', 'Data', 'Library', 'Application Support', 'Civilization V Campaign Edition')
    ];
  }

  if (platform === 'linux') {
    return [
      path.join(homeDir, '.local', 'share', 'Aspyr', 'Sid Meier\'s Civilization 5'),
      path.join(homeDir, '.local', 'share', 'aspyr-media', 'Sid Meier\'s Civilization 5'),
      path.join(documentsPath, 'My Games', 'Sid Meier\'s Civilization 5')
    ];
  }

  return [
    path.join(documentsPath, 'My Games', 'Sid Meier\'s Civilization 5')
  ];
}

export async function getCiv5UserDataPath(): Promise<string> {
  if (cachedCiv5UserDataPath) {
    return cachedCiv5UserDataPath;
  }

  if (config.database?.civ5UserDataPath) {
    cachedCiv5UserDataPath = config.database.civ5UserDataPath;
    logger.info(`Using configured Civ5 user data path: ${cachedCiv5UserDataPath}`);
    return cachedCiv5UserDataPath;
  }

  const documentsPath = await getDocumentsPath();
  const homeDir = process.env.HOME || process.env.USERPROFILE || documentsPath;
  const candidates = getCiv5UserDataPathCandidates(process.platform, homeDir, documentsPath);
  const existingCandidate = candidates.find(candidate => fs.existsSync(candidate));

  cachedCiv5UserDataPath = existingCandidate ?? candidates[0];

  if (existingCandidate) {
    logger.info(`Auto-detected Civ5 user data path: ${cachedCiv5UserDataPath}`);
  } else {
    logger.warn(`Using fallback Civ5 user data path: ${cachedCiv5UserDataPath}`);
  }

  return cachedCiv5UserDataPath;
}

/**
 * Singleton configuration instance
 */
export const config = loadConfig();

export default config;
