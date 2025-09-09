import { z } from "zod";
import { VoxAgent } from "../infra/vox-agent.js";
import { VoxContext } from "../infra/vox-context.js";
import { createLogger } from "./logger.js";
import { Tool as VercelTool, dynamicTool, ToolSet } from 'ai';
import { convertJsonSchemaToZod } from 'zod-from-json-schema';
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { mcpClient } from "./mcp-client.js";

/**
 * Creates a dynamic tool wrapper for an agent using Vercel AI SDK's dynamicTool
 * @param agent - The agent to wrap as a tool
 * @param context - The VoxContext for executing the agent
 * @param baseParameters - Base parameters to merge with tool invocation parameters
 * @returns A CoreTool that can be used with AI SDK
 */
export function createAgentTool<TParameters, TInput = unknown, TOutput = unknown>(
  agent: VoxAgent<TParameters, TInput, TOutput>,
  context: VoxContext<TParameters>,
  baseParameters: TParameters
): VercelTool {
  const logger = createLogger(`AgentTool-${agent.name}`);
  
  // Use a simpler approach to avoid deep type instantiation issues
  const description = agent.toolDescription || `Execute the ${agent.name} agent to handle specialized tasks`;
  const inputSchema = agent.inputSchema || z.object({
    prompt: z.string().describe("The prompt or task to give to the agent")
  });
  
  return dynamicTool({
    description,
    inputSchema: inputSchema as any,
    execute: async (input) => {
      logger.info(`Executing agent-tool: ${agent.name}`);
      
      try {
        let parameters: TParameters;
        
        if (agent.inputSchema) {
          // Direct usage when agent defines its own schema
          parameters = input as TParameters;
        } else {
          // Default behavior: merge with base parameters
          const { prompt } = input as {
            prompt: string;
          };
          
          parameters = {
            ...baseParameters,
            prompt
          } as TParameters;
        }
        
        // Execute the agent through the context
        const result = await context.execute(agent.name, parameters);
        
        logger.info(`Agent-tool execution completed: ${agent.name}`);
        
        // Apply output schema if defined
        if (agent.outputSchema) {
          return agent.outputSchema.parse(result);
        }
        
        return { result };
      } catch (error) {
        logger.error(`Error in agent-tool ${agent.name}:`, error);
        throw error;
      }
    }
  });
}

/**
 * Wrap a MCP tool for Vercel AI.
 */
export function wrapMCPTool(tool: Tool): VercelTool {
  const logger = createLogger(`MCPTool-${tool.name}`);
  return dynamicTool({
    description: tool.description || `MCP tool: ${tool.name}`,
    inputSchema: convertJsonSchemaToZod(tool.inputSchema as any) as any,
    execute: async (args: any, options) => {
      // Autocomplete support
      if (tool.annotations?.autoComplete) {
        (tool.annotations?.autoComplete as string[]).forEach(
          value => args[value] = (options.experimental_context as any)[value]
        )
      }
      logger.info(`Calling tool ${tool.name}...`, args);
      // Call the tool
      const result = await mcpClient.callTool(tool.name, args);
      logger.info(`Tool call completed: ${tool.name}`);
      return result;
    }
  });
}
/**
 * Wrap a MCP tool for Vercel AI.
 */
export function wrapMCPTools(tools: Tool[]): ToolSet {
  var results: Record<string, VercelTool> = {};
  tools.forEach(tool => results[tool.name] = wrapMCPTool(tool));
  return results;
}