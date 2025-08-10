/**
 * Configuration loader for the Bridge Service
 */

import fs from 'fs';
import path from 'path';
import { logger } from './logger';

/**
 * Service configuration structure
 */
export interface ServiceConfig {
  rest: {
    port: number;
    host: string;
  };
  winsock: {
    id: string;
    retry: number;
  };
  logging: {
    level: string;
  };
}

/**
 * Default configuration values
 */
const defaultConfig: ServiceConfig = {
  rest: {
    port: 8080,
    host: 'localhost'
  },
  winsock: {
    id: 'civ5',
    retry: 5000
  },
  logging: {
    level: 'info'
  }
};

/**
 * Load configuration from file and environment variables
 */
export function loadConfig(): ServiceConfig {
  const configPath = path.join(process.cwd(), 'config.json');
  let fileConfig: Partial<ServiceConfig> = {};

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
  const config: ServiceConfig = {
    rest: {
      port: parseInt(process.env.PORT || '') || fileConfig.rest?.port || defaultConfig.rest.port,
      host: process.env.HOST || fileConfig.rest?.host || defaultConfig.rest.host
    },
    winsock: {
      id: process.env.WINSOCK_ID || fileConfig.winsock?.id || defaultConfig.winsock.id,
      retry: parseInt(process.env.WINSOCK_RETRY || '') || fileConfig.winsock?.retry || defaultConfig.winsock.retry
    },
    logging: {
      level: process.env.LOG_LEVEL || fileConfig.logging?.level || defaultConfig.logging.level
    }
  };

  // Update logger level based on configuration
  logger.level = config.logging.level;

  logger.info('Configuration loaded:', {
    rest: config.rest,
    winsock: { id: config.winsock.id, retry: config.winsock.retry },
    logging: { level: config.logging.level }
  });

  return config;
}

/**
 * Singleton configuration instance
 */
export const config = loadConfig();

export default config;