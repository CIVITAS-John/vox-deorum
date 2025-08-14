/**
 * Configuration loader for the Bridge Service
 */

import fs from 'fs';
import path from 'path';
import { createLogger } from './logger.js';

/**
 * Service configuration structure
 */
export interface ServiceConfig {
  rest: {
    port: number;
    host: string;
  };
  namedpipe: {
    id: string;
    retry: number;
  };
  logging: {
    level: string;
  };
}

const logger = createLogger('Config');

/**
 * Default configuration values
 */
const defaultConfig: ServiceConfig = {
  rest: {
    port: 8080,
    host: 'localhost'
  },
  namedpipe: {
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
    namedpipe: {
      id: process.env.namedpipe_ID || fileConfig.namedpipe?.id || defaultConfig.namedpipe.id,
      retry: parseInt(process.env.namedpipe_RETRY || '') || fileConfig.namedpipe?.retry || defaultConfig.namedpipe.retry
    },
    logging: {
      level: process.env.LOG_LEVEL || fileConfig.logging?.level || defaultConfig.logging.level
    }
  };

  // Update logger level based on configuration
  logger.level = config.logging.level;

  logger.info('Configuration loaded:', {
    rest: config.rest,
    namedpipe: { id: config.namedpipe.id, retry: config.namedpipe.retry },
    logging: { level: config.logging.level }
  });

  return config;
}

/**
 * Singleton configuration instance
 */
export const config = loadConfig();

export default config;