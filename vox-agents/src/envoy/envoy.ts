/**
 * @module envoy/envoy
 *
 * Base envoy agent implementation for chat-based interactions.
 */

import { StepResult, Tool } from "ai";
import { VoxAgent } from "../infra/vox-agent.js";
import { StrategistParameters } from "../strategist/strategy-parameters.js";
import { EnvoyThread } from "../types/index.js";

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
  public getOutput(
    _parameters: StrategistParameters,
    input: EnvoyThread,
    _finalText: string
  ): EnvoyThread {
    return input;
  }

  /**
   * Determines whether the agent should stop execution
   */
  public stopCheck(
    _parameters: StrategistParameters,
    input: EnvoyThread,
    lastStep: StepResult<Record<string, Tool>>,
    allSteps: StepResult<Record<string, Tool>>[]
  ): boolean {
    // Add the message to the record
    lastStep.response.messages.forEach(element => {
      input.messages.push(element);
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