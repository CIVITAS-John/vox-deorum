/**
 * @module telepathist/preparation/instructions
 *
 * Zod schemas, types, and instruction builders for turn and phase summarization.
 * Each builder produces a structured JSON instruction requesting four fields:
 * situation, abstract, decisions, narrative.
 */

import { z } from 'zod';
import { summarizerGuidelines } from '../summarizer.js';

/** Zod schema for turn summary structured output */
export const turnSummarySchema = z.object({
  situation: z.string().describe('Detailed world state paragraph covering military, economic, diplomatic, and research situation'),
  abstract: z.string().describe('Context-agnostic generalized summary with no concrete civilization/leader/city names'),
  decisions: z.string().describe('Detailed player decisions and reasoning for this turn'),
  narrative: z.string().describe('Short combined narrative weaving situation and decisions together')
});

/** Output type for turn summaries */
export type TurnSummaryOutput = z.infer<typeof turnSummarySchema>;

/** Zod schema for phase summary structured output */
export const phaseSummarySchema = z.object({
  situation: z.string().describe('Narrative paragraph of the phase\'s world state arc'),
  abstract: z.string().describe('Context-agnostic generalized phase summary with no concrete names'),
  decisions: z.string().describe('Narrative paragraph of the phase\'s strategic choices'),
  narrative: z.string().describe('Short combined narrative for the phase')
});

/** Output type for phase summaries */
export type PhaseSummaryOutput = z.infer<typeof phaseSummarySchema>;

/**
 * Builds the instruction for turn summarization.
 * Requests a structured JSON object with situation, abstract, decisions, and narrative.
 */
export function buildTurnSummaryInstruction(turn: number): string {
  return `Accurately summarize the game state and decisions for turn ${turn}.

# Guidelines
${summarizerGuidelines}

# Output Format
Respond with a JSON object containing these fields (generate them in this order, so earlier fields can provide context for later ones):
1. "situation": Detailed paragraphs summarizing, from an OBSERVER perspective, the world state: military situation, economic state, diplomatic state, research progress, and notable events. Do not discuss the leader's strategies, thoughts, or decisions.
2. "abstract": A context-agnostic generalized summary of the same events. Replace all concrete names (civilizations, leaders, cities, technologies) with generic descriptions. This should read as a universal game scenario.
3. "decisions": A detailed paragraph covering the leader's decisions and reasoning: what options were available, what was chosen, and why.
4. "narrative": A short combined narrative (2-3 sentences) weaving the situation and decisions together into a cohesive summary.

# Focus
- Focus on what changed or is notable, e.g. any wars, peace treaties, or diplomatic shifts.
- Highlight strategic inflection points (new wars, pivotal technologies, policy adoptions).
- Carefully go through the raw game data to clarify uncertain situations.

# Reminder
Respond ONLY with a JSON object containing exactly these four fields: "situation", "abstract", "decisions", "narrative".
- "situation" must only cover world state: do NOT include any leader decisions or reasoning.
- Do not include any other text or commentary outside the JSON.`;
}

/**
 * Builds the instruction for phase summarization.
 * Requests a structured JSON object with situation, abstract, decisions, and narrative.
 */
export function buildPhaseSummaryInstruction(fromTurn: number, toTurn: number): string {
  return `Create a structured summary of this phase (turns ${fromTurn}-${toTurn}) based on the individual turn summaries provided. This summary will serve as high-level context for a conversation about the game.

# Guidelines
${summarizerGuidelines}

# Output Format
Respond with a JSON object containing these fields (generate them in this order, so earlier fields provide context for later ones):
1. "situation": An observation paragraph of the phase's world state arc: how the military, economic, diplomatic, and research landscape evolved across these turns. Do not discuss the leader's strategies, thoughts, or decisions.
2. "abstract": A context-agnostic generalized phase summary. Replace all concrete names with generic descriptions. This should read as a universal game phase description.
3. "decisions": A narrative paragraph of the phase's strategic choices: the key decisions made, their rationale, and their outcomes.
4. "narrative": A short combined narrative (2-3 sentences) weaving the situation and decisions into a cohesive phase summary.

# Focus
- Identify the dominant themes and narrative arcs of this phase.
- Highlight major turning points: wars declared/ended, key technologies, policy adoptions, new cities.
- Note the overall trajectory: is the civilization expanding, at war, building infrastructure, etc.?

# Reminder
Respond ONLY with a JSON object containing exactly these four fields: "situation", "abstract", "decisions", "narrative".
- "situation" must only cover world state: do NOT include any leader decisions or reasoning.
- Do not include any other text or commentary outside the JSON.`;
}
