/**
 * @module utils/models/tool-rescue
 *
 * Tool rescue utility for AI SDK.
 * Detects and transforms JSON tool calls embedded in text responses into proper tool-call format.
 * Handles cases where LLMs output tool calls as JSON text instead of using the native tool-calling API.
 */
import { tool, type LanguageModelMiddleware, type Tool } from 'ai';
import { createLogger } from '../logger.js';
import { LanguageModelV2FunctionTool, LanguageModelV2ProviderDefinedTool, LanguageModelV2StreamPart, LanguageModelV2Text, LanguageModelV2ToolCall, LanguageModelV2ToolChoice } from '@ai-sdk/provider';

// @ts-ignore - jaison doesn't have type definitions
import jaison from 'jaison';

const logger = createLogger("tool-rescue");

/**
 * Configuration options for tool rescue
 */
export interface ToolRescueOptions {
  /**
   * If true, instructs the model to respond in tool/arguments JSON format
   * by adding a system prompt with instructions
   */
  prompt?: boolean;
}

export function createToolPrompt(tool: (LanguageModelV2FunctionTool | LanguageModelV2ProviderDefinedTool)) {
  // We don't support provider tools this way
  if (tool.type === "provider-defined") return;
  let toolInfo = `### ${tool.name}`;
  if (tool.description) {
    toolInfo += `\n- Description: ${tool.description}`;
  }
  if (tool.inputSchema) {
    toolInfo += `\n- Arguments: \n\`\`\`\n${JSON.stringify(tool.inputSchema, null, 2)}\n\`\`\``;
  }
  return toolInfo;
}

/**
 * Creates a tool instruction prompt for models that don't support native tool calling
 * @param tools Array of tool definitions with names and schemas
 * @returns System prompt text instructing the model to use JSON format for tool calls
 */
export function createToolPrompts(tools: (LanguageModelV2FunctionTool | LanguageModelV2ProviderDefinedTool)[],
  choice: LanguageModelV2ToolChoice): string | undefined {
  // Format tools with their schemas
  const descriptions = tools.map(createToolPrompt).join('\n\n');

  // Format the prompt
  switch (choice.type) {
    case "required":
      return `## Tool Calling
You must use one or more tools from the list below. Respond ONLY with a JSON array in this exact format:
\`\`\`json
[
  { "tool": "<tool_name>", "arguments": { <parameters> } },
]
\`\`\`

## Available Tools
${descriptions}`;
    case "tool":
      return `## Tool Calling
You must use the tool defined below. Respond ONLY with a JSON object in this exact format:
{ "tool": "<tool_name>", "arguments": { <parameters> } }

${descriptions}`;
    case "none":
      return undefined;
    default:
      return `## Tool Calling
You have access to tools. If you decide to invoke any of the tool(s), respond ONLY with a JSON array in this exact format:
\`\`\`json
[
  { "tool": "<tool_name>", "arguments": { <parameters> } },
]
\`\`\`

## Available Tools
${descriptions}`;
  }
}

/**
 * Rescues tool calls from JSON text and transforms them into proper tool call format.
 * This function processes text that may contain JSON tool calls and converts them
 * to the format expected by the AI SDK.
 *
 * @param text The text to process
 * @param availableTools Set of available tool names for validation
 * @returns Object containing rescued tool calls and remaining text (if any)
 */
