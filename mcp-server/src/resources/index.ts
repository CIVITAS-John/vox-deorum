/**
 * Resources module - Exports and registers all MCP resources
 */

import { GameStateResource } from './game-state.js';
import { UnitsResource } from './units.js';
import { logger } from '../utils/logger.js';

/**
 * Register all resources with the MCP server
 */
export function registerAllResources(): void {
  logger.info('Registering MCP resources');
  
  // Register each resource
  GameStateResource.register();
  UnitsResource.register();
  
  logger.info('All resources registered');
}

// Export individual resources for direct use if needed
export { GameStateResource } from './game-state.js';
export { UnitsResource } from './units.js';
export { ResourceBase } from './base.js';
export type { ResourceMetadata, PlayerContext } from './base.js';