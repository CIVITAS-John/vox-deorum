/**
 * @module telepathist/tools/get-decisions
 *
 * Telepathist tool for extracting AI decisions and reasoning from telemetry spans.
 * Shows what the AI decided and why — includes available options, agents involved,
 * reasoning text, and concrete decisions made.
 */

import { z } from 'zod';
import { TelepathistTool } from '../telepathist-tool.js';
import { TelepathistParameters } from '../telepathist-parameters.js';
import type { Span } from '../../utils/telemetry/schema.js';

/** Decision tools whose inputs contain the AI's strategic choices */
const decisionTools = [
  'set-strategy',
  'set-research',
  'set-policy',
  'set-flavors',
  'set-persona',
  'set-relationship',
  'keep-status-quo',
  'relay-message',
];

/** Agent role descriptions for context */
const agentRoles: Record<string, string> = {
  'simple-strategist': 'Core strategist making primary decisions',
  'simple-strategist-briefed': 'Strategist with briefing context',
  'simple-strategist-staffed': 'Strategist with full staff support',
  'simple-briefer': 'General briefer summarizing game state',
  'specialized-briefer': 'Specialized briefer (Military/Economy/Diplomacy)',
  'diplomat': 'Diplomatic envoy handling foreign interactions',
  'spokesperson': 'Official spokesperson representing the civilization',
  'diplomatic-analyst': 'Intelligence analyst processing diplomatic data',
  'keyword-librarian': 'Librarian managing keyword knowledge',
};

const inputSchema = z.object({
  turns: z.string().describe(
    'Turn(s) to retrieve decisions for. Single ("30"), comma-separated ("10,20,30"), or range ("30-50").'
  )
});

type GetDecisionsInput = z.infer<typeof inputSchema>;

/**
 * Extracts AI decisions and reasoning from telemetry spans.
 * Shows the options landscape and the choices made.
 */
export class GetDecisionsTool extends TelepathistTool<GetDecisionsInput> {
  readonly name = 'get-decisions';
  readonly description = 'Get AI decisions and reasoning for specific turns. Shows what agents were involved, what options were available, what the AI decided, and why.';
  readonly inputSchema = inputSchema;

  async execute(input: GetDecisionsInput, params: TelepathistParameters): Promise<string> {
    const turns = this.parseTurns(input.turns, params.availableTurns);
    if (turns.length === 0) {
      return 'No turns found in the requested range.';
    }

    const sections: string[] = [];

    for (const turn of turns) {
      const turnSections: string[] = [];
      turnSections.push(`# Turn ${turn}`);

      const rootSpans = await this.getRootSpans(params.db, [turn]);

      if (Object.keys(rootSpans).length === 0) {
        turnSections.push('*No agent executions found for this turn.*');
        sections.push(turnSections.join('\n'));
        continue;
      }

      // 1. Strategic options available (from get-options)
      await this.addOptionsSection(params, turn, rootSpans, turnSections);

      // 2. Agents involved
      turnSections.push('## Agents Involved');
      for (const [agentName, spans] of Object.entries(rootSpans)) {
        const role = agentRoles[agentName] || `Agent: ${agentName}`;
        turnSections.push(`- **${agentName}**: ${role} (${spans.length} execution${spans.length > 1 ? 's' : ''})`);
      }

      // 3. AI Reasoning + 4. Decisions made (per-agent)
      for (const [agentName, agentSpans] of Object.entries(rootSpans)) {
        // Get steps for this agent
        const stepSpans = await this.getStepsForAgent(params, agentSpans);
        if (stepSpans.length === 0) continue;

        // Extract reasoning from step responses
        const reasoning = this.extractReasoning(stepSpans);
        if (reasoning) {
          turnSections.push(`## ${agentName} — Reasoning`);
          turnSections.push(reasoning);
        }

        // Extract decisions from tool calls
        const decisions = await this.extractDecisions(params, stepSpans);
        if (decisions.length > 0) {
          turnSections.push(`## ${agentName} — Decisions`);
          turnSections.push(...decisions);
        }
      }

      sections.push(turnSections.join('\n\n'));
    }

    return sections.join('\n\n---\n\n');
  }

