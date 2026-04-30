/**
 * @module oracle/batch/providers/google-format-converter
 *
 * Converts directly between Vercel AI SDK format and Google GenAI types
 * for the native Google batch API. Also converts Google responses back
 * to OpenAI ChatCompletion format for DB caching and convertToStepResult().
 */

import type { ModelMessage, ToolSet } from 'ai';
import type { InlinedRequest, InlinedResponse, Content, Part, GenerateContentConfig, FunctionCallingConfigMode } from '@google/genai';
import type { Model } from '../../../types/index.js';
import type { ChatCompletion } from '../types.js';
import type { BatchResultItem } from './batch-provider.js';

// ── Vercel → Google Conversion ──

/**
 * Convert Vercel AI SDK streamText params to a Google InlinedRequest.
 * Handles messages, tools, toolChoice, and model config directly —
 * no intermediate OpenAI format.
 */
export function toInlinedRequest(
  params: Record<string, any>,
  modelConfig: Model
): InlinedRequest {
  const messages: ModelMessage[] = params.messages ?? [];
  const { contents, systemInstruction } = convertMessages(messages);
  const config: GenerateContentConfig = {};

  if (systemInstruction) {
    config.systemInstruction = systemInstruction;
  }

  // Convert tools
  const tools = convertTools(params.tools, params.activeTools);
  if (tools.length > 0) {
    config.tools = [{ functionDeclarations: tools }];
  }

  // Convert tool_choice
  if (params.toolChoice && tools.length > 0) {
    config.toolConfig = convertToolChoice(params.toolChoice);
  }

  // Map generation parameters
  if (params.temperature !== undefined) {
    config.temperature = params.temperature;
  }
  if (params.topP !== undefined) {
    config.topP = params.topP;
  }
  if (params.maxTokens !== undefined) {
    config.maxOutputTokens = params.maxTokens;
  }

  // Map reasoning effort to thinking budget
  if (modelConfig.options?.reasoningEffort) {
    config.thinkingConfig = {
      thinkingBudget: reasoningEffortToBudget(modelConfig.options.reasoningEffort),
    };
  }

  return {
    model: modelConfig.name,
    contents,
    config: Object.keys(config).length > 0 ? config : undefined,
  };
}

/**
 * Convert Vercel ModelMessage[] to Google Content[] and optional systemInstruction.
 * System messages are extracted as systemInstruction; all others become Content entries.
 */
function convertMessages(messages: ModelMessage[]): {
  contents: Content[];
  systemInstruction?: Content;
} {
  const contents: Content[] = [];
  const systemParts: Part[] = [];

  for (const msg of messages) {
    switch (msg.role) {
      case 'system':
        // Accumulate all system messages into one systemInstruction
        systemParts.push({ text: msg.content });
        break;

      case 'user':
        contents.push({
          role: 'user',
          parts: typeof msg.content === 'string'
            ? [{ text: msg.content }]
            : flattenUserParts(msg.content),
        });
        break;

      case 'assistant':
        contents.push(convertAssistantMessage(msg));
        break;

      case 'tool':
        // Vercel tool messages have an array of tool results.
        // Each tool-result becomes a functionResponse part.
        for (const part of msg.content) {
          if (part.type === 'tool-result') {
            const output = (part as any).output;
            contents.push({
              role: 'user',
              parts: [{
                functionResponse: {
                  id: part.toolCallId,
                  name: part.toolName,
                  response: typeof output === 'string'
                    ? { output }
                    : (output as Record<string, unknown>),
                },
              }],
            });
          }
        }
        break;
    }
  }

  return {
    contents,
    systemInstruction: systemParts.length > 0
      ? { parts: systemParts }
      : undefined,
  };
}

/**
 * Flatten Vercel user content parts to Google Part[].
 * Extracts text parts only (batch API doesn't support multimodal).
 */
function flattenUserParts(content: any[]): Part[] {
  return content
    .filter(part => part.type === 'text')
    .map(part => ({ text: part.text }));
}

/**
 * Convert a Vercel assistant message to a Google Content with role 'model'.
 */
function convertAssistantMessage(msg: ModelMessage & { role: 'assistant' }): Content {
  if (typeof msg.content === 'string') {
    return { role: 'model', parts: [{ text: msg.content }] };
  }

  const parts: Part[] = [];
  for (const part of msg.content) {
    if (part.type === 'text') {
      parts.push({ text: part.text });
    } else if (part.type === 'tool-call') {
      const input = (part as any).input;
      parts.push({
        functionCall: {
          id: part.toolCallId,
          name: part.toolName,
          args: typeof input === 'string' ? JSON.parse(input) : input,
        },
      });
    }
    // Skip reasoning, file, and tool-result parts
  }

  return { role: 'model', parts };
}

/**
 * Convert Vercel tool definitions to Google FunctionDeclaration[].
 * Only includes tools listed in activeTools.
 */
