/**
 * @module telepathist/telepathist-tool
 *
 * Abstract base class for Telepathist tools.
 * Wraps createSimpleTool with shared database query helpers for traversing
 * the span hierarchy: turns -> agent spans -> step spans -> tool call spans.
 */

import { Tool as VercelTool } from 'ai';
import { Tool as MCPTool } from '@modelcontextprotocol/sdk/types.js';
import { z, ZodType } from 'zod';
import { Kysely } from 'kysely';
import { TelepathistParameters } from './telepathist-parameters.js';
import { createSimpleTool } from '../utils/tools/simple-tools.js';
import { jsonToMarkdown, HeadingConfig } from '../utils/tools/json-to-markdown.js';
import { VoxContext } from '../infra/vox-context.js';
import { buildToolSummaryInstruction } from './summarizer.js';
import { createLogger } from '../utils/logger.js';
import type { TelemetryDatabase, Span, SpanAttributes } from '../utils/telemetry/schema.js';
import type { SummarizerInput } from './summarizer.js';

const logger = createLogger('TelepathistTool');

/** Minimum result length (in characters) before summarization kicks in */
const summarizeThreshold = 2000;

/**
 * Reusable Zod field for the inquiry parameter.
 * Tools that enable summarization should spread this into their inputSchema.
 */
export const inquiryField = {
  inquiry: z.string().optional().describe(
    'What you want to learn from this data. Guides the summary to focus on relevant information.'
  )
};

/**
 * Abstract base class that wraps createSimpleTool with shared database query patterns.
 * Each concrete tool extends this, inheriting DB query helpers and getting
 * automatic simple-tool.{name} telemetry spans.
 */
export abstract class TelepathistTool<TInput = any> {
  /** Tool name used for registration and telemetry */
  abstract readonly name: string;
  /** Human-readable description for the LLM */
  abstract readonly description: string;
  /** Zod schema defining the tool's input */
  abstract readonly inputSchema: ZodType<TInput>;

  /** Whether this tool's results should be summarized via the Summarizer agent. Tools opt in explicitly. */
  protected summarize: boolean = false;

  /** Reference to MCP tool definitions for dynamic markdownConfig lookup */
  protected mcpToolMap?: Map<string, MCPTool>;

  /**
   * Create the AI SDK tool. Captures mcpToolMap from context for dynamic
   * markdownConfig access, then delegates to createSimpleTool for telemetry tracing.
   * When summarize is true, wraps execute to route long results through the Summarizer agent.
   */
  createTool(context: VoxContext<TelepathistParameters>): VercelTool {
    this.mcpToolMap = context.mcpToolMap;
    return createSimpleTool({
      name: this.name,
      description: this.description,
      inputSchema: this.inputSchema,
      execute: async (input, params) => {
        const rawResult = await this.execute(input, params);

        if (!this.summarize || rawResult.length < summarizeThreshold) {
          return rawResult;
        }

        const inquiry = (input as any)?.inquiry as string | undefined;
        const instruction = buildToolSummaryInstruction(this.name, inquiry);
        const summarizerInput: SummarizerInput = { text: rawResult, instruction };

        logger.info(`Summarizing ${this.name} result (${rawResult.length} chars)`, { inquiry });
        const summary = await context.callAgent<string>('summarizer', summarizerInput, params);
        return summary ?? rawResult;
      }
    }, context);
  }

  /** Execute the tool with the given input and parameters */
  abstract execute(input: TInput, params: TelepathistParameters): Promise<string>;

  // --- Shared query helpers ---

  /**
   * Parse flexible turn input into number[].
   * Supports single turn ("30"), comma-separated ("10,20,30"), or range ("30-50").
   */
  protected parseTurns(turns: string, available: number[], maxLength = 10): number[] {
    const trimmed = turns.trim();
    let result: number[] = [];

    // Range format: "30-50"
    if (trimmed.includes('-') && !trimmed.includes(',')) {
      const [startStr, endStr] = trimmed.split('-');
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);
      if (!isNaN(start) && !isNaN(end)) {
        result = available.filter(t => t >= start && t <= end);
      }
    }
    // Comma-separated: "10,20,30"
    else if (trimmed.includes(',')) {
      const requested = trimmed.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
      result = available.filter(t => requested.includes(t));
    }
    // Single turn: "30"
    else {
      const single = parseInt(trimmed, 10);
      if (!isNaN(single)) {
        result = available.filter(t => t === single);
      }
    }

