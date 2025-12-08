/**
 * Utility types for MCP tool annotations with enhanced type safety
 */

import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";

/**
 * Markdown configuration for formatting tool output
 */
export interface MarkdownConfig {
  /**
   * Format string with {key} placeholders for dynamic content
   */
  format: string;
}

/**
 * Extended tool annotations that builds on MCP's base ToolAnnotations
 * with additional fields for enhanced UI support
 */
export interface ExtendedToolAnnotations extends ToolAnnotations {
  /**
   * Fields that support autocomplete in the client UI
   * These fields will provide suggestions during input
   */
  autoComplete?: string[];

  /**
   * Markdown configuration for output formatting
   * Multiple formats can be specified for different contexts
   */
  markdownConfig?: MarkdownConfig[];
}