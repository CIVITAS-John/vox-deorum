/**
 * @module oracle/utils/schema-tools
 *
 * Schema-only tool wrappers for oracle replay mode.
 * LLMs can generate tool call intents but nothing executes against MCP.
 */

import { dynamicTool, jsonSchema } from 'ai';
import fs from 'node:fs';
import path from 'node:path';
import type { Tool as MCPTool } from '@modelcontextprotocol/sdk/types.js';
import type { VoxContext } from '../../infra/vox-context.js';
import type { OracleParameters } from '../types.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('OracleSchemaTools');
const toolCachePath = path.join('cache', 'mcp-tools.json');

/**
 * Create a schema-only tool from an MCP tool entry.
 * The LLM can generate call intents but nothing executes.
 *
 * @param name - Tool name
 * @param mcpTool - MCP tool entry with description and inputSchema
 * @param rewriter - Optional function to rewrite the tool's JSON schema
 */
export function schemaOnlyTool(
  name: string,
  mcpTool: { description?: string; inputSchema: any },
  rewriter?: (json: string) => string
): any {
  let description = mcpTool.description ?? `Tool: ${name}`;
  let schema = mcpTool.inputSchema;

  // Remove autoComplete fields from schema (same filtering as wrapMCPTool)
  if (schema.properties && (mcpTool as any)._meta?.autoComplete) {
    const autoCompleteFields = (mcpTool as any)._meta.autoComplete as string[];
    schema = { ...schema, properties: { ...schema.properties } };
    autoCompleteFields.forEach(field => {
      delete schema.properties[field];
    });
    if (schema.required) {
      schema.required = schema.required.filter(
        (field: string) => !autoCompleteFields.includes(field)
      );
    }
  }

  if (rewriter) {
    const rewritten = JSON.parse(rewriter(JSON.stringify({ description, inputSchema: schema })));
    description = rewritten.description;
    schema = rewritten.inputSchema;
  }

  return dynamicTool({
    description,
    inputSchema: jsonSchema(schema as any),
    execute: async () => ({ _oracle: true, message: `Tool ${name} not executed in replay mode.` }),
  });
}

/**
 * Replace all tools in the VoxContext with schema-only versions.
 * The LLM can still generate tool call intents, but nothing executes.
 *
 * @param voxContext - The VoxContext to modify in place
 * @param rewriter - Optional function applied to each tool's JSON schema
 */
export function replaceToolsWithSchemaOnly(
  voxContext: VoxContext<OracleParameters>,
  rewriter?: (json: string) => string
): void {
  const schemaTools: Record<string, any> = {};
  for (const [name, mcpTool] of voxContext.mcpToolMap) {
    schemaTools[name] = schemaOnlyTool(name, mcpTool, rewriter);
  }
  voxContext.tools = schemaTools;
}

/**
 * Load cached MCP tool definitions for schema-only replay.
 * The cache is trusted as written; malformed cache reads fail as a whole and
 * let the caller fall back to live MCP discovery.
 */
export function loadToolSchemaCache(voxContext: VoxContext<OracleParameters>): boolean {
  try {
    if (!fs.existsSync(toolCachePath)) {
      logger.info('No MCP tool schema cache found');
      return false;
    }

    const raw = fs.readFileSync(toolCachePath, 'utf-8');
    const tools = JSON.parse(raw) as MCPTool[];
    voxContext.mcpToolMap = new Map(tools.map(t => [t.name, t]));
    logger.info(`Loaded MCP tool schema cache (${tools.length} tools)`);
    return true;
  } catch (error) {
    logger.warn('Failed to load MCP tool schema cache', { error });
    return false;
  }
}
