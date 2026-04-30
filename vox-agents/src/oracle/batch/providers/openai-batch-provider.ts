/**
 * @module oracle/batch/providers/openai-batch-provider
 *
 * OpenAI Batch API provider.
 * Handles the full lifecycle: Vercel params → OpenAI JSONL → file upload →
 * batch creation → status polling → result download and parsing.
 */

import fs from 'node:fs';
import path from 'node:path';
import OpenAI from 'openai';
import type { ModelMessage, ToolSet } from 'ai';
import { createLogger } from '../../../utils/logger.js';
import type { Model } from '../../../types/index.js';
import type {
  ChatCompletion,
  ChatCompletionRequest,
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from '../types.js';
import { BatchProvider } from './batch-provider.js';
import type {
  BatchSubmitItem,
  BatchCreateResult,
  BatchStatusResult,
  BatchResultItem,
} from './batch-provider.js';

const logger = createLogger('OpenAiBatchProvider');

/**
 * Batch provider for OpenAI and OpenAI-compatible endpoints.
 * Converts Vercel AI SDK params to OpenAI chat completion format,
 * writes JSONL, uploads via the Files API, and creates batches.
 */
export class OpenAiBatchProvider extends BatchProvider {
  private client: OpenAI;
  private stateDir: string;
  /** Stores outputFileId from last getBatchStatus for getResults */
  private outputFileIds = new Map<string, string>();

  constructor(apiKey: string, baseURL: string, stateDir: string) {
    super();
    this.client = new OpenAI({ apiKey, baseURL });
    this.stateDir = stateDir;
  }

  async submitBatch(items: BatchSubmitItem[]): Promise<BatchCreateResult> {
    // Convert Vercel params to OpenAI JSONL lines
    const jsonlLines = items.map(item => {
      const request = convertToOpenAIRequest(item.params, item.modelConfig);
      return JSON.stringify({
        custom_id: item.customId,
        method: 'POST',
        url: '/v1/chat/completions',
        body: request,
      });
    });

    // Write temp JSONL file
    const jsonlPath = path.join(this.stateDir, `requests-${Date.now()}.jsonl`);
    fs.writeFileSync(jsonlPath, jsonlLines.join('\n'), 'utf-8');

    try {
      // Upload
      const file = await this.client.files.create({
        file: fs.createReadStream(jsonlPath),
        purpose: 'batch',
      });
      logger.info(`Uploaded JSONL file: ${file.id}`);

      // Create batch
      const batch = await this.client.batches.create({
        input_file_id: file.id,
        endpoint: '/v1/chat/completions',
        completion_window: '24h',
      });
      logger.info(`Created batch: ${batch.id} (status: ${batch.status})`);

      return { id: batch.id, status: batch.status };
    } finally {
      try { fs.unlinkSync(jsonlPath); } catch { /* ignore cleanup errors */ }
    }
  }

  async getBatchStatus(batchId: string): Promise<BatchStatusResult> {
    const batch = await this.client.batches.retrieve(batchId);

    // Store output file ID for getResults
    if (batch.output_file_id) {
      this.outputFileIds.set(batchId, batch.output_file_id);
    }

    return {
      id: batch.id,
      status: batch.status,
      completedAt: batch.completed_at
        ? new Date(batch.completed_at * 1000).toISOString()
        : undefined,
      requestCounts: batch.request_counts
        ? {
            total: batch.request_counts.total,
            completed: batch.request_counts.completed,
            failed: batch.request_counts.failed,
          }
        : undefined,
    };
  }

  async getResults(batchId: string): Promise<BatchResultItem[]> {
    const outputFileId = this.outputFileIds.get(batchId);
    if (!outputFileId) {
      throw new Error(`No output file ID found for batch ${batchId}`);
    }

    const response = await this.client.files.content(outputFileId);
    const content = await response.text();
    const lines = content.split('\n').filter(line => line.trim());

    return lines.map(line => {
      const parsed = JSON.parse(line) as {
        id: string;
        custom_id: string;
        response: { status_code: number; body: ChatCompletion } | null;
        error: { code: string; message: string } | null;
      };

      if (parsed.response && parsed.response.status_code === 200) {
        return {
          customId: parsed.custom_id,
          response: parsed.response.body,
          error: null,
        };
      }
      return {
        customId: parsed.custom_id,
        response: null,
        error: parsed.error ?? {
          code: String(parsed.response?.status_code ?? 'unknown'),
          message: `HTTP ${parsed.response?.status_code ?? 'unknown'}`,
        },
      };
    });
  }
}

// ── Vercel → OpenAI Format Conversion ──
// Moved from format-converter.ts to keep provider-specific logic together.

/**
 * Convert streamText params into an OpenAI chat completion request.
 */
function convertToOpenAIRequest(
  params: Record<string, any>,
  modelConfig: Model
): ChatCompletionRequest {
  const messages = convertMessages(params.messages ?? []);
  const tools = convertTools(params.tools, params.activeTools);

  const request: ChatCompletionRequest = {
    model: modelConfig.name,
    messages,
  };

  if (tools.length > 0) {
    request.tools = tools;
  }

  // Convert tool_choice
  if (params.toolChoice && tools.length > 0) {
    if (typeof params.toolChoice === 'string') {
      request.tool_choice = params.toolChoice as any;
    } else if (params.toolChoice?.type === 'tool') {
      request.tool_choice = {
        type: 'function',
        function: { name: params.toolChoice.toolName },
      };
    }
  }

  if (modelConfig.options?.reasoningEffort) {
    (request as any).reasoning_effort = modelConfig.options.reasoningEffort;
  }

  return request;
}

/**
 * Convert Vercel AI SDK ModelMessages to OpenAI ChatCompletionMessageParams.
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
        for (const part of msg.content) {
          if (part.type === 'tool-result') {
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

function flattenUserContent(content: any[]): string {
  return content
    .filter(part => part.type === 'text')
    .map(part => part.text)
    .join('');
}

function convertAssistantMessage(msg: ModelMessage & { role: 'assistant' }): ChatCompletionMessageParam {
  if (typeof msg.content === 'string') {
    return { role: 'assistant', content: msg.content };
  }

  const textParts: string[] = [];
  const toolCalls: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }> = [];

  for (const part of msg.content) {
    if (part.type === 'text') {
      textParts.push(part.text);
    } else if (part.type === 'tool-call') {
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

function convertTools(
  tools: ToolSet | undefined,
  activeTools: string[] | undefined
): ChatCompletionTool[] {
  if (!tools || !activeTools || activeTools.length === 0) return [];

  const result: ChatCompletionTool[] = [];

  for (const name of activeTools) {
    const tool = tools[name];
    if (!tool) continue;

    const toolDef = tool as any;
    const description = toolDef.description ?? `Tool: ${name}`;

    let parameters: Record<string, unknown> = {};
    if (toolDef.parameters) {
      parameters = toolDef.parameters.jsonSchema ?? toolDef.parameters ?? {};
    }

    result.push({
      type: 'function',
      function: { name, description, parameters },
    });
  }

  return result;
}
