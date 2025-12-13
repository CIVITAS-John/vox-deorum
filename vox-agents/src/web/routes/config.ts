/**
 * @module web/routes/config
 *
 * Configuration management API endpoints for reading and updating
 * config.json and .env files.
 */

import { Router } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { createLogger } from '../../utils/logger.js';
import { defaultConfig, loadConfigFromFile, type VoxAgentsConfig } from '../../utils/config.js';

const logger = createLogger('config', 'webui');
const router = Router();

/**
 * Parse .env file content into a key-value object
 */
function parseEnvFile(content: string): Record<string, string> {
  const env: Record<string, string> = {};
  const lines = content.split('\n');

  for (const line of lines) {
    // Skip comments and empty lines
    if (line.trim().startsWith('#') || !line.trim()) continue;

    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      env[key.trim()] = valueParts.join('=').trim();
    }
  }

  return env;
}

/**
 * Format environment variables into .env file content
 */
function formatEnvFile(env: Record<string, string>): string {
  return Object.entries(env)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n') + '\n';
}

/**
 * GET /api/config
 * Get current configuration from config.json and .env
 */
router.get('/', async (req, res) => {
  try {
    // Load config.json
    const configPath = path.join(process.cwd(), 'config.json');
    const config = loadConfigFromFile<VoxAgentsConfig>('config.json', defaultConfig);

    // Load .env file
    const envPath = path.join(process.cwd(), '.env');
    let apiKeys: Record<string, string> = {};

    try {
      const envContent = await fs.readFile(envPath, 'utf-8');
      const env = parseEnvFile(envContent);

      // Extract API keys
      apiKeys = Object.entries(env)
        .filter(([key]) => key.includes('API_KEY') || key === 'OLLAMA_URL')
        .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});
    } catch (error) {
      logger.debug('.env file not found or could not be read');
    }

    res.json({
      config,
      apiKeys
    });
  } catch (error) {
    logger.error('Error loading configuration', error);
    res.status(500).json({ error: 'Failed to load configuration' });
  }
});

/**
 * POST /api/config
 * Update configuration in config.json and .env
 */
router.post('/', async (req, res) => {
  try {
    const { config, apiKeys } = req.body;

    // Update config.json if config provided
    if (config) {
      const configPath = path.join(process.cwd(), 'config.json');

      // Load existing config
      const existingConfig = loadConfigFromFile<VoxAgentsConfig>('config.json', defaultConfig);

      // Merge with updates (deep merge for nested objects)
      const updatedConfig: VoxAgentsConfig = {
        ...existingConfig,
        ...config,
        agent: { ...existingConfig.agent, ...(config.agent || {}) },
        webui: { ...existingConfig.webui, ...(config.webui || {}) },
        mcpServer: {
          ...existingConfig.mcpServer,
          ...(config.mcpServer || {}),
          transport: {
            ...existingConfig.mcpServer.transport,
            ...(config.mcpServer?.transport || {})
          }
        },
        logging: { ...existingConfig.logging, ...(config.logging || {}) },
        llms: { ...existingConfig.llms, ...(config.llms || {}) }
      };

      // Write updated config
      await fs.writeFile(configPath, JSON.stringify(updatedConfig, null, 2));
      logger.info('Updated config.json');
    }

    // Update .env if API keys provided
    if (apiKeys) {
      const envPath = path.join(process.cwd(), '.env');

      // Load existing .env
      let existingEnv: Record<string, string> = {};
      try {
        const envContent = await fs.readFile(envPath, 'utf-8');
        existingEnv = parseEnvFile(envContent);
      } catch (error) {
        logger.debug('Creating new .env file');
      }

      // Merge with updates
      const updatedEnv = {
        ...existingEnv,
        ...apiKeys
      };

      // Write updated .env
      await fs.writeFile(envPath, formatEnvFile(updatedEnv));
      logger.info('Updated .env file');
    }

    res.json({ success: true });
  } catch (error) {
    logger.error('Error updating configuration', error);
    res.status(500).json({ error: 'Failed to update configuration' });
  }
});

export default router;