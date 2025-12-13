/**
 * @module web/routes/config
 *
 * Configuration management API endpoints for reading and updating
 * config.json and .env files.
 */

import { Router } from 'express';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';
import { createLogger } from '../../utils/logger.js';
import { defaultConfig, loadConfigFromFile, type VoxAgentsConfig } from '../../utils/config.js';

const logger = createLogger('config', 'webui');
const router = Router();

/**
 * Format environment variables into .env file content
 * Properly handles multi-line values by using double quotes and escaping
 */
function formatEnvFile(env: Record<string, string>): string {
  return Object.entries(env)
    .map(([key, value]) => {
      // Check if value contains newlines or needs quoting
      if (value.includes('\n') || value.includes('"')) {
        // Escape existing backslashes and quotes, then quote the value
        const escaped = value
          .replace(/\\/g, '\\\\')
          .replace(/"/g, '\\"')
          .replace(/\n/g, '\\n');
        return `${key}="${escaped}"`;
      }
      // Simple values don't need quotes
      return `${key}=${value}`;
    })
    .join('\n') + '\n';
}

/**
 * GET /api/config
 * Get current configuration from config.json and .env
 */
router.get('/', async (req, res) => {
  try {
    // Load config.json
    const config = loadConfigFromFile<VoxAgentsConfig>('config.json', defaultConfig);

    // Load .env file
    const envPath = path.join(process.cwd(), '.env');
    let apiKeys: Record<string, string> = {};

    try {
      const envContent = await fs.readFile(envPath, 'utf-8');
      const env = dotenv.parse(envContent);

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

      // Override with the provided config (no merging)
      const updatedConfig: VoxAgentsConfig = {
        ...defaultConfig,  // Start with defaults
        ...config          // Override with provided config
      };

      // Write updated config
      await fs.writeFile(configPath, JSON.stringify(updatedConfig, null, 2));
      logger.info('Updated config.json');
    }

    // Update .env if API keys provided
    if (apiKeys) {
      const envPath = path.join(process.cwd(), '.env');

      // Override with the provided API keys (no merging)
      // Write updated .env
      await fs.writeFile(envPath, formatEnvFile(apiKeys));
      logger.info('Updated .env file');
    }

    res.json({ success: true });
  } catch (error) {
    logger.error('Error updating configuration', error);
    res.status(500).json({ error: 'Failed to update configuration' });
  }
});

export default router;