/**
 * @module oracle/batch/format-converter
 *
 * Converts between Vercel AI SDK message/tool formats and the official
 * OpenAI package types used by the batch manager.
 *
 * Two main conversions:
 * 1. streamText params → OpenAI ChatCompletionCreateParams (for batch request)
 * 2. OpenAI ChatCompletion → streamTextWithConcurrency return shape (for VoxContext)
 *
 * Reuses computeFinalSchema() from oracle/utils/schema-tools.ts for tool definitions.
 */

import type { ModelMessage, ToolSet } from 'ai';
import type { Model } from '../../types/index.js';
import type { ChatCompletionRequest, ChatCompletion, ChatCompletionMessageParam, ChatCompletionTool } from './types.js';

// ── Vercel → OpenAI Conversion ──

/**
 * Convert streamTextWithConcurrency params into an OpenAI chat completion request.
 * Extracts messages, tools, tool_choice, and model-specific options from the
 * Vercel AI SDK param shape.
 *
 * @param params - The params object passed to streamTextWithConcurrency (with __modelConfig)
 * @param modelConfig - The Model configuration (provider, name, options)
 * @returns An OpenAI chat completion request body ready for JSONL serialization
 */
export function convertToOpenAIRequest(
  params: Record<string, any>,
  modelConfig: Model
): ChatCompletionRequest {
  const messages = convertMessages(params.messages ?? []);
  const tools = convertTools(params.tools, params.activeTools);

  const request: ChatCompletionRequest = {
    model: modelConfig.name,
    messages,
  };

  // Add tools if any are active
  if (tools.length > 0) {
    request.tools = tools;
  }

  // Convert tool_choice
  if (params.toolChoice && tools.length > 0) {
    if (typeof params.toolChoice === 'string') {
      // "auto", "none", "required"
      request.tool_choice = params.toolChoice as any;
    } else if (params.toolChoice?.type === 'tool') {
      // Specific tool selection
      request.tool_choice = {
        type: 'function',
        function: { name: params.toolChoice.toolName },
      };
    }
  }

  // Map reasoning effort if configured
  if (modelConfig.options?.reasoningEffort) {
    (request as any).reasoning_effort = modelConfig.options.reasoningEffort;
  }

  return request;
}

/**
 * Convert an array of Vercel AI SDK ModelMessages to OpenAI ChatCompletionMessageParams.
 * Handles all message roles: system, user, assistant, tool.
 *
 * @param messages - Vercel AI SDK ModelMessage array
 * @returns Array of OpenAI chat completion message params
 */
function convertMessages(messages: ModelMessage[]): ChatCompletionMessageParam[] {
  const result: ChatCompletionMessageParam[] = [];

  for (const msg of messages) {
    switch (msg.role) {
      case 'system':
        result.push({ role: 'system', content: msg.content });
        break;

      case 'user':
        result.push({
          role: 'user',
          content: typeof msg.content === 'string'
            ? msg.content
            : flattenUserContent(msg.content),
        });
        break;

      case 'assistant':
        result.push(convertAssistantMessage(msg));
        break;

      case 'tool':
        // Vercel tool messages have an array of tool results;
        // OpenAI expects one message per tool result
        for (const part of msg.content) {
          if (part.type === 'tool-result') {
            // ToolResultPart uses `output` for the result value
            const output = (part as any).output;
            result.push({
              role: 'tool',
              tool_call_id: part.toolCallId,
              content: typeof output === 'string'
                ? output
                : JSON.stringify(output),
            });
          }
        }
        break;
    }
  }

  return result;
}

/**
 * Flatten Vercel user content parts into a plain string.
 * Extracts text from TextPart arrays, ignoring image/file parts
 * (batch API doesn't support multimodal input).
 *
 * @param content - Array of content parts (TextPart, ImagePart, FilePart)
 * @returns Concatenated text content
 */
function flattenUserContent(content: any[]): string {
  return content
    .filter(part => part.type === 'text')
    .map(part => part.text)
    .join('');
}

/**
 * Convert a Vercel assistant message to OpenAI format.
 * Handles both plain text responses and tool call responses.
 *
 * @param msg - Vercel AssistantModelMessage
 * @returns OpenAI assistant message param
 */
function convertAssistantMessage(msg: ModelMessage & { role: 'assistant' }): ChatCompletionMessageParam {
  if (typeof msg.content === 'string') {
    return { role: 'assistant', content: msg.content };
  }

  // Extract text parts and tool call parts from the content array
  const textParts: string[] = [];
  const toolCalls: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }> = [];

  for (const part of msg.content) {
    if (part.type === 'text') {
      textParts.push(part.text);
    } else if (part.type === 'tool-call') {
      // ToolCallPart uses `input` for arguments (not `args`)
      const input = (part as any).input;
      toolCalls.push({
        id: part.toolCallId,
        type: 'function' as const,
        function: {
          name: part.toolName,
          arguments: typeof input === 'string'
            ? input
            : JSON.stringify(input),
        },
      });
    }
    // Skip reasoning, file, and tool-result parts
  }

  const result: any = { role: 'assistant' as const };
  if (textParts.length > 0) {
    result.content = textParts.join('');
  }
  if (toolCalls.length > 0) {
    result.tool_calls = toolCalls;
  }

  return result;
}

