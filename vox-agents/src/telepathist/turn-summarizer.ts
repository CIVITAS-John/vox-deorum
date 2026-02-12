/**
 * @module telepathist/turn-summarizer
 *
 * Non-interactive agent that generates per-turn summaries from game state data.
 * Called in a loop during Telepathist session initialization.
 * Input: pre-formatted game state text for a single turn.
 * Output: { shortSummary, fullSummary } structured response.
 */

import { z } from 'zod';
import { VoxAgent } from '../infra/vox-agent.js';
import { TelepathistParameters } from './telepathist-parameters.js';
import { VoxContext } from '../infra/vox-context.js';

/**
 * Input for the TurnSummarizer agent: pre-formatted game state text for one turn
 */
export interface TurnSummarizerInput {
  /** The turn number being summarized */
  turn: number;
  /** Pre-formatted game state data as markdown text */
  gameStateText: string;
}

/**
 * Output from the TurnSummarizer agent
 */
export interface TurnSummary {
  /** A 1-2 sentence summary for use in phase summaries */
  shortSummary: string;
  /** A detailed paragraph summary for use in get-game-overview */
  fullSummary: string;
}

const outputSchema = z.object({
  shortSummary: z.string().describe('A 1-2 sentence summary capturing the key events and decisions of this turn'),
  fullSummary: z.string().describe('A detailed paragraph summary covering all significant aspects of this turn')
});

/**
 * Agent that generates turn summaries from game state data.
 * No tools needed — just text generation with structured output.
 */
export class TurnSummarizer extends VoxAgent<TelepathistParameters, TurnSummarizerInput, TurnSummary> {
  readonly name = 'turn-summarizer';
  readonly description = 'Generates per-turn summaries from game state data for the telepathist system';
  public tags = ['telepathist', 'internal'];
  public outputSchema = outputSchema;

  public async getSystem(
    params: TelepathistParameters,
    input: TurnSummarizerInput,
    _context: VoxContext<TelepathistParameters>
  ): Promise<string> {
    return `You are a senior historian analyzing a Civilization V game played by ${params.leaderName} of ${params.civilizationName}.

# Task
Summarize the game state for turn ${input.turn}. You will receive the raw game data that the leader saw during this turn.

# Output Format
Respond with a JSON object containing:
- "fullSummary": A detailed paragraph covering all significant aspects: military situation, economic state, diplomatic changes, research progress, and strategic direction
- "shortSummary": 1-2 sentences capturing the most important events/decisions of this turn

# Writing
- Write in past tense from a historian's perspective, not the leader's
- Mention specific civilizations, cities, technologies, and policies by name

# Guidelines
- Focus on what changed or is notable, e.g. any wars, peace treaties, or diplomatic shifts
- Highlight strategic inflection points (new wars, pivotal technologies, policy adoptions)
- Carefully distinguish between what is truth (game state) and what is perception of the leader
  - "Rationale" under the Options heading reflects the leader's perspective and can deviate from the reality
  - "RelayedMessage" type of events reflects the intelligence gathered by the government and can be incorrect`.trim();
  }

  public async getInitialMessages(
    _params: TelepathistParameters,
    input: TurnSummarizerInput,
    _context: VoxContext<TelepathistParameters>
  ) {
    return [{
      role: 'user' as const,
      content: input.gameStateText
    }];
  }
}
