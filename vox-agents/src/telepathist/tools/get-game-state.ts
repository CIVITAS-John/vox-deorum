/**
 * @module telepathist/tools/get-game-state
 *
 * Telepathist tool for reconstructing ground-truth game state from telemetry spans.
 * Extracts MCP tool outputs stored in span attributes and formats them using
 * the same jsonToMarkdown + markdownConfig that agents see during live play.
 */

import { z } from 'zod';
import { TelepathistTool } from '../telepathist-tool.js';
import { TelepathistParameters } from '../telepathist-parameters.js';

/** Maps category names to MCP tool names */
const categoryToolMap: Record<string, string> = {
  players: 'get-players',
  victory: 'get-victory-progress',
  options: 'get-options',
  military: 'get-military-report',
  cities: 'get-cities',
  events: 'get-events',
};

const allCategories = Object.keys(categoryToolMap);

/** Human-friendly labels for each category */
const categoryLabelMap: Record<string, string> = {
  players: 'Players',
  victory: 'Victory Progress',
  options: 'Options',
  military: 'Military',
  cities: 'Cities',
  events: 'Events',
};

const inputSchema = z.object({
  turns: z.string().describe(
    'Turn(s) to retrieve game state for. Single ("30"), comma-separated ("10,20,30"), or range ("30-40"). No more than 10 turns at a time.'
  ),
  categories: z.array(z.string()).optional().describe(
    `Optional filter for specific data categories: ${allCategories.join(', ')}. If omitted, returns all available data.`
  )
});

type GetGameStateInput = z.infer<typeof inputSchema>;

/**
 * Reconstructs the actual game data the AI had access to from MCP tool output spans.
 * Uses valid traceId per turn to skip botched spans.
 */
export class GetGameStateTool extends TelepathistTool<GetGameStateInput> {
  readonly name = 'get-game-state';
  readonly description = 'Get the actual game state data for specific turns, reconstructed from telemetry.';
  readonly inputSchema = inputSchema;

  async execute(input: GetGameStateInput, params: TelepathistParameters): Promise<string> {
    const turns = this.parseTurns(input.turns, params.availableTurns);
    if (turns.length === 0) {
      return 'No turns found in the requested range.';
    }

    const requestedCategories = input.categories && input.categories.length > 0
      ? input.categories.filter(c => c in categoryToolMap)
      : allCategories;

    if (requestedCategories.length === 0) {
      return `Invalid categories. Available: ${allCategories.join(', ')}`;
    }

    const sections: string[] = [];

    for (const turn of turns) {
      const turnSections: string[] = [];
      turnSections.push(`# Turn ${turn}`);

      // Get the valid root spans for this turn to identify valid traceIds
      const rootSpans = await this.getRootSpans(params.db, [turn]);

      // Collect all valid traceIds (from strategist and fire-and-forget agents)
      const validTraceIds = new Set<string>();
      for (const agentSpans of Object.values(rootSpans)) {
        for (const span of agentSpans) {
          validTraceIds.add(span.traceId);
        }
      }

      if (validTraceIds.size === 0) {
        turnSections.push('*No valid agent executions found for this turn.*');
        sections.push(turnSections.join('\n'));
        continue;
      }

      // For each category, find the relevant MCP tool spans
      for (const category of requestedCategories) {
        const toolName = categoryToolMap[category];
        const mcpSpanName = `mcp-tool.${toolName}`;

        // Find tool spans that belong to valid traces for this turn
        const toolSpans = await params.db
          .selectFrom('spans')
          .selectAll()
          .where('turn', '=', turn)
          .where('name', '=', mcpSpanName)
          .where('traceId', 'in', [...validTraceIds])
          .orderBy('startTime', 'desc')
          .limit(1)
          .execute();

        if (toolSpans.length > 0) {
          const output = this.getToolOutput(toolSpans[0]);
          if (output) {
            turnSections.push(`## ${categoryLabelMap[category]}`);
            turnSections.push(this.formatToolOutput(toolName, output));
          }
        }
      }

      if (turnSections.length === 1) {
        turnSections.push('*No game state data found for this turn.*');
      }

      sections.push(turnSections.join('\n'));
    }

    return sections.join('\n\n');
  }
}
