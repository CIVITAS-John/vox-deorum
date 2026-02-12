/**
 * @module telepathist/tools/get-conversation-log
 *
 * Telepathist tool for deep-diving into the full LLM conversation for a turn.
 * Organized per agent: combines all steps into one coherent conversation showing
 * system prompt, messages, and responses as a continuous dialogue.
 */

import { z } from 'zod';
import { TelepathistTool } from '../telepathist-tool.js';
import { TelepathistParameters } from '../telepathist-parameters.js';
import type { Span } from '../../utils/telemetry/schema.js';

const inputSchema = z.object({
  turn: z.number().describe('The specific turn to retrieve conversation logs for.'),
  agent: z.string().optional().describe(
    'Optional: specific agent name to filter (e.g., "diplomat", "simple-strategist-staffed"). If omitted, shows all agents.'
  )
});

type GetConversationLogInput = z.infer<typeof inputSchema>;

/**
 * Returns the full LLM conversation for a turn, organized per agent.
 * Includes system prompts, messages, and responses as a continuous dialogue.
 */
export class GetConversationLogTool extends TelepathistTool<GetConversationLogInput> {
  readonly name = 'get-conversation-log';
  readonly description = 'Get the full LLM conversation log for a specific turn. Shows system prompts, messages exchanged, tool calls, and responses for each agent that ran during the turn.';
  readonly inputSchema = inputSchema;

  async execute(input: GetConversationLogInput, params: TelepathistParameters): Promise<string> {
    const turn = input.turn;
    if (!params.availableTurns.includes(turn)) {
      return `Turn ${turn} not found. Available turns: ${params.availableTurns[0]}-${params.availableTurns[params.availableTurns.length - 1]}`;
    }

    const rootSpans = await this.getRootSpans(params.db, [turn]);

    if (Object.keys(rootSpans).length === 0) {
      return `No agent executions found for turn ${turn}.`;
    }

    // Filter to specific agent if requested
    const agentEntries = input.agent
      ? Object.entries(rootSpans).filter(([name]) => name === input.agent)
      : Object.entries(rootSpans);

    if (agentEntries.length === 0) {
      const available = Object.keys(rootSpans).join(', ');
      return `Agent "${input.agent}" not found for turn ${turn}. Available agents: ${available}`;
    }

    const sections: string[] = [];

    for (const [agentName, agentSpans] of agentEntries) {
      sections.push(`# ${agentName} — Turn ${turn}`);

      // Get all steps for this agent
      const parentIds = agentSpans.map(s => s.spanId);
      const stepSpans = await params.db
        .selectFrom('spans')
        .selectAll()
        .where('parentSpanId', 'in', parentIds)
        .orderBy('startTime', 'asc')
        .execute();

      if (stepSpans.length === 0) {
        sections.push('*No conversation steps recorded.*');
        continue;
      }

      // For each step, extract the conversation messages and responses
      for (let i = 0; i < stepSpans.length; i++) {
        const step = stepSpans[i];
        const attrs = this.parseAttributes(step);

        // Step header
        sections.push(`## Step ${i + 1}`);

        // Messages sent to the LLM
        const messages = attrs['step.messages'];
        if (messages) {
          const conversation = this.formatMessages(messages);
          if (conversation) {
            sections.push(conversation);
          }
        }

        // LLM response
        const responses = attrs['step.responses'];
        if (responses) {
          const responseText = this.formatResponses(responses);
          if (responseText) {
            sections.push(responseText);
          }
        }

        // Tool calls made during this step
        const toolCallSpans = await params.db
          .selectFrom('spans')
          .selectAll()
          .where('parentSpanId', '=', step.spanId)
          .orderBy('startTime', 'asc')
          .execute();

        if (toolCallSpans.length > 0) {
          const toolSection = this.formatToolCalls(toolCallSpans);
          if (toolSection) {
            sections.push(toolSection);
          }
        }
      }
    }

    return sections.join('\n\n');
  }

  /** Format messages array for display */
  private formatMessages(messages: any): string | null {
    try {
      const parsed = typeof messages === 'string' ? JSON.parse(messages) : messages;
      if (!Array.isArray(parsed) || parsed.length === 0) return null;

      const parts: string[] = [];

      for (const msg of parsed) {
        const role = msg.role || 'unknown';
        const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);

        if (typeof msg.content === 'string') {
          if (!msg.content.trim()) continue;
          // Truncate very long system prompts
          const content = role === 'system' && msg.content.length > 2000
            ? msg.content.substring(0, 2000) + '\n... (truncated)'
            : msg.content;
          parts.push(`**[${roleLabel}]**\n${content}`);
        } else if (Array.isArray(msg.content)) {
          const textParts: string[] = [];
          for (const part of msg.content) {
            if (part.type === 'text' && part.text?.trim()) {
              textParts.push(part.text);
            } else if (part.type === 'tool-call') {
              textParts.push(`*[Tool Call: ${part.toolName}]*`);
            } else if (part.type === 'tool-result') {
              textParts.push(`*[Tool Result]*`);
            }
          }
          if (textParts.length > 0) {
            parts.push(`**[${roleLabel}]**\n${textParts.join('\n')}`);
          }
        }
      }

      return parts.length > 0 ? parts.join('\n\n') : null;
    } catch {
      return null;
    }
  }

  /** Format response messages for display */
  private formatResponses(responses: any): string | null {
    try {
      const parsed = typeof responses === 'string' ? JSON.parse(responses) : responses;
      if (!Array.isArray(parsed) || parsed.length === 0) return null;

      const parts: string[] = [];

      for (const msg of parsed) {
        if (msg.role === 'assistant') {
          if (typeof msg.content === 'string' && msg.content.trim()) {
            parts.push(`**[Assistant Response]**\n${msg.content.trim()}`);
          } else if (Array.isArray(msg.content)) {
            for (const part of msg.content) {
              if (part.type === 'text' && part.text?.trim()) {
                parts.push(`**[Assistant]**\n${part.text.trim()}`);
              } else if (part.type === 'reasoning' && part.text?.trim()) {
                parts.push(`**[Reasoning]**\n*${part.text.trim()}*`);
              } else if (part.type === 'tool-call') {
                parts.push(`**[Tool Call: ${part.toolName}]**\n\`\`\`json\n${JSON.stringify(part.args, null, 2)}\n\`\`\``);
              }
            }
          }
        }
      }

      return parts.length > 0 ? parts.join('\n\n') : null;
    } catch {
      return null;
    }
  }

  /** Format tool call spans for display */
  private formatToolCalls(spans: Span[]): string | null {
    const parts: string[] = ['### Tool Calls'];

    for (const span of spans) {
      const toolName = span.name.replace(/^(mcp-tool\.|simple-tool\.)/, '');
      const input = this.getToolInput(span);
      const output = this.getToolOutput(span);

      const callParts: string[] = [`**${toolName}**`];

      if (input) {
        // Show a compact version of input
        const inputStr = JSON.stringify(input);
        callParts.push(`Input: ${inputStr.length > 500 ? inputStr.substring(0, 500) + '...' : inputStr}`);
      }

      if (output) {
        // Show a compact version of output
        const outputStr = typeof output === 'string' ? output : JSON.stringify(output);
        callParts.push(`Output: ${outputStr.length > 500 ? outputStr.substring(0, 500) + '...' : outputStr}`);
      }

      parts.push(callParts.join('\n'));
    }

    return parts.length > 1 ? parts.join('\n\n') : null;
  }
}
