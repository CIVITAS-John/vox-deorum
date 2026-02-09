/**
 * @module envoy/envoy
 *
 * Generic base envoy agent for chat-based interactions.
 * Parameterized over TParameters to allow specialization for different game contexts.
 */

import { ModelMessage, StepResult, Tool } from "ai";
import { VoxAgent, AgentParameters } from "../infra/vox-agent.js";
import { EnvoyThread, MessageWithMetadata, SpecialMessageConfig } from "../types/index.js";

/**
 * Generic base envoy agent that can chat with the user.
 * Accepts and returns EnvoyThread for maintaining conversation context.
 * Subclasses specialize for specific parameter types (e.g., LiveEnvoy for StrategistParameters).
 *
 * @abstract
 * @class
 */
export abstract class Envoy<TParameters extends AgentParameters = AgentParameters>
  extends VoxAgent<TParameters, EnvoyThread, EnvoyThread> {

  /**
   * Manually post-process LLM results and send back the output.
   */
  public async getOutput(
    _parameters: TParameters,
    input: EnvoyThread,
    _finalText: string
  ): Promise<EnvoyThread> {
    return input;
  }

  /**
   * Determines whether the agent should stop execution.
   * Adds response messages to the thread with metadata and limits tool-call loops.
   */
  public stopCheck(
    parameters: TParameters,
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

  // Special messages
  /**
   * Returns the map of special message tokens to their configurations.
   * Special messages are triple-brace-enclosed tokens (e.g., "{{{Greeting}}}") that
   * trigger specific agent behavior without appearing as user messages.
   * Override in concrete subclasses to define supported special messages.
   */
  protected abstract getSpecialMessages(): Record<string, SpecialMessageConfig>;

  /**
   * Checks if a message string is a registered special message token.
   */
  protected isSpecialMessage(message: string): boolean {
    return message in this.getSpecialMessages();
  }

  // Utilities
  /**
   * Converts an array of MessageWithMetadata to ModelMessage array.
   * Formats turn information into the message content for user messages.
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
