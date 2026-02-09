/**
 * @module envoy/live-envoy
 *
 * Live game envoy that handles StrategistParameters-specific behavior.
 * Combines special message detection with game context assembly for live game interactions.
 * Replaces the former SimpleEnvoy class.
 */

import { ModelMessage } from "ai";
import { Envoy } from "./envoy.js";
import { StrategistParameters, getGameState } from "../strategist/strategy-parameters.js";
import { EnvoyThread, MessageWithMetadata, SpecialMessageConfig } from "../types/index.js";
import { VoxContext } from "../infra/vox-context.js";
import { jsonToMarkdown } from "../utils/tools/json-to-markdown.js";

/**
 * Envoy specialized for live game sessions with StrategistParameters.
 * Handles special message detection (e.g., {{{Greeting}}}) and assembles
 * full game context for normal conversations.
 *
 * @abstract
 * @class
 */
export abstract class LiveEnvoy extends Envoy<StrategistParameters> {
  /**
   * Orchestrates initial messages with special message support.
   * Detects special messages in the last user message and generates
   * appropriate prompts. Falls back to full context + history for normal messages.
   */
  public async getInitialMessages(
    parameters: StrategistParameters,
    input: EnvoyThread,
    _context: VoxContext<StrategistParameters>
  ): Promise<ModelMessage[]> {
    const specialConfig = this.findLastSpecialMessage(input);
    const messages = this.getContextMessages(parameters, input, specialConfig);
    if (!specialConfig) messages.push(...this.convertToModelMessages(
        this.filterSpecialMessages(input.messages)
      ));
    return messages;
  }

  // Special message detection

  /**
   * Checks if the very last message in the thread is a special message.
   * Returns the config if it is, undefined otherwise.
   */
  private findLastSpecialMessage(input: EnvoyThread): SpecialMessageConfig | undefined {
    if (input.messages.length === 0) return undefined;
    const last = input.messages[input.messages.length - 1];
    if (typeof last.message.content === 'string') {
      return this.getSpecialMessages()[last.message.content];
    }
    return undefined;
  }

  /**
   * Filters out special messages from message history before sending to LLM.
   * Ensures special message tokens don't appear as visible conversation turns.
   */
  protected filterSpecialMessages(messages: MessageWithMetadata[]): MessageWithMetadata[] {
    const specialMessages = this.getSpecialMessages();
    return messages.filter(msg => {
      if (msg.message.role === 'user' && typeof msg.message.content === 'string') {
        return !(msg.message.content in specialMessages);
      }
      return true;
    });
  }

  // Game context assembly (absorbed from SimpleEnvoy)

  /**
   * Returns the full game context messages: civilization identity + game state.
   * Uses briefing when available, otherwise includes raw game reports.
   */
  protected getContextMessages(parameters: StrategistParameters, input: EnvoyThread, special?: SpecialMessageConfig): ModelMessage[] {
    const leader = parameters.metadata!.YouAre!.Leader;
    const civName = parameters.metadata!.YouAre!.Name;
    const state = getGameState(parameters, parameters.turn);
    if (!state) {
      throw new Error(`No game state available near turn ${parameters.turn}`);
    }
    const hint = this.getHint(parameters, input);
    const { YouAre, ...SituationData } = parameters.metadata || {};
    const { Options, ...Strategy } = state.options || {};

    const messages: ModelMessage[] = [{
      role: "system",
      content: `
# Situation
${jsonToMarkdown(SituationData)}

# Your Civilization
${jsonToMarkdown(YouAre)}

# Players
Players: summary reports about visible players in the world.

${jsonToMarkdown(state.players)}

# Strategies
Strategies: existing strategic decisions from your leader.

${jsonToMarkdown(Strategy)}`.trim()
    }];

    // Special mode: ignore the rest
    if (special) { 
      messages.push({
        role: "user", 
        content: `
# Special Instruction
${special.prompt}`.trim()
      })
      return messages;
    }

    // If there is a briefing, use it
    if (state.reports["briefing"]) {
      messages.push({
        role: "user",
        content: `
# Briefings
${state.reports["briefing"]}

${hint}`.trim()
      });
    } else {
      messages.push({
        role: "user",
        content: `
# Victory Progress
Victory Progress: current progress towards each type of victory.

${jsonToMarkdown(state.victory)}

# Cities
Cities: summary reports about discovered cities in the world.

${jsonToMarkdown(state.cities)}

# Military
Military: summary reports about tactical zones and visible units.

${jsonToMarkdown(state.military)}

# Events
Events: events since the last decision-making.

${jsonToMarkdown(state.events)}

${hint}`.trim()});
    }

    return messages;
  }

  // Abstract methods

  /**
   * Returns a short contextual reminder that anchors the LLM on its role,
   * audience, and current turn. Used as the sole context in special message mode,
   * and typically appended to game state messages in normal mode.
   */
  protected abstract getHint(parameters: StrategistParameters, input: EnvoyThread): string;
}
