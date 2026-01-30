/**
 * @module strategist/strategist
 *
 * Base strategist agent implementation. All strategists inherit from this class.
 */

import { ModelMessage, StepResult, Tool } from "ai";
import { VoxAgent } from "../infra/vox-agent.js";
import { StrategistParameters } from "./strategy-parameters.js";
import { VoxContext } from "../infra/vox-context.js";

/**
 * Base strategist agent that analyzes the game state and sets an appropriate strategy.
 *
 * @abstract
 * @class
 */
export abstract class Strategist extends VoxAgent<StrategistParameters> {
  /**
   * Prepare the configuration for the next step in the strategist's execution.
   * Includes special handling for corrupted responses without tool calls.
   */
  public async prepareStep(
    parameters: StrategistParameters,
    input: any,
    lastStep: StepResult<Record<string, Tool>> | null,
    allSteps: StepResult<Record<string, Tool>>[],
    messages: ModelMessage[],
    context: VoxContext<StrategistParameters>
  ) {
    // Call the base prepareStep method first
    const config = await super.prepareStep(parameters, input, lastStep, allSteps, messages, context);

    // Special check: if last step doesn't have tool calls, strip its response messages
    if (lastStep && lastStep.toolCalls.length === 0) {
      // Filter out the messages from the last step's response
      const baseMessages = config.messages || messages;
      const responseMessages = lastStep.response.messages;
      const modifiedMessages = baseMessages.filter(
        msg => !responseMessages.some(respMsg => respMsg === msg)
      );

      // Add recovery message to enforce tool calling
      modifiedMessages.push({
        role: 'user',
        content: 'Your previous response did not include any tool calls. Please follow the tool calling format using the available tools.'
      });

      config.messages = modifiedMessages;
    }

    return config;
  }
}