    // Trim down to maxLength
    if (result.length > maxLength) result = result.slice(0, maxLength);
    return result;
  }

  /**
   * Get root agent spans for given turns, grouped by agent type.
   * Handles botched turns: for each turn, finds the LAST strategist root span
   * (highest startTime) and uses its traceId to filter in-trace agents.
   * Also discovers fire-and-forget agents by turn + name pattern.
   *
   * @returns Record<agentType, Span[]> - keys are agent names, values are spans across turns
   */
  protected async getRootSpans(
    db: Kysely<TelemetryDatabase>,
    turns: number[]
  ): Promise<Record<string, Span[]>> {
    if (turns.length === 0) return {};

    const result: Record<string, Span[]> = {};

    for (const turn of turns) {
      // Find all root spans for this turn (parentSpanId is null)
      const rootSpans = await db
        .selectFrom('spans')
        .selectAll()
        .where('turn', '=', turn)
        .where('parentSpanId', 'is', null)
        .orderBy('startTime', 'asc')
        .execute();

      // Find the last strategist root span (highest startTime) — earlier ones are botched
      const strategistRoots = rootSpans.filter(s => s.name.startsWith('simple-strategist'));
      const validRoot = strategistRoots.length > 0
        ? strategistRoots[strategistRoots.length - 1]
        : null;

      if (validRoot) {
        // Add the strategist itself
        const agentName = validRoot.name.split('.')[0];
        if (!result[agentName]) result[agentName] = [];
        result[agentName].push(validRoot);

        // Find all agent spans within this trace (child agent spans)
        const traceSpans = await db
          .selectFrom('spans')
          .selectAll()
          .where('traceId', '=', validRoot.traceId)
          .where('parentSpanId', 'is not', null)
          .execute();

        // Agent spans follow the pattern: {agentName}.turn.{turn}
        const agentPattern = /^([^.]+)\.turn\.\d+$/;
        for (const span of traceSpans) {
          const match = span.name.match(agentPattern);
          if (match) {
            const name = match[1];
            if (!result[name]) result[name] = [];
            result[name].push(span);
          }
        }
      }

      // Find fire-and-forget agents (separate traceIds, same turn)
      // These are root spans that aren't strategists
      const detachedRoots = rootSpans.filter(s =>
        !s.name.startsWith('simple-strategist') &&
        s.name.match(/^[^.]+\.turn\.\d+$/)
      );
      for (const span of detachedRoots) {
        const agentName = span.name.split('.')[0];
        if (!result[agentName]) result[agentName] = [];
        result[agentName].push(span);
      }
    }

    return result;
  }

  /**
   * Get step spans for a specific agent type across the given turns.
   * Steps follow the pattern: {agentName}.turn.{turn}.step.{N}
   */
  protected async getAgentSteps(
    db: Kysely<TelemetryDatabase>,
    turns: number[],
    agentType: string
  ): Promise<Span[]> {
    if (turns.length === 0) return [];

    const rootSpans = await this.getRootSpans(db, turns);
    const agentSpans = rootSpans[agentType] || [];
    if (agentSpans.length === 0) return [];

    const parentSpanIds = agentSpans.map(s => s.spanId);
    return db
      .selectFrom('spans')
      .selectAll()
      .where('parentSpanId', 'in', parentSpanIds)
      .orderBy('startTime', 'asc')
      .execute();
  }

  /**
   * Get MCP tool call spans from step spans.
   * Avoids re-filtering by turn/traceId since steps already have the right scope.
   * Optional toolNames filter for specific tools.
   */
  protected async getToolCallSpans(
    db: Kysely<TelemetryDatabase>,
    stepSpans: Span[],
    toolNames?: string[]
  ): Promise<Span[]> {
    if (stepSpans.length === 0) return [];

    const parentIds = stepSpans.map(s => s.spanId);
    let query = db
      .selectFrom('spans')
      .selectAll()
      .where('parentSpanId', 'in', parentIds)
      .where('name', 'like', 'mcp-tool.%')
      .orderBy('startTime', 'asc');

    if (toolNames && toolNames.length > 0) {
      const prefixedNames = toolNames.map(n => `mcp-tool.${n}`);
      query = query.where('name', 'in', prefixedNames);
    }

    return query.execute();
  }

  /**
   * Extract tool.input from a tool call span (parsed JSON from attributes)
   */
  protected getToolInput(span: Span): any {
    const attrs = this.parseAttributes(span);
    if (!attrs['tool.input']) return undefined;
    try {
      return typeof attrs['tool.input'] === 'string'
        ? JSON.parse(attrs['tool.input'])
        : attrs['tool.input'];
    } catch {
      return attrs['tool.input'];
    }
  }

  /**
   * Extract tool.output from a tool call span (parsed JSON from attributes)
   */
  protected getToolOutput(span: Span): any {
    const attrs = this.parseAttributes(span);
    if (!attrs['tool.output']) return undefined;
    try {
      return typeof attrs['tool.output'] === 'string'
        ? JSON.parse(attrs['tool.output'])
        : attrs['tool.output'];
    } catch {
      return attrs['tool.output'];
    }
  }

  /**
   * Format a tool output using jsonToMarkdown with dynamically looked-up markdownConfig.
   * Reads markdownConfig from mcpToolMap via tool._meta?.markdownConfig.
   */
  protected formatToolOutput(toolName: string, output: any): string {
    if (!output || typeof output !== 'object') return String(output ?? '');

    const mcpTool = this.mcpToolMap?.get(toolName);
    const config = (mcpTool?._meta as any)?.markdownConfig;

    if (Array.isArray(config)) {
      return jsonToMarkdown(output, {
        configs: config.map(level => ({ format: level } as HeadingConfig))
      });
    }

    return jsonToMarkdown(output);
  }

  /**
   * Safely parse JSON attributes from a span
   */
  protected parseAttributes(span: Span): SpanAttributes {
    if (!span.attributes) return {};
    try {
      return typeof span.attributes === 'string'
        ? JSON.parse(span.attributes)
        : span.attributes as SpanAttributes;
    } catch {
      return {};
    }
  }
}
