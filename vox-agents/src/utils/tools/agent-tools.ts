/**
 * @module utils/tools/agent-tools
 *
 * Agent tool wrapper utilities for integrating VoxAgents with Vercel AI SDK.
 * Provides functions to wrap VoxAgents as AI SDK CoreTools,
 * handling schema transformation, parameter injection, and observability.
 */

import { z } from "zod";
import { AgentParameters, VoxAgent } from "../../infra/vox-agent.js";
import { VoxContext } from "../../infra/vox-context.js";
import { createLogger } from "../logger.js";
import { Tool as VercelTool, dynamicTool } from 'ai';
import { trace, SpanStatusCode } from '@opentelemetry/api';

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