  /** Add get-options output to the turn sections */
  private async addOptionsSection(
    params: TelepathistParameters,
    turn: number,
    rootSpans: Record<string, Span[]>,
    turnSections: string[]
  ): Promise<void> {
    // Collect valid traceIds
    const validTraceIds = new Set<string>();
    for (const spans of Object.values(rootSpans)) {
      for (const span of spans) {
        validTraceIds.add(span.traceId);
      }
    }

    const optionSpans = await params.db
      .selectFrom('spans')
      .selectAll()
      .where('turn', '=', turn)
      .where('name', '=', 'mcp-tool.get-options')
      .where('traceId', 'in', [...validTraceIds])
      .orderBy('startTime', 'desc')
      .limit(1)
      .execute();

    if (optionSpans.length > 0) {
      const output = this.getToolOutput(optionSpans[0]);
      if (output) {
        turnSections.push('## Strategic Options Available');
        turnSections.push(this.formatToolOutput('get-options', output));
      }
    }
  }

  /** Get step spans that are children of the given agent spans */
  private async getStepsForAgent(
    params: TelepathistParameters,
    agentSpans: Span[]
  ): Promise<Span[]> {
    const parentIds = agentSpans.map(s => s.spanId);
    return params.db
      .selectFrom('spans')
      .selectAll()
      .where('parentSpanId', 'in', parentIds)
      .orderBy('startTime', 'asc')
      .execute();
  }

  /** Extract reasoning text from step span responses */
  private extractReasoning(stepSpans: Span[]): string | null {
    const reasoningParts: string[] = [];

    for (const step of stepSpans) {
      const attrs = this.parseAttributes(step);
      const responses = attrs['step.responses'];
      if (!responses) continue;

      try {
        const parsed = typeof responses === 'string' ? JSON.parse(responses) : responses;
        if (Array.isArray(parsed)) {
          for (const msg of parsed) {
            // Extract text content from assistant messages
            if (msg.role === 'assistant') {
              if (typeof msg.content === 'string' && msg.content.trim()) {
                reasoningParts.push(msg.content.trim());
              } else if (Array.isArray(msg.content)) {
                for (const part of msg.content) {
                  if (part.type === 'text' && part.text?.trim()) {
                    reasoningParts.push(part.text.trim());
                  } else if (part.type === 'reasoning' && part.text?.trim()) {
                    reasoningParts.push(`*[Reasoning]: ${part.text.trim()}*`);
                  }
                }
              }
            }
          }
        }
      } catch {
        // Skip unparseable responses
      }
    }

    return reasoningParts.length > 0 ? reasoningParts.join('\n\n') : null;
  }

  /** Extract decision tool calls from step spans */
  private async extractDecisions(
    params: TelepathistParameters,
    stepSpans: Span[]
  ): Promise<string[]> {
    const parentIds = stepSpans.map(s => s.spanId);

    // Find all tool call spans that are children of these steps
    const toolCalls = await params.db
      .selectFrom('spans')
      .selectAll()
      .where('parentSpanId', 'in', parentIds)
      .orderBy('startTime', 'asc')
      .execute();

    const decisions: string[] = [];

    for (const span of toolCalls) {
      // Extract the tool name from span name (e.g., "mcp-tool.set-strategy" or "simple-tool.keep-status-quo")
      const toolName = span.name.replace(/^(mcp-tool\.|simple-tool\.)/, '');

      if (decisionTools.includes(toolName)) {
        const input = this.getToolInput(span);
        if (input) {
          const parts: string[] = [`### ${toolName}`];

          // Format the decision input
          if (input.Rationale || input.rationale) {
            parts.push(`**Rationale**: ${input.Rationale || input.rationale}`);
          }

          // Show the decision details (excluding rationale to avoid duplication)
          const details = { ...input };
          delete details.Rationale;
          delete details.rationale;
          delete details.PlayerID;
          delete details.player_id;

          if (Object.keys(details).length > 0) {
            for (const [key, value] of Object.entries(details)) {
              if (typeof value === 'object') {
                parts.push(`**${key}**:\n${JSON.stringify(value, null, 2)}`);
              } else {
                parts.push(`**${key}**: ${value}`);
              }
            }
          }

          decisions.push(parts.join('\n'));
        }
      }
    }

    return decisions;
  }
}