function convertTools(
  tools: ToolSet | undefined,
  activeTools: string[] | undefined
): Array<{ name: string; description: string; parameters?: Record<string, unknown> }> {
  if (!tools || !activeTools || activeTools.length === 0) return [];

  const result: Array<{ name: string; description: string; parameters?: Record<string, unknown> }> = [];

  for (const name of activeTools) {
    const tool = tools[name];
    if (!tool) continue;

    const toolDef = tool as any;
    const description = toolDef.description ?? `Tool: ${name}`;

    let parameters: Record<string, unknown> | undefined;
    if (toolDef.parameters) {
      parameters = toolDef.parameters.jsonSchema ?? toolDef.parameters;
    }

    result.push({
      name,
      description,
      ...(parameters ? { parametersJsonSchema: parameters } : {}),
    });
  }

  return result;
}

/**
 * Convert Vercel toolChoice to Google ToolConfig.
 */
function convertToolChoice(toolChoice: any): { functionCallingConfig: { mode: FunctionCallingConfigMode; allowedFunctionNames?: string[] } } {
  if (typeof toolChoice === 'string') {
    const modeMap: Record<string, FunctionCallingConfigMode> = {
      auto: 'AUTO' as FunctionCallingConfigMode,
      none: 'NONE' as FunctionCallingConfigMode,
      required: 'ANY' as FunctionCallingConfigMode,
    };
    return {
      functionCallingConfig: { mode: modeMap[toolChoice] ?? 'AUTO' as FunctionCallingConfigMode },
    };
  }

  if (toolChoice?.type === 'tool') {
    return {
      functionCallingConfig: {
        mode: 'ANY' as FunctionCallingConfigMode,
        allowedFunctionNames: [toolChoice.toolName],
      },
    };
  }

  return {
    functionCallingConfig: { mode: 'AUTO' as FunctionCallingConfigMode },
  };
}

/**
 * Map Vercel/OpenAI reasoning effort to Google thinking budget tokens.
 */
function reasoningEffortToBudget(effort: string): number {
  switch (effort) {
    case 'minimal': return 256;
    case 'low': return 1024;
    case 'medium': return 4096;
    case 'high': return 16384;
    default: return -1; // automatic
  }
}

// ── Google → ChatCompletion Conversion ──

/**
 * Convert a Google InlinedResponse to a BatchResultItem containing
 * an OpenAI ChatCompletion (for DB caching and convertToStepResult).
 */
export function toResultItem(resp: InlinedResponse, customId: string): BatchResultItem {
  if (resp.error) {
    return {
      customId,
      response: null,
      error: {
        code: String(resp.error.code ?? 'unknown'),
        message: resp.error.message ?? 'Unknown error',
      },
    };
  }

  const genResponse = resp.response;
  if (!genResponse) {
    return {
      customId,
      response: null,
      error: { code: 'no_response', message: 'No response in batch result' },
    };
  }

  const candidate = genResponse.candidates?.[0];
  const parts = candidate?.content?.parts ?? [];

  // Extract text and function calls from parts
  const textParts: string[] = [];
  const toolCalls: ChatCompletion['choices'][0]['message']['tool_calls'] = [];

  for (const part of parts) {
    if (part.text) {
      textParts.push(part.text);
    } else if (part.functionCall) {
      toolCalls.push({
        id: part.functionCall.id ?? `call_${toolCalls.length}`,
        type: 'function' as const,
        function: {
          name: part.functionCall.name!,
          arguments: JSON.stringify(part.functionCall.args ?? {}),
        },
      });
    }
  }

  const content = textParts.join('') || null;
  const usage = genResponse.usageMetadata;

  const completion: ChatCompletion = {
    id: `gen-${customId}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: genResponse.modelVersion ?? 'unknown',
    choices: [{
      index: 0,
      message: {
        role: 'assistant' as const,
        content,
        ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
        refusal: null,
      },
      finish_reason: mapFinishReason(candidate?.finishReason),
      logprobs: null,
    }],
    usage: {
      prompt_tokens: usage?.promptTokenCount ?? 0,
      completion_tokens: usage?.candidatesTokenCount ?? 0,
      total_tokens: (usage?.promptTokenCount ?? 0) + (usage?.candidatesTokenCount ?? 0),
    },
  };

  return { customId, response: completion, error: null };
}

/**
 * Map Google FinishReason to OpenAI finish_reason.
 */
function mapFinishReason(reason: string | undefined): 'stop' | 'length' | 'tool_calls' | 'content_filter' {
  switch (reason) {
    case 'STOP': return 'stop';
    case 'MAX_TOKENS': return 'length';
    case 'SAFETY':
    case 'RECITATION':
    case 'BLOCKLIST':
    case 'PROHIBITED_CONTENT':
    case 'SPII': return 'content_filter';
    default: return 'stop';
  }
}
