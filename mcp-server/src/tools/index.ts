/**
 * Tools module - Exports and registers all MCP tools
 */

import { ScoreAnalysisTool, UnitStrengthAnalysisTool } from './analysis.js';
import { MoveUnitTool, EndTurnTool } from './commands.js';
import { logger } from '../utils/logger.js';

/**
 * Register all tools with the MCP server
 */
export function registerAllTools(): void {
  logger.info('Registering MCP tools');
  
  // Register analysis tools
  ScoreAnalysisTool.register();
  UnitStrengthAnalysisTool.register();
  
  // Register command tools
  MoveUnitTool.register();
  EndTurnTool.register();
  
  logger.info('All tools registered');
}

// Export individual tools for direct use if needed
export { ScoreAnalysisTool, UnitStrengthAnalysisTool } from './analysis.js';
export { MoveUnitTool, EndTurnTool } from './commands.js';
export { ToolBase } from './base.js';
export type { ToolMetadata, PlayerContext, ToolResult } from './base.js';