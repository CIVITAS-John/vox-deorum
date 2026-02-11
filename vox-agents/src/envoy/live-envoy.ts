/**
 * @module envoy/live-envoy
 *
 * Live game envoy that handles StrategistParameters-specific behavior.
 * Combines special message detection with game context assembly for live game interactions.
 * Provides a get-briefing internal tool for on-demand briefing retrieval.
 */

import { ModelMessage, StepResult, Tool } from "ai";
import { Envoy } from "./envoy.js";
import { StrategistParameters, getGameState } from "../strategist/strategy-parameters.js";
import { EnvoyThread, MessageWithMetadata, SpecialMessageConfig } from "../types/index.js";
import { VoxContext } from "../infra/vox-context.js";
import { jsonToMarkdown } from "../utils/tools/json-to-markdown.js";
import { createBriefingTool } from "../briefer/briefing-utils.js";

/**
 * Envoy specialized for live game sessions with StrategistParameters.
 * Handles special message detection (e.g., {{{Greeting}}}) and assembles
 * game context for conversations. Provides a get-briefing tool for
 * on-demand briefing retrieval and generation.
 *
 * @abstract
 * @class
 */
export abstract class LiveEnvoy extends Envoy<StrategistParameters> {
  /**
   * Allow the LLM to decide when to call tools rather than forcing it
   */
  public override toolChoice: string = "auto";

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
    const messages = this.getContextMessages(parameters, input);

    if (specialConfig) {
      // Special mode: ignore the rest
      messages.push({
        role: "user",
        content: `
# Special Instruction
${specialConfig.prompt}`.trim()
      })
      return messages;
    } else {
      // Normal mode: add hint, the LLM calls get-briefing if it needs detailed context
      messages.push(...this.convertToModelMessages(
        this.filterSpecialMessages(input.messages)
      ));
      messages.push({
        role: "user",
        content: this.getHint(parameters, input)
      });
    }
    return messages;
  }

  /**
   * Restricts the envoy to only the get-briefing tool
   */
  public override getActiveTools(_parameters: StrategistParameters): string[] | undefined {
    return ["get-briefing"];
  }

  /**
   * Provides the get-briefing internal tool for on-demand briefing retrieval.
   * Fetches existing briefings from the current game state, or generates new ones
   * via the specialized-briefer agent if they don't exist.
   */
  public override getExtraTools(context: VoxContext<StrategistParameters>): Record<string, Tool> {
    return { "get-briefing": createBriefingTool(context) };
  }

  /**
   * Disables tools when in special message mode.
   * Special prompts (e.g., greetings) only need text generation, not tool calls.
   */
  public override async prepareStep(
    parameters: StrategistParameters,
    input: EnvoyThread,
    lastStep: StepResult<Record<string, Tool>> | null,
    allSteps: StepResult<Record<string, Tool>>[],
    messages: ModelMessage[],
    context: VoxContext<StrategistParameters>
  ) {
    const config = await super.prepareStep(parameters, input, lastStep, allSteps, messages, context);
    if (this.isSpecialMode(input)) {
      config.activeTools = [];
    }
    return config;
  }

  // Special message detection

  /**
   * Checks if the current interaction is in special message mode.
   * Returns true when the last message is a recognized special message token.
   */
  protected isSpecialMode(input: EnvoyThread): boolean {
    return this.findLastSpecialMessage(input) !== undefined;
  }

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

  // Game context assembly

  /**
   * Returns the game context messages: civilization identity, players, and strategies.
   * Briefings are fetched on-demand via the get-briefing tool rather than injected here.
   */
  protected getContextMessages(parameters: StrategistParameters, input: EnvoyThread): ModelMessage[] {
    const state = getGameState(parameters, parameters.turn);
    if (!state) {
      throw new Error(`No game state available near turn ${parameters.turn}`);
    }
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