/**
 * Convert Vercel AI SDK tool definitions to OpenAI ChatCompletionTool format.
 * Only includes tools that are in the activeTools list.
 *
 * @param tools - Vercel ToolSet (Record<string, Tool>)
 * @param activeTools - Array of tool names that should be included
 * @returns Array of OpenAI tool definitions
 */
function convertTools(
  tools: ToolSet | undefined,
  activeTools: string[] | undefined
): ChatCompletionTool[] {
  if (!tools || !activeTools || activeTools.length === 0) return [];

  const result: ChatCompletionTool[] = [];

  for (const name of activeTools) {
    const tool = tools[name];
    if (!tool) continue;

    // Extract description and parameters from the Vercel tool definition
    // Vercel tools have { description, parameters (jsonSchema) }
    const toolDef = tool as any;
    const description = toolDef.description ?? `Tool: ${name}`;

    // Get the JSON schema from the tool's parameters
    // Vercel tools wrap schemas in jsonSchema() which adds a .jsonSchema property
    let parameters: Record<string, unknown> = {};
    if (toolDef.parameters) {
      // The Vercel jsonSchema wrapper stores the raw schema at .jsonSchema
      parameters = toolDef.parameters.jsonSchema ?? toolDef.parameters ?? {};
    }

    result.push({
      type: 'function',
      function: { name, description, parameters },
    });
  }

  return result;
}

// ── OpenAI → Vercel Conversion ──

/**
 * Convert an OpenAI ChatCompletion response into the shape that
 * streamTextWithConcurrency returns. This allows VoxContext to consume
 * batch results identically to real-time streaming results.
 *
 * The returned object has a `steps` array with a single StepResult
 * containing text, toolCalls, usage, and response messages.
 *
 * @param response - OpenAI chat completion response
 * @returns Object matching streamTextWithConcurrency's return type
 */
export function convertToStepResult(response: ChatCompletion): {
  steps: any[];
} {
  const choice = response.choices[0];
  if (!choice) {
    return { steps: [createEmptyStep(response)] };
  }

  const message = choice.message;

  // Extract text content
  const text = message.content ?? '';

  // Convert OpenAI tool calls to Vercel ToolCallPart format.
  // tool_calls is a union of function and custom tool calls;
  // we only handle function calls (type === 'function').
  const toolCalls = (message.tool_calls ?? [])
    .filter((tc): tc is Extract<typeof tc, { type: 'function' }> => tc.type === 'function')
    .map(tc => ({
      type: 'tool-call' as const,
      toolCallId: tc.id,
      toolName: tc.function.name,
      args: safeParseJson(tc.function.arguments),
    }));

  // Build response messages in Vercel format
  const responseMessages: ModelMessage[] = [];

  // Build assistant message content parts
  const contentParts: any[] = [];
  if (text) {
    contentParts.push({ type: 'text', text });
  }
  for (const tc of toolCalls) {
    contentParts.push(tc);
  }

  responseMessages.push({
    role: 'assistant',
    content: contentParts.length > 0 ? contentParts : text,
  } as ModelMessage);

  // Build the StepResult-like object
  const step = {
    text,
    reasoning: [],
    reasoningText: undefined,
    files: [],
    sources: [],
    content: contentParts,
    toolCalls,
    staticToolCalls: [],
    dynamicToolCalls: [],
    toolResults: [],
    staticToolResults: [],
    dynamicToolResults: [],
    finishReason: mapFinishReason(choice.finish_reason),
    usage: {
      inputTokens: response.usage?.prompt_tokens ?? 0,
      outputTokens: response.usage?.completion_tokens ?? 0,
      reasoningTokens: response.usage?.completion_tokens_details?.reasoning_tokens ?? 0,
    },
    warnings: undefined,
    request: {},
    response: {
      messages: responseMessages,
    },
    providerMetadata: undefined,
  };

  return { steps: [step] };
}

/**
 * Create an empty step result for responses with no choices.
 *
 * @param response - The original response (for usage data)
 * @returns A minimal StepResult-like object
 */
function createEmptyStep(response: ChatCompletion): any {
  return {
    text: '',
    reasoning: [],
    reasoningText: undefined,
    files: [],
    sources: [],
    content: [],
    toolCalls: [],
    staticToolCalls: [],
    dynamicToolCalls: [],
    toolResults: [],
    staticToolResults: [],
    dynamicToolResults: [],
    finishReason: 'unknown',
    usage: {
      inputTokens: response.usage?.prompt_tokens ?? 0,
      outputTokens: response.usage?.completion_tokens ?? 0,
      reasoningTokens: 0,
    },
    warnings: undefined,
    request: {},
    response: { messages: [] },
    providerMetadata: undefined,
  };
}

/**
 * Map OpenAI finish_reason to Vercel AI SDK FinishReason.
 *
 * @param reason - OpenAI finish reason string
 * @returns Vercel-compatible finish reason
 */
function mapFinishReason(reason: string | null): string {
  switch (reason) {
    case 'stop': return 'stop';
    case 'length': return 'length';
    case 'tool_calls': return 'tool-calls';
    case 'content_filter': return 'content-filter';
    default: return 'unknown';
  }
}

/**
 * Safely parse a JSON string, returning the raw string on failure.
 *
 * @param str - JSON string to parse
 * @returns Parsed object or the original string
 */
function safeParseJson(str: string): any {
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
}