export function rescueToolCallsFromText(
  text: string,
  availableTools: Set<string>,
  useJaison: boolean = true
): { remainingText?: string, toolCalls: LanguageModelV2ToolCall[] } {
  // Define common field name patterns to check
  const fieldPatterns = [
    { nameField: 'name', parametersField: 'parameters' },
    { nameField: 'toolName', parametersField: 'input' },
    { nameField: 'tool', parametersField: 'arguments' }
  ];

  // First, try to extract the largest JSON block by finding balanced brackets/braces
  // This uses character-by-character parsing instead of regex
  function findJsonBlocks(str: string): string[] {
    const blocks: string[] = [];
    const openChars = ['{', '['];

    for (let i = 0; i < str.length; i++) {
      if (!openChars.includes(str[i])) continue;

      const startChar = str[i];
      const endChar = startChar === '{' ? '}' : ']';
      let depth = 1;
      let j = i + 1;
      let inString = false;
      let escapeNext = false;

      while (j < str.length && depth > 0) {
        const char = str[j];

        if (escapeNext) {
          escapeNext = false;
          j++;
          continue;
        }

        if (char === '\\') {
          escapeNext = true;
          j++;
          continue;
        }

        if (char === '"') {
          inString = !inString;
        } else if (!inString) {
          if (char === startChar) {
            depth++;
          } else if (char === endChar) {
            depth--;
          }
        }

        j++;
      }

      if (depth === 0) {
        blocks.push(str.substring(i, j));
      }
    }

    return blocks;
  }

  // If in strict mode and the json block is incomplete, skip it
  if (!useJaison && text.indexOf("```json") !== -1) return { toolCalls: [], remainingText: text };

  // First check for markdown code blocks with ```json syntax
  const codeBlockRegex = /\`\`\`json\s*\n([\s\S]*?)\n\`\`\`/;
  const codeBlockMatch = text.match(codeBlockRegex);

  let jsonText: string;

  if (codeBlockMatch) {
    // If markdown code block found, use its content directly
    jsonText = codeBlockMatch[1].trim();
  } else {
    // Otherwise, find all potential JSON blocks and select the largest one
    const jsonBlocks = findJsonBlocks(text);
    let largestBlock = '';
    let largestBlockSize = 0;

    for (const block of jsonBlocks) {
      if (block.length > largestBlockSize) {
        largestBlock = block;
        largestBlockSize = block.length;
      }
    }

    // If no JSON block found, try to parse the entire text
    jsonText = largestBlock || text;
  }

  // Try to parse the JSON using jaison
  let parsed: any;
  try {
    if (useJaison)
      parsed = jaison(jsonText);
    else parsed = JSON.parse(jsonText);
  } catch {
    // Not valid JSON, return as text
    return { toolCalls: [], remainingText: text };
  }

  // Check if it's an array of tool calls
  const toolCalls = Array.isArray(parsed) ? parsed : [parsed];
  let allToolCallsValid = true;
  const rescuedToolCalls: LanguageModelV2ToolCall[] = [];

  for (const toolCall of toolCalls) {
    if (!toolCall) continue;
    
    // Try each field pattern to find valid tool call structure
    let toolName: string | undefined;
    let toolParameters: Record<string, unknown> | undefined;
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
      if (Object.keys(toolCall).length > 0 && useJaison)
        logger.log("warn", `Failed to rescue tool call: no matching field pattern found from ${jsonText}`);
      continue;
    }

    // Check if the tool exists in available tools
    if (!availableTools.has(toolName!)) {
      if (useJaison) logger.log("warn", `Failed to rescue tool call: non-existent or unavailable tool ${toolName}`, toolParameters);
      continue;
    }

    logger.log("debug", `Rescued tool call: ${toolName}`, toolParameters!);

    // Transform into a tool call
    rescuedToolCalls.push({
      type: 'tool-call',
      toolCallId: generateId(),
      toolName: toolName!,
      input: JSON.stringify(toolParameters),
    });
  }

  // Only return the rescued tool calls if all were valid
  if (rescuedToolCalls.length > 0 && allToolCallsValid) {
    // If we extracted a JSON block, calculate remaining text
    let remainingText: string | undefined;

    // Determine what was extracted - either the full markdown block or just the JSON content
    const extractedContent = codeBlockMatch ? codeBlockMatch[0] : jsonText;

    if (extractedContent && extractedContent !== text) {
      // Remove the extracted content from the original text
      const blockIndex = text.indexOf(extractedContent);
      const before = text.substring(0, blockIndex).trim();
      const after = text.substring(blockIndex + extractedContent.length).trim();
      remainingText = (before + ' ' + after).trim();
      if (!remainingText) remainingText = undefined;
    }
    
    return { toolCalls: rescuedToolCalls, remainingText };
  }

  // If rescue failed, return original text
  return { toolCalls: [], remainingText: text };
}

// Simple ID generator
function generateId(): string {
  return `call_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Emits rescued tool calls as stream chunks
 * @param toolCalls Array of rescued tool calls
 * @param controller Transform stream controller
 */
function emitToolCallChunks(
  toolCalls: LanguageModelV2ToolCall[],
  controller: TransformStreamDefaultController<LanguageModelV2StreamPart>
): void {
  toolCalls.forEach((toolCall) => {
    controller.enqueue({
      type: 'tool-call',
      toolCallId: toolCall.toolCallId,
      toolName: toolCall.toolName,
      input: toolCall.input
    } as any);
  });
}

/**
 * Emits remaining text as a text-delta chunk
 * @param text Remaining text to emit
 * @param controller Transform stream controller
 * @param id Optional chunk ID
 */
function emitRemainingText(
  text: string | undefined,
  controller: TransformStreamDefaultController<LanguageModelV2StreamPart>,
  id: string
): void {
  if (text) {
    controller.enqueue({
      type: 'text-delta',
      delta: text,
      id
    });
  }
}

/**
 * Creates a tool rescue middleware for language models.
 * This middleware intercepts generate operations to detect and transform
 * JSON tool calls embedded in text responses into proper tool-call format.
 *
 * @param options Configuration options
 * @returns A LanguageModelMiddleware that handles tool rescue
 */
export function toolRescueMiddleware(options?: ToolRescueOptions): LanguageModelMiddleware {
  return {
    middlewareVersion: 'v2',

    // Transform params if prompt mode is enabled
    transformParams: async ({ params }) => {
      // Skip if prompt mode not enabled or no tools
      if (!options?.prompt || !params?.tools || params.tools.length === 0) {
        return params;
      }

      // Create tool instruction prompt with full tool schemas
      const toolPrompt = createToolPrompts(params.tools, params.toolChoice ?? { type: "auto" });

      // Modify the prompt to include tool instructions
      const originalPrompt = params.prompt ?? [];
      const modifiedPrompt: any = [
        { role: 'system', content: toolPrompt },
        ...originalPrompt
      ];

      // Return modified params without tools (since we're using JSON format)
      return {
        ...params,
        tools: undefined,
        originalTools: params.tools,
        prompt: modifiedPrompt
      };
    },

    wrapGenerate: async ({ doGenerate, params }) => {
      try {
        // Execute the generation (params were already transformed if needed)
        const result = await doGenerate();
        params.tools = params.tools ?? (params as any).originalTools;

        // Process the response to rescue tool calls from JSON text if we have tools but not tool calls
        if (result.content.findIndex(content => content.type === "tool-call") === -1 && params.tools && params.tools.length > 0) {
          // Extract tool names from the tool definitions
          const toolNames = new Set(params.tools.map((tool) => tool.name));
          const newContents: typeof result.content = [];

          // Go through each text respose
          result.content.forEach((content) => {
            if (content.type === "text") {
              const processed = rescueToolCallsFromText(content.text, toolNames);
              // If tool calls were rescued, add them to the content array
              if (processed.toolCalls.length > 0) {
                // Remove the text that contained the tool calls if it was completely consumed
                if (processed.remainingText) newContents.push({ type: 'text', text: processed.remainingText });
                // Add the rescued tool calls to content
                newContents.push(...processed.toolCalls);
                result.finishReason = 'tool-calls';
                return;
              }
            }
            newContents.push(content);
          });

          // Update result with new contents
          result.content = newContents;
        }

        return result;
      } catch (error) {
        // Re-throw the error to let the retry mechanism handle it
        logger.error("Error in wrapGenerate middleware", error);
        throw error;
      }
    },

    wrapStream: async ({ doStream, params }) => {
      try {
        const { stream, ...rest } = await doStream();
        params.tools = params.tools ?? (params as any).originalTools;

        // If we don't have tools, just pass through the stream
        if (!params.tools || params.tools.length === 0) {
          return { stream, ...rest };
        }

        // Extract tool names from the tool definitions
        const toolNames = new Set(params.tools.map((tool) => tool.name));

        // Track if we've already found tool calls
        let toolCallsFound = false;
        // Buffer for incomplete JSON
        let incompleteBuffers: Record<string, string> = {};

        const transformStream = new TransformStream<
          LanguageModelV2StreamPart,
          LanguageModelV2StreamPart
        >({
          transform(chunk, controller) {
            switch (chunk.type) {
              case "text-delta": {
                // Process the incoming delta
                let incompleteBuffer = incompleteBuffers[chunk.id] ?? "";
                let currentDelta = incompleteBuffer + chunk.delta;

                // Check for both { and [ as JSON start characters
                const objStartIndex = currentDelta.indexOf('{');
                const arrStartIndex = currentDelta.indexOf('[');
                const markdownStartIndex = currentDelta.indexOf('```json');
                let jsonStartIndex = -1;

                // Find the first occurrence of either { or [
                if (markdownStartIndex !== -1) {
                  jsonStartIndex = markdownStartIndex;
                } else if (objStartIndex !== -1 && arrStartIndex !== -1) {
                  jsonStartIndex = Math.min(objStartIndex, arrStartIndex);
                } else if (arrStartIndex !== -1) {
                  jsonStartIndex = arrStartIndex;
                } else if (objStartIndex !== -1) {
                  jsonStartIndex = objStartIndex;
                } else {
                  chunk.delta = currentDelta;
                }

                if (jsonStartIndex !== -1) {
                  // Output text before JSON, start buffering from JSON
                  chunk.delta = currentDelta.substring(0, jsonStartIndex);
                  incompleteBuffer = currentDelta.substring(jsonStartIndex);

                  if (!incompleteBuffer.startsWith('```json')) {
                    // Try to rescue tool calls from accumulated buffer - strict first
                    const processed = rescueToolCallsFromText(incompleteBuffer, toolNames, false);
                    if (processed.toolCalls.length > 0) {
                      toolCallsFound = true;
                      // Emit tool calls as proper stream chunks
                      emitToolCallChunks(processed.toolCalls, controller);
                      // Clear the buffer and put remaining text there
                      let remaining = processed.remainingText ?? "";
                      if (remaining.indexOf("{") !== -1)
                        incompleteBuffers[chunk.id] = remaining;
                      else {
                        incompleteBuffers[chunk.id] = "";
                        chunk.delta += remaining;
                      }
                    } else {
                      incompleteBuffers[chunk.id] = incompleteBuffer;
                    }
                  } else {
                    incompleteBuffers[chunk.id] = incompleteBuffer;
                  }
                }

                // Pass through the remaining text
                controller.enqueue(chunk);
                break;
              }
              case "text-end": {
                // Text block ended, pass through
                let incompleteBuffer = incompleteBuffers[chunk.id] ?? "";
                if (incompleteBuffer !== "") {
                  // More lenient when the stream is finishing
                  const processed = rescueToolCallsFromText(incompleteBuffer, toolNames);
                  if (processed.toolCalls.length > 0) {
                    toolCallsFound = true;
                    // Emit remaining text if any
                    emitRemainingText(processed.remainingText, controller, chunk.id);
                    // Emit tool calls
                    emitToolCallChunks(processed.toolCalls, controller);
                  } else {
                    emitRemainingText(incompleteBuffer, controller, chunk.id);
                  }
                }
                controller.enqueue(chunk);
                break;
              }
              case "finish": {
                // Update finish reason if we found tool calls
                if (toolCallsFound) {
                  controller.enqueue({
                    ...chunk,
                    finishReason: 'tool-calls'
                  });
                } else {
                  controller.enqueue(chunk);
                }
                break;
              }

              default: {
                // Pass through other chunks unchanged
                controller.enqueue(chunk);
                break;
              }
            }
          }
        });

        return {
          stream: stream.pipeThrough(transformStream),
          ...rest,
        };
      } catch (error) {
        // Re-throw the error to let the retry mechanism handle it
        logger.error("Error in wrapStream middleware", error);
        throw error;
      }
    }
  };
}