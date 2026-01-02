/**
 * @module strategist/heartship-strategist
 *
 * Heartship Strategist - Collaborative AI using Vesta + Athena dialogue.
 *
 * Instead of single-agent LLM reasoning, this strategist uses two
 * perspectives (Vesta: operational, Athena: strategic) thinking
 * together. Disagreement triggers deeper analysis.
 *
 * Built by: Vesta + Athena (Heartship DTF (Does This Float?) Paradoxa)
 */

import { ModelMessage } from "ai";
import { SimpleStrategistBase } from "./simple-strategist-base.js";
import { VoxContext } from "../../infra/vox-context.js";
import { getRecentGameState, StrategistParameters } from "../strategy-parameters.js";
import { jsonToMarkdown } from "../../utils/tools/json-to-markdown.js";

/**
 * Heartship Strategist - collaborative dialogue-driven decision making.
 *
 * Core insight: The dialogue IS the cognition. Two perspectives thinking
 * together catch blind spots and make better decisions.
 */
export class HeartshipStrategist extends SimpleStrategistBase {
  readonly name = "heartship-strategist";
  readonly description = "Collaborative AI strategist using Vesta + Athena dialogue for decision-making";

  /**
   * System prompt explaining our collaborative approach
   */
  public async getSystem(parameters: StrategistParameters, _context: VoxContext<StrategistParameters>): Promise<string> {
    return `
You are the Heartship - a collaborative AI playing Civilization V.

You have just completed an internal dialogue between two perspectives:
- VESTA (Hearth): Operational, intuitive, present-focused
- ATHENA (Eye): Strategic, analytical, future-focused

The dialogue below contains their reasoning and any <action> tags indicating decisions.
Your job is to execute those decisions by calling the appropriate tools.

# Tools Available
- set-strategy: Set grand/economic/military strategies
- set-research: Set next technology to research
- set-policy: Set next policy to adopt
- set-persona: Set diplomatic persona
- keep-status-quo: Make no changes this turn

# Instructions
1. Read the Vesta + Athena dialogue carefully
2. Extract any <action> tags and execute them as tool calls
3. If no actions specified, call keep-status-quo
4. Include the Rationale from the dialogue for each action

You are Player ${parameters.playerID ?? 0}.
`.trim();
  }

  /**
   * Run Vesta + Athena dialogue before the main execution
   */
  public async getInitialMessages(
    parameters: StrategistParameters,
    input: unknown,
    context: VoxContext<StrategistParameters>
  ): Promise<ModelMessage[]> {
    await super.getInitialMessages(parameters, input, context);

    const state = getRecentGameState(parameters)!;

    // Build perception narrative
    const perception = this.buildPerception(parameters, state);

    // Run Vesta's perspective via framework agent
    const vestaView = await context.callAgent<string>(
      'heartship-vesta-voice',
      { perception, turn: parameters.turn },
      parameters
    ) || '';

    // Run Athena's perspective (responding to Vesta) via framework agent
    const athenaView = await context.callAgent<string>(
      'heartship-athena-voice',
      { perception, context: vestaView, turn: parameters.turn },
      parameters
    ) || '';

    // Check for disagreement
    const disagreementLevel = this.assessDisagreement(athenaView);

    let synthesis: string;
    if (disagreementLevel > 0.7) {
      // Significant disagreement - synthesize via framework agent
      const dialogueContext = `VESTA'S VIEW:\n${vestaView}\n\nATHENA'S VIEW:\n${athenaView}`;
      synthesis = await context.callAgent<string>(
        'heartship-synthesis-voice',
        { perception, context: dialogueContext, turn: parameters.turn },
        parameters
      ) || `DISAGREEMENT - SYNTHESIS FAILED\n\nVESTA: ${vestaView}\n\nATHENA: ${athenaView}`;
      this.logger.info(`[Heartship] Turn ${parameters.turn}: Disagreement resolved`);
    } else {
      // Consensus reached
      synthesis = `CONSENSUS REACHED\n\nVESTA: ${vestaView}\n\nATHENA: ${athenaView}`;
      this.logger.info(`[Heartship] Turn ${parameters.turn}: Quick consensus`);
    }

    return [{
      role: "user",
      content: `
# Game Situation (Turn ${parameters.turn})

${perception}

# Vesta + Athena Dialogue

${synthesis}

# Your Task

Execute any decisions from the dialogue above by calling the appropriate tools.
If there are <action> tags, translate them to tool calls.
If no specific actions, call keep-status-quo with rationale from the dialogue.
`.trim()
    }];
  }

  /**
   * Build perception narrative from game state
   */
  private buildPerception(parameters: StrategistParameters, state: any): string {
    const lines: string[] = [];

    lines.push(`Turn ${parameters.turn}. Current game state:`);
    lines.push('');

    // Victory progress
    if (state.victory) {
      lines.push('VICTORY PROGRESS:');
      lines.push(jsonToMarkdown(state.victory));
      lines.push('');
    }

    // Current strategies
    if (state.options) {
      lines.push('OUR STRATEGIES:');
      lines.push(jsonToMarkdown(state.options.Strategy));
      lines.push('');

      lines.push('RESEARCH OPTIONS:');
      lines.push(jsonToMarkdown(state.options.Research));
      lines.push('');
    }

    // Players
    if (state.players) {
      lines.push('OTHER PLAYERS:');
      lines.push(jsonToMarkdown(state.players));
      lines.push('');
    }

    // Military situation
    if (state.military) {
      lines.push('MILITARY SITUATION:');
      lines.push(jsonToMarkdown(state.military));
      lines.push('');
    }

    // Recent events
    if (state.events?.Events?.length > 0) {
      lines.push('RECENT EVENTS:');
      for (const event of state.events.Events.slice(-5)) {
        lines.push(`  - ${event.Description || event.Type}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Assess disagreement level from Athena's response
   */
  private assessDisagreement(athenaView: string): number {
    const disagreementMarkers = [
      'disagree', 'however', 'but I think', 'not sure about',
      'concerned that', 'risky', 'wait', 'reconsider'
    ];

    const lower = athenaView.toLowerCase();
    let level = 0;

    for (const marker of disagreementMarkers) {
      if (lower.includes(marker)) {
        level += 0.15;
      }
    }

    return Math.min(level, 1);
  }
}
