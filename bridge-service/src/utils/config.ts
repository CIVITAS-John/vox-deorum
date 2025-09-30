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
  gamepipe: {
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
    port: 5000,
    host: '127.0.0.1'
  },
  gamepipe: {
    id: 'vox-deorum-bridge',
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
    gamepipe: {
      id: process.env.gamepipe_ID || fileConfig.gamepipe?.id || defaultConfig.gamepipe.id,
      retry: parseInt(process.env.gamepipe_RETRY || '') || fileConfig.gamepipe?.retry || defaultConfig.gamepipe.retry
    },
    logging: {
      level: process.env.LOG_LEVEL || fileConfig.logging?.level || defaultConfig.logging.level
    }
  };

  // Update logger level based on configuration
  logger.level = config.logging.level;

  logger.info('Configuration loaded:', {
    rest: config.rest,
    gamepipe: { id: config.gamepipe.id, retry: config.gamepipe.retry },
    logging: { level: config.logging.level }
  });

  return config;
}

/**
 * Singleton configuration instance
 */
export const config = loadConfig();

export default config;