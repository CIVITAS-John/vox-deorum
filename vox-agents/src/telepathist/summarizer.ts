/**
 * @module telepathist/summarizer
 *
 * General-purpose summarization agent for the telepathist system.
 * Handles all summarization needs: tool result focusing, turn summaries,
 * and phase summaries — driven by a flexible instruction parameter.
 * Replaces the previous TurnSummarizer and PhaseSummarizer agents.
 */

import { createHash } from 'node:crypto';
import { z } from 'zod';
import { VoxAgent } from '../infra/vox-agent.js';
import { TelepathistParameters } from './telepathist-parameters.js';
import { VoxContext } from '../infra/vox-context.js';
import { createLogger } from '../utils/logger.js';

/**
 * Shared historian guidelines reused across summarization instructions.
 * Both the Summarizer's system prompt and caller-built instructions
 * reference these to maintain consistent tone and quality.
 */
export const summarizerGuidelines = `- Write in past tense from a historian's perspective, not the leader's.
- Mention specific civilizations, cities, technologies, and policies by name.
- The history happened in a generated world, and the geography had nothing to do with the real Earth.
- Carefully distinguish between what is truth (game state) and what is perception of the leader.
  - "Rationale" under the Options heading reflects the leader's perspective and can deviate from the reality.
  - "RelayedMessage" type of events reflects the intelligence gathered by the government and can be incorrect.`;

/** Zod schema for turn summary structured output, used by callers to parse JSON responses */
export const turnSummarySchema = z.object({
  shortSummary: z.string().describe('A 1-2 sentence summary capturing the key events and decisions of this turn'),
  fullSummary: z.string().describe('A detailed paragraph summary covering all significant aspects of this turn')
});

/** Output type for turn summaries */
export type TurnSummary = z.infer<typeof turnSummarySchema>;

/**
 * Input for the Summarizer agent.
 * The instruction drives the summarization behavior — from tool result
 * focusing to structured turn summaries to narrative phase summaries.
 */
export interface SummarizerInput {
  /** The raw text data to summarize */
  text: string;
  /** What to focus on and how to format the output */
  instruction: string;
}

/**
 * Builds the instruction for turn summarization.
 * Tells the Summarizer to produce JSON with shortSummary and fullSummary.
 */
export function buildTurnSummaryInstruction(turn: number): string {
  return `Summarize the game state for turn ${turn}.

# Output Format
Respond with a JSON object containing:
- "fullSummary": A detailed paragraph covering all significant aspects: military situation, economic state, diplomatic changes, research progress, and strategic direction.
- "shortSummary": 1-2 sentences capturing the most important events/decisions of this turn.

# Focus
- Focus on what changed or is notable, e.g. any wars, peace treaties, or diplomatic shifts.
- Highlight strategic inflection points (new wars, pivotal technologies, policy adoptions).`;
}

/**
 * Builds the instruction for phase summarization.
 * Tells the Summarizer to produce a concise narrative paragraph.
 */
export function buildPhaseSummaryInstruction(fromTurn: number, toTurn: number): string {
  return `Create a concise narrative summary of this phase (turns ${fromTurn}-${toTurn}) based on the individual turn summaries provided. This summary will serve as high-level context for a conversation about the game.

# Focus
- Identify the dominant themes and narrative arcs of this phase.
- Highlight major turning points: wars declared/ended, key technologies, policy adoptions, new cities.
- Note the overall trajectory: is the civilization expanding, at war, building infrastructure, etc.?
- Keep it to one paragraph: concise but enough for context.`;
}

/**
 * Builds the instruction for tool result summarization.
 * Focuses the summary on the user's inquiry if provided.
 */
export function buildToolSummaryInstruction(toolName: string, inquiry?: string): string {
  if (inquiry) {
    return `Summarize the following ${toolName} data. Preserve key details (turn numbers, names, numerical values) relevant to the inquiry. Omit irrelevant sections.

# Inquiry
${inquiry}`;
  }
  return `Summarize the following ${toolName} data, preserving the most important information. Focus on significant events, decisions, and state changes. Keep specifics (turn numbers, names, values) but compress verbose sections.`;
}

/**
 * General-purpose summarization agent.
 * Driven by an instruction parameter that controls output format and focus.
 * No outputSchema — returns text by default; callers parse structured output when needed.
 */
export class Summarizer extends VoxAgent<TelepathistParameters, SummarizerInput, string> {
  readonly name = 'summarizer';
  readonly description = 'General-purpose summarizer for historical data';

  public async getSystem(
    params: TelepathistParameters,
    _input: SummarizerInput,
    _context: VoxContext<TelepathistParameters>
  ): Promise<string> {
    return `You are a senior historian analyzing a Civilization V game played by ${params.leaderName} of ${params.civilizationName}.

# Guidelines
${summarizerGuidelines}`.trim();
  }

  public async getInitialMessages(
    _params: TelepathistParameters,
    input: SummarizerInput,
    _context: VoxContext<TelepathistParameters>
  ) {
    return [{
      role: 'user' as const,
      content: `# Task\n${input.instruction}\n\n# Data\n${input.text}`
    }];
  }
}

const cacheLogger = createLogger('SummarizerCache');

/** Generates a SHA-256 cache key from the summarizer input text and instruction. */
function computeCacheKey(text: string, instruction: string): string {
  return createHash('sha256')
    .update(text)
    .update(instruction)
    .digest('hex');
}

/**
 * Summarizes text using the Summarizer agent, with database-backed caching.
 * Checks the summary_cache table before invoking the LLM. On cache miss,
 * calls the summarizer agent and persists the result.
 */
export async function summarizeWithCache(
  input: SummarizerInput,
  params: TelepathistParameters,
  context: VoxContext<TelepathistParameters>
): Promise<string | undefined> {
  const cacheKey = computeCacheKey(input.text, input.instruction);

  const cached = await params.telepathistDb
    .selectFrom('summary_cache')
    .select('result')
    .where('cacheKey', '=', cacheKey)
    .executeTakeFirst();

  if (cached) {
    cacheLogger.debug('Summary cache hit', { cacheKey: cacheKey.substring(0, 12) });
    return cached.result;
  }

  cacheLogger.debug('Summary cache miss, invoking summarizer', { cacheKey: cacheKey.substring(0, 12) });
  const result = await context.callAgent<string>('summarizer', input, params);

  if (result) {
    await params.telepathistDb
      .insertInto('summary_cache')
      .values({
        cacheKey,
        result,
        model: 'auto',
        createdAt: Date.now()
      })
      .onConflict((oc) => oc.column('cacheKey').doNothing())
      .execute();
  }

  return result;
}
