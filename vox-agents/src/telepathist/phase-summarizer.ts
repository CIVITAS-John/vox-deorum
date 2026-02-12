/**
 * @module telepathist/phase-summarizer
 *
 * Non-interactive agent that generates phase summaries from turn summaries.
 * Groups ~10 turns into a phase and produces a high-level summary.
 * Called after all turn summaries are generated during session initialization.
 */

import { VoxAgent } from '../infra/vox-agent.js';
import { TelepathistParameters } from './telepathist-parameters.js';
import { VoxContext } from '../infra/vox-context.js';

/**
 * Input for the PhaseSummarizer agent: concatenated turn summaries for a phase
 */
export interface PhaseSummarizerInput {
  /** The starting turn of this phase */
  fromTurn: number;
  /** The ending turn of this phase */
  toTurn: number;
  /** Short turn summaries for this phase, keyed by turn number */
  turnSummaries: Record<number, string>;
}

/**
 * Agent that generates phase summaries from turn summaries.
 * No tools needed — just text generation.
 */
export class PhaseSummarizer extends VoxAgent<TelepathistParameters, PhaseSummarizerInput, string> {
  readonly name = 'phase-summarizer';
  readonly description = 'Generates phase summaries from turn summaries for the telepathist system';
  public tags = ['telepathist', 'internal'];

  public async getSystem(
    params: TelepathistParameters,
    input: PhaseSummarizerInput,
    _context: VoxContext<TelepathistParameters>
  ): Promise<string> {
    return `You are a senior historian summarizing a stage (turns ${input.fromTurn}-${input.toTurn}) of a Civilization V game played by ${params.leaderName} of ${params.civilizationName}.

# Task
Create a concise narrative summary of this phase based on the individual turn summaries provided. This summary will serve as high-level context for a conversation about the game.

# Writing
- Write in past tense from a historian's perspective, not the leader's
- Mention specific civilizations, cities, technologies, and policies by name
- Keep it to one paragraph: concise but enough for context

# Guidelines
- Identify the dominant themes and narrative arcs of this phase
- Highlight major turning points: wars declared/ended, key technologies, policy adoptions, new cities
- Note the overall trajectory: is the civilization expanding, at war, building infrastructure, etc.?`.trim();
  }

  public async getInitialMessages(
    _params: TelepathistParameters,
    input: PhaseSummarizerInput,
    _context: VoxContext<TelepathistParameters>
  ) {
    return [{
      role: 'user' as const,
      content: `
# Turn Summaries: Turns ${input.fromTurn} to ${input.toTurn}
${Object.entries(input.turnSummaries).map(([turn, summary]) => `
## Turn ${turn}
${summary}`.trim()).join('\n\n')}`.trim()
    }];
  }
}
