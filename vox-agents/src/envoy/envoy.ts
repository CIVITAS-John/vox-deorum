/**
 * @module envoy/envoy
 *
 * Base envoy agent implementation for chat-based interactions.
 */

import { ModelMessage, StepResult, Tool } from "ai";
import { VoxAgent } from "../infra/vox-agent.js";
import { StrategistParameters } from "../strategist/strategy-parameters.js";
import { EnvoyThread, MessageWithMetadata } from "../types/index.js";

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
}