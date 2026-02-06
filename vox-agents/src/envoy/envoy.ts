/**
 * @module envoy/envoy
 *
 * Base envoy agent implementation for chat-based interactions.
 */

import { ModelMessage, StepResult, Tool } from "ai";
import { VoxAgent } from "../infra/vox-agent.js";
import { StrategistParameters } from "../strategist/strategy-parameters.js";
import { EnvoyThread, MessageWithMetadata, Model } from "../types/index.js";
import { VoxContext } from "../infra/vox-context.js";

/**
 * Base envoy agent that can chat with the user.
 * Accepts and returns EnvoyThread for maintaining conversation context.
 *
 * @abstract
 * @class
 */
export abstract class Envoy extends VoxAgent<StrategistParameters, EnvoyThread, EnvoyThread> {
  /**
   * Manually post-process LLM results and send back the output.
   *
   * @param parameters - The execution parameters
   * @param input - The starting input
   * @param finalText - The final generated text
   * @returns True if the agent should stop, false to continue
   */
  public async getOutput(
    _parameters: StrategistParameters,
    input: EnvoyThread,
    _finalText: string
  ): Promise<EnvoyThread> {
    return input;
  }

  /**
   * Orchestrates initial messages with greeting mode support.
   * Empty thread → greeting mode (hint only). Otherwise → full context + history.
   */
  public async getInitialMessages(
    parameters: StrategistParameters,
    input: EnvoyThread,
    _context: VoxContext<StrategistParameters>
  ): Promise<ModelMessage[]> {
    // Greeting mode: empty thread → minimal context for a brief introduction
    if (!input.messages || input.messages.length === 0) {
      return [{ role: "system", content: `
Send out a short message greeting the ${this.formatUserDescription(input)} based on your diplomatic relationship.

${this.getHint(parameters, input)}`.trim() }];
    }

    // Normal mode: full game context + conversation history
    const messages = this.getContextMessages(parameters, input);
    messages.push(...this.convertToModelMessages(input.messages));
    return messages;
  }

  /**
   * Determines whether the agent should stop execution
   */
  public stopCheck(
    parameters: StrategistParameters,
    input: EnvoyThread,
    lastStep: StepResult<Record<string, Tool>>,
    allSteps: StepResult<Record<string, Tool>>[]
  ): boolean {
    // Add the messages to the record with metadata
    const currentTurn = parameters.turn;
    const currentDatetime = new Date();

    lastStep.response.messages.forEach(element => {
      input.messages.push({
        message: element,
        metadata: {
          datetime: currentDatetime,
          turn: currentTurn
        }
      });
    });

    // Continue if we have executed a tool
    for (var step of allSteps) {
      for (const result of step.content) {
        if (result.type === "tool-call") {
          // Unless after 3 steps to prevent infinite loops
          if (allSteps.length >= 3) {
            this.logger.warn("Reached maximum step limit (3), stopping agent");
            return true;
          }
          return false;
        }
      }
    }

    return true;
  }

  // Downstream customization
  /**
   * Returns a short contextual reminder that anchors the LLM on its role,
   * audience, and current turn. Used as the sole user message in greeting mode,
   * and typically appended to game state messages in normal mode.
   */
  protected abstract getHint(parameters: StrategistParameters, input: EnvoyThread): string;

  /**
   * Returns the full game context messages (identity, situation, game state).
   * Should NOT include thread conversation history — that is handled by the base class.
   */
  protected abstract getContextMessages(parameters: StrategistParameters, input: EnvoyThread): ModelMessage[];

  // Utilities
  /**
   * Converts an array of MessageWithMetadata to ModelMessage array.
   * Formats turn information into the message content for user messages.
   *
   * @param messages - Array of messages with metadata
   * @returns Array of ModelMessage objects
   */
  protected convertToModelMessages(messages: MessageWithMetadata[]): ModelMessage[] {
    return messages.map(item => {
      const message = { ...item.message };
      // Format turn into messages for context
      if (typeof message.content === 'string') {
        message.content = `[Turn ${item.metadata.turn}] ${message.content}`;
      }
      return message;
    });
  }

  /**
   * Formats a description of the user based on their identity.
   * Returns a readable string like "a diplomat representing Bismarck of Germany" or "a foreign observer".
   */
  protected formatUserDescription(input: EnvoyThread): string {
    if (!input.userIdentity) return 'an unknown participant';
    const parts = [input.userIdentity.role || 'a participant'];
    if (input.userIdentity.displayName && input.userIdentity.displayName !== 'Observer') {
      parts.push(`representing ${input.userIdentity.displayName}`);
    }
    return parts.join(' ');
  }
}