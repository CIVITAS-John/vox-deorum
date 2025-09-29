import type {
  LanguageModelV2Content,
} from '@ai-sdk/provider';
import { LanguageModelMiddleware } from 'ai';
import { createLogger } from '../logger.js';

const logger = createLogger("tool-rescue");

/**
 * Rescue tool calls from JSON in text responses and transform them into proper tool calls.
 * Detects when a text response contains valid JSON with tool name and parameters,
 * validates against available tools, and converts to tool-call format.
 *
 * Supports both single tool calls and arrays of multiple tool calls.
 * If multiple tool calls are provided as an array, all must be valid for the rescue to succeed.
 *
 * @param nameField - The JSON field name for the tool name (default: 'name').
 * @param parametersField - The JSON field name for the tool parameters (default: 'parameters').
 */
export function toolRescueMiddleware({
  nameField = 'name',
  parametersField = 'parameters',
}: {
  nameField?: string;
  parametersField?: string;
} = {}): LanguageModelMiddleware {
  return {
    middlewareVersion: 'v2',
    wrapGenerate: async ({ doGenerate, params }) => {
      const { content, ...rest } = await doGenerate();

      const transformedContent: LanguageModelV2Content[] = [];

      // Get available tools from params
      const availableTools = new Set(
        params?.tools?.map(tool => tool.name) || [],
      );

      for (const part of content) {
        if (part.type !== 'text') {
          transformedContent.push(part);
          continue;
        }

        // Try to parse the text as JSON
        let parsed: any;
        try {
          parsed = JSON.parse(part.text);
        } catch {
          // Not valid JSON, keep as text
          transformedContent.push(part);
          continue;
        }

        // Check if it's an array of tool calls
        const toolCalls = Array.isArray(parsed) ? parsed : [parsed];
        let allToolCallsValid = true;
        const rescuedToolCalls: LanguageModelV2Content[] = [];

        for (const toolCall of toolCalls) {
          // Check if it has the required fields
          const toolName = toolCall[nameField];
          const toolParameters = toolCall[parametersField];

          if (!toolName || !toolParameters) {
            logger.log("warn", `Failed to rescue tool call: missing parts`, toolCall);
            // Missing required fields for this tool call
            allToolCallsValid = false;
            break;
          }

          // Check if the tool exists in available tools
          if (!availableTools.has(toolName)) {
            logger.log("warn", `Failed to rescue tool call: non-existent tool ${toolName}`, toolParameters);
            // Tool not available
            allToolCallsValid = false;
            break;
          }

          logger.log("info", `Rescued tool call: ${toolName}`, toolParameters);

          // Transform into a tool call
          rescuedToolCalls.push({
            type: 'tool-call',
            toolCallId: generateId(),
            toolName: toolName,
            input: JSON.stringify(toolParameters),
          });
        }

        // Only add the rescued tool calls if all were valid
        if (allToolCallsValid && rescuedToolCalls.length > 0) {
          transformedContent.push(...rescuedToolCalls);
        } else {
          // Keep as text if any tool call was invalid
          transformedContent.push(part);
        }
      }

      return { content: transformedContent, ...rest };
    },
  };
}

// Simple ID generator
function generateId(): string {
  return `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}