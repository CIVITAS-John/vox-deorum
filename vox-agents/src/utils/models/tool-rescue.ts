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
 * Automatically detects common field name patterns:
 * - name/parameters
 * - toolName/input
 * - tool/arguments
 * - function/args
 */
export function toolRescueMiddleware(): LanguageModelMiddleware {
  // Define common field name patterns to check
  const fieldPatterns = [
    { nameField: 'name', parametersField: 'parameters' },
    { nameField: 'toolName', parametersField: 'input' }
  ];

  return {
    middlewareVersion: 'v2',
    wrapGenerate: async ({ doGenerate, params }) => {
      const { content, ...rest } = await doGenerate();

      const transformedContent: LanguageModelV2Content[] = [];
      let toolSeen = content.some(part => part.type === 'tool-call');

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
          // Try each field pattern to find valid tool call structure
          let toolName: string | undefined;
          let toolParameters: any;
          let patternFound = false;

          for (const pattern of fieldPatterns) {
            const candidateName = toolCall[pattern.nameField];
            const candidateParams = toolCall[pattern.parametersField];

            if (candidateName && candidateParams) {
              toolName = candidateName?.replaceAll(/_/g, '-');
              toolParameters = candidateParams;
              patternFound = true;
              break;
            }
          }

          if (!patternFound) {
            // Sometimes a false alarm - Jetstream2's response can have both text AND tool_calls. Those warnings can be safely ignored then.
            if (!toolSeen)
              logger.log("warn", `Failed to rescue tool call: no matching field pattern found`, toolCall);
            // No matching pattern found for this tool call
            allToolCallsValid = false;
            continue;
          }

          // Check if the tool exists in available tools
          if (!availableTools.has(toolName!)) {
            logger.log("warn", `Failed to rescue tool call: non-existent tool ${toolName}`, toolParameters);
            // Tool not available
            allToolCallsValid = false;
            continue;
          }

          logger.log("info", `Rescued tool call: ${toolName}`, toolParameters);

          // Transform into a tool call
          rescuedToolCalls.push({
            type: 'tool-call',
            toolCallId: generateId(),
            toolName: toolName!,
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