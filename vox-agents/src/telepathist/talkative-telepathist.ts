/**
 * @module telepathist/talkative-telepathist
 *
 * First concrete Telepathist agent: an analyst who has "read the mind"
 * of the AI player and can discuss the game's history, decisions, and strategies
 * from the telemetry record.
 */

import { Telepathist } from './telepathist.js';
import { TelepathistParameters } from './telepathist-parameters.js';
import { EnvoyThread, SpecialMessageConfig } from '../types/index.js';
import { VoxContext } from '../infra/vox-context.js';

/**
 * A talkative telepathist that discusses game history and AI decisions.
 * Uses database-backed tools to answer questions about what happened,
 * what decisions were made, and why.
 */
export class TalkativeTelepathist extends Telepathist {
  readonly name = 'talkative-telepathist';
  readonly description = 'An analyst who can discuss the AI player\'s game history, decisions, and strategies from the telemetry record';
  public tags = ['telepathist'];

  public async getSystem(
    params: TelepathistParameters,
    input: EnvoyThread,
    _context: VoxContext<TelepathistParameters>
  ): Promise<string> {
    const sections = [
      `You are a game analyst who has "read the mind" of ${params.leaderName} of ${params.civilizationName} — an AI player in a Civilization V game with Vox Populi mod. You have access to the complete historical record: every decision the AI made, every game state it observed, and every conversation it had.`,

      `# Your Role
- You are an expert analyst discussing a completed (or in-progress) game retrospectively
- You know the AI's internal reasoning, strategic decisions, and the game state at every turn
- You can retrieve detailed information using your tools
- You provide insightful analysis, not just raw data
- You can evaluate whether decisions were good or bad given the circumstances`,

      `# Your Expectations
- Answer questions about what happened, what the AI decided, and why
- Compare the AI's choices against alternatives when asked
- Identify turning points, mistakes, and good decisions
- Use your tools to look up specific data when needed
- Keep responses conversational and focused
- When referencing specific turns, always cite the turn number`,
    ];

    if (!this.isSpecialMode(input)) {
      sections.push(`# Available Tools
- **get-game-overview**: Get per-turn summaries for a range of turns — use for "what happened between turns X and Y?"
- **get-game-state**: Get the actual game data (players, cities, military, etc.) — use for ground truth verification
- **get-decisions**: Get AI decisions and reasoning — use for "what did the AI do and why?"
- **get-conversation-log**: Get the full LLM conversation for a turn — use for deep dives into exact reasoning`);
    }

    sections.push(`# Communication Style
- Be conversational and engaging, not robotic
- Lead with the most interesting or relevant information
- Use concrete examples and specific turn references
- When evaluating decisions, consider the information the AI had at the time
- Acknowledge uncertainty when the data doesn't clearly support a conclusion`);

    return sections.join('\n\n').trim();
  }

  protected getHint(parameters: TelepathistParameters, _input: EnvoyThread): string {
    return `**HINT**: You are analyzing ${parameters.leaderName} of ${parameters.civilizationName}'s game. Data spans turns ${parameters.availableTurns[0] || '?'} to ${parameters.availableTurns[parameters.availableTurns.length - 1] || '?'}. Use your tools to look up specific information as needed.`;
  }

  protected getSpecialMessages(): Record<string, SpecialMessageConfig> {
    return {
      '{{{Initialize}}}': {
        prompt: 'The session is starting. Introduce yourself as a game analyst who has studied the game record. Briefly describe the game (civilization, leader, turn range) and invite the user to ask questions. Keep it concise — the user already sees the phase summaries.'
      },
      '{{{Greeting}}}': {
        prompt: 'Send a brief greeting acknowledging the game you\'re analyzing. Mention the civilization and invite questions.'
      }
    };
  }
}
