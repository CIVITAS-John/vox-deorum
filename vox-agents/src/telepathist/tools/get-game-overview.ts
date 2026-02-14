/**
 * @module telepathist/tools/get-game-overview
 *
 * Telepathist tool for zooming into per-turn detailed summaries.
 * Returns pre-generated turn summaries from the telepathist database.
 * Fast read from DB - no LLM calls needed.
 */

import { z } from 'zod';
import { TelepathistTool } from '../telepathist-tool.js';
import { TelepathistParameters } from '../telepathist-parameters.js';

const inputSchema = z.object({
  Turns: z.string().describe(
    'Turn range to get overviews for. Single turn ("30"), comma-separated ("10,20,30"), or range ("30-39"). No more than 20 turns at a time.'
  )
});

type GetGameOverviewInput = z.infer<typeof inputSchema>;

/**
 * Returns per-turn detailed summaries for the requested range.
 * Summaries are pre-generated during session initialization.
 */
export class GetGameOverviewTool extends TelepathistTool<GetGameOverviewInput> {
  readonly name = 'get-game-overview';
  readonly description = 'Get detailed per-turn summaries for a range of turns. Use this to understand what happened during specific turns or time periods.';
  readonly inputSchema = inputSchema;

  async execute(input: GetGameOverviewInput, params: TelepathistParameters): Promise<string[]> {
    const turns = this.parseTurns(input.Turns, params.availableTurns, 20);

    if (turns.length === 0) {
      return ['No turns found in the requested range.'];
    }

    // Read summaries from the telepathist DB
    const summaries = await params.telepathistDb
      .selectFrom('turn_summaries')
      .selectAll()
      .where('turn', 'in', turns)
      .orderBy('turn', 'asc')
      .execute();

    if (summaries.length === 0) {
      return ['No summaries available for the requested turns. Summaries are generated during session initialization.'];
    }

    const sections: string[] = [];

    for (const summary of summaries) {
      sections.push(`## Turn ${summary.turn}\n${summary.fullSummary}`);
    }

    // Note any turns that were requested but have no summary
    const summarizedTurns = new Set(summaries.map(s => s.turn));
    const missing = turns.filter(t => !summarizedTurns.has(t));
    if (missing.length > 0) {
      sections.push(`\n*Note: No summaries available for turns: ${missing.join(', ')}*`);
    }

    return sections;
  }
}
