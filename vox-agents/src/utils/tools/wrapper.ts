/**
 * @module utils/tools/wrapper
 *
 * Tool wrapper utilities for integrating agents and MCP tools with Vercel AI SDK.
 * Provides functions to wrap VoxAgents and MCP tools as AI SDK CoreTools,
 * handling schema transformation, parameter injection, and observability.
 */

import { z } from "zod";
import { AgentParameters, VoxAgent } from "../../infra/vox-agent.js";
import { VoxContext } from "../../infra/vox-context.js";
import { createLogger } from "../logger.js";
import { Tool as VercelTool, dynamicTool, ToolSet, jsonSchema } from 'ai';
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { mcpClient } from "../models/mcp-client.js";
import { trace, SpanStatusCode, SpanKind } from '@opentelemetry/api';
import { camelCase } from "change-case";

const tracer = trace.getTracer('vox-tools');

/**
 * Creates a dynamic tool wrapper for an agent using Vercel AI SDK's dynamicTool.
 * Allows agents to call other agents as tools, enabling hierarchical agent architectures.
 *
 * @param agent - The agent to wrap as a tool
 * @param context - The VoxContext for executing the agent
 * @param baseParameters - Base parameters to merge with tool invocation parameters
 * @returns A CoreTool that can be used with AI SDK
 *
 * @example
 * ```typescript
 * const strategistAgent = new SimpleStrategist();
 * const tool = createAgentTool(strategistAgent, context, { playerID: 0 });
 * ```
 */
export function createAgentTool<TParameters extends AgentParameters, TInput = unknown, TOutput = unknown>(
  agent: VoxAgent<TParameters, TInput, TOutput>,
  context: VoxContext<TParameters>,
  baseParameters: TParameters
): VercelTool {
  const logger = createLogger(`AgentTool-${agent.name}`);

  // Use a simpler approach to avoid deep type instantiation issues
  const description = agent.toolDescription || `Execute the ${agent.name} agent to handle specialized tasks`;
  const inputSchema = agent.inputSchema || z.object({
    Prompt: z.string().describe("The prompt or task to give to the agent")
  });

  return dynamicTool({
    description,
    inputSchema: inputSchema as any,
    execute: async (input) => {
      const span = tracer.startSpan(`agent-tool.${agent.name}`, {
        attributes: {
          'vox.context.id': context.id,
          'tool.name': agent.name,
          'tool.type': 'agent',
        }
      });

      try {
        logger.debug(`Executing agent-tool: ${agent.name}`);
        span.setAttributes({
          'tool.input': JSON.stringify(input)
        });

        let parameters = baseParameters;

        // Execute the agent through the context
        const result = await context.execute(agent.name, parameters, input);
        logger.debug(`Agent-tool execution completed: ${agent.name}`);

        span.setAttributes({
          'tool.output': JSON.stringify(result)
        });
        span.setStatus({ code: SpanStatusCode.OK });

        // Apply output schema if defined
        if (agent.outputSchema) {
          return agent.outputSchema.parse(result);
        }

        return { result };
      } catch (error) {
        logger.error(`Error in agent-tool ${agent.name}:`, error);
        span.recordException(error as Error);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : String(error)
        });
        throw error;
      } finally {
        span.end();
      }
    }
  });
}

/**
 * Wrap a MCP tool for Vercel AI SDK.
 * Handles schema filtering and parameter injection,
 * and markdown conversion of results.
 *
 * @param tool - MCP tool definition
 * @param contextId - Optional VoxContext ID for tracing
 * @returns Vercel AI SDK CoreTool
 *
 * @example
 * ```typescript
 * const tools = await mcpClient.getTools();
 * const wrapped = wrapMCPTool(tools[0]);
 * ```
 */
export function wrapMCPTool(tool: Tool, context: VoxContext<AgentParameters>): VercelTool {
  const logger = createLogger(`tool-${tool.name}`);

  // Remove autoComplete fields from input schema
  const filteredSchema = { ...tool.inputSchema };
  if (filteredSchema.properties && (tool._meta as any)?.autoComplete) {
    const autoCompleteFields = (tool._meta as any).autoComplete as string[];
    const filteredProperties = { ...filteredSchema.properties };

    // Remove autoComplete fields from properties
    autoCompleteFields.forEach(field => {
      delete filteredProperties[field];
    });

    // Remove autoComplete fields from required array if present
    if (filteredSchema.required) {
      filteredSchema.required = filteredSchema.required.filter(
        (field: string) => !autoCompleteFields.includes(field)
      );
    }

    filteredSchema.properties = filteredProperties;
  }

  return dynamicTool({
    description: tool.description || `MCP tool: ${tool.name}`,
    inputSchema: jsonSchema(filteredSchema),
    execute: async (args: any, options) => {
      const span = tracer.startSpan(`mcp-tool.${tool.name}`, {
        kind: SpanKind.CLIENT,
        attributes: {
          'tool.name': tool.name,
          'tool.type': 'mcp',
          'vox.context.id': context.id,
          'game.turn': context.lastParameter?.turn ?? -1
        }
      });

      try {
        // Autocomplete support - add the fields back for execution
        if ((tool._meta as any)?.autoComplete) {
          ((tool._meta as any)?.autoComplete as string[]).forEach(
            key => {
              var camelKey = camelCase(key);
              if (camelKey.endsWith("Id")) camelKey = camelKey.substring(0, camelKey.length - 2) + "ID";
              args[key] = (options.experimental_context as any)[camelKey];
              // console.log(`${key} => ${camelKey} => ${(options.experimental_context as any)[camelKey]}`)
            }
          )
          // console.log(options.experimental_context);
        }

        // Log inputs
        span.setAttributes({
          'tool.input': JSON.stringify(args)
        });
        logger.info(`Calling tool ${tool.name}...`, args);

        // Call the tool
        var result = await mcpClient.callTool(tool.name, args);
        const structuredResult = result.structuredContent;
        result = structuredResult ?? result;
        result = result.Result ?? result;
        logger.debug(`Tool call completed: ${tool.name}`);

        span.setAttributes({
          'tool.output': JSON.stringify(result)
        });
        span.setStatus({ code: SpanStatusCode.OK });

        // Return results
        if (typeof(result) === "object")
          result._markdownConfig = (tool._meta as any)?.markdownConfig
        return result;
      } catch (error) {
        logger.error(`Error calling MCP tool ${tool.name}:`, error);
        span.recordException(error as Error);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : String(error)
        });
        throw error;
      } finally {
        span.end();
      }
    }
  });
}

/**
 * Wrap multiple MCP tools for Vercel AI SDK.
 * Convenience function to batch-wrap an array of MCP tools.
 *
 * @param tools - Array of MCP tool definitions
 * @param contextId - Optional VoxContext ID for tracing
 * @returns ToolSet object mapping tool names to wrapped tools
 *
 * @example
 * ```typescript
 * const tools = await mcpClient.getTools();
 * const toolSet = wrapMCPTools(tools);
 * ```
 */
export function wrapMCPTools(tools: Tool[], context: VoxContext<AgentParameters>): ToolSet {
  var results: Record<string, VercelTool> = {};
  tools.forEach(tool => results[tool.name] = wrapMCPTool(tool, context));
  return results;
}