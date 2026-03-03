/**
 * @module oracle/prompt-extractor
 *
 * Extracts original prompts from telemetry databases.
 * Traverses the span hierarchy (root → agent → step) to recover
 * system prompts, messages, tools, responses, and model information.
 */

import type { Kysely } from 'kysely';
import type { ModelMessage } from 'ai';
import { createLogger } from '../utils/logger.js';
import { cleanToolArtifacts } from '../utils/text-cleaning.js';
import type { TelemetryDatabase, Span, SpanAttributes } from '../utils/telemetry/schema.js';
import type { ExtractedPrompt } from './types.js';

const logger = createLogger('OraclePromptExtractor');

/**
 * Parse JSON attributes from a span record.
 */
function parseAttributes(span: Span): SpanAttributes {
  if (!span.attributes) return {};
  try {
    return typeof span.attributes === 'string'
      ? JSON.parse(span.attributes)
      : span.attributes as SpanAttributes;
  } catch {
    return {};
  }
}

/**
 * Extract the original prompt data for a specific turn from a telemetry database.
 * Traverses: root span (strategist.turn.{N}) → agent span (agent.{name}) → step span
 *
 * @param db - Kysely instance for the telemetry database (read-only)
 * @param turn - The turn number to extract
 * @param targetAgent - Optional specific agent name to target. If not provided, auto-detects strategist.
 * @returns Extracted prompt data, or null if the turn/agent is not found
 */
export async function extractPrompt(
  db: Kysely<TelemetryDatabase>,
  turn: number,
  targetAgent?: string
): Promise<ExtractedPrompt | null> {
  // Find root spans for this turn
  const rootSpans = await db
    .selectFrom('spans')
    .selectAll()
    .where('turn', '=', turn)
    .where('parentSpanId', 'is', null)
    .orderBy('startTime', 'asc')
    .execute();

  if (rootSpans.length === 0) {
    logger.warn(`No root spans found for turn ${turn}`);
    return null;
  }

  // Use the last valid root span (earlier ones are botched retries)
  const turnRootPattern = /^strategist\.turn\.\d+$/;
  const turnRoots = rootSpans.filter(s => turnRootPattern.test(s.name));
  const validRoot = turnRoots.length > 0 ? turnRoots[turnRoots.length - 1] : null;

  if (!validRoot) {
    logger.warn(`No strategist.turn root span found for turn ${turn}`);
    return null;
  }

  // Find agent spans within this trace
  const agentPattern = /^agent\.([a-z][-a-z]*)$/;
  const traceSpans = await db
    .selectFrom('spans')
    .selectAll()
    .where('traceId', '=', validRoot.traceId)
    .where('parentSpanId', 'is not', null)
    .orderBy('startTime', 'asc')
    .execute();

  // Group agent spans by name
  const agentSpans = new Map<string, Span[]>();
  for (const span of traceSpans) {
    const match = span.name.match(agentPattern);
    if (match) {
      const name = match[1];
      if (!agentSpans.has(name)) agentSpans.set(name, []);
      agentSpans.get(name)!.push(span);
    }
  }

  // Select the target agent
  let agentName: string;
  let selectedAgentSpans: Span[];

  if (targetAgent) {
    if (!agentSpans.has(targetAgent)) {
      const available = Array.from(agentSpans.keys()).join(', ');
      logger.warn(`Agent "${targetAgent}" not found for turn ${turn}. Available: ${available}`);
      return null;
    }
    agentName = targetAgent;
    selectedAgentSpans = agentSpans.get(targetAgent)!;
  } else {
    // Auto-detect: prefer strategist agents
    const strategistKey = Array.from(agentSpans.keys()).find(name =>
      name.includes('strategist')
    );
    if (strategistKey) {
      agentName = strategistKey;
      selectedAgentSpans = agentSpans.get(strategistKey)!;
    } else if (agentSpans.size > 0) {
      // Fall back to first agent
      const [firstKey, firstSpans] = agentSpans.entries().next().value!;
      agentName = firstKey;
      selectedAgentSpans = firstSpans;
    } else {
      logger.warn(`No agent spans found for turn ${turn}`);
      return null;
    }
  }

  // Get the agent's model from its span attributes
  const agentAttrs = parseAttributes(selectedAgentSpans[0]);
  const modelString = agentAttrs['model'] as string || '';

  // Find step spans (children of agent spans)
  const agentSpanIds = selectedAgentSpans.map(s => s.spanId);
  const stepSpans = await db
    .selectFrom('spans')
    .selectAll()
    .where('parentSpanId', 'in', agentSpanIds)
    .orderBy('startTime', 'asc')
    .execute();

  if (stepSpans.length === 0) {
    logger.warn(`No step spans found for agent ${agentName} at turn ${turn}`);
    return null;
  }

  // Extract from the first step span (we only replay the initial prompt)
  const firstStep = stepSpans[0];
  const stepAttrs = parseAttributes(firstStep);

  // Parse messages
  const rawMessages = parseJson(stepAttrs['step.messages']);
  if (!Array.isArray(rawMessages) || rawMessages.length === 0) {
    logger.warn(`No messages found in first step for agent ${agentName} at turn ${turn}`);
    return null;
  }

  // Split system prompt from conversation messages
  let system = '';
  const messages: ModelMessage[] = [];

  for (const msg of rawMessages) {
    if (msg.role === 'system') {
      // Concatenate system messages (usually just one)
      system += (system ? '\n' : '') + extractTextContent(msg.content);
    } else {
      messages.push(msg as ModelMessage);
    }
  }

  // Parse tools
  const rawTools = parseJson(stepAttrs['step.tools']);
  const activeTools: string[] = Array.isArray(rawTools) ? rawTools : [];

  // Parse responses
  const rawResponses = parseJson(stepAttrs['step.responses']);
  const originalResponse = extractResponse(rawResponses);

  // Use model from step span if not on agent span
  const stepModel = stepAttrs['model'] as string || '';
  const finalModelString = modelString || stepModel;

  return {
    system,
    messages,
    activeTools,
    modelString: finalModelString,
    originalResponse,
    agentName,
  };
}

/** Safely parse JSON, returning the value as-is if already parsed */
function parseJson(value: any): any {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}

/** Extract text content from a message content field */
function extractTextContent(content: any): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter(part => part.type === 'text')
      .map(part => part.text)
      .join('\n');
  }
  return '';
}

/** Extract response text and tool calls from response messages */
function extractResponse(responses: any): { text: string; toolCalls: { toolName: string; args: any }[] } {
  const result = { text: '', toolCalls: [] as { toolName: string; args: any }[] };

  if (!Array.isArray(responses)) return result;

  for (const msg of responses) {
    if (msg.role !== 'assistant') continue;

    if (typeof msg.content === 'string') {
      result.text += cleanToolArtifacts(msg.content);
    } else if (Array.isArray(msg.content)) {
      for (const part of msg.content) {
        if (part.type === 'text') {
          result.text += cleanToolArtifacts(part.text || '');
        } else if (part.type === 'tool-call') {
          result.toolCalls.push({
            toolName: part.toolName,
            args: part.args,
          });
        }
      }
    }
  }

  return result;
